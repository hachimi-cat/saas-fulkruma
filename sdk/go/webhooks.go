package fulkruma

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

// VerifyWebhookOptions tunes VerifyWebhook. A nil pointer uses defaults.
type VerifyWebhookOptions struct {
	// ToleranceSec — max drift in seconds between the signature timestamp
	// and the current clock. Default 300 (5 min). Zero or negative means
	// "use the default".
	ToleranceSec int64
	// Now — clock for the freshness check. Nil means time.Now. Useful in
	// tests.
	Now func() time.Time
}

// VerifyWebhook verifies and parses an inbound Fulkruma webhook.
//
// Fulkruma signs every webhook delivery with::
//
//	Fulkruma-Signature: t=<unix>,v1=<hex>
//
// where `<hex> = HMAC-SHA256(secret, fmt.Sprintf("%s.%s", t, rawBody))`.
// The raw body bytes are what got signed — re-serialising parsed JSON
// will drift whitespace and the signature will never match.
//
// Returns the parsed envelope on success. Returns *Error on any failure
// (missing header, drift, bad signature, malformed JSON).
//
// net/http example:
//
//	func fulkrumaWebhook(w http.ResponseWriter, r *http.Request) {
//	    body, err := io.ReadAll(r.Body)
//	    if err != nil { http.Error(w, "bad body", 400); return }
//	    sig := r.Header.Get("Fulkruma-Signature")
//	    event, err := fulkruma.VerifyWebhook(body, sig, os.Getenv("FULKRUMA_WEBHOOK_SECRET"), nil)
//	    if err != nil { http.Error(w, err.Error(), 400); return }
//	    // switch event.Type { … }; reply 204.
//	}
func VerifyWebhook(rawBody []byte, signatureHeader, secret string, opts *VerifyWebhookOptions) (*WebhookEventEnvelope, error) {
	if signatureHeader == "" {
		return nil, newErr(0, "missing_signature", "missing Fulkruma-Signature header")
	}

	tolerance := int64(300)
	nowFn := time.Now
	if opts != nil {
		if opts.ToleranceSec > 0 {
			tolerance = opts.ToleranceSec
		}
		if opts.Now != nil {
			nowFn = opts.Now
		}
	}

	ts, v1, ok := parseFulkrumaSignature(signatureHeader)
	if !ok {
		return nil, newErr(0, "malformed_signature", "malformed signature header")
	}
	tsNum, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return nil, newErr(0, "malformed_signature", "non-numeric timestamp")
	}
	drift := nowFn().Unix() - tsNum
	if drift < 0 {
		drift = -drift
	}
	if drift > tolerance {
		return nil, newErr(0, "signature_expired",
			"signature timestamp "+strconv.FormatInt(drift, 10)+"s out of tolerance")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts))
	mac.Write([]byte{'.'})
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))

	// Constant-time compare. Fall back to a length check first because
	// hmac.Equal is constant-time only on equal-length inputs.
	givenBytes, err := hex.DecodeString(v1)
	if err != nil || len(givenBytes) != sha256.Size {
		return nil, newErr(0, "bad_signature", "bad signature")
	}
	expectedBytes, _ := hex.DecodeString(expected)
	if !hmac.Equal(expectedBytes, givenBytes) {
		return nil, newErr(0, "bad_signature", "bad signature")
	}

	var env WebhookEventEnvelope
	if err := json.Unmarshal(rawBody, &env); err != nil {
		return nil, newErr(0, "invalid_body", "webhook body is not valid JSON")
	}
	return &env, nil
}

func parseFulkrumaSignature(header string) (ts, v1 string, ok bool) {
	var tSeen, v1Seen bool
	for _, segment := range strings.Split(header, ",") {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		k, v, found := strings.Cut(segment, "=")
		if !found {
			continue
		}
		switch strings.TrimSpace(k) {
		case "t":
			ts = strings.TrimSpace(v)
			tSeen = true
		case "v1":
			v1 = strings.TrimSpace(v)
			v1Seen = true
		}
	}
	return ts, v1, tSeen && v1Seen
}
