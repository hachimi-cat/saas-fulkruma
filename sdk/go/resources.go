package fulkruma

import (
	"context"
	"fmt"
)

// All resource types share a backref to the parent Client. Each method
// passes a fresh context the caller controls, so cancelation propagates.

// ─── Products ───────────────────────────────────────────────

// ProductCreateInput is the request body for Products.Create.
// Optional fields are JSON-omitempty so zero values don't override
// backend defaults.
type ProductCreateInput struct {
	Name           string       `json:"name"`
	SKU            string       `json:"sku,omitempty"`
	Description    string       `json:"description,omitempty"`
	Type           ProductType  `json:"type,omitempty"`
	Weight         *float64     `json:"weight,omitempty"`
	Length         *float64     `json:"length,omitempty"`
	Width          *float64     `json:"width,omitempty"`
	Height         *float64     `json:"height,omitempty"`
	LicenseEnabled *bool        `json:"licenseEnabled,omitempty"`
	MaxActivations *int64       `json:"maxActivations,omitempty"`
	ExternalRef    string       `json:"externalRef,omitempty"`
	ExternalSource string       `json:"externalSource,omitempty"`
}

// ProductUpdateInput patches a product — every field is optional.
type ProductUpdateInput struct {
	Name           *string      `json:"name,omitempty"`
	SKU            *string      `json:"sku,omitempty"`
	Description    *string      `json:"description,omitempty"`
	Type           *ProductType `json:"type,omitempty"`
	Weight         *float64     `json:"weight,omitempty"`
	Length         *float64     `json:"length,omitempty"`
	Width          *float64     `json:"width,omitempty"`
	Height         *float64     `json:"height,omitempty"`
	LicenseEnabled *bool        `json:"licenseEnabled,omitempty"`
	MaxActivations *int64       `json:"maxActivations,omitempty"`
	ExternalRef    *string      `json:"externalRef,omitempty"`
	ExternalSource *string      `json:"externalSource,omitempty"`
}

// VariantCreateInput is the request body for Products.AddVariant.
type VariantCreateInput struct {
	Name              string  `json:"name"`
	SKU               string  `json:"sku,omitempty"`
	PriceCents        *int64  `json:"priceCents,omitempty"`
	CostCents         *int64  `json:"costCents,omitempty"`
	LowStockThreshold *int64  `json:"lowStockThreshold,omitempty"`
	Weight            *float64 `json:"weight,omitempty"`
	IsDefault         *bool   `json:"isDefault,omitempty"`
	ExternalRef       string  `json:"externalRef,omitempty"`
	ExternalSource    string  `json:"externalSource,omitempty"`
}

// VariantUpdateInput is the PATCH-only counterpart.
type VariantUpdateInput struct {
	Name              *string  `json:"name,omitempty"`
	SKU               *string  `json:"sku,omitempty"`
	PriceCents        *int64   `json:"priceCents,omitempty"`
	CostCents         *int64   `json:"costCents,omitempty"`
	LowStockThreshold *int64   `json:"lowStockThreshold,omitempty"`
	Weight            *float64 `json:"weight,omitempty"`
	IsDefault         *bool    `json:"isDefault,omitempty"`
	ExternalRef       *string  `json:"externalRef,omitempty"`
	ExternalSource    *string  `json:"externalSource,omitempty"`
}

// ProductsResource groups every /api/v1/products call.
type ProductsResource struct{ c *Client }

// ProductEnvelope wraps `{ product: Product }` responses.
type ProductEnvelope struct {
	Product Product `json:"product"`
}

// ProductListEnvelope wraps `{ products: [] }` responses.
type ProductListEnvelope struct {
	Products []Product `json:"products"`
}

// VariantEnvelope wraps `{ variant: ProductVariant }` responses.
type VariantEnvelope struct {
	Variant ProductVariant `json:"variant"`
}

// ArchivedEnvelope wraps `{ archived: bool }` responses.
type ArchivedEnvelope struct {
	Archived bool `json:"archived"`
}

// DeletedEnvelope wraps `{ deleted: bool }` responses.
type DeletedEnvelope struct {
	Deleted bool `json:"deleted"`
}

// Create — POST /api/v1/products (idempotent via auto-generated key).
func (r *ProductsResource) Create(ctx context.Context, in ProductCreateInput) (*Product, error) {
	var out ProductEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/products", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return &out.Product, nil
}

