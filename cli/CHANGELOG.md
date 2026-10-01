# Changelog

## 0.7.0
- `fulkruma api deliveries download <id>` records a download of a digital delivery (409 `DOWNLOAD_LIMIT` when used up, 410 `EXPIRED` after expiry).

## 0.6.0
- `fulkruma api webhooks get-events <id>` and `fulkruma api shipping get-shipments <id>` read one delivery / shipment (they were `events-2` and `shipments-2`; the old names still work, hidden from help).
- `fulkruma api shipping track <waybillId>` marks `--courier` required, as the API always did.
- Depends on `@forjio/fulkruma-node` 0.7.0.
