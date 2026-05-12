package fulkruma

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// fixedClock returns a deterministic time source so we can re-derive
// signatures byte-for-byte in tests.
func fixedClock(t int64) func() time.Time {
	return func() time.Time { return time.Unix(t, 0) }
}

// newTestClient wires a Client against a httptest.Server with a frozen
// clock — the same recipe every round-trip test uses.
func newTestClient(t *testing.T, ts *httptest.Server, clockTs int64) *Client {
	t.Helper()
	c, err := NewClient(ClientOptions{
		KeyID:   "AKIAFULKTEST",
		Secret:  "shhh-secret-1234",
		BaseURL: ts.URL,
		Now:     fixedClock(clockTs),
		HTTP:    ts.Client(),
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

// envelopeOK builds the {data,error,meta} envelope the backend would send.
func envelopeOK(data any) []byte {
	raw, _ := json.Marshal(data)
	env := ApiEnvelope{
		Data: raw,
		Meta: &EnvelopeMeta{RequestID: "req_test"},
	}
	out, _ := json.Marshal(env)
	return out
}

// ─── Construction / option validation ───────────────────────

func TestNewClient_MissingKeyID(t *testing.T) {
	t.Setenv("FULKRUMA_KEY_ID", "")
	t.Setenv("FULKRUMA_SECRET", "x")
	_, err := NewClient(ClientOptions{Secret: "x"})
	if err == nil {
		t.Fatal("expected missing_key_id error")
	}
	fe, ok := err.(*Error)
	if !ok || fe.Code != "missing_key_id" {
		t.Fatalf("expected *Error.Code=missing_key_id, got %#v", err)
	}
}

func TestNewClient_MissingSecret(t *testing.T) {
	t.Setenv("FULKRUMA_KEY_ID", "")
	t.Setenv("FULKRUMA_SECRET", "")
	_, err := NewClient(ClientOptions{KeyID: "AKIA"})
	if err == nil {
		t.Fatal("expected missing_secret error")
	}
	fe, ok := err.(*Error)
	if !ok || fe.Code != "missing_secret" {
		t.Fatalf("expected missing_secret, got %#v", err)
	}
}

func TestNewClient_EnvFallback(t *testing.T) {
	t.Setenv("FULKRUMA_KEY_ID", "AKIAENV")
	t.Setenv("FULKRUMA_SECRET", "envsecret")
	t.Setenv("FULKRUMA_BASE_URL", "https://example.test")
	c, err := NewClient(ClientOptions{})
	if err != nil {
		t.Fatalf("NewClient with env: %v", err)
	}
	if c.KeyID() != "AKIAENV" || c.BaseURL() != "https://example.test" {
		t.Fatalf("env fallback failed: keyID=%q baseURL=%q", c.KeyID(), c.BaseURL())
	}
}

func TestForMerchant_PropagatesOBO(t *testing.T) {
	var captured string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r.Header.Get("X-Fulkruma-On-Behalf-Of")
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{"warehouses": []any{}}))
	}))
	defer ts.Close()

	base := newTestClient(t, ts, 1_700_000_000)
	scoped := base.ForMerchant("acc_123")
	if _, err := scoped.Warehouses.List(context.Background()); err != nil {
		t.Fatalf("List: %v", err)
	}
	if captured != "acc_123" {
		t.Fatalf("expected X-Fulkruma-On-Behalf-Of=acc_123, got %q", captured)
	}
}

// ─── HMAC signing format ────────────────────────────────────

// TestSign_ReDerive — re-derives the signature byte-for-byte against the
// canonical string the Node + Python SDKs build. If the algorithm ever
// drifts (e.g. wrong newline count, missing idem suffix) this catches it.
func TestSign_ReDerive(t *testing.T) {
	c, err := NewClient(ClientOptions{
		KeyID:  "AKIA",
		Secret: "s3cr3t",
		Now:    fixedClock(1_700_000_000),
	})
	if err != nil {
		t.Fatal(err)
	}

	body := []byte(`{"foo":"bar"}`)
	method := "POST"
	path := "/api/v1/products"
	ts := "1700000000"
	idem := "idem_abcd"

	got := c.sign(method, path, body, ts, idem)

	bodyHash := sha256.Sum256(body)
	want := hmacHex([]byte("s3cr3t"),
		method+"\n"+path+"\n"+ts+"\n"+hex.EncodeToString(bodyHash[:])+"\n"+idem)

	if got != want {
		t.Fatalf("signature mismatch:\n got:  %s\n want: %s", got, want)
	}
}

