#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""同步旧服务器 uploads（商品图片等）到新服务器。"""
import os
import sys
import paramiko

OLD = dict(host="121.40.219.139", user="root", pwd="Wrn123456")
NEW = dict(host="47.99.142.184", user="root", pwd="Wcy123456")
LOCAL_TAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads.tar.gz")


def connect(host, user, pwd):
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(host, port=22, username=user, password=pwd, timeout=25, banner_timeout=25)
    return cli


def run(cli, cmd, timeout=3600):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return stdout.channel.recv_exit_status(), out, err


def main():
    print("== 1. 旧服务器打包 uploads ==", flush=True)
    old = connect(OLD["host"], OLD["user"], OLD["pwd"])
    code, out, err = run(old, "cd /www/wwwroot/campus-trade-server && tar czf /tmp/uploads.tar.gz uploads && ls -lh /tmp/uploads.tar.gz && echo PACK_RC=$?")
    print(out, err, flush=True)
    print("== 2. 下载到本地（413MB，耗时较长）==", flush=True)
    sftp = old.open_sftp()
    sftp.get("/tmp/uploads.tar.gz", LOCAL_TAR)
    sftp.close()
    old.close()
    print("local_MB=%.1f" % (os.path.getsize(LOCAL_TAR) / 1024 / 1024), flush=True)

    print("== 3. 上传新服务器并解压 ==", flush=True)
    new = connect(NEW["host"], NEW["user"], NEW["pwd"])
    sftp = new.open_sftp()
    sftp.put(LOCAL_TAR, "/tmp/uploads.tar.gz")
    sftp.close()
    code, out, err = run(new, "cd /www/wwwroot/campus-trade-server && tar xzf /tmp/uploads.tar.gz && echo EXTRACT_RC=$?; du -sh uploads; ls uploads | wc -l")
    print(out, err, flush=True)
    new.close()
    print("UPLOADS_SYNC_DONE")


if __name__ == "__main__":
    sys.exit(main())
