// Package fulkruma is the official Go SDK for Fulkruma — stock,
// warehouses, shipping (Biteship), licenses, deliveries, API keys,
// audit log, billing, integrations status, stats, webhooks. Mirrors
// `@forjio/fulkruma-node` and `fulkruma` (Python) 1:1.
//
// All API calls are HMAC-signed:
//
//	Authorization: Fulkruma-HMAC-SHA256 keyId=…, scope=*, signature=…
//	X-Fulkruma-Timestamp: <unix>
//	X-Fulkruma-On-Behalf-Of: <accountId>   (platform-admin only, optional)
//	Idempotency-Key: idem_<uuid>           (on replay-sensitive mutations)
//
// The signature payload is `${METHOD}\n${path}\n${ts}\n${sha256(body)}` —
// plus `\n${idempotencyKey}` when present.
package fulkruma

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// ClientOptions controls FulkrumaClient construction. Empty fields fall
// back to the matching FULKRUMA_* env vars (KEY_ID, SECRET, BASE_URL,
// ON_BEHALF_OF) — keeping parity with the Node + Python SDKs.
type ClientOptions struct {
	// KeyID — HMAC access key id, e.g. "AKIAFULK…". Required.
	KeyID string
	// Secret — HMAC secret. Required.
	Secret string
	// BaseURL — defaults to https://fulkruma.com (or $FULKRUMA_BASE_URL).
	BaseURL string
	// OnBehalfOf — merchant accountId forwarded as the
	// `X-Fulkruma-On-Behalf-Of` header. Platform-admin scope only.
	OnBehalfOf string
	// Timeout — per-request HTTP timeout. Default 30s.
	Timeout time.Duration
	// HTTP — inject a pre-configured client (custom transport, retries).
	// When nil the SDK constructs a fresh http.Client with Timeout.
	HTTP *http.Client
	// Now — clock source for signature timestamps; nil means time.Now.
	// Useful for tests that re-derive the signature deterministically.
	Now func() time.Time
}

// Client is the HMAC-signed Fulkruma REST client. Construct one per
// merchant (or one platform-admin client and call ForMerchant per call
// site).
type Client struct {
	keyID      string
	secret     string
	baseURL    string
	defaultOBO string
	timeout    time.Duration
	http       *http.Client
	now        func() time.Time

	// Resource namespaces — match the Node SDK property names.
	Products     *ProductsResource
	Warehouses   *WarehousesResource
	Stock        *StockResource
	Addresses    *AddressesResource
	Shipments    *ShipmentsResource
	Shipping     *ShippingResource
	Licenses     *LicensesResource
	Deliveries   *DeliveriesResource
	APIKeys      *APIKeysResource
	AuditLog     *AuditLogResource
	Billing      *BillingResource
	Integrations *IntegrationsResource
	Stats        *StatsResource
	Webhooks     *WebhooksResource
	Admin        *AdminResource
}

