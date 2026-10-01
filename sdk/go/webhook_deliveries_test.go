package fulkruma

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// The vector the backend's signer is tested against
// (backend/src/__tests__/merchant-webhooks.test.ts), and the Node and Python
// helpers too: the server and all three SDKs agree on the signature.
func TestVerifyWebhook_SharedServerVector(t *testing.T) {
	const secret = "whsec_fulkruma_test_vector_0001"
	body := []byte(`{"id":"evt_01JTESTVECTOR0000000000000","type":"fulkruma.shipment.created.v1","occurredAt":"2026-01-01T00:00:00.000Z","accountId":"acc_test","data":{"shipmentId":"shp_1","note":"café — 日本"},"metadata":{}}`)
	const header = "t=1767225600,v1=812b74713b8424ca6d154b60ee47541f37a0635d82f5ed55e83d949576e73fa1"
	clock := func() time.Time { return time.Unix(1767225600+30, 0) }

	env, err := VerifyWebhook(body, header, secret, &VerifyWebhookOptions{Now: clock})
	if err != nil {
		t.Fatalf("server signature rejected: %v", err)
	}
	if env.ID != "evt_01JTESTVECTOR0000000000000" || env.Type != "fulkruma.shipment.created.v1" {
		t.Fatalf("envelope not decoded: %+v", env)
	}
	if _, err := VerifyWebhook(body, header, "whsec_other", &VerifyWebhookOptions{Now: clock}); err == nil {
		t.Fatal("wrong secret accepted")
	}
}

func TestWebhooks_DeliveryLog(t *testing.T) {
	type seen struct {
		method, path, query, idem string
		body                      int
	}
	var calls []seen
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		calls = append(calls, seen{r.Method, r.URL.Path, r.URL.RawQuery, r.Header.Get("Idempotency-Key"), len(b)})
		switch r.URL.Path {
		case "/api/v1/webhooks/events":
			_, _ = w.Write(envelopeOK(map[string]any{
				"events": []map[string]any{{
					"id": "whe_1", "eventId": "evt_1", "type": "fulkruma.license.issued.v1", "status": "failed",
					"attempts": 6, "responseCode": 503, "nextRetryAt": nil, "lastError": "HTTP 503",
					"payload":          map[string]any{"id": "evt_1", "type": "fulkruma.license.issued.v1", "data": map[string]any{"licenseId": "lic_1"}},
					"deliveryAttempts": []map[string]any{{"attemptNumber": 1, "status": "failed", "responseCode": 503, "durationMs": 12, "nextRetryAt": "2026-10-01T00:01:00.000Z"}},
				}},
				"nextCursor": "whe_1",
			}))
		default:
			_, _ = w.Write(envelopeOK(map[string]any{"event": map[string]any{"id": "whe_1", "status": "pending", "attempts": 6}}))
		}
	}))
	defer ts.Close()
	c := newTestClient(t, ts, time.Now().Unix())
	ctx := context.Background()

	page, err := c.Webhooks.ListEvents(ctx, WebhookEventsListParams{Limit: 20, Status: "failed", EndpointID: "ep_1", Cursor: "cur_1"})
	if err != nil {
		t.Fatal(err)
	}
	if calls[0].query != "cursor=cur_1&endpointId=ep_1&limit=20&status=failed" {
		t.Fatalf("query = %q", calls[0].query)
	}
	ev := page.Events[0]
	if ev.Status != "failed" || ev.Attempts != 6 || *ev.ResponseCode != 503 || ev.NextRetryAt != nil || ev.Payload.ID != "evt_1" {
		t.Fatalf("delivery not decoded: %+v", ev)
	}
	if len(ev.DeliveryAttempts) != 1 || ev.DeliveryAttempts[0].DurationMs != 12 || *ev.DeliveryAttempts[0].NextRetryAt == "" {
		t.Fatalf("attempts not decoded: %+v", ev.DeliveryAttempts)
	}
	if page.NextCursor == nil || *page.NextCursor != "whe_1" {
		t.Fatalf("nextCursor = %v", page.NextCursor)
	}

	if _, err := c.Webhooks.ListEvents(ctx, WebhookEventsListParams{}); err != nil || calls[1].query != "" {
		t.Fatalf("empty params sent %q (%v)", calls[1].query, err)
	}
	got, err := c.Webhooks.GetEvent(ctx, "whe_1")
	if err != nil || got.ID != "whe_1" || calls[2].method != "GET" || calls[2].path != "/api/v1/webhooks/events/whe_1" {
		t.Fatalf("GetEvent: %+v %+v %v", got, calls[2], err)
	}
	queued, err := c.Webhooks.RetryEvent(ctx, "whe_1")
	if err != nil || queued.Status != "pending" {
		t.Fatalf("RetryEvent: %+v %v", queued, err)
	}
	if r := calls[3]; r.method != "POST" || r.path != "/api/v1/webhooks/events/whe_1/retry" || r.body != 0 || r.idem == "" {
		t.Fatalf("RetryEvent sent %+v", r)
	}
}
