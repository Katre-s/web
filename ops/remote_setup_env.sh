#!/bin/bash
# 新服务器环境安装：apt 阿里源 + nginx + MySQL + Node20 + pm2
set -e
export DEBIAN_FRONTEND=noninteractive

echo "== 1. 配置阿里云 apt 源 =="
if [ ! -f /etc/apt/sources.list.bak ]; then
  cp /etc/apt/sources.list /etc/apt/sources.list.bak
fi
cat > /etc/apt/sources.list <<'EOF'
deb http://mirrors.aliyun.com/ubuntu/ jammy main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ jammy-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ jammy-backports main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ jammy-security main restricted universe multiverse
EOF
apt-get update -qq

echo "== 2. 安装 nginx / mysql-server / 工具 =="
apt-get install -y -qq nginx mysql-server curl xz-utils >/dev/null
nginx -v 2>&1
mysql --version

echo "== 3. 安装 Node 20（阿里云镜像二进制包）=="
cd /tmp
if [ ! -d /usr/local/node-v20.18.0-linux-x64 ]; then
  curl -fsSL -o node.tar.xz https://mirrors.aliyun.com/nodejs-release/v20.18.0/node-v20.18.0-linux-x64.tar.xz
  tar -xJf node.tar.xz -C /usr/local/
fi
ln -sf /usr/local/node-v20.18.0-linux-x64/bin/node /usr/local/bin/node
ln -sf /usr/local/node-v20.18.0-linux-x64/bin/npm /usr/local/bin/npm
ln -sf /usr/local/node-v20.18.0-linux-x64/bin/npx /usr/local/bin/npx
node -v
npm -v

echo "== 4. 安装 pm2（淘宝 npm 镜像）=="
npm config set registry https://registry.npmmirror.com
npm install -g pm2 --silent
pm2 -v || echo "pm2 未安装成功，稍后重试"

echo "== 5. 启动服务 =="
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx
systemctl enable mysql >/dev/null 2>&1 || true
systemctl restart mysql
sleep 2
ss -tlnp | grep -E ':80|:3306' || true

echo "== 6. 内存/磁盘 =="
free -m | head -2
df -h / | tail -1
echo "SETUP_DONE"