// NewClient constructs a Fulkruma client. Returns *Error when required
// fields are missing — never panics.
func NewClient(opts ClientOptions) (*Client, error) {
	if opts.KeyID == "" {
		opts.KeyID = os.Getenv("FULKRUMA_KEY_ID")
	}
	if opts.Secret == "" {
		opts.Secret = os.Getenv("FULKRUMA_SECRET")
	}
	if opts.BaseURL == "" {
		opts.BaseURL = os.Getenv("FULKRUMA_BASE_URL")
	}
	if opts.OnBehalfOf == "" {
		opts.OnBehalfOf = os.Getenv("FULKRUMA_ON_BEHALF_OF")
	}
	if opts.KeyID == "" {
		return nil, newErr(0, "missing_key_id",
			"FulkrumaClient: KeyID is required (set FULKRUMA_KEY_ID env or ClientOptions.KeyID)")
	}
	if opts.Secret == "" {
		return nil, newErr(0, "missing_secret",
			"FulkrumaClient: Secret is required (set FULKRUMA_SECRET env or ClientOptions.Secret)")
	}
	if opts.BaseURL == "" {
		opts.BaseURL = "https://fulkruma.com"
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 30 * time.Second
	}
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{Timeout: opts.Timeout}
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	c := &Client{
		keyID:      opts.KeyID,
		secret:     opts.Secret,
		baseURL:    strings.TrimRight(opts.BaseURL, "/"),
		defaultOBO: opts.OnBehalfOf,
		timeout:    opts.Timeout,
		http:       opts.HTTP,
		now:        opts.Now,
	}
	// Wire resource namespaces.
	c.Products = &ProductsResource{c: c}
	c.Warehouses = &WarehousesResource{c: c}
	c.Stock = &StockResource{c: c}
	c.Addresses = &AddressesResource{c: c}
	c.Shipments = &ShipmentsResource{c: c}
	c.Shipping = &ShippingResource{c: c}
	c.Licenses = &LicensesResource{c: c}
	c.Deliveries = &DeliveriesResource{c: c}
	c.APIKeys = &APIKeysResource{c: c}
	c.AuditLog = &AuditLogResource{c: c}
	c.Billing = &BillingResource{c: c}
	c.Integrations = &IntegrationsResource{c: c}
	c.Stats = &StatsResource{c: c}
	c.Webhooks = &WebhooksResource{c: c}
	c.Admin = &AdminResource{c: c}
	return c, nil
}

// ForMerchant returns a shallow clone scoped to a specific merchant.
// Only useful with platform-admin keys.
func (c *Client) ForMerchant(accountId string) *Client {
	clone, _ := NewClient(ClientOptions{
		KeyID:      c.keyID,
		Secret:     c.secret,
		BaseURL:    c.baseURL,
		OnBehalfOf: accountId,
		Timeout:    c.timeout,
		HTTP:       c.http,
		Now:        c.now,
	})
	return clone
}

// KeyID returns the HMAC access key id (for logging / dev tooling).
func (c *Client) KeyID() string { return c.keyID }

// BaseURL returns the resolved base URL.
func (c *Client) BaseURL() string { return c.baseURL }

// ─── Request plumbing ───────────────────────────────────────

// RequestOptions tunes a single low-level Request call. Most callers use
// the typed resource methods instead.
type RequestOptions struct {
	IdempotencyKey string
	OnBehalfOf     string // per-call override; "" falls back to default
}

