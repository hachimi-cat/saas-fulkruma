---
title: Stats — reference
---

# Stats

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/stats/overview` | [Powers the /dashboard overview tiles.](#powers-the-dashboard-overview-tiles) |

## Powers the /dashboard overview tiles.

```
GET /api/v1/stats/overview
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/stats/overview" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
