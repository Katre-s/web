#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""新服务器 47.99.142.184 部署：后端代码 + .env + 依赖 + pm2 + 前端 dist + nginx。

配置要点（本次要求）：
- 注册收发邮件邮箱：danallextest@163.com
- AI 接口先不接：AI_API_KEY / CHAT_API_KEY 留空（自动降级规则引擎）
"""
import os
import posixpath
import sys
import tarfile
import io
import paramiko

HOST = "47.99.142.184"
USER = "root"
PWD = "Wcy123456"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # campus-trade 根
SERVER_DIR = os.path.join(ROOT, "server")
DIST_DIR = os.path.join(ROOT, "web", "dist")
REMOTE_SERVER = "/www/wwwroot/campus-trade-server"
REMOTE_WEB = "/www/wwwroot/xiaoxianyu-web"

ENV_CONTENT = """PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=campus_trade
DB_USER=root
DB_PASSWORD=Wcy123456!
DB_SYNC_ALTER=false

JWT_SECRET=xiaoxianyu_new_server_2026_secret
JWT_EXPIRES=7d

UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

OPEN_LIBRARY_URL=https://openlibrary.org/api/books
GOOGLE_BOOKS_URL=https://www.googleapis.com/books/v1/volumes

BAIDU_OCR_API_KEY=
BAIDU_OCR_SECRET_KEY=

# AI 接口暂不接入（留空自动降级规则引擎）
AI_API_KEY=
AI_API_URL=https://api.siliconflow.cn/v1/chat/completions
AI_MODEL=zai-org/GLM-5.3-Flash
CHAT_API_URL=https://api.siliconflow.cn/v1/chat/completions
CHAT_API_KEY=
CHAT_API_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
AGENT_TOOL_MODE=hybrid

# 注册/找回密码邮件：新邮箱
MAIL_HOST=smtp.163.com
MAIL_PORT=465
MAIL_USER=danallextest@163.com
MAIL_PASS=TAuQem8b6EKFJCpr

WEATHER_DEFAULT_LAT=34.2538
WEATHER_DEFAULT_LON=117.2264
WEATHER_DEFAULT_CITY=徐州云龙区
"""

NGINX_CONF = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /www/wwwroot/xiaoxianyu-web;
    index index.html;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        access_log off;
    }
}
"""


def connect():
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, port=22, username=USER, password=PWD, timeout=25, banner_timeout=25)
    return cli


def run(cli, cmd, timeout=1800):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def make_tar(src_dir, prefix_name, excludes):
    """把目录打包成 tar.gz 字节流。"""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = [d for d in dirs if d not in excludes]
            for f in files:
                if f in excludes:
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src_dir)
                tar.add(full, arcname=posixpath.join(prefix_name, rel.replace("\\", "/")))
    buf.seek(0)
    return buf


def main():
    cli = connect()
    sftp = cli.open_sftp()

    print("== 1. 上传后端代码 ==", flush=True)
    run(cli, "mkdir -p %s" % REMOTE_SERVER)
    buf = make_tar(SERVER_DIR, "server", excludes={"node_modules", "deploy", ".env", ".git", "uploads"})
    sftp.putfo(buf, "/tmp/server_src.tar.gz")
    code, out, err = run(cli, "cd %s && tar -xzf /tmp/server_src.tar.gz --strip-components=1 && ls" % REMOTE_SERVER)
    print(out[-600:], flush=True)

    print("== 2. 写 .env ==", flush=True)
    with sftp.open(REMOTE_SERVER + "/.env", "w") as f:
        f.write(ENV_CONTENT)
    run(cli, "mkdir -p %s/uploads && chmod 600 %s/.env" % (REMOTE_SERVER, REMOTE_SERVER))

    print("== 3. 安装后端依赖 ==", flush=True)
    code, out, err = run(cli, "cd %s && npm install --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com 2>&1 | tail -5" % REMOTE_SERVER, timeout=2400)
    print(out, flush=True)

    print("== 4. pm2 启动后端 ==", flush=True)
    code, out, err = run(cli, "cd %s && (pm2 delete campus-api 2>/dev/null; pm2 start src/app.js --name campus-api && pm2 save) 2>&1 | tail -8" % REMOTE_SERVER)
    print(out, flush=True)

    print("== 5. 上传前端 dist ==", flush=True)
    run(cli, "mkdir -p %s" % REMOTE_WEB)
    buf2 = make_tar(DIST_DIR, "dist", excludes=set())
    sftp.putfo(buf2, "/tmp/web_dist.tar.gz")
    code, out, err = run(cli, "cd %s && tar -xzf /tmp/web_dist.tar.gz --strip-components=1 && ls | head" % REMOTE_WEB)
    print(out, flush=True)

    print("== 6. 配置 nginx ==", flush=True)
    with sftp.open("/tmp/xiaoxianyu_nginx.conf", "w") as f:
        f.write(NGINX_CONF)
    cmd = ("cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak 2>/dev/null; "
           "cp /tmp/xiaoxianyu_nginx.conf /etc/nginx/sites-available/default && ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default && "
           "nginx -t && systemctl reload nginx && echo NGINX_OK")
    code, out, err = run(cli, cmd)
    print(out, err, flush=True)

    print("== 7. 健康检查 ==", flush=True)
    code, out, err = run(cli, "sleep 3; curl -s -m 5 http://127.0.0.1:3000/api/health; echo; curl -s -o /dev/null -w 'nginx_root_http=%{http_code}\\n' http://127.0.0.1/; pm2 list | head -8")
    print(out, flush=True)

    sftp.close()
    cli.close()
    print("DEPLOY_DONE")


if __name__ == "__main__":
    sys.exit(main())
