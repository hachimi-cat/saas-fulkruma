// S-052: Biteship low-balance alert.
//
// Biteship doesn't expose a balance API (no GET /balance, no
// balance.* webhooks, no programmatic top-up). The only way to know
// the Forjio Saldo dried up is when Biteship returns an
// "insufficient balance" error on a draft/confirm/order call.
//
// Detect those error responses + fire a throttled email alert to
// adhya@forjio.com so someone can manually top up via Biteship's
// dashboard before the problem cascades to many merchants. Throttled
// to once per 30 minutes so a burst of failing orders doesn't spam
// the inbox.

const ALERT_TO = process.env.BITESHIP_BALANCE_ALERT_EMAIL ?? 'adhya@forjio.com';
const ALERT_FROM = process.env.BITESHIP_BALANCE_ALERT_FROM ?? 'Fulkruma <noreply@fulkruma.forjio.com>';
const ALERT_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
let lastAlertAt = 0;

/**
 * Returns true when the Biteship error body indicates insufficient
 * balance. Pattern-matches on:
 *   - error_code 40004001 / 40004002 (their balance codes — confirm
 *     against actual prod payload first time it fires)
 *   - error message containing 'insufficient' / 'balance low' /
 *     'saldo kurang' / 'saldo habis'
 *
 * Conservative: false positives only mean an extra email, so the
 * matcher is intentionally broad on the message side.
 */
export function isInsufficientBalanceError(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as { error?: string; code?: number; message?: string };
  const code = b.code;
  if (typeof code === 'number' && (code === 40004001 || code === 40004002)) return true;
  const blob = `${b.error ?? ''} ${b.message ?? ''}`.toLowerCase();
  if (blob.includes('insufficient')) return true;
  if (blob.includes('balance') && (blob.includes('low') || blob.includes('not enough'))) return true;
  if (blob.includes('saldo') && (blob.includes('kurang') || blob.includes('habis'))) return true;
  return false;
}

/**
 * Send a throttled low-balance email via Resend's HTTP API. Failures
 * to deliver are logged but never bubble up — the caller's main flow
 * must not break because of an alert problem.
 */
export function fireLowBalanceAlert(context: {
  operation: string;
  merchantAccountId?: string;
  shipmentId?: string;
  biteshipResponseBody?: unknown;
}): void {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('[biteship-balance] insufficient balance detected, but RESEND_API_KEY not set — no email sent');
    return;
  }
  const now = Date.now();
  if (now - lastAlertAt < ALERT_THROTTLE_MS) {
    // Recently alerted; suppress to avoid inbox spam during a burst.
    return;
  }
  lastAlertAt = now;

  const merchantLine = context.merchantAccountId
    ? `<li>Merchant: <code>${escapeHtml(context.merchantAccountId)}</code></li>`
    : '';
  const shipmentLine = context.shipmentId
    ? `<li>Shipment: <code>${escapeHtml(context.shipmentId)}</code></li>`
    : '';
  const rawSnippet = context.biteshipResponseBody
    ? `<pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;">${escapeHtml(JSON.stringify(context.biteshipResponseBody, null, 2))}</pre>`
    : '';

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#c2410c;">🟠 Biteship Saldo is low / empty</h2>
      <p>Operation <code>${escapeHtml(context.operation)}</code> on the Forjio Biteship account just failed because the balance is insufficient.</p>
      <p><strong>Every merchant&apos;s confirmPickup is failing until you top up.</strong></p>
      <p>
        <a href="https://biteship.com/dashboard" style="display:inline-block;background:#0ea5e9;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;">
          Open Biteship dashboard
        </a>
      </p>
      <ul style="font-size:13px;color:#555;">
        ${merchantLine}
        ${shipmentLine}
        <li>Triggered: ${new Date(now).toISOString()}</li>
      </ul>
      ${rawSnippet}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:11px;color:#999;">
        This alert is throttled to once per 30 minutes — subsequent failures within that window are
        suppressed so your inbox doesn&apos;t fill up. Biteship doesn&apos;t expose a balance API, so
        Forjio can&apos;t poll proactively — we only learn the saldo is dry when a call fails.
      </p>
    </div>
  `;

  // Fire-and-forget via Resend HTTP API.
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: '🟠 Biteship Saldo low — top up to unblock orders',
      html,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      console.error('[biteship-balance] resend rejected alert', res.status, text);
    }
  }).catch((e) => console.error('[biteship-balance] resend fetch failed', (e as Error).message));
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
