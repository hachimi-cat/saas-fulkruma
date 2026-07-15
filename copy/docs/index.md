---
title: Introduction
---

# Introduction

Fulkruma is the fulfilment and warehousing platform in the **Forjio family**. It owns the boring-but-load-bearing part of selling physical goods: warehouses, products, stock, customer addresses, shipments, deliveries, and software licenses. You can run it standalone with your own API integration, or plug it into Storlaunch to handle the back-of-house side of an e-commerce stack.

This documentation covers everything: getting started, the dashboard, authentication, the public REST API, and our SDKs for Node.js, Python, and Go.

<blockquote class="callout-tip">

**New to Fulkruma?** Start with the [**Quickstart**](/docs/quickstart) — you'll have a warehouse set up and a test shipment going in about five minutes.

</blockquote>

## What's here

The docs are organized by how you'll use the product over time:

- **Getting started** &mdash; sign up, install the SDK or CLI, ship a test order.
- **Core concepts** &mdash; the model behind warehouses, products, stock, shipments, deliveries, and licenses.
- **Authentication** &mdash; how sign-in and password resets work. We use Huudis as the identity provider so the flow is shared with every other Forjio product.
- **Portal** &mdash; per-feature tours of what you can do in the dashboard at fulkruma.com.
- **API reference** &mdash; the public REST API with HMAC signing.
- **SDKs** &mdash; per-language guides for `@forjio/fulkruma-node`, `fulkruma` on PyPI, and `github.com/hachimi-cat/fulkruma-go`.

## Two ways to use Fulkruma

You can run Fulkruma in two modes:

- **Direct** &mdash; you mint an API key in the dashboard and call Fulkruma directly from your application. Best for custom storefronts or back-office tools.
- **Via Storlaunch** &mdash; if you use Storlaunch as your e-commerce front-end, Fulkruma is wired in as a module. Storlaunch provisions your Fulkruma workspace and forwards orders to it. You don't need an API key &mdash; Storlaunch manages the integration.

The data model is the same in both cases. Storlaunch just hides the API surface behind its own UI.

## A note on the Forjio family

Fulkruma is part of the **Forjio family** &mdash; a set of independent SaaS products that share identity (Huudis SSO), billing (Plugipay, via Pattern 2 partner billing), and design conventions. If you've used Storlaunch, Plugipay, Ripllo, LinkSnap, Pawpado, or Catentio, the auth and SDK shapes here will feel familiar.

Each product owns its own bounded context. Fulkruma owns warehouses, stock, shipments, deliveries, and licenses. It does **not** own payments (&rarr; Plugipay), the product catalog as merchants think of it for marketing (&rarr; Storlaunch), or auth (&rarr; Huudis).

## Reach us

- **GitHub issues**: [hachimi-cat/fulkruma-node](https://github.com/hachimi-cat/fulkruma-node/issues)
- **Status page**: [status.fulkruma.com](https://status.fulkruma.com)
- **Email**: hello@fulkruma.com

Ready? Go to the [**Quickstart**](/docs/quickstart).
