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
