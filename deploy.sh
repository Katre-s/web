#!/usr/bin/env bash
# 文衡 - 宝塔服务器一键部署脚本
# 用法：把 server-src-update.tar.gz、frontend-dist.tar.gz 和本脚本上传到 /www/wwwroot/ 后执行
#   bash /www/wwwroot/deploy.sh
set -euo pipefail

APP_DIR=/www/wwwroot/campus-trade-server      # 后端目录（src 在里面）
WEB_DIR=/www/wwwroot/121.40.219.139           # 前端站点根目录
PKG_DIR=/www/wwwroot                          # 两个 tar.gz 所在目录
BACKUP_DIR=/www/wwwroot/backup                # 备份目录
PM2_NAME=campus-api
TS=$(date +%Y%m%d_%H%M%S)

echo "==> 1/5 备份"
mkdir -p "$BACKUP_DIR"
if [ -d "$APP_DIR/src" ]; then
  tar -czf "$BACKUP_DIR/src-backup-$TS.tar.gz" -C "$APP_DIR" src
  echo "    $BACKUP_DIR/src-backup-$TS.tar.gz"
fi
if [ -d "$WEB_DIR" ]; then
  tar -czf "$BACKUP_DIR/frontend-backup-$TS.tar.gz" -C "$WEB_DIR" .
  echo "    $BACKUP_DIR/frontend-backup-$TS.tar.gz"
fi

echo "==> 2/5 解压后端源码到 $APP_DIR/src"
tar -xzf "$PKG_DIR/server-src-update.tar.gz" -C "$APP_DIR/src"

echo "==> 3/5 重启后端"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
  sleep 3
  pm2 list | grep "$PM2_NAME" || true
else
  echo "    !! 找不到 pm2，请到宝塔「PM2管理器」里重启 $PM2_NAME"
fi

echo "==> 4/5 解压前端到 $WEB_DIR"
tar -xzf "$PKG_DIR/frontend-dist.tar.gz" -C "$WEB_DIR"

echo "==> 5/5 验证"
curl -s -m 8 http://127.0.0.1:3000/api/health; echo
curl -s -o /dev/null -w "首页 HTTP %{http_code}\n" http://127.0.0.1/
echo
echo "完成。回滚命令："
echo "  tar -xzf $BACKUP_DIR/src-backup-$TS.tar.gz -C $APP_DIR && pm2 restart $PM2_NAME"
echo "  tar -xzf $BACKUP_DIR/frontend-backup-$TS.tar.gz -C $WEB_DIR"
