#!/usr/bin/env bash
# Bootstrap a fulkruma dev environment from scratch.
#
# Idempotent — safe to re-run. Brings local Postgres + schema + seed
# into the state expected by the portal + backend.
#
# Staging/prod use a different invocation:
#   - Postgres is provisioned out-of-band (managed DB / DO).
#   - DATABASE_URL is set via the deploy unit (systemd EnvironmentFile).
#   - Skip the role/database creation block below.
#   - `npm run prisma:deploy` instead of `prisma migrate dev`.
#   - DON'T run seed — production has real data.
set -euo pipefail

cd "$(dirname "$0")/.."

# ─── Config ─────────────────────────────────────────────────────────
SECRETS_FILE="${FULKRUMA_SECRETS_FILE:-/root/.config/forjio/fulkruma-secrets.env}"
DB_PASS_FILE="${FULKRUMA_DB_PASS_FILE:-/root/.config/forjio/fulkruma-db-pass.txt}"
DB_NAME="${FULKRUMA_DB_NAME:-fulkruma}"
DB_USER="${FULKRUMA_DB_USER:-fulkruma}"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "[bootstrap] $SECRETS_FILE missing — write env first." >&2
  exit 1
fi

# ─── Step 1: provision Postgres role + db (local dev only) ──────────
if [[ "${ENVIRONMENT:-development}" == "development" ]]; then
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    echo "[bootstrap] creating role $DB_USER..."
    DB_PASS="$(openssl rand -hex 16)"
    sudo -u postgres psql <<SQL
CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
ALTER ROLE $DB_USER CREATEDB;
SQL
    echo "$DB_PASS" > "$DB_PASS_FILE"
    chmod 600 "$DB_PASS_FILE"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    echo "[bootstrap] creating database $DB_NAME..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  fi
  if [[ -f "$DB_PASS_FILE" ]]; then
    DB_PASS="$(cat "$DB_PASS_FILE")"
    DB_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
    if ! grep -q "^DATABASE_URL=$DB_URL$" "$SECRETS_FILE"; then
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" "$SECRETS_FILE"
      echo "[bootstrap] DATABASE_URL written to $SECRETS_FILE"
    fi
  fi
fi

# Source env so prisma + node see DATABASE_URL.
set -a; source "$SECRETS_FILE"; set +a

# ─── Step 2: install backend deps + prisma + migrate ─────────────────
echo "[bootstrap] backend deps..."
( cd backend && npm install --silent )

echo "[bootstrap] prisma migrate..."
( cd backend && npx prisma migrate "${MIGRATE_CMD:-dev}" --skip-seed )

# ─── Step 3: install frontend deps ───────────────────────────────────
echo "[bootstrap] frontend deps..."
( cd frontend && npm install --silent )

# ─── Step 4: seed (dev only) ─────────────────────────────────────────
if [[ "${SEED_DATA:-1}" == "1" && "${ENVIRONMENT:-development}" == "development" ]]; then
  echo "[bootstrap] seed dev data..."
  ( cd backend && npm run prisma:seed )
fi

echo "[bootstrap] done. Start the apps with:"
echo "  cd backend  && npm run dev   # :4140"
echo "  cd frontend && npm run dev   # :3140"
