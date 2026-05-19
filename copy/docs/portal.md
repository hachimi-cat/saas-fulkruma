---
title: Portal tour
---

# Portal tour

![Plugipay family portal: dashboard](/docs-img/portal/dashboard.png)


The Fulkruma portal at [fulkruma.com/dashboard](https://fulkruma.com/dashboard) is your day-to-day workspace. This section walks through every page in the dashboard with common tasks and tips.

If you're looking for a specific feature, jump straight to it from the sidebar. If you're new, read through this overview first.

## Layout

The portal has three main regions:

1. **Sidebar (left)** &mdash; primary navigation. Sections: Warehouses, Products, Stock, Reservations, Movements, Shipping, Shipments, Deliveries, Licenses, Addresses, API keys, Webhooks, Audit log, Workspaces, Settings, Billing.
2. **Top bar** &mdash; workspace switcher, search, notifications, account menu.
3. **Main content** &mdash; the page you're on.

The sidebar collapses on mobile and narrow viewports.

## The dashboard home

The default landing page is `/dashboard`. It shows:

- **Counters** &mdash; warehouses, products, total stock units, shipments in transit, low-stock variants.
- **Recent activity** &mdash; the last few stock movements, shipment status changes, and license activations.
- **Integrations health** &mdash; whether Huudis, Biteship, Plugipay, and Storlaunch are wired up correctly. Click any of them to jump to the relevant settings page.

The counters are refreshed on each page load &mdash; they're cheap to compute since stock and shipment status are denormalized into per-workspace aggregates.

## Workspace switching

Top-left chip shows the active workspace. Click to:

- Switch to another workspace you're a member of
- View workspace settings

Switching is instant &mdash; no page reload.

If you have both a direct-sign-up workspace (`usr_…`) and one provisioned by Storlaunch (`acc_…`), they appear as separate entries. The currently-active one is highlighted.

## Common tasks &mdash; quick links

| Task | Where |
|---|---|
| Add a new warehouse | [Warehouses &rarr; New](/docs/portal/warehouses) |
| Add a product | [Products &rarr; New](/docs/portal/products) |
| Adjust stock | [Stock &rarr; Adjust](/docs/portal/products) |
| Create a shipment | [Shipments &rarr; New](/docs/portal/shipments) |
| Configure Biteship | [Settings &rarr; Integrations](/docs/portal) |
| Create an API key | [Settings &rarr; API keys](/docs/portal) |
| Configure a webhook | [Settings &rarr; Webhooks](/docs/portal) |
| View billing | [Settings &rarr; Billing](/docs/portal) |

## Test vs live

Fulkruma doesn't have a strict test/live split the way Plugipay does &mdash; stock movements and shipments are inherently linked to real-world inventory, so there's no "fake" mode. Instead:

- If you haven't configured Biteship, `shipments.create` records a local placeholder and doesn't book a courier. This is the "dev mode" until you connect Biteship.
- For SDK and API integration testing, request a **staging** workspace by emailing hello@fulkruma.com. It runs against `staging.fulkruma.com` with separate keys and data.

## Coming pages

The portal section currently covers three core areas:

- [**Warehouses**](/docs/portal/warehouses) &mdash; setting up locations.
- [**Products & stock**](/docs/portal/products) &mdash; the catalog and the stock ledger.
- [**Shipments**](/docs/portal/shipments) &mdash; the shipment + delivery flow.

Deeper pages (deliveries, licenses, API keys, webhooks, settings, billing) will land in subsequent sessions. The dashboard itself has contextual help on most pages &mdash; look for the **?** icon in the top-right.

## Next

- [**Warehouses**](/docs/portal/warehouses) &mdash; setting up your first location.
- [**API overview**](/docs/api) &mdash; do the same things programmatically.