// Get — GET /api/v1/products/:id.
func (r *ProductsResource) Get(ctx context.Context, id string) (*Product, error) {
	var out ProductEnvelope
	err := r.c.Request(ctx, "GET", "/api/v1/products/"+id, nil, &out, nil)
	if err != nil {
		return nil, err
	}
	return &out.Product, nil
}

// ProductListParams filters the list endpoint.
type ProductListParams struct {
	Archived *bool
}

// List — GET /api/v1/products.
func (r *ProductsResource) List(ctx context.Context, p ProductListParams) ([]Product, error) {
	params := map[string]any{}
	if p.Archived != nil {
		params["archived"] = *p.Archived
	}
	var out ProductListEnvelope
	err := r.c.Request(ctx, "GET", "/api/v1/products"+qs(params), nil, &out, nil)
	if err != nil {
		return nil, err
	}
	return out.Products, nil
}

// Update — PATCH /api/v1/products/:id.
func (r *ProductsResource) Update(ctx context.Context, id string, patch ProductUpdateInput) (*Product, error) {
	var out ProductEnvelope
	err := r.c.Request(ctx, "PATCH", "/api/v1/products/"+id, patch, &out, nil)
	if err != nil {
		return nil, err
	}
	return &out.Product, nil
}

// Archive — DELETE /api/v1/products/:id (soft delete).
func (r *ProductsResource) Archive(ctx context.Context, id string) (bool, error) {
	var out ArchivedEnvelope
	err := r.c.Request(ctx, "DELETE", "/api/v1/products/"+id, nil, &out, nil)
	if err != nil {
		return false, err
	}
	return out.Archived, nil
}

// AddVariant — POST /api/v1/products/:id/variants.
func (r *ProductsResource) AddVariant(ctx context.Context, productID string, in VariantCreateInput) (*ProductVariant, error) {
	var out VariantEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/products/"+productID+"/variants", in, &out, nil)
	if err != nil {
		return nil, err
	}
	return &out.Variant, nil
}

// UpdateVariant — PATCH /api/v1/products/:productId/variants/:variantId.
func (r *ProductsResource) UpdateVariant(ctx context.Context, productID, variantID string, patch VariantUpdateInput) (*ProductVariant, error) {
	var out VariantEnvelope
	err := r.c.Request(ctx, "PATCH",
		"/api/v1/products/"+productID+"/variants/"+variantID, patch, &out, nil)
	if err != nil {
		return nil, err
	}
	return &out.Variant, nil
}

// ArchiveVariant — DELETE /api/v1/products/:productId/variants/:variantId.
func (r *ProductsResource) ArchiveVariant(ctx context.Context, productID, variantID string) (bool, error) {
	var out ArchivedEnvelope
	err := r.c.Request(ctx, "DELETE",
		"/api/v1/products/"+productID+"/variants/"+variantID, nil, &out, nil)
	if err != nil {
		return false, err
	}
	return out.Archived, nil
}

// ─── Warehouses ─────────────────────────────────────────────

// WarehouseCreateInput — POST /api/v1/warehouses body.
type WarehouseCreateInput struct {
	Name      string   `json:"name"`
	Address   string   `json:"address,omitempty"`
	City      string   `json:"city,omitempty"`
	Postal    string   `json:"postal,omitempty"`
	Lat       *float64 `json:"lat,omitempty"`
	Lng       *float64 `json:"lng,omitempty"`
	Phone     string   `json:"phone,omitempty"`
	IsDefault *bool    `json:"isDefault,omitempty"`
}

// WarehouseUpdateInput — PATCH-only counterpart.
type WarehouseUpdateInput struct {
	Name      *string  `json:"name,omitempty"`
	Address   *string  `json:"address,omitempty"`
	City      *string  `json:"city,omitempty"`
	Postal    *string  `json:"postal,omitempty"`
	Lat       *float64 `json:"lat,omitempty"`
	Lng       *float64 `json:"lng,omitempty"`
	Phone     *string  `json:"phone,omitempty"`
	IsDefault *bool    `json:"isDefault,omitempty"`
}

// WarehousesResource — /api/v1/warehouses.
type WarehousesResource struct{ c *Client }

type warehouseEnvelope struct {
	Warehouse Warehouse `json:"warehouse"`
}

type warehouseListEnvelope struct {
	Warehouses []Warehouse `json:"warehouses"`
}

// Create — POST /api/v1/warehouses.
func (r *WarehousesResource) Create(ctx context.Context, in WarehouseCreateInput) (*Warehouse, error) {
	var out warehouseEnvelope
	if err := r.c.Request(ctx, "POST", "/api/v1/warehouses", in, &out, nil); err != nil {
		return nil, err
	}
	return &out.Warehouse, nil
}

