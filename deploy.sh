#!/bin/bash
# deploy.sh — yjs-erp VPS 배포 스크립트
#
# [최초 실행 전 준비]
# chmod +x deploy.sh
#
# [사용법]
# ./deploy.sh
#
# [전제 조건]
# - VPS에 Node.js, PM2 설치됨
# - PROJECT_DIR에 git clone 완료
# - .env.production 파일이 PROJECT_DIR에 존재 (git 비추적 파일)
# - PM2에 yjs-erp 앱이 등록되어 있음 (최초 1회: pm2 start ecosystem.config.js)

set -e  # 오류 발생 시 즉시 중단

PROJECT_DIR="/var/www/yjs_erp"   # ← VPS 실제 경로로 수정
APP_NAME="yjs-erp"

echo "=============================="
echo " yjs-erp 배포 시작"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================="

cd "$PROJECT_DIR"

echo ""
echo "[1/4] git pull"
git pull origin main

echo ""
echo "[2/4] npm install"
npm install --omit=dev

echo ""
echo "[3/4] npm run build"
npm run build

echo ""
echo "[4/4] pm2 reload"
pm2 reload "$APP_NAME"

echo ""
echo "=============================="
echo " 배포 완료"
echo " 상태 확인: pm2 status"
echo " 로그 확인: pm2 logs $APP_NAME --lines 50"
echo "=============================="
