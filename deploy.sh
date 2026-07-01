#!/bin/bash
set -e

# FoxNOC360 Setup Script for Hostinger VPS (Ubuntu)
# Run this on your server as root

# Configuration (Edit these before running)
FRONTEND_DOMAIN="foxnoc360.com"
BACKEND_DOMAIN="api.foxnoc360.com"
EMAIL="admin@foxnoc360.com" # For Let's Encrypt SSL

echo "🚀 Starting FoxNOC360 Deployment on Hostinger VPS..."

# 1. System Updates & Dependencies
echo "📦 Installing required dependencies..."
apt-get update
apt-get install -y docker.io docker-compose git nginx certbot python3-certbot-nginx

systemctl enable docker
systemctl start docker

# 2. Setup Nginx Reverse Proxy
echo "🌐 Configuring Nginx for ${FRONTEND_DOMAIN} and ${BACKEND_DOMAIN}..."
cat > /etc/nginx/sites-available/foxnoc360 <<EOF
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
server {
    listen 80;
    server_name ${BACKEND_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/foxnoc360 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# 3. Pull code & Deploy Containers
echo "🐳 Deploying application containers..."
export FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
export BACKEND_DOMAIN=${BACKEND_DOMAIN}

# Assuming code is cloned to /opt/foxnoc360, but if this script is in the repo, we use the current dir
cd "$(dirname "$0")"

# We must map port 3000 and 8000 to the host so Nginx can proxy to them
export COMPOSE_FILE=docker-compose.production.yml
# Expose ports for Nginx
sed -i '/backend:/a \    ports:\n      - "127.0.0.1:8000:8000"' docker-compose.production.yml
sed -i '/frontend:/a \    ports:\n      - "127.0.0.1:3000:3000"' docker-compose.production.yml

docker-compose up -d --build

# 4. SSL Certificates
echo "🔒 Requesting SSL certificates from Let's Encrypt..."
certbot --nginx -d ${FRONTEND_DOMAIN} -d ${BACKEND_DOMAIN} --non-interactive --agree-tos -m ${EMAIL} || echo "⚠️  SSL setup skipped or failed. Ensure your DNS points to this server."

echo "✅ Deployment finished successfully!"
echo "Frontend: https://${FRONTEND_DOMAIN}"
echo "Backend:  https://${BACKEND_DOMAIN}"
