---
title: Concepts
---

# Concepts

This page covers the building blocks of Fulkruma: what each object is, how they relate to each other, and the lifecycle they go through. Read this before you go deep on any specific feature &mdash; the rest of the docs assume you know what a *shipment* is and how it differs from a *delivery*.

## The data model

```
Workspace (account)
  ├── Warehouses
  │     └── Variant stock
  │           └── Stock movements
  │           └── Stock reservations
  ├── Products
  │     └── Variants
  ├── Customer addresses
  ├── Shipments        ─────→ Shipment events
  ├── Deliveries       (digital fulfilment)
  ├── Licenses         ─────→ License activations
  ├── API keys
  └── Webhook endpoints
```

Everything is scoped to a **workspace** (internally an `accountId`). Cross-workspace queries don't exist &mdash; if you operate two businesses, you'll have two workspaces and treat them as fully separate.

## Workspace

A **workspace** is the top-level tenant boundary. Each workspace has:

- Its own warehouses, products, and stock
- Its own customer address book
- Its own shipments, deliveries, and licenses
- Its own API keys
- Its own webhook endpoints
- Its own Biteship adapter configuration (if shipping)

Workspaces are isolated. Data **never** crosses between them.

A workspace can be provisioned two ways:

- **Direct sign-up.** You sign in with Huudis SSO, and your `accountId` is namespaced as `usr_<huudisUserId>`.
- **Via a partner.** Storlaunch (or another Forjio partner) provisions a workspace on your behalf, and your `accountId` is namespaced as `acc_<workspaceId>`. The two namespaces never cross.

## Warehouse

A **warehouse** is a physical location where stock lives. You'll have at least one.

A warehouse has:

