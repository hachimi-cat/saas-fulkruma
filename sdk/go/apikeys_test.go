package fulkruma

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// The server answers list with { apiKeys: [...] } and create with
// { apiKey: {...}, secret } (backend/src/routes/api-keys.ts). The SDK decoded
// "keys" / "key", so List always came back empty and Create lost the secret.
func TestAPIKeys_DecodeWhatTheServerSends(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write(envelopeOK(map[string]any{"apiKeys": []any{map[string]any{"id": "k1", "name": "CI"}}}))
			return
		}
		_, _ = w.Write(envelopeOK(map[string]any{
			"apiKey": map[string]any{"id": "k2", "name": "CI key", "keyId": "AKIAFULKNEW"},
			"secret": "fulksk_once",
		}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1_700_000_000)

	keys, err := c.APIKeys.List(context.Background())
	if err != nil || len(keys) != 1 || keys[0]["id"] != "k1" {
		t.Fatalf("List = %v, %v", keys, err)
	}
	created, err := c.APIKeys.Create(context.Background(), APIKeyCreateInput{Name: "CI key"})
	if err != nil {
		t.Fatal(err)
	}
	if created.Secret != "fulksk_once" || created.APIKey["keyId"] != "AKIAFULKNEW" {
		t.Fatalf("Create = %+v", created)
	}
}

// GET /billing/invoices answers { data, cursor, hasMore } (backend
// services/billing.ts getBillingHistory); the SDK decoded invoices/nextCursor.
func TestBilling_InvoicesDecodeWhatTheServerSends(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(envelopeOK(map[string]any{
			"data":    []any{map[string]any{"id": "inv_1", "amount": 99000}},
			"cursor":  "inv_1",
			"hasMore": true,
		}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1_700_000_000)
	page, err := c.Billing.Invoices(context.Background(), BillingInvoicesParams{Limit: 1})
	if err != nil || len(page.Data) != 1 || page.Cursor != "inv_1" || !page.HasMore {
		t.Fatalf("Invoices = %+v, %v", page, err)
	}
}

// POST /webhooks/endpoints answers { endpoint, secret }; the secret is shown once.
func TestWebhooks_CreateEndpointReturnsTheSecret(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(envelopeOK(map[string]any{"endpoint": map[string]any{"id": "we_1"}, "secret": "whsec_once"}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1_700_000_000)
	created, err := c.Webhooks.CreateEndpoint(context.Background(), WebhookEndpointCreateInput{URL: "https://example.com/hook"})
	if err != nil || created.Secret != "whsec_once" || created.Endpoint["id"] != "we_1" {
		t.Fatalf("CreateEndpoint = %+v, %v", created, err)
	}
}
