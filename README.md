# Fulkruma

[![pipeline status](https://depllo.forjio.com/api/v1/public/badges/54a1512e236058de16b497a286e76299/pipeline.svg)](https://depllo.forjio.com/dashboard/projects/proj_01kxjh5zm6rm8sr3r0hyywrfev)

Stock + warehouses + shipping for the Forjio commerce family.
M5 in the [Forjio micro-SaaS roadmap](https://github.com/hachimi-cat/forjio-architecture/blob/master/ROADMAP.md).

- Domain: [fulkruma.com](https://fulkruma.com) + `fulkruma.forjio.com`
- Auth: Huudis SSO (workspace `Fulkruma`)
- Payment: Plugipay (Pattern 2 partner billing)
- Storefront integration: consumed by Storlaunch as a module

## What it does

- **Inventory** — multi-warehouse stock per variant, movements, reservations
- **Shipping** — Biteship adapter (Indonesian couriers); Shipment + ShipmentEvent
- **Addresses** — buyer address book per merchant
- **Delivery & licenses** — digital + physical fulfilment

Pricing (locked, see `forjio-architecture/PRICING.md`): 50 orders free /
299k / 799k / 1.999k IDR per month.

## Repo shape

```
backend/     Express + Prisma + Vitest. Port 4140 in dev.
frontend/    Next.js 15 App Router. Port 3140 in dev.
cli/         Commander-based CLI. Publishes as @forjio/fulkruma-cli.
e2e/         Playwright.
```

## Local dev

```bash
# backend
cd backend && cp .env.example .env && npm install
npx prisma migrate dev --name init && npm run dev   # :4140

# frontend
cd ../frontend && cp .env.example .env.local && npm install
npm run dev                                          # :3140

# cli
cd ../cli && npm install && npm run build
node dist/index.js auth whoami
```

## Architecture

See `CLAUDE.md` in this repo for the bounded context + non-negotiables.
Cross-service decisions live in
[forjio-architecture](https://github.com/hachimi-cat/forjio-architecture).
