---
title: Audit log — reference
---

# Audit log

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/audit-log` | [List audit log](#list-audit-log) |

## List audit log

```
GET /api/v1/audit-log
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `action` | any | no |  |
| `limit` | any | no |  |
| `target_type` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/audit-log" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
