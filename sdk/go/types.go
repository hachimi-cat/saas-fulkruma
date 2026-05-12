package fulkruma

import "encoding/json"

// ApiEnvelope mirrors the backend's standard `{ data, error, meta }` JSON
// shape. Generic-free on purpose — every resource method unmarshals
// `Data` into a concrete struct.
type ApiEnvelope struct {
	Data  json.RawMessage `json:"data"`
	Error *ErrorBody      `json:"error"`
	Meta  *EnvelopeMeta   `json:"meta,omitempty"`
}

// ErrorBody is the inner shape of `envelope.error`.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// EnvelopeMeta carries the pagination + tracing fields the backend
// returns alongside every response.
type EnvelopeMeta struct {
	RequestID string `json:"requestId,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Cursor    string `json:"cursor,omitempty"`
	HasMore   bool   `json:"hasMore,omitempty"`
}

// ─── Catalogue ──────────────────────────────────────────────

// ProductType — "physical" | "digital" | "license".
type ProductType string

const (
	ProductTypePhysical ProductType = "physical"
	ProductTypeDigital  ProductType = "digital"
	ProductTypeLicense  ProductType = "license"
)

// ProductVariant matches the Node SDK type 1:1.
type ProductVariant struct {
	ID                 string  `json:"id"`
	ProductID          string  `json:"productId"`
	SKU                *string `json:"sku"`
	Name               string  `json:"name"`
	PriceCents         int64   `json:"priceCents"`
	CostCents          *int64  `json:"costCents"`
	LowStockThreshold  *int64  `json:"lowStockThreshold"`
	Weight             *float64 `json:"weight"`
	IsDefault          bool    `json:"isDefault"`
	Archived           bool    `json:"archived"`
	ExternalRef        *string `json:"externalRef"`
	ExternalSource     *string `json:"externalSource"`
	CreatedAt          string  `json:"createdAt"`
	UpdatedAt          string  `json:"updatedAt"`
}

// Product matches the Node SDK type 1:1.
type Product struct {
	ID             string           `json:"id"`
	AccountID      string           `json:"accountId"`
	Name           string           `json:"name"`
	SKU            *string          `json:"sku"`
	Description    *string          `json:"description"`
	Type           ProductType      `json:"type"`
	Weight         *float64         `json:"weight"`
	Length         *float64         `json:"length"`
	Width          *float64         `json:"width"`
	Height         *float64         `json:"height"`
	LicenseEnabled bool             `json:"licenseEnabled"`
	MaxActivations int64            `json:"maxActivations"`
	ExternalRef    *string          `json:"externalRef"`
	ExternalSource *string          `json:"externalSource"`
	Archived       bool             `json:"archived"`
	Metadata       map[string]any   `json:"metadata"`
	CreatedAt      string           `json:"createdAt"`
	UpdatedAt      string           `json:"updatedAt"`
	Variants       []ProductVariant `json:"variants,omitempty"`
}

// ─── Inventory ──────────────────────────────────────────────

type Warehouse struct {
	ID        string  `json:"id"`
	AccountID string  `json:"accountId"`
	Name      string  `json:"name"`
	Address   *string `json:"address"`
	City      *string `json:"city"`
	Postal    *string `json:"postal"`
	Phone     *string `json:"phone"`
	IsDefault bool    `json:"isDefault"`
	Archived  bool    `json:"archived"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

type VariantStock struct {
	ID          string             `json:"id"`
	VariantID   string             `json:"variantId"`
	WarehouseID string             `json:"warehouseId"`
	Quantity    int64              `json:"quantity"`
	UpdatedAt   string             `json:"updatedAt"`
	Warehouse   *VariantStockWarehouseRef `json:"warehouse,omitempty"`
}

// VariantStockWarehouseRef is the truncated warehouse hint the backend
// inlines on level responses.
type VariantStockWarehouseRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// StockMovementReason — enumerated values match Node SDK.
type StockMovementReason string

const (
	StockMovementManualAdjust       StockMovementReason = "manual_adjust"
	StockMovementCheckoutReserve    StockMovementReason = "checkout_reserve"
	StockMovementCheckoutCommit     StockMovementReason = "checkout_commit"
	StockMovementCheckoutRelease    StockMovementReason = "checkout_release"
	StockMovementRefundRestock      StockMovementReason = "refund_restock"
	StockMovementTransferIn         StockMovementReason = "transfer_in"
	StockMovementTransferOut        StockMovementReason = "transfer_out"
	StockMovementDamaged            StockMovementReason = "damaged"
	StockMovementReturnedToSupplier StockMovementReason = "returned_to_supplier"
	StockMovementInitialStock       StockMovementReason = "initial_stock"
	StockMovementImport             StockMovementReason = "import"
)

type StockMovement struct {
	ID          string              `json:"id"`
	VariantID   string              `json:"variantId"`
	WarehouseID string              `json:"warehouseId"`
	Delta       int64               `json:"delta"`
	Reason      StockMovementReason `json:"reason"`
	ReferenceID *string             `json:"referenceId"`
	Note        *string             `json:"note"`
	CreatedAt   string              `json:"createdAt"`
	CreatedBy   *string             `json:"createdBy"`
}

type StockReservation struct {
	ID                string  `json:"id"`
	VariantID         string  `json:"variantId"`
	WarehouseID       string  `json:"warehouseId"`
	Quantity          int64   `json:"quantity"`
	CheckoutSessionID string  `json:"checkoutSessionId"`
	ExpiresAt         string  `json:"expiresAt"`
	ConsumedAt        *string `json:"consumedAt"`
	ReleasedAt        *string `json:"releasedAt"`
	CreatedAt         string  `json:"createdAt"`
}

// ─── Addresses + Shipping ────────────────────────────────────

type CustomerAddress struct {
	ID                  string   `json:"id"`
	CustomerID          string   `json:"customerId"`
	AccountID           string   `json:"accountId"`
	Label               string   `json:"label"`
	ContactName         string   `json:"contactName"`
	ContactPhone        string   `json:"contactPhone"`
	Email               *string  `json:"email"`
	Address             string   `json:"address"`
	PostalCode          *string  `json:"postalCode"`
	AreaID              *string  `json:"areaId"`
	Lat                 *float64 `json:"lat"`
	Lng                 *float64 `json:"lng"`
	BiteshipLocationID  *string  `json:"biteshipLocationId"`
	IsDefault           bool     `json:"isDefault"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt"`
}

// ShipmentStatus — enumerated.
type ShipmentStatus string

const (
	ShipmentPending     ShipmentStatus = "pending"
	ShipmentConfirmed   ShipmentStatus = "confirmed"
	ShipmentAllocated   ShipmentStatus = "allocated"
	ShipmentPickingUp   ShipmentStatus = "picking_up"
	ShipmentPickedUp    ShipmentStatus = "picked_up"
	ShipmentDroppingOff ShipmentStatus = "dropping_off"
	ShipmentInTransit   ShipmentStatus = "in_transit"
	ShipmentDelivered   ShipmentStatus = "delivered"
	ShipmentCancelled   ShipmentStatus = "cancelled"
	ShipmentReturned    ShipmentStatus = "returned"
	ShipmentFailed      ShipmentStatus = "failed"
)

type Shipment struct {
	ID                  string                   `json:"id"`
	AccountID           string                   `json:"accountId"`
	ProductID           *string                  `json:"productId"`
	CheckoutSessionID   *string                  `json:"checkoutSessionId"`
	CustomerID          *string                  `json:"customerId"`
	CustomerEmail       *string                  `json:"customerEmail"`
	BiteshipOrderID     string                   `json:"biteshipOrderId"`
	BiteshipTrackingID  *string                  `json:"biteshipTrackingId"`
	WaybillID           *string                  `json:"waybillId"`
	CourierCode         string                   `json:"courierCode"`
	CourierServiceCode  string                   `json:"courierServiceCode"`
	CourierType         string                   `json:"courierType"`
	Status              ShipmentStatus           `json:"status"`
	TrackingURL         *string                  `json:"trackingUrl"`
	LabelURL            *string                  `json:"labelUrl"`
	Price               float64                  `json:"price"`
	Insurance           float64                  `json:"insurance"`
	Insured             bool                     `json:"insured"`
	OriginSnapshot      map[string]any           `json:"originSnapshot"`
	DestinationSnapshot map[string]any           `json:"destinationSnapshot"`
	Items               []map[string]any         `json:"items"`
	CancelReason        *string                  `json:"cancelReason"`
	ExternalSource      *string                  `json:"externalSource"`
	ExternalRef         *string                  `json:"externalRef"`
	CreatedAt           string                   `json:"createdAt"`
	UpdatedAt           string                   `json:"updatedAt"`
}

// ─── Digital fulfilment ─────────────────────────────────────

// LicenseStatus — "active" | "revoked".
type LicenseStatus string

const (
	LicenseActive  LicenseStatus = "active"
	LicenseRevoked LicenseStatus = "revoked"
)

type License struct {
	ID             string        `json:"id"`
	AccountID      string        `json:"accountId"`
	ProductID      string        `json:"productId"`
	CustomerID     string        `json:"customerId"`
	Key            string        `json:"key"`
	Status         LicenseStatus `json:"status"`
	Activations    int64         `json:"activations"`
	MaxActivations int64         `json:"maxActivations"`
	ExpiresAt      *string       `json:"expiresAt"`
	ExternalSource *string       `json:"externalSource"`
	ExternalRef    *string       `json:"externalRef"`
	CreatedAt      string        `json:"createdAt"`
	UpdatedAt      string        `json:"updatedAt"`
}

type LicenseActivation struct {
	ID             string  `json:"id"`
	LicenseID      string  `json:"licenseId"`
	InstanceID     string  `json:"instanceId"`
	ActivatedAt    string  `json:"activatedAt"`
	DeactivatedAt  *string `json:"deactivatedAt"`
}

type Delivery struct {
	ID                string  `json:"id"`
	AccountID         string  `json:"accountId"`
	ProductID         string  `json:"productId"`
	CustomerID        string  `json:"customerId"`
	CheckoutSessionID string  `json:"checkoutSessionId"`
	DownloadCount     int64   `json:"downloadCount"`
	MaxDownloads      int64   `json:"maxDownloads"`
	ExpiresAt         string  `json:"expiresAt"`
	ExternalSource    *string `json:"externalSource"`
	ExternalRef       *string `json:"externalRef"`
	CreatedAt         string  `json:"createdAt"`
	UpdatedAt         string  `json:"updatedAt"`
}

// ─── Partner billing ────────────────────────────────────────

type PartnerWorkspace struct {
	AccountID     string  `json:"accountId"`
	Partner       string  `json:"partner"`
	DiscountRate  float64 `json:"discountRate"`
	BrandName     *string `json:"brandName"`
	BusinessEmail *string `json:"businessEmail"`
	CreatedAt     string  `json:"createdAt"`
}

type PartnerUsagePeriod struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type PartnerUsageTotals struct {
	Shipments       int64 `json:"shipments"`
	LicensesIssued  int64 `json:"licensesIssued"`
	Deliveries      int64 `json:"deliveries"`
	ChargeableCents int64 `json:"chargeableCents"`
}

type PartnerUsageMerchant struct {
	AccountID       string `json:"accountId"`
	Shipments       int64  `json:"shipments"`
	LicensesIssued  int64  `json:"licensesIssued"`
	Deliveries      int64  `json:"deliveries"`
	ChargeableCents int64  `json:"chargeableCents"`
}

type PartnerUsageSummary struct {
	Partner    string                 `json:"partner"`
	Period     PartnerUsagePeriod     `json:"period"`
	Totals     PartnerUsageTotals     `json:"totals"`
	ByMerchant []PartnerUsageMerchant `json:"byMerchant"`
}

// ─── Webhook events ─────────────────────────────────────────

// WebhookEventEnvelope is the parsed shape returned by VerifyWebhook.
// Data stays as RawMessage so callers can switch on Type before
// unmarshaling.
type WebhookEventEnvelope struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	OccurredAt string          `json:"occurredAt"`
	AccountID  *string         `json:"accountId"`
	Data       json.RawMessage `json:"data"`
	Metadata   map[string]any  `json:"metadata"`
}