// Request issues an HMAC-signed request and unmarshals `envelope.data`
// into `out`. Pass nil out to discard the response body.
//
// `body` is JSON-marshaled (compact, the Go default) before signing. The
// raw bytes that get signed are exactly the bytes that get sent over the
// wire — same invariant the backend enforces.
func (c *Client) Request(ctx context.Context, method, path string, body any, out any, opts *RequestOptions) error {
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return newErr(0, "serialize_failed", err.Error())
		}
	}

	var idem, obo string
	if opts != nil {
		idem = opts.IdempotencyKey
		obo = opts.OnBehalfOf
	}
	if obo == "" {
		obo = c.defaultOBO
	}

	timestamp := strconv.FormatInt(c.now().Unix(), 10)
	signature := c.sign(method, path, bodyBytes, timestamp, idem)

	url := c.baseURL + path
	var reqBody io.Reader
	if bodyBytes != nil {
		reqBody = bytes.NewReader(bodyBytes)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return newErr(0, "bad_request", err.Error())
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf(
		"Fulkruma-HMAC-SHA256 keyId=%s, scope=*, signature=%s",
		c.keyID, signature,
	))
	req.Header.Set("X-Fulkruma-Timestamp", timestamp)
	if bodyBytes != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idem != "" {
		req.Header.Set("Idempotency-Key", idem)
	}
	if obo != "" {
		req.Header.Set("X-Fulkruma-On-Behalf-Of", obo)
	}

	res, err := c.http.Do(req)
	if err != nil {
		// Best effort to distinguish timeout from generic transport.
		msg := err.Error()
		code := "network_error"
		if ctx.Err() == context.DeadlineExceeded || strings.Contains(msg, "deadline exceeded") ||
			strings.Contains(msg, "Client.Timeout") || strings.Contains(msg, "context deadline") {
			code = "timeout"
			msg = fmt.Sprintf("Fulkruma request timed out after %s", c.timeout)
		}
		return newErr(0, code, msg)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return newErr(res.StatusCode, "network_error", err.Error())
	}

	// Decode envelope. Empty body is treated as missing data.
	var env ApiEnvelope
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &env); err != nil {
			snippet := string(raw)
			if len(snippet) > 200 {
				snippet = snippet[:200]
			}
			return newErr(res.StatusCode, "invalid_response", "Non-JSON response: "+snippet)
		}
	}

	var reqID string
	if env.Meta != nil {
		reqID = env.Meta.RequestID
	}
	if res.StatusCode >= 400 || env.Error != nil {
		code := "unknown"
		msg := fmt.Sprintf("HTTP %d", res.StatusCode)
		if env.Error != nil {
			code = env.Error.Code
			msg = env.Error.Message
		}
		return newErrWithReqID(res.StatusCode, code, msg, reqID)
	}
	if out != nil && len(env.Data) > 0 && string(env.Data) != "null" {
		if err := json.Unmarshal(env.Data, out); err != nil {
			return newErrWithReqID(res.StatusCode, "decode_failed", err.Error(), reqID)
		}
	}
	return nil
}

// sign returns the hex-encoded HMAC-SHA256 over the canonical signing
// string. Mirrors `FulkrumaClient.sign` from the Node SDK exactly.
func (c *Client) sign(method, path string, body []byte, timestamp, idempotencyKey string) string {
	hash := sha256.Sum256(body) // sha256("") for empty payloads is well-defined.
	bodyHash := hex.EncodeToString(hash[:])

	var b strings.Builder
	b.WriteString(strings.ToUpper(method))
	b.WriteByte('\n')
	b.WriteString(path)
	b.WriteByte('\n')
	b.WriteString(timestamp)
	b.WriteByte('\n')
	b.WriteString(bodyHash)
	if idempotencyKey != "" {
		b.WriteByte('\n')
		b.WriteString(idempotencyKey)
	}

	mac := hmac.New(sha256.New, []byte(c.secret))
	mac.Write([]byte(b.String()))
	return hex.EncodeToString(mac.Sum(nil))
}

// genIdem mirrors `idem_${randomUUID()}` from the Node SDK.
func (c *Client) genIdem() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failing is exceptional — fall back to a timestamp.
		return fmt.Sprintf("idem_%d", c.now().UnixNano())
	}
	// RFC 4122 v4 layout.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("idem_%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// qs builds a URL query string from a map of {string→value}. Mirrors the
// Node SDK helper: skips nil values, JS-style bool coercion ("true" /
// "false"), and emits "?" prefix when non-empty.
func qs(params map[string]any) string {
	if len(params) == 0 {
		return ""
	}
	v := url.Values{}
	keys := make([]string, 0, len(params))
	for k, val := range params {
		if val == nil {
			continue
		}
		switch x := val.(type) {
		case string:
			if x == "" {
				continue
			}
			v.Set(k, x)
		case bool:
			if x {
				v.Set(k, "true")
			} else {
				v.Set(k, "false")
			}
		case int:
			v.Set(k, strconv.Itoa(x))
		case int64:
			v.Set(k, strconv.FormatInt(x, 10))
		case float64:
			v.Set(k, strconv.FormatFloat(x, 'f', -1, 64))
		default:
			v.Set(k, fmt.Sprintf("%v", x))
		}
		keys = append(keys, k)
	}
	if len(v) == 0 {
		return ""
	}
	return "?" + v.Encode()
}
