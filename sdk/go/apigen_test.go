package fulkruma

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Client.API (api_generated.go) goes through apigenRequest: the same signing,
// headers and envelope as every hand-written call.

type apigenSeen struct {
	method, uri string
	body        []byte
	header      http.Header
}

// apigenServer records each request and checks its signature the way the
// backend does (middleware/hmac-auth.ts): req.originalUrl — the path WITH its
// query — and sha256 of the body.
func apigenServer(t *testing.T, secret string, data any) (*httptest.Server, *[]apigenSeen) {
	t.Helper()
	var seen []apigenSeen
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen = append(seen, apigenSeen{r.Method, r.URL.RequestURI(), body, r.Header.Clone()})
		var sig string
		for _, part := range strings.Split(r.Header.Get("Authorization"), ",") {
			if s, ok := strings.CutPrefix(strings.TrimSpace(part), "signature="); ok {
				sig = s
			}
		}
		bh := sha256.Sum256(body)
		canon := r.Method + "\n" + r.URL.RequestURI() + "\n" + r.Header.Get("X-Fulkruma-Timestamp") + "\n" + hex.EncodeToString(bh[:])
		if idem := r.Header.Get("Idempotency-Key"); idem != "" {
			canon += "\n" + idem
		}
		if want := hmacHex([]byte(secret), canon); sig != want {
			t.Errorf("signature = %s, want %s (canon %q)", sig, want, canon)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(data))
	}))
	t.Cleanup(ts.Close)
	return ts, &seen
}

func apigenClient(t *testing.T, ts *httptest.Server, secret string) *Client {
	t.Helper()
	c, err := NewClient(ClientOptions{KeyID: "AKIAFULKTEST", Secret: secret, BaseURL: ts.URL, Now: fixedClock(1_700_000_000), HTTP: ts.Client()})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestAPI_ListSendsQueryAndSignsIt(t *testing.T) {
	ts, seen := apigenServer(t, "s1", map[string]any{"products": []any{}})
	c := apigenClient(t, ts, "s1")
	data, err := c.API.ProductsList(context.Background(), &ProductsListArgs{Archived: true})
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != `{"products":[]}` {
		t.Fatalf("data = %s", data)
	}
	r := (*seen)[0]
	if r.method != "GET" || r.uri != "/api/v1/products?archived=true" || len(r.body) != 0 {
		t.Fatalf("request = %s %s %q", r.method, r.uri, r.body)
	}
	if r.header.Get("Idempotency-Key") != "" {
		t.Fatal("GET carries an Idempotency-Key")
	}
	if !strings.HasPrefix(r.header.Get("Authorization"), "Fulkruma-HMAC-SHA256 keyId=AKIAFULKTEST, scope=*, signature=") {
		t.Fatalf("Authorization = %q", r.header.Get("Authorization"))
	}
}

func TestAPI_RequiredQuery(t *testing.T) {
	ts, seen := apigenServer(t, "s1", map[string]any{})
	c := apigenClient(t, ts, "s1")
	if _, err := c.API.LicensesValidate(context.Background(), &LicensesValidateArgs{Key: "K 1", ProductID: Ptr("prd_1")}); err != nil {
		t.Fatal(err)
	}
	if u := (*seen)[0].uri; u != "/api/v1/licenses/validate?key=K+1&productId=prd_1" {
		t.Fatalf("uri = %s", u)
	}
}

func TestAPI_CreateSendsBodyWithIdempotencyKey(t *testing.T) {
	ts, seen := apigenServer(t, "s2", map[string]any{"product": map[string]any{"id": "prod_1"}})
	c := apigenClient(t, ts, "s2")
	_, err := c.API.ProductsCreate(context.Background(), &ProductsCreateArgs{
		Name: "Mug", Weight: Ptr(300), LicenseEnabled: Ptr(false),
		Body: map[string]any{"metadata": map[string]any{"color": "red"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	r := (*seen)[0]
	if r.method != "POST" || r.uri != "/api/v1/products" {
		t.Fatalf("request = %s %s", r.method, r.uri)
	}
	if string(r.body) != `{"licenseEnabled":false,"metadata":{"color":"red"},"name":"Mug","weight":300}` {
		t.Fatalf("body = %s", r.body)
	}
	if !strings.HasPrefix(r.header.Get("Idempotency-Key"), "idem_") || r.header.Get("Content-Type") != "application/json" {
		t.Fatalf("headers = %v", r.header)
	}
}

func TestAPI_EmptyBodyIsNotSent(t *testing.T) {
	// The server hashes an empty body as "": sending "{}" would break the signature.
	ts, seen := apigenServer(t, "s3", map[string]any{})
	c := apigenClient(t, ts, "s3").ForMerchant("acc_m")
	if _, err := c.API.ProductsUpdate(context.Background(), "prod/1", nil); err != nil {
		t.Fatal(err)
	}
	r := (*seen)[0]
	if r.method != "PATCH" || r.uri != "/api/v1/products/prod%2F1" || len(r.body) != 0 {
		t.Fatalf("request = %s %s %q", r.method, r.uri, r.body)
	}
	if r.header.Get("X-Fulkruma-On-Behalf-Of") != "acc_m" {
		t.Fatalf("X-Fulkruma-On-Behalf-Of = %q", r.header.Get("X-Fulkruma-On-Behalf-Of"))
	}
}

func TestAPI_RequiredFieldMissing(t *testing.T) {
	ts, seen := apigenServer(t, "s1", map[string]any{})
	c := apigenClient(t, ts, "s1")
	_, err := c.API.ProductsCreate(context.Background(), &ProductsCreateArgs{Sku: Ptr("X")})
	if err == nil || !strings.Contains(err.Error(), "Name") {
		t.Fatalf("err = %v, want a missing Name", err)
	}
	if len(*seen) != 0 {
		t.Fatalf("sent %d requests", len(*seen))
	}
}

func TestAPI_ErrorEnvelope(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"data": nil, "error": map[string]any{"code": "NOT_FOUND", "message": "nope"}, "meta": map[string]any{"requestId": "req_9"}})
	}))
	defer ts.Close()
	_, err := apigenClient(t, ts, "s").API.ProductsGet(context.Background(), "prod_x")
	e, ok := err.(*Error)
	if !ok || e.Status != 404 || e.Code != "NOT_FOUND" {
		t.Fatalf("err = %#v", err)
	}
}
