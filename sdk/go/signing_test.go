package fulkruma

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The signature covers exactly the bytes sent ("" when none). The server accepts a
// signature over the raw bytes it received (backend middleware/hmac-auth.ts), and — as
// the deployed server still requires — over its own re-serialisation, where an empty
// {} counts as "". Sending no body for an empty one satisfies both.
func signingServer(t *testing.T, secret string, seen *[]string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		bh := sha256.Sum256(body)
		canon := r.Method + "\n" + r.URL.RequestURI() + "\n" + r.Header.Get("X-Fulkruma-Timestamp") + "\n" + hex.EncodeToString(bh[:])
		if idem := r.Header.Get("Idempotency-Key"); idem != "" {
			canon += "\n" + idem
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasSuffix(auth, "signature="+hmacHex([]byte(secret), canon)) {
			t.Errorf("%s %s: signature is not over the bytes sent (%q)", r.Method, r.URL.Path, body)
		}
		if len(body) == 0 && r.Header.Get("Content-Type") != "" {
			t.Errorf("%s %s: Content-Type without a body", r.Method, r.URL.Path)
		}
		*seen = append(*seen, r.Method+" "+r.URL.Path+" "+string(body))
		_, _ = w.Write(envelopeOK(map[string]any{}))
	}))
}

func TestSigning_CallsThatCarryNothingSendNoBody(t *testing.T) {
	var seen []string
	ts := signingServer(t, "shhh-secret-1234", &seen)
	defer ts.Close()
	c := newTestClient(t, ts, 1_700_000_000)
	ctx := context.Background()
	_, _ = c.Licenses.Revoke(ctx, "lic_1")
	_, _ = c.APIKeys.Revoke(ctx, "ak_1")
	_, _ = c.Billing.Cancel(ctx)
	want := []string{
		"POST /api/v1/licenses/lic_1/revoke ",
		"POST /api/v1/api-keys/ak_1/revoke ",
		"POST /api/v1/billing/cancel ",
	}
	if strings.Join(seen, "|") != strings.Join(want, "|") {
		t.Fatalf("requests:\n%s\nwant:\n%s", strings.Join(seen, "\n"), strings.Join(want, "\n"))
	}
}

func TestSigning_SignsExactlyTheBytesSent(t *testing.T) {
	var seen []string
	ts := signingServer(t, "shhh-secret-1234", &seen)
	defer ts.Close()
	c := newTestClient(t, ts, 1_700_000_000)
	lat, lng := -6.2, 106.0
	if _, err := c.Warehouses.Create(context.Background(), WarehouseCreateInput{Name: "Gudang Café — 東京 <main> & co", Lat: &lat, Lng: &lng}); err != nil {
		t.Fatal(err)
	}
	if _, err := c.APIKeys.Create(context.Background(), APIKeyCreateInput{Name: "CI key", Scopes: []string{"read"}}); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 2 || !strings.HasSuffix(seen[1], `{"name":"CI key","scopes":["read"]}`) {
		t.Fatalf("unexpected requests: %q", seen)
	}
}
