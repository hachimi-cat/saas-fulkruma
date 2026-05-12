package fulkruma

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
	"time"
)

// TestVerifyWebhook_RoundTrip signs a body the same way the backend does
// (see saas-fulkruma backend webhook signer) and verifies the SDK parses
// it. Any drift here means real webhooks will start 400ing.
func TestVerifyWebhook_RoundTrip(t *testing.T) {
	secret := "whsec_fulkruma_test_1234567890"
	body := []byte(`{"id":"evt_x","type":"fulkruma.shipment.created.v1","occurredAt":"2026-01-01T00:00:00Z","accountId":"acc_1","data":{"shipmentId":"shp_1"},"metadata":{}}`)
	timestamp := int64(1_750_000_000)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	sigHeader := fmt.Sprintf("t=%d,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))

	clock := func() time.Time { return time.Unix(timestamp+10, 0) }
	env, err := VerifyWebhook(body, sigHeader, secret, &VerifyWebhookOptions{Now: clock})
	if err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if env.ID != "evt_x" || env.Type != "fulkruma.shipment.created.v1" {
		t.Fatalf("envelope fields not decoded: %+v", env)
	}
}

func TestVerifyWebhook_Tampered(t *testing.T) {
	secret := "whsec_x"
	timestamp := int64(1_750_000_000)
	body := []byte(`{"id":"e","type":"t","occurredAt":"","accountId":null,"data":{"hello":"world"},"metadata":{}}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	good := hex.EncodeToString(mac.Sum(nil))

	// Same length, different content — should still fail.
	tampered := []byte(`{"id":"e","type":"t","occurredAt":"","accountId":null,"data":{"hello":"mAAAA"},"metadata":{}}`)
	sigHeader := fmt.Sprintf("t=%d,v1=%s", timestamp, good)
	clock := func() time.Time { return time.Unix(timestamp, 0) }

	if _, err := VerifyWebhook(tampered, sigHeader, secret, &VerifyWebhookOptions{Now: clock}); err == nil {
		t.Fatal("tampered body accepted")
	}
}

func TestVerifyWebhook_Expired(t *testing.T) {
	secret := "whsec_x"
	timestamp := int64(1_750_000_000)
	body := []byte(`{"id":"e","type":"t","occurredAt":"","accountId":null,"data":{},"metadata":{}}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	sigHeader := fmt.Sprintf("t=%d,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))

	// 10 min past — beyond default 5 min tolerance.
	clock := func() time.Time { return time.Unix(timestamp+600, 0) }
	_, err := VerifyWebhook(body, sigHeader, secret, &VerifyWebhookOptions{Now: clock})
	if err == nil {
		t.Fatal("stale signature accepted")
	}
	fe := err.(*Error)
	if fe.Code != "signature_expired" {
		t.Fatalf("expected signature_expired, got %s", fe.Code)
	}
}

func TestVerifyWebhook_MalformedHeader(t *testing.T) {
	if _, err := VerifyWebhook([]byte("x"), "", "s", nil); err == nil {
		t.Fatal("empty header accepted")
	}
	if _, err := VerifyWebhook([]byte("x"), "not-a-header", "s", nil); err == nil {
		t.Fatal("garbage header accepted")
	}
	if _, err := VerifyWebhook([]byte("x"), "t=abc,v1=deadbeef", "s", nil); err == nil {
		t.Fatal("non-numeric timestamp accepted")
	}
	// Right shape but v1 is hex that won't be sha256-sized.
	if _, err := VerifyWebhook([]byte("x"), "t=1,v1=aa", "s", nil); err == nil {
		t.Fatal("short v1 accepted")
	}
}

func TestVerifyWebhook_BodyParseFailure(t *testing.T) {
	// Sign valid, body is non-JSON garbage.
	secret := "whsec_z"
	ts := int64(1_750_000_000)
	body := []byte(`not json at all`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", ts)))
	mac.Write(body)
	header := fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
	clock := func() time.Time { return time.Unix(ts, 0) }

	_, err := VerifyWebhook(body, header, secret, &VerifyWebhookOptions{Now: clock})
	if err == nil {
		t.Fatal("non-JSON body accepted")
	}
	fe := err.(*Error)
	if fe.Code != "invalid_body" {
		t.Fatalf("expected invalid_body, got %s", fe.Code)
	}
}

func TestVerifyWebhook_HeaderWhitespaceTolerated(t *testing.T) {
	// Backends/proxies sometimes pad spaces. The parser must tolerate it.
	secret := "whsec_pad"
	ts := int64(1_750_000_000)
	body := []byte(`{"id":"e","type":"t","occurredAt":"","accountId":null,"data":{},"metadata":{}}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", ts)))
	mac.Write(body)
	good := hex.EncodeToString(mac.Sum(nil))
	header := fmt.Sprintf("  t = %d , v1 = %s  ", ts, good)
	clock := func() time.Time { return time.Unix(ts, 0) }

	if _, err := VerifyWebhook(body, strings.TrimSpace(header), secret, &VerifyWebhookOptions{Now: clock}); err != nil {
		t.Fatalf("padded header rejected: %v", err)
	}
}
