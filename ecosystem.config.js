// PM2 설정 파일
//
// [VPS 최초 실행]
// pm2 start ecosystem.config.js
// pm2 save          ← 재부팅 후 자동 복구 등록
// pm2 startup       ← 출력된 명령어 복사해서 실행
//
// [배포 후 재시작]
// pm2 reload yjs-erp
//
// [로그 확인]
// pm2 logs yjs-erp
// pm2 monit

module.exports = {
  apps: [
    {
      name: 'yjs-erp',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/yjs_erp',   // ← VPS 실제 경로로 수정
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/yjs-erp-error.log',
      out_file: '/var/log/pm2/yjs-erp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
