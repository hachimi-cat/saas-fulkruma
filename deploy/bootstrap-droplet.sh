#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 DO droplet for Fulkruma.
#
# Per `reference_forjio_deploy_playbook.md`:
#   1. DEBIAN_FRONTEND=noninteractive to suppress needrestart TTY prompts.
#   2. 2GB swap BEFORE first npm ci (1GB droplets OOM during the
#      frontend build otherwise).
#   3. Postgres 16 + ufw + nginx (NO certbot --nginx yet — that needs
#      the cert first; we use certbot --standalone in step 7).
#   4. Node 22 LTS via NodeSource.
#   5. pm2 globally so the deploy script can start services.
#   6. Postgres role + DB for fulkruma.
#   7. Per-service env file at /etc/fulkruma/secrets.env (chmod 600,
#      consumed by systemd EnvironmentFile or pm2 --env-file).
#
# This script is idempotent — re-running on an already-bootstrapped
# droplet only creates missing pieces.
#
# Invoke from dev-machine via:
#   ssh root@<ip> "export DEBIAN_FRONTEND=noninteractive FULKRUMA_DB_PASS='<pass>'; bash -s" < deploy/bootstrap-droplet.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "[bootstrap] === apt update + base packages ==="
apt-get update -y -q
apt-get install -y -q --no-install-recommends \
  curl ca-certificates gnupg lsb-release \
  build-essential git \
  postgresql-16 postgresql-client-16 \
  nginx \
  certbot python3-certbot-nginx \
  ufw rsync

echo "[bootstrap] === 2GB swap (idempotent) ==="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "[bootstrap] === Node 22 LTS ==="
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
npm i -g pm2 >/dev/null

echo "[bootstrap] === Postgres role + db (fulkruma) ==="
DB_PASS="${FULKRUMA_DB_PASS:-}"
if [ -z "$DB_PASS" ]; then
  echo "[bootstrap] FULKRUMA_DB_PASS not provided — generating one"
  DB_PASS="$(openssl rand -hex 16)"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='fulkruma'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE fulkruma WITH LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='fulkruma'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE fulkruma OWNER fulkruma;"

# Persist DB password into the secrets file so the deploy step can read it.
mkdir -p /etc/fulkruma
chmod 700 /etc/fulkruma
if [ ! -f /etc/fulkruma/db-pass ]; then
  echo "$DB_PASS" > /etc/fulkruma/db-pass
  chmod 600 /etc/fulkruma/db-pass
fi

echo "[bootstrap] === pm2 startup + log dirs ==="
pm2 startup systemd -u root --hp /root >/dev/null || true
mkdir -p /opt/fulkruma /var/log/fulkruma
chown -R root:root /opt/fulkruma /var/log/fulkruma

echo "[bootstrap] === ufw — allow 22/80/443 ==="
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo "[bootstrap] done. Next: scp /etc/fulkruma/secrets.env into place + certbot --standalone."
