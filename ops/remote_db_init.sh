#!/bin/bash
# 初始化：pm2 重装 + MySQL 建库/设 root 密码
set -e
echo "== 1. 重装 pm2 =="
npm install -g pm2 --registry=https://registry.npmmirror.com 2>&1 | tail -3
which pm2 || true
pm2 -v 2>/dev/null || echo "pm2 仍失败"

echo "== 2. MySQL root 密码 + 建库 =="
mysql -uroot <<'SQL'
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Wcy123456!';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS campus_trade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES LIKE 'campus_trade';
SQL
echo "== 3. 验证 root 密码登录 =="
mysql -uroot -p'Wcy123456!' -e "SELECT VERSION(); SHOW DATABASES LIKE 'campus_trade';" 2>&1 | tail -4
echo "DB_INIT_DONE"