- A name
- An address, city, postal code
- Optional latitude/longitude (for shipping rate optimization)
- Optional phone (used as the courier's pickup contact)
- An `isDefault` flag &mdash; the first warehouse you create is marked default automatically

Stock balances are tracked **per (variant, warehouse)** pair, so the same product can have different counts in different locations.

## Product

A **product** is something you sell. Products have variants &mdash; if you sell a t-shirt in Small/Medium/Large, that's one product with three variants.

A product has:

- A name and optional SKU
- A type: `physical`, `digital`, or `license`
- Dimensions: weight, length, width, height (used for shipping rates)
- License flags: `licenseEnabled`, `maxActivations` (if `type=license`)
- Optional external references (`externalSource`, `externalRef`) &mdash; used when products are mirrored from Storlaunch's catalog

A variant has its own SKU, price, cost, and stock level per warehouse. Products with a single variant still get one auto-created.

## Stock

**Stock** is the count of how many units of a variant exist at a warehouse. Every change goes through the **stock movement** ledger so you can answer "how did we get to this number?".

Stock movement reasons:

| Reason | Means |
|---|---|
| `initial` | First time you set the stock on a new variant |
| `restock` | A new shipment came in from your supplier |
| `sale` | A customer order consumed inventory |
| `return` | A customer return added back to inventory |
| `damage` | Damaged goods written off |
| `transfer` | Moved between warehouses |
| `adjustment` | Manual correction (you counted and we were wrong) |

**Stock reservations** are a soft hold &mdash; "the customer is checking out, hold 1 unit for 15 minutes." If checkout completes, the reservation converts to a `sale` movement. If the customer abandons, the reservation expires and the stock is released.

## Shipment

A **shipment** is a real-world delivery from one of your warehouses to a customer address. Fulkruma tracks the lifecycle and posts events to your webhook.

A shipment has:

- An origin warehouse
- A destination customer address
- A courier (Biteship-backed: JNE, J&T, SiCepat, etc.)
- A list of items (variant + quantity + weight)
- A price (what you paid for the shipping label)
- Optional insurance
- A status: `pending`, `confirmed`, `picked_up`, `in_transit`, `delivered`, `failed`, `returned`

Identifier: `shp_...`.

When Biteship is configured, `shipments.create` books the order with the courier and stores the courier's tracking ID. When it isn't, Fulkruma records the intended shipment locally with a placeholder ID &mdash; useful for development.

## Shipment event

Every status change emits a **shipment event** so you have an audit trail and can rebuild current status from the event log. Events come from two sources:

1. **Biteship's webhook** &mdash; the courier reports status changes (picked up, in transit, delivered, etc.).
2. **Manual updates** &mdash; you mark a shipment as something via the API or dashboard.

Events have an `occurredAt` (when the status changed in the real world) and a `recordedAt` (when Fulkruma received the update).

## Delivery

A **delivery** is the digital counterpart of a shipment &mdash; used for `digital` or `license` products. Where a shipment ships a box, a delivery sends a download URL or a license key.

A delivery has:

- A reference to a product (must be `digital` or `license`)
- A customer
- Optional `maxDownloads` and `expiresAt`
- A status: `pending`, `delivered`, `expired`

A `digital` delivery gives the customer a short-lived signed download URL. A `license` delivery issues a **license key** they can use to activate their copy of the software.

## License

A **license** is a credential that authorizes a customer to use a piece of software. Licenses are produced by deliveries on `type=license` products, but you can also issue them standalone via the API.

A license has:

- A key (`fk_lic_...`) shown to the customer
- A `maxActivations` count (how many machines/instances can use it concurrently)
- An optional expiration
- A status: `active`, `revoked`, `expired`
- A list of **activations** &mdash; each one represents a registered instance (a machine, a docker container, etc.)

Three public endpoints make licenses useful to customer-facing software:

- `POST /api/v1/licenses/activate` &mdash; bind a license key to an instance ID.
- `POST /api/v1/licenses/deactivate` &mdash; release an instance (useful when migrating machines).
- `GET /api/v1/licenses/validate` &mdash; on launch, the software pings this to confirm it's still licensed.

These three don't need an API key &mdash; they're authenticated by the license key itself.

## Customer address

A **customer address** is a saved shipping destination for one of your customers. Addresses are scoped to the workspace and tagged by `customerId` (which references either a Huudis identity or a Storlaunch customer record &mdash; Fulkruma doesn't own customer identity).

Used by shipments and deliveries as the destination.

## API key

An **API key** authenticates server-to-server calls. Keys have:

- An identifier (`AKIAFULK...`)
- A secret (shown once at creation)
- A scope (default `*`; platform-admin keys also hold `fulkruma:platform:admin`)
- A creation date and last-used timestamp

Keys are per-workspace. They authenticate via **HMAC signing** of the request &mdash; see [**API authentication**](/docs/api/authentication).

## Identifiers (the prefix system)

Every Fulkruma object has a typed prefix on its ID. Use this to read at a glance what kind of object you're holding:

| Prefix | Type |
|---|---|
| `wh_` | Warehouse |
| `prod_` | Product |
| `var_` | Variant |
| `mov_` | Stock movement |
| `res_` | Stock reservation |
| `addr_` | Customer address |
| `shp_` | Shipment |
| `dlv_` | Delivery |
| `lic_` | License |
| `act_` | License activation |
| `ak_` | API key |

## Why this matters

The model isn't ornamental &mdash; it shapes how you build integrations:

- **Webhook handlers** dispatch on event type, which is named after the object (`shipment.delivered`, `stock.low`, `license.activated`).
- **Idempotency** is keyed on the operation, so you can safely retry a `stock.adjust` without double-counting.
- **Audit log** entries record actions on objects by ID, so you can trace "who archived warehouse wh_123" precisely.

Once you have this mental model in place, the rest of the docs are linear &mdash; each portal page, each API endpoint, each SDK method maps cleanly to one of these objects.

## Next

- [**Portal tour**](/docs/portal) &mdash; the dashboard, feature by feature.
- [**Portal &rarr; Warehouses**](/docs/portal/warehouses) &mdash; setting up locations.
- [**API reference**](/docs/api) &mdash; every endpoint.