// TestSign_NoIdem confirms the idem suffix is absent (not even a trailing
// newline) when no idempotency key is set — same as the Node SDK.
func TestSign_NoIdem(t *testing.T) {
	c, _ := NewClient(ClientOptions{KeyID: "k", Secret: "s", Now: fixedClock(1)})
	got := c.sign("GET", "/x", nil, "1", "")
	bodyHash := sha256.Sum256(nil)
	want := hmacHex([]byte("s"), "GET\n/x\n1\n"+hex.EncodeToString(bodyHash[:]))
	if got != want {
		t.Fatalf("signature without idem drifted:\n got:  %s\n want: %s", got, want)
	}
}

// TestRequest_HeadersAndSignature inspects the actual headers that hit
// the wire and re-derives the signature server-side. This is the
// strongest guarantee that the client matches the backend's verifier.
func TestRequest_HeadersAndSignature(t *testing.T) {
	const secret = "test-secret-9"
	const fixedTs = int64(1_700_000_000)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Read the body the server actually received.
		body, _ := io.ReadAll(r.Body)
		stamp := r.Header.Get("X-Fulkruma-Timestamp")
		auth := r.Header.Get("Authorization")

		// Pull signature= out of the Authorization header.
		var sig string
		for _, part := range strings.Split(auth, ",") {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, "signature=") {
				sig = strings.TrimPrefix(part, "signature=")
			}
		}

		// Reconstruct canonical string.
		idem := r.Header.Get("Idempotency-Key")
		bh := sha256.Sum256(body)
		canon := r.Method + "\n" + r.URL.Path + "\n" + stamp + "\n" + hex.EncodeToString(bh[:])
		if idem != "" {
			canon += "\n" + idem
		}
		expect := hmacHex([]byte(secret), canon)
		if sig != expect {
			t.Errorf("server-side resigning mismatch:\n got: %s\n want: %s\n canon: %q",
				sig, expect, canon)
		}
		if stamp != "1700000000" {
			t.Errorf("X-Fulkruma-Timestamp = %q, want 1700000000", stamp)
		}
		if !strings.HasPrefix(auth, "Fulkruma-HMAC-SHA256 keyId=") {
			t.Errorf("Authorization header malformed: %q", auth)
		}
		if !strings.Contains(auth, "scope=*") {
			t.Errorf("Authorization missing scope=*: %q", auth)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type missing on POST")
		}
		if idem == "" {
			t.Errorf("Idempotency-Key missing on POST products")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{"product": map[string]any{
			"id": "prod_1", "accountId": "acc", "name": "Test", "type": "physical",
			"licenseEnabled": false, "maxActivations": 0, "archived": false,
			"metadata": map[string]any{},
			"createdAt": "", "updatedAt": "",
		}}))
	}))
	defer ts.Close()

	c, err := NewClient(ClientOptions{
		KeyID: "AKIA", Secret: secret, BaseURL: ts.URL,
		Now: fixedClock(fixedTs), HTTP: ts.Client(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Products.Create(context.Background(), ProductCreateInput{Name: "Test"}); err != nil {
		t.Fatalf("Create: %v", err)
	}
}

// ─── Route round-trips ──────────────────────────────────────

func TestProducts_Get(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.URL.Path != "/api/v1/products/prod_42" {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{"product": map[string]any{
			"id": "prod_42", "accountId": "acc", "name": "Forty-Two",
			"type": "digital", "licenseEnabled": true, "maxActivations": 3,
			"archived": false, "metadata": map[string]any{},
			"createdAt": "2026-01-01", "updatedAt": "2026-01-01",
		}}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	p, err := c.Products.Get(context.Background(), "prod_42")
	if err != nil {
		t.Fatal(err)
	}
	if p.ID != "prod_42" || p.Name != "Forty-Two" || p.Type != ProductTypeDigital {
		t.Fatalf("decoded product unexpected: %+v", p)
	}
	if !p.LicenseEnabled || p.MaxActivations != 3 {
		t.Fatalf("license fields lost: %+v", p)
	}
}

func TestProducts_ListWithArchivedQuery(t *testing.T) {
	var seenPath string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path + "?" + r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{"products": []any{}}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	archived := true
	if _, err := c.Products.List(context.Background(), ProductListParams{Archived: &archived}); err != nil {
		t.Fatal(err)
	}
	if seenPath != "/api/v1/products?archived=true" {
		t.Fatalf("query coercion wrong: %s", seenPath)
	}
}

func TestWarehouses_Create(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/api/v1/warehouses" {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		var got map[string]any
		_ = json.Unmarshal(body, &got)
		if got["name"] != "Main" {
			t.Errorf("name not forwarded: %v", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{"warehouse": map[string]any{
			"id": "wh_1", "accountId": "acc", "name": "Main",
			"isDefault": true, "archived": false,
			"createdAt": "", "updatedAt": "",
		}}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	isDef := true
	wh, err := c.Warehouses.Create(context.Background(), WarehouseCreateInput{
		Name: "Main", IsDefault: &isDef,
	})
	if err != nil {
		t.Fatal(err)
	}
	if wh.ID != "wh_1" || !wh.IsDefault {
		t.Fatalf("warehouse round-trip: %+v", wh)
	}
}

func TestStock_Adjust_Idempotent(t *testing.T) {
	var sawIdem string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawIdem = r.Header.Get("Idempotency-Key")
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{
			"stock": map[string]any{
				"id": "vs_1", "variantId": "v", "warehouseId": "w",
				"quantity": 7, "updatedAt": "",
			},
			"movement": map[string]any{
				"id": "mv_1", "variantId": "v", "warehouseId": "w",
				"delta": 7, "reason": "initial_stock", "createdAt": "",
			},
		}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	res, err := c.Stock.Adjust(context.Background(), StockAdjustInput{
		VariantID: "v", WarehouseID: "w", Delta: 7,
		Reason: StockMovementInitialStock,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Stock.Quantity != 7 || res.Movement.Delta != 7 {
		t.Fatalf("decoded result: %+v", res)
	}
	if !strings.HasPrefix(sawIdem, "idem_") {
		t.Fatalf("expected auto-idem key, got %q", sawIdem)
	}
}

func TestLicenses_ValidatePublic(t *testing.T) {
	var seenQuery string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{
			"valid": true, "key": "LIC-1", "status": "active",
			"productId": "prod_x", "activations": 1, "maxActivations": 3,
			"expiresAt": nil,
		}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	res, err := c.Licenses.Validate(context.Background(), LicenseValidateParams{
		Key: "LIC-1", ProductID: "prod_x",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Valid || res.Key != "LIC-1" {
		t.Fatalf("validate response: %+v", res)
	}
	if !strings.Contains(seenQuery, "key=LIC-1") || !strings.Contains(seenQuery, "productId=prod_x") {
		t.Fatalf("query not preserved: %s", seenQuery)
	}
}

func TestAdmin_ProvisionWorkspace_DeterministicIdem(t *testing.T) {
	var sawIdem string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawIdem = r.Header.Get("Idempotency-Key")
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelopeOK(map[string]any{
			"accountId": "acc_abc", "partner": "storlaunch",
			"discountRate": 0.003, "createdAt": "",
		}))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	_, err := c.Admin.ProvisionWorkspace(context.Background(), ProvisionWorkspaceInput{
		AccountID: "acc_abc", Partner: "storlaunch", DiscountRate: 0.003,
	})
	if err != nil {
		t.Fatal(err)
	}
	if sawIdem != "ws_acc_abc_storlaunch" {
		t.Fatalf("admin idem-key mismatch: %q", sawIdem)
	}
}

func TestShipments_CreateAndGet(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == "POST" && r.URL.Path == "/api/v1/shipments":
			w.Write(envelopeOK(map[string]any{"shipment": map[string]any{
				"id": "shp_1", "accountId": "acc", "biteshipOrderId": "bo_1",
				"courierCode": "jne", "courierServiceCode": "REG", "courierType": "regular",
				"status": "pending", "price": 12000, "insurance": 0, "insured": false,
				"originSnapshot": map[string]any{}, "destinationSnapshot": map[string]any{},
				"items": []any{}, "createdAt": "", "updatedAt": "",
			}}))
		case r.Method == "GET" && r.URL.Path == "/api/v1/shipments/shp_1":
			w.Write(envelopeOK(map[string]any{"shipment": map[string]any{
				"id": "shp_1", "accountId": "acc", "biteshipOrderId": "bo_1",
				"courierCode": "jne", "courierServiceCode": "REG", "courierType": "regular",
				"status": "in_transit", "price": 12000, "insurance": 0, "insured": false,
				"originSnapshot": map[string]any{}, "destinationSnapshot": map[string]any{},
				"items": []any{}, "createdAt": "", "updatedAt": "",
			}}))
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	created, err := c.Shipments.Create(context.Background(), ShipmentCreateInput{
		CourierCode: "jne", CourierServiceCode: "REG", CourierType: "regular",
		Price:       12000,
		Origin:      map[string]any{"city": "Jakarta"},
		Destination: map[string]any{"city": "Bandung"},
		Items:       []map[string]any{{"name": "Widget"}},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.Status != ShipmentPending {
		t.Fatalf("status: %v", created.Status)
	}

	got, err := c.Shipments.Get(context.Background(), "shp_1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Status != ShipmentInTransit {
		t.Fatalf("status post-Get: %v", got.Status)
	}
}

// ─── Error envelope handling ────────────────────────────────

func TestRequest_ErrorEnvelope(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(409)
		env := ApiEnvelope{
			Error: &ErrorBody{Code: "conflict", Message: "already provisioned"},
			Meta:  &EnvelopeMeta{RequestID: "req_xyz"},
		}
		out, _ := json.Marshal(env)
		w.Write(out)
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	_, err := c.Warehouses.Create(context.Background(), WarehouseCreateInput{Name: "x"})
	if err == nil {
		t.Fatal("expected error")
	}
	fe, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *Error, got %T", err)
	}
	if fe.Status != 409 || fe.Code != "conflict" || fe.RequestID != "req_xyz" {
		t.Fatalf("error fields wrong: %+v", fe)
	}
	if !strings.Contains(fe.Error(), "already provisioned") {
		t.Fatalf("Error() missing message: %s", fe.Error())
	}
}

func TestRequest_NonJSON(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(502)
		w.Write([]byte("<html>upstream barfed</html>"))
	}))
	defer ts.Close()
	c := newTestClient(t, ts, 1)

	_, err := c.Stats.Overview(context.Background())
	if err == nil {
		t.Fatal("expected error on non-JSON response")
	}
	fe := err.(*Error)
	if fe.Code != "invalid_response" {
		t.Fatalf("expected invalid_response, got %+v", fe)
	}
}

// ─── qs helper ──────────────────────────────────────────────

func TestQS_BoolCoercion(t *testing.T) {
	got := qs(map[string]any{"archived": true})
	if got != "?archived=true" {
		t.Fatalf("bool coercion wrong: %q", got)
	}
	got = qs(map[string]any{"archived": false})
	if got != "?archived=false" {
		t.Fatalf("false coercion wrong: %q", got)
	}
	if qs(map[string]any{}) != "" {
		t.Fatalf("empty params should produce empty string")
	}
	if qs(map[string]any{"x": nil}) != "" {
		t.Fatalf("nil values should be dropped")
	}
}

// ─── Helpers ────────────────────────────────────────────────

func hmacHex(secret []byte, payload string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
