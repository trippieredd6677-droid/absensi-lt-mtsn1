# Deploy — Absensi LT

Opsi: VPS Ubuntu 20.04 ($5-15) / PaaS Render/Railway / On-prem. Repo ada render.yaml (single origin).

## VPS 11 langkah
1 ssh root@ip | 2 apt update && apt install curl git build-essential
3 Node18: curl -fsSL https://deb.nodesource.com/setup_18.x | bash; apt install nodejs
4 Postgres: apt install postgresql; systemctl enable postgresql; sudo -u postgres psql → CREATE USER absensi WITH PASSWORD 'xxx'; CREATE DATABASE absensi_mtsn1 OWNER absensi;
5 Nginx: apt install nginx
6 Clone: cd /var/www; git clone <repo> absensi-mtsn1; cd absensi-mtsn1; cp .env.example .env; nano .env
   PORT=5001 NODE_ENV=production CLIENT_URL=https://domain.id DB_* / DATABASE_URL JWT_SECRET(32+) ADMIN_PASSWORD GURU_DEFAULT_PASSWORD EMAIL_*
7 Build: npm install --production; cd client; npm install; npm run build; cd ..
8 DB: npm run setup-db
9 PM2: npm i -g pm2; cat > ecosystem.config.js (script server/index.js, env PORT 5001) → pm2 start; pm2 save
10 Nginx: /etc/nginx/sites-available/absensi → upstream 127.0.0.1:5001; location / → root client/dist try_files; location /api → proxy_pass; location /uploads → root absensi-mtsn1; ln -s sites-enabled; nginx -t; systemctl restart nginx
11 SSL: apt install certbot python3-certbot-nginx; certbot --nginx -d domain.id; ufw allow 22,80,443

Backup: /usr/local/bin/backup-absensi.sh → pg_dump absensi_mtsn1 | gzip > /var/backups/absensi_$DATE.sql.gz; cron 0 2 * * *

Security checklist: ganti admin pass, JWT 32+, DB pass kuat, SSL, firewall, backup, CCTV rate-limit, CORS hanya CLIENT_URL, foto private.

Update: git pull; npm install; cd client && npm run build; npm run setup-db; pm2 restart absensi-backend
