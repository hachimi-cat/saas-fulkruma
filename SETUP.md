# Bootstrapping a New Forjio Product

Checklist for turning this template into a real product.

## 1. Repo

```bash
gh repo create hachimi-cat/<brand> --template=hachimi-cat/forjio-service-template --public \
  --description "<One-line product description>"
git clone git@github.com:hachimi-cat/<brand>.git
cd <brand>
```

## 2. Replace placeholders

Search + replace across the repo:

| Placeholder | Example |
|---|---|
| `FORJIO_BRAND` | `huudis` |
| `forjio-brand` | `huudis` |
| `Forjio Brand` | `Huudis` |
| `brand.com` | `huudis.com` |
| `brand.forjio.com` | `huudis.forjio.com` |

Or just run `./scripts/bootstrap.sh <brand>` (TODO: add once we've run
this manually once and know the exact sed incantation).

## 3. Rename package names

- `backend/package.json` → `name: "@forjio/<brand>-backend"` (or drop the
  name; it's private)
- `frontend/package.json` → `name: "@forjio/<brand>-frontend"` (or drop)
- `cli/package.json` → `name: "@forjio/<brand>-cli"` (this one matters —
  it's published to npm)
- `cli/bin/cli.js` → rename shebang binary to match: `"<brand>"`

## 4. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL + HUUDIS_ISSUER + HUUDIS_AUDIENCE (your new brand)
npm install
npx prisma migrate dev --name init
npm run dev
curl http://localhost:4000/api/v1/health
# → { "data": { "service": "forjio-brand", "status": "ok" }, ... }
```

## 5. Frontend setup

```bash
cd ../frontend
cp .env.example .env.local
# Fill in NEXT_PUBLIC_API_URL + NEXT_PUBLIC_OIDC_ISSUER + NEXT_PUBLIC_OIDC_CLIENT_ID
npm install
npm run dev
open http://localhost:3000
```

## 6. CLI setup

```bash
cd ../cli
npm install
npm run build
node dist/index.js auth whoami
```

## 7. Register as an OIDC client in Huudis

Once Huudis is live (M1+), register this product as an OAuth client:

```bash
huudis iam create-client \
  --name "<Brand>" \
  --redirect-uri "https://<brand>.com/callback" \
  --redirect-uri "https://<brand>.forjio.com/callback" \
  --scope "openid profile email <brand>:admin"
```

Copy the client ID + secret into `frontend/.env` and `backend/.env`.

## 8. DNS + SSL

```bash
# On the target droplet:
sudo certbot --nginx -d <brand>.com -d www.<brand>.com -d <brand>.forjio.com
# nginx config goes under /etc/nginx/sites-enabled/<brand>.com
# See existing Storlaunch setup for the pattern.
```

## 9. CI/CD

The shipped `.github/workflows/ci.yml` runs lint+test+build on every push.
Add a `ci-cd.yml` derived from Storlaunch's existing workflow for the
deploy path (rsync + pm2 restart). Not templated because
droplet/nginx/systemd specifics differ per product.

## 10. Deploy first version

```bash
# after CI passes and the nginx config is live
git push origin master  # triggers CI; manually deploy first time
```

Then iterate.

## 11. Read the ADRs

Every architectural question is answered in the
[forjio-architecture](https://github.com/hachimi-cat/forjio-architecture)
repo. When in doubt, check there before inventing a new pattern.
