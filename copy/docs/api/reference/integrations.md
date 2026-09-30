---
title: Integrations — reference
---

# Integrations

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/integrations/status` | [List status](#list-status) |

## List status

```
GET /api/v1/integrations/status
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/integrations/status" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