// List — GET /api/v1/warehouses.
func (r *WarehousesResource) List(ctx context.Context) ([]Warehouse, error) {
	var out warehouseListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/warehouses", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Warehouses, nil
}

// Update — PATCH /api/v1/warehouses/:id.
func (r *WarehousesResource) Update(ctx context.Context, id string, patch WarehouseUpdateInput) (*Warehouse, error) {
	var out warehouseEnvelope
	if err := r.c.Request(ctx, "PATCH", "/api/v1/warehouses/"+id, patch, &out, nil); err != nil {
		return nil, err
	}
	return &out.Warehouse, nil
}

// Archive — DELETE /api/v1/warehouses/:id.
func (r *WarehousesResource) Archive(ctx context.Context, id string) (bool, error) {
	var out ArchivedEnvelope
	if err := r.c.Request(ctx, "DELETE", "/api/v1/warehouses/"+id, nil, &out, nil); err != nil {
		return false, err
	}
	return out.Archived, nil
}

// ─── Stock ──────────────────────────────────────────────────

// StockResource — /api/v1/stock.
type StockResource struct{ c *Client }

type stockLevelsEnvelope struct {
	Stock []VariantStock `json:"stock"`
}

type stockMovementsEnvelope struct {
	Movements []StockMovement `json:"movements"`
}

type stockReservationsEnvelope struct {
	Reservations []StockReservation `json:"reservations"`
}

// StockAdjustInput — POST /api/v1/stock/adjust body.
type StockAdjustInput struct {
	VariantID   string              `json:"variantId"`
	WarehouseID string              `json:"warehouseId"`
	Delta       int64               `json:"delta"`
	Reason      StockMovementReason `json:"reason"`
	Note        string              `json:"note,omitempty"`
}

// StockAdjustResult mirrors `{ stock, movement }`.
type StockAdjustResult struct {
	Stock    VariantStock  `json:"stock"`
	Movement StockMovement `json:"movement"`
}

