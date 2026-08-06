import type { ChatAction } from '@forjio/agent-ui';
import { api } from '@/lib/api';

/**
 * The docked chat's Apply path (review mode) — executes a BFF-sanitized
 * ChatAction with the USER's own session through the same BFF proxy the
 * dashboard pages use (the agent only ever proposed it).
 *
 * Warehouses and products are independent here, so there is no `$n`
 * cross-reference resolution. Note what is absent: no variant branch —
 * variants carry priceCents, whose unit is unsettled across the family,
 * so the agent has no business proposing a number into it.
 */

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const strOrNull = (v: unknown): string | null | undefined =>
  v === null ? null : typeof v === 'string' ? v : undefined;

function defined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function applyChatAction(
  action: ChatAction,
  // Unused: these resources reference nothing. Kept in the signature so
  // the shared docked-chat call site is identical across products.
  _earlier: { action: ChatAction; result?: unknown }[] = [],
): Promise<unknown> {
  const f = action.fields ?? {};

  if (action.resource === 'warehouses') {
    const payload = defined({
      name: str(f.name),
      address: strOrNull(f.address),
      city: strOrNull(f.city),
      postal: strOrNull(f.postal),
      phone: strOrNull(f.phone),
    });
    if (action.mode === 'edit') {
      const id = str(action.id);
      if (!id) throw new Error('Missing warehouse id');
      return api(`/warehouses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
    if (!payload.name) throw new Error('A warehouse needs a name');
    return api('/warehouses', { method: 'POST', body: JSON.stringify(payload) });
  }

  if (action.resource === 'products') {
    const payload = defined({
      name: str(f.name),
      sku: str(f.sku),
      description: str(f.description),
      type: str(f.type),
      weight: num(f.weight),
      length: num(f.length),
      width: num(f.width),
      height: num(f.height),
    });
    if (action.mode === 'edit') {
      const id = str(action.id);
      if (!id) throw new Error('Missing product id');
      return api(`/products/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
    if (!payload.name) throw new Error('A product needs a name');
    return api('/products', { method: 'POST', body: JSON.stringify(payload) });
  }

  throw new Error('This action type is not supported');
}
