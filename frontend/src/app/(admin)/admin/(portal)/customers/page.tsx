'use client';

/*
 * Customers — MANDATORY admin-portal standard.
 * See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 *
 * Body from @forjio/admin-ui; data from fulkruma's adapter in
 * backend/src/routes/admin-customers.ts, which joins the Huudis SSO
 * roster against fulkruma's own shipment, invoice and subscription
 * tables. "Paid" is subscription revenue — never Shipment.price, which
 * is the courier fee fulkruma pays out.
 */

import { CustomersPanel } from '@forjio/admin-ui';

export default function Page() {
  return <CustomersPanel />;
}