// Levels — GET /api/v1/stock/levels.
func (r *StockResource) Levels(ctx context.Context, variantID string) ([]VariantStock, error) {
	var out stockLevelsEnvelope
	q := map[string]any{}
	if variantID != "" {
		q["variant_id"] = variantID
	}
	if err := r.c.Request(ctx, "GET", "/api/v1/stock/levels"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Stock, nil
}

// Movements — GET /api/v1/stock/movements.
func (r *StockResource) Movements(ctx context.Context, variantID string) ([]StockMovement, error) {
	var out stockMovementsEnvelope
	q := map[string]any{}
	if variantID != "" {
		q["variant_id"] = variantID
	}
	if err := r.c.Request(ctx, "GET", "/api/v1/stock/movements"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Movements, nil
}

// Reservations — GET /api/v1/stock/reservations.
func (r *StockResource) Reservations(ctx context.Context) ([]StockReservation, error) {
	var out stockReservationsEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/stock/reservations", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Reservations, nil
}

// Adjust — POST /api/v1/stock/adjust (idempotent).
func (r *StockResource) Adjust(ctx context.Context, in StockAdjustInput) (*StockAdjustResult, error) {
	var out StockAdjustResult
	err := r.c.Request(ctx, "POST", "/api/v1/stock/adjust", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Addresses ──────────────────────────────────────────────

// AddressesResource — /api/v1/addresses.
type AddressesResource struct{ c *Client }

type addressEnvelope struct {
	Address CustomerAddress `json:"address"`
}

type addressListEnvelope struct {
	Addresses []CustomerAddress `json:"addresses"`
}

// AddressCreateInput — POST /api/v1/addresses body.
type AddressCreateInput struct {
	CustomerID   string   `json:"customerId"`
	Label        string   `json:"label"`
	ContactName  string   `json:"contactName"`
	ContactPhone string   `json:"contactPhone"`
	Email        string   `json:"email,omitempty"`
	Address      string   `json:"address"`
	PostalCode   string   `json:"postalCode,omitempty"`
	AreaID       string   `json:"areaId,omitempty"`
	Lat          *float64 `json:"lat,omitempty"`
	Lng          *float64 `json:"lng,omitempty"`
	IsDefault    *bool    `json:"isDefault,omitempty"`
}

// List — GET /api/v1/addresses.
func (r *AddressesResource) List(ctx context.Context, customerID string) ([]CustomerAddress, error) {
	q := map[string]any{}
	if customerID != "" {
		q["customer_id"] = customerID
	}
	var out addressListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/addresses"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Addresses, nil
}

// Create — POST /api/v1/addresses.
func (r *AddressesResource) Create(ctx context.Context, in AddressCreateInput) (*CustomerAddress, error) {
	var out addressEnvelope
	if err := r.c.Request(ctx, "POST", "/api/v1/addresses", in, &out, nil); err != nil {
		return nil, err
	}
	return &out.Address, nil
}

// Delete — DELETE /api/v1/addresses/:id.
func (r *AddressesResource) Delete(ctx context.Context, id string) (bool, error) {
	var out DeletedEnvelope
	if err := r.c.Request(ctx, "DELETE", "/api/v1/addresses/"+id, nil, &out, nil); err != nil {
		return false, err
	}
	return out.Deleted, nil
}

// ─── Shipments ──────────────────────────────────────────────

// ShipmentsResource — /api/v1/shipments.
type ShipmentsResource struct{ c *Client }

type shipmentEnvelope struct {
	Shipment Shipment `json:"shipment"`
}

type shipmentListEnvelope struct {
	Shipments []Shipment `json:"shipments"`
}

// ShipmentCreateInput is intentionally loosely typed to match the Node
// SDK — origin/destination/items are arbitrary JSON shapes the backend
// validates.
type ShipmentCreateInput struct {
	ProductID          string                   `json:"productId,omitempty"`
	CheckoutSessionID  string                   `json:"checkoutSessionId,omitempty"`
	CustomerID         string                   `json:"customerId,omitempty"`
	CustomerEmail      string                   `json:"customerEmail,omitempty"`
	CourierCode        string                   `json:"courierCode"`
	CourierServiceCode string                   `json:"courierServiceCode"`
	CourierType        string                   `json:"courierType"`
	Price              float64                  `json:"price"`
	Insurance          *float64                 `json:"insurance,omitempty"`
	Insured            *bool                    `json:"insured,omitempty"`
	Origin             map[string]any           `json:"origin"`
	Destination        map[string]any           `json:"destination"`
	Items              []map[string]any         `json:"items"`
	ExternalSource     string                   `json:"externalSource,omitempty"`
	ExternalRef        string                   `json:"externalRef,omitempty"`
}

// List — GET /api/v1/shipments.
func (r *ShipmentsResource) List(ctx context.Context, status string) ([]Shipment, error) {
	q := map[string]any{}
	if status != "" {
		q["status"] = status
	}
	var out shipmentListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/shipments"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Shipments, nil
}

// Get — GET /api/v1/shipments/:id.
func (r *ShipmentsResource) Get(ctx context.Context, id string) (*Shipment, error) {
	var out shipmentEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/shipments/"+id, nil, &out, nil); err != nil {
		return nil, err
	}
	return &out.Shipment, nil
}

// Create — POST /api/v1/shipments (idempotent).
func (r *ShipmentsResource) Create(ctx context.Context, in ShipmentCreateInput) (*Shipment, error) {
	var out shipmentEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/shipments", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return &out.Shipment, nil
}

// ─── Shipping ───────────────────────────────────────────────

// ShippingResource — /api/v1/shipping/*.
type ShippingResource struct{ c *Client }

// Couriers — GET /api/v1/shipping/couriers (untyped — passthrough to backend).
func (r *ShippingResource) Couriers(ctx context.Context) ([]map[string]any, error) {
	var out []map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/shipping/couriers", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// Origin — GET /api/v1/shipping/origin.
func (r *ShippingResource) Origin(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/shipping/origin", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// SetOrigin — PATCH /api/v1/shipping/origin.
func (r *ShippingResource) SetOrigin(ctx context.Context, in map[string]any) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "PATCH", "/api/v1/shipping/origin", in, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// ShippingRatesInput — POST /api/v1/shipping/rates body.
type ShippingRatesInput struct {
	Destination map[string]any   `json:"destination"`
	Items       []map[string]any `json:"items"`
	Insurance   *bool            `json:"insurance,omitempty"`
}

// Rates — POST /api/v1/shipping/rates.
func (r *ShippingResource) Rates(ctx context.Context, in ShippingRatesInput) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "POST", "/api/v1/shipping/rates", in, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// ─── Licenses ───────────────────────────────────────────────

// LicensesResource — /api/v1/licenses.
type LicensesResource struct{ c *Client }

type licenseEnvelope struct {
	License License `json:"license"`
}

type licenseListEnvelope struct {
	Licenses []License `json:"licenses"`
}

// LicenseIssueInput — POST /api/v1/licenses body.
type LicenseIssueInput struct {
	ProductID      string `json:"productId"`
	CustomerID     string `json:"customerId"`
	MaxActivations *int64 `json:"maxActivations,omitempty"`
	ExpiresAt      string `json:"expiresAt,omitempty"`
	ExternalSource string `json:"externalSource,omitempty"`
	ExternalRef    string `json:"externalRef,omitempty"`
}

// LicenseActivateInput / LicenseDeactivateInput are public-unauthenticated.
type LicenseActivateInput struct {
	Key        string `json:"key"`
	InstanceID string `json:"instanceId"`
}

// LicenseActivateResult mirrors the Node response.
type LicenseActivateResult struct {
	License       License           `json:"license"`
	Activation    LicenseActivation `json:"activation"`
	AlreadyActive bool              `json:"alreadyActive"`
}

// LicenseDeactivateResult mirrors the Node response.
type LicenseDeactivateResult struct {
	Deactivated        bool  `json:"deactivated"`
	AlreadyDeactivated bool  `json:"alreadyDeactivated"`
	Activations        int64 `json:"activations"`
}

// LicenseValidateResult — payload returned by GET /licenses/validate.
type LicenseValidateResult struct {
	Valid          bool    `json:"valid"`
	Key            string  `json:"key"`
	Status         *string `json:"status"`
	ProductID      *string `json:"productId"`
	Activations    *int64  `json:"activations"`
	MaxActivations *int64  `json:"maxActivations"`
	ExpiresAt      *string `json:"expiresAt"`
}

// List — GET /api/v1/licenses.
func (r *LicensesResource) List(ctx context.Context) ([]License, error) {
	var out licenseListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/licenses", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Licenses, nil
}

// Issue — POST /api/v1/licenses (idempotent).
func (r *LicensesResource) Issue(ctx context.Context, in LicenseIssueInput) (*License, error) {
	var out licenseEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/licenses", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return &out.License, nil
}

// Revoke — POST /api/v1/licenses/:id/revoke.
func (r *LicensesResource) Revoke(ctx context.Context, id string) (*License, error) {
	var out licenseEnvelope
	if err := r.c.Request(ctx, "POST", "/api/v1/licenses/"+id+"/revoke",
		map[string]any{}, &out, nil); err != nil {
		return nil, err
	}
	return &out.License, nil
}

// Activate — public unauthenticated. Pass arbitrary creds; the HMAC is
// still attached but the backend treats this route as unauthenticated.
func (r *LicensesResource) Activate(ctx context.Context, in LicenseActivateInput) (*LicenseActivateResult, error) {
	var out LicenseActivateResult
	if err := r.c.Request(ctx, "POST", "/api/v1/licenses/activate", in, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// Deactivate — public unauthenticated.
func (r *LicensesResource) Deactivate(ctx context.Context, in LicenseActivateInput) (*LicenseDeactivateResult, error) {
	var out LicenseDeactivateResult
	if err := r.c.Request(ctx, "POST", "/api/v1/licenses/deactivate", in, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// LicenseValidateParams — GET /licenses/validate query.
type LicenseValidateParams struct {
	Key       string
	ProductID string
}

// Validate — public unauthenticated.
func (r *LicensesResource) Validate(ctx context.Context, p LicenseValidateParams) (*LicenseValidateResult, error) {
	q := map[string]any{"key": p.Key}
	if p.ProductID != "" {
		q["productId"] = p.ProductID
	}
	var out LicenseValidateResult
	if err := r.c.Request(ctx, "GET", "/api/v1/licenses/validate"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Deliveries ─────────────────────────────────────────────

// DeliveriesResource — /api/v1/deliveries.
type DeliveriesResource struct{ c *Client }

type deliveryEnvelope struct {
	Delivery Delivery `json:"delivery"`
}

type deliveryListEnvelope struct {
	Deliveries []Delivery `json:"deliveries"`
}

// DeliveryCreateInput — POST /api/v1/deliveries body.
type DeliveryCreateInput struct {
	ProductID         string `json:"productId"`
	CustomerID        string `json:"customerId"`
	CheckoutSessionID string `json:"checkoutSessionId"`
	MaxDownloads      *int64 `json:"maxDownloads,omitempty"`
	ExpiresAt         string `json:"expiresAt,omitempty"`
	ExternalSource    string `json:"externalSource,omitempty"`
	ExternalRef       string `json:"externalRef,omitempty"`
}

// List — GET /api/v1/deliveries.
func (r *DeliveriesResource) List(ctx context.Context) ([]Delivery, error) {
	var out deliveryListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/deliveries", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Deliveries, nil
}

// Get — GET /api/v1/deliveries/:id.
func (r *DeliveriesResource) Get(ctx context.Context, id string) (*Delivery, error) {
	var out deliveryEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/deliveries/"+id, nil, &out, nil); err != nil {
		return nil, err
	}
	return &out.Delivery, nil
}

// Create — POST /api/v1/deliveries (idempotent).
func (r *DeliveriesResource) Create(ctx context.Context, in DeliveryCreateInput) (*Delivery, error) {
	var out deliveryEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/deliveries", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return &out.Delivery, nil
}

// ─── API keys ───────────────────────────────────────────────

// APIKeysResource — /api/v1/api-keys.
type APIKeysResource struct{ c *Client }

type apiKeyEnvelope struct {
	Key map[string]any `json:"key"`
}

type apiKeyListEnvelope struct {
	Keys []map[string]any `json:"keys"`
}

// APIKeyCreateInput — POST /api/v1/api-keys body.
type APIKeyCreateInput struct {
	Description string `json:"description,omitempty"`
	Scope       string `json:"scope,omitempty"`
}

// RevokedEnvelope wraps `{ revoked: bool }`.
type RevokedEnvelope struct {
	Revoked bool `json:"revoked"`
}

// List — GET /api/v1/api-keys.
func (r *APIKeysResource) List(ctx context.Context) ([]map[string]any, error) {
	var out apiKeyListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/api-keys", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Keys, nil
}

// Create — POST /api/v1/api-keys (idempotent).
func (r *APIKeysResource) Create(ctx context.Context, in APIKeyCreateInput) (map[string]any, error) {
	var out apiKeyEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/api-keys", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return out.Key, nil
}

// Revoke — POST /api/v1/api-keys/:id/revoke.
func (r *APIKeysResource) Revoke(ctx context.Context, id string) (bool, error) {
	var out RevokedEnvelope
	if err := r.c.Request(ctx, "POST", "/api/v1/api-keys/"+id+"/revoke",
		map[string]any{}, &out, nil); err != nil {
		return false, err
	}
	return out.Revoked, nil
}

// ─── Audit log ──────────────────────────────────────────────

// AuditLogResource — /api/v1/audit-log.
type AuditLogResource struct{ c *Client }

// AuditLogListParams — GET /audit-log query.
type AuditLogListParams struct {
	Limit     int
	Cursor    string
	Since     string
	EventType string
}

// AuditLogListResult mirrors the cursor-paginated envelope.
type AuditLogListResult struct {
	Entries    []map[string]any `json:"entries"`
	NextCursor string           `json:"nextCursor,omitempty"`
}

// List — GET /api/v1/audit-log.
func (r *AuditLogResource) List(ctx context.Context, p AuditLogListParams) (*AuditLogListResult, error) {
	q := map[string]any{}
	if p.Limit > 0 {
		q["limit"] = p.Limit
	}
	if p.Cursor != "" {
		q["cursor"] = p.Cursor
	}
	if p.Since != "" {
		q["since"] = p.Since
	}
	if p.EventType != "" {
		q["eventType"] = p.EventType
	}
	var out AuditLogListResult
	if err := r.c.Request(ctx, "GET", "/api/v1/audit-log"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Billing ────────────────────────────────────────────────

// BillingResource — /api/v1/billing/*.
type BillingResource struct{ c *Client }

// BillingInvoicesParams — GET /billing/invoices query.
type BillingInvoicesParams struct {
	Limit  int
	Cursor string
}

// BillingInvoicesResult mirrors the paginated envelope.
type BillingInvoicesResult struct {
	Invoices   []map[string]any `json:"invoices"`
	NextCursor string           `json:"nextCursor,omitempty"`
}

// BillingCheckoutInput — POST /billing/checkout body.
type BillingCheckoutInput struct {
	PlanID     string `json:"planId"`
	SuccessURL string `json:"successUrl,omitempty"`
	CancelURL  string `json:"cancelUrl,omitempty"`
}

// BillingCheckoutResult mirrors `{ url, sessionId }`.
type BillingCheckoutResult struct {
	URL       string `json:"url"`
	SessionID string `json:"sessionId"`
}

// Plans — GET /billing/plans (untyped passthrough).
func (r *BillingResource) Plans(ctx context.Context) ([]map[string]any, error) {
	var out []map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/billing/plans", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// CurrentPlan — GET /billing/plan.
func (r *BillingResource) CurrentPlan(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/billing/plan", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// Subscription — GET /billing/subscription.
func (r *BillingResource) Subscription(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/billing/subscription", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// Usage — GET /billing/usage.
func (r *BillingResource) Usage(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "GET", "/api/v1/billing/usage", nil, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// Invoices — GET /billing/invoices.
func (r *BillingResource) Invoices(ctx context.Context, p BillingInvoicesParams) (*BillingInvoicesResult, error) {
	q := map[string]any{}
	if p.Limit > 0 {
		q["limit"] = p.Limit
	}
	if p.Cursor != "" {
		q["cursor"] = p.Cursor
	}
	var out BillingInvoicesResult
	if err := r.c.Request(ctx, "GET", "/api/v1/billing/invoices"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// Checkout — POST /billing/checkout.
func (r *BillingResource) Checkout(ctx context.Context, in BillingCheckoutInput) (*BillingCheckoutResult, error) {
	var out BillingCheckoutResult
	if err := r.c.Request(ctx, "POST", "/api/v1/billing/checkout", in, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// Cancel — POST /billing/cancel.
func (r *BillingResource) Cancel(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := r.c.Request(ctx, "POST", "/api/v1/billing/cancel",
		map[string]any{}, &out, nil); err != nil {
		return nil, err
	}
	return out, nil
}

// ─── Integrations ───────────────────────────────────────────

// IntegrationsResource — /api/v1/integrations.
type IntegrationsResource struct{ c *Client }

// IntegrationsStatus mirrors the per-provider status envelope.
type IntegrationsStatus struct {
	Huudis     map[string]any `json:"huudis,omitempty"`
	Biteship   map[string]any `json:"biteship,omitempty"`
	Plugipay   map[string]any `json:"plugipay,omitempty"`
	Storlaunch map[string]any `json:"storlaunch,omitempty"`
}

// Status — GET /api/v1/integrations/status.
func (r *IntegrationsResource) Status(ctx context.Context) (*IntegrationsStatus, error) {
	var out IntegrationsStatus
	if err := r.c.Request(ctx, "GET", "/api/v1/integrations/status", nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Stats ──────────────────────────────────────────────────

// StatsResource — /api/v1/stats.
type StatsResource struct{ c *Client }

// StatsOverview mirrors the overview envelope.
type StatsOverview struct {
	Counters map[string]int64 `json:"counters"`
	Recent   map[string]any   `json:"recent"`
}

// Overview — GET /api/v1/stats/overview.
func (r *StatsResource) Overview(ctx context.Context) (*StatsOverview, error) {
	var out StatsOverview
	if err := r.c.Request(ctx, "GET", "/api/v1/stats/overview", nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Webhooks (control plane) ───────────────────────────────

// WebhooksResource — /api/v1/webhooks/*. (For signature verification of
// inbound deliveries, see VerifyWebhook.)
type WebhooksResource struct{ c *Client }

type webhookEndpointEnvelope struct {
	Endpoint map[string]any `json:"endpoint"`
}

type webhookEndpointListEnvelope struct {
	Endpoints []map[string]any `json:"endpoints"`
}

// WebhookEndpointCreateInput — POST /webhooks/endpoints body.
type WebhookEndpointCreateInput struct {
	URL         string   `json:"url"`
	Events      []string `json:"events,omitempty"`
	Description string   `json:"description,omitempty"`
}

// WebhookEndpointUpdateInput — PATCH body. Fields are pointers to
// distinguish "leave alone" from "set to zero".
type WebhookEndpointUpdateInput struct {
	URL         *string   `json:"url,omitempty"`
	Events      *[]string `json:"events,omitempty"`
	Description *string   `json:"description,omitempty"`
	Active      *bool     `json:"active,omitempty"`
}

// WebhookEventsListParams — GET /webhooks/events query.
type WebhookEventsListParams struct {
	Limit  int
	Cursor string
	Type   string
}

// WebhookEventsListResult mirrors the cursor-paginated envelope.
type WebhookEventsListResult struct {
	Events     []map[string]any `json:"events"`
	NextCursor string           `json:"nextCursor,omitempty"`
}

// ListEndpoints — GET /api/v1/webhooks/endpoints.
func (r *WebhooksResource) ListEndpoints(ctx context.Context) ([]map[string]any, error) {
	var out webhookEndpointListEnvelope
	if err := r.c.Request(ctx, "GET", "/api/v1/webhooks/endpoints", nil, &out, nil); err != nil {
		return nil, err
	}
	return out.Endpoints, nil
}

// CreateEndpoint — POST /api/v1/webhooks/endpoints (idempotent).
func (r *WebhooksResource) CreateEndpoint(ctx context.Context, in WebhookEndpointCreateInput) (map[string]any, error) {
	var out webhookEndpointEnvelope
	err := r.c.Request(ctx, "POST", "/api/v1/webhooks/endpoints", in, &out, &RequestOptions{
		IdempotencyKey: r.c.genIdem(),
	})
	if err != nil {
		return nil, err
	}
	return out.Endpoint, nil
}

// UpdateEndpoint — PATCH /api/v1/webhooks/endpoints/:id.
func (r *WebhooksResource) UpdateEndpoint(ctx context.Context, id string, patch WebhookEndpointUpdateInput) (map[string]any, error) {
	var out webhookEndpointEnvelope
	if err := r.c.Request(ctx, "PATCH", "/api/v1/webhooks/endpoints/"+id, patch, &out, nil); err != nil {
		return nil, err
	}
	return out.Endpoint, nil
}

// DeleteEndpoint — DELETE /api/v1/webhooks/endpoints/:id.
func (r *WebhooksResource) DeleteEndpoint(ctx context.Context, id string) (bool, error) {
	var out DeletedEnvelope
	if err := r.c.Request(ctx, "DELETE", "/api/v1/webhooks/endpoints/"+id, nil, &out, nil); err != nil {
		return false, err
	}
	return out.Deleted, nil
}

// ListEvents — GET /api/v1/webhooks/events.
func (r *WebhooksResource) ListEvents(ctx context.Context, p WebhookEventsListParams) (*WebhookEventsListResult, error) {
	q := map[string]any{}
	if p.Limit > 0 {
		q["limit"] = p.Limit
	}
	if p.Cursor != "" {
		q["cursor"] = p.Cursor
	}
	if p.Type != "" {
		q["type"] = p.Type
	}
	var out WebhookEventsListResult
	if err := r.c.Request(ctx, "GET", "/api/v1/webhooks/events"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Admin (Pattern 2 partner billing) ──────────────────────

// AdminResource — /api/v1/admin/* (platform-admin scope only).
type AdminResource struct{ c *Client }

// ProvisionWorkspaceInput — POST /admin/workspaces body.
type ProvisionWorkspaceInput struct {
	AccountID     string  `json:"accountId"`
	Partner       string  `json:"partner"`
	DiscountRate  float64 `json:"discountRate"`
	BrandName     string  `json:"brandName,omitempty"`
	BusinessEmail string  `json:"businessEmail,omitempty"`
}

// PartnerUsageParams — GET /admin/partner/usage query.
type PartnerUsageParams struct {
	Partner string
	From    string
	To      string
}

// ProvisionWorkspace — POST /api/v1/admin/workspaces. Idempotency key is
// derived deterministically (`ws_<accountId>_<partner>`), matching the
// Node SDK so the same input always yields the same key.
func (r *AdminResource) ProvisionWorkspace(ctx context.Context, in ProvisionWorkspaceInput) (*PartnerWorkspace, error) {
	var out PartnerWorkspace
	err := r.c.Request(ctx, "POST", "/api/v1/admin/workspaces", in, &out, &RequestOptions{
		IdempotencyKey: fmt.Sprintf("ws_%s_%s", in.AccountID, in.Partner),
	})
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// GetWorkspace — GET /api/v1/admin/workspaces/:accountId.
func (r *AdminResource) GetWorkspace(ctx context.Context, accountID string) (*PartnerWorkspace, error) {
	var out PartnerWorkspace
	if err := r.c.Request(ctx, "GET", "/api/v1/admin/workspaces/"+accountID, nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}

// PartnerUsage — GET /api/v1/admin/partner/usage.
func (r *AdminResource) PartnerUsage(ctx context.Context, p PartnerUsageParams) (*PartnerUsageSummary, error) {
	q := map[string]any{
		"partner": p.Partner,
		"from":    p.From,
		"to":      p.To,
	}
	var out PartnerUsageSummary
	if err := r.c.Request(ctx, "GET", "/api/v1/admin/partner/usage"+qs(q), nil, &out, nil); err != nil {
		return nil, err
	}
	return &out, nil
}
