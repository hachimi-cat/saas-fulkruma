---
title: fulkruma.delivery.downloaded
---

# `fulkruma.delivery.downloaded.v1`

Fires when a download of a digital delivery is recorded &mdash; your file-serving endpoint calls [`POST /api/v1/deliveries/:id/download`](/docs/api/resources/deliveries#record-a-download) before it serves the file.

## When it fires

Inside the same transaction that counts the download. A refused download (`409 DOWNLOAD_LIMIT`, `410 EXPIRED`) sends nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.delivery.downloaded.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "deliveryId": "clx6d5e4f0000aa1b2c3d4e5f",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "downloadCount": 2,
    "maxDownloads": 5,
    "remaining": 3,
    "downloadedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

`remaining` is how many downloads are left (`0` on the last one).

## Handler examples

```js
// Node
if (event.type === 'fulkruma.delivery.downloaded.v1') {
  await sync(event.data.deliveryId);
}
```

```python
# Python
if event["type"] == "fulkruma.delivery.downloaded.v1":
    sync(event["data"]["deliveryId"])
```

## Related events

- [`fulkruma.delivery.created.v1`](./fulkruma.delivery.created)
- [`fulkruma.delivery.expired.v1`](./fulkruma.delivery.expired)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
