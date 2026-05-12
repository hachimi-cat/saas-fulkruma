/**
 * `fulkruma shipping …` — couriers, origin, set-origin, rates, config,
 * track, label, cancel, areas.
 *
 * The SDK only types couriers/origin/setOrigin/rates. For
 * `config`/`track`/`label`/`cancel`/`areas` we fall through to
 * `client.request<T>({ method, path })` since the SDK doesn't expose
 * dedicated helpers yet.
 */
import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseBody } from '../lib/util.js';
import { printJson, printResult } from '../lib/output.js';

export const shippingCommand = new Command('shipping').description('Shipping origin, couriers, rates');

shippingCommand
  .command('couriers')
  .description('List supported couriers')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const couriers = await client.shipping.couriers();
      // courier payload is provider-defined; render JSON in both modes for fidelity.
      if (g.json) {
        printJson(couriers);
      } else {
        const rows = (couriers as Array<Record<string, unknown>>) ?? [];
        printResult(
          rows,
          [
            { header: 'Code', accessor: (r) => (r['courier_code'] as string) ?? (r['code'] as string) },
            { header: 'Name', accessor: (r) => (r['courier_name'] as string) ?? (r['name'] as string) },
            { header: 'Service', accessor: (r) => (r['courier_service_code'] as string) ?? (r['service'] as string) },
            { header: 'Type', accessor: (r) => (r['courier_service_name'] as string) ?? (r['type'] as string) },
          ],
          formatOpts(g),
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('origin')
  .description('Show the configured origin location')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const origin = await client.shipping.origin();
      printJson(origin);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('set-origin')
  .description('Set the origin location (use --body for the JSON payload)')
  .requiredOption('--body <json>', 'origin payload (inline JSON, @file, or "-")')
  .action(async (options: { body: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body = parseBody(options.body);
      if (!body) throw new Error('--body is required');
      const result = await client.shipping.setOrigin(body);
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('rates')
  .description('Compute shipping rates for a destination + items (use --body)')
  .requiredOption('--body <json>', 'rates payload (inline JSON, @file, or "-")')
  .action(async (options: { body: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body = parseBody(options.body);
      if (!body) throw new Error('--body is required');
      const result = await client.shipping.rates(
        body as Parameters<typeof client.shipping.rates>[0],
      );
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

// ─── Advanced shipping (SDK passthrough via client.request) ────

const configCommand = new Command('config').description('Shipping account configuration');

configCommand
  .command('get')
  .description('Get current shipping config (GET /api/v1/shipping/config)')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.request<{ config: Record<string, unknown> }>({
        method: 'GET',
        path: '/api/v1/shipping/config',
      });
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

configCommand
  .command('update')
  .description('Update shipping config (PUT /api/v1/shipping/config)')
  .requiredOption('--body <json>', 'config payload (inline JSON, @file, or "-")')
  .action(async (options: { body: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body = parseBody(options.body);
      if (!body) throw new Error('--body is required');
      const result = await client.request<{ config: Record<string, unknown> }>({
        method: 'PUT',
        path: '/api/v1/shipping/config',
        body,
      });
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand.addCommand(configCommand);

shippingCommand
  .command('track <waybill>')
  .description('Track a shipment by waybill (GET /api/v1/shipping/track/:waybill)')
  .action(async (waybill: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.request<Record<string, unknown>>({
        method: 'GET',
        path: `/api/v1/shipping/track/${encodeURIComponent(waybill)}`,
      });
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('label <shipment-id>')
  .description(
    'Fetch a shipping label. If the response is a JSON envelope with a URL, ' +
      'prints the URL; otherwise writes binary to --out or stdout.',
  )
  .option('--out <file>', 'write the label binary to this file path')
  .action(async (shipmentId: string, options: { out?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      // We don't know whether the backend returns JSON or binary here.
      // Try JSON first (most Forjio routes do); fall back to a separate
      // request flag if request<T> throws on non-JSON. The SDK's request
      // method assumes JSON envelopes, so binary endpoints would need a
      // raw fetch — we treat this as JSON-with-URL by convention for now
      // and document the fallback.
      const result = await client.request<{
        url?: string;
        labelUrl?: string;
        contentType?: string;
        data?: string;
      }>({
        method: 'GET',
        path: `/api/v1/shipping/shipments/${encodeURIComponent(shipmentId)}/label`,
      });
      const url = result.url ?? result.labelUrl;
      if (url) {
        if (g.json) {
          printJson(result);
        } else {
          process.stdout.write(`${url}\n`);
        }
        process.exit(0);
      }
      // Inline base64 data fallback — write binary to file or stdout.
      if (result.data) {
        const buf = Buffer.from(result.data, 'base64');
        if (options.out) {
          writeFileSync(options.out, buf);
          if (!g.json) process.stdout.write(`label written to ${options.out}\n`);
          else printJson({ ok: true, file: options.out, bytes: buf.length });
        } else {
          process.stdout.write(buf);
        }
        process.exit(0);
      }
      // Unknown shape — emit raw response for inspection.
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('cancel <shipment-id>')
  .description('Cancel a shipment (POST /api/v1/shipping/shipments/:id/cancel)')
  .option('--reason <text>', 'cancellation reason')
  .action(async (shipmentId: string, options: { reason?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body: Record<string, unknown> = {};
      if (options.reason) body['reason'] = options.reason;
      const result = await client.request<Record<string, unknown>>({
        method: 'POST',
        path: `/api/v1/shipping/shipments/${encodeURIComponent(shipmentId)}/cancel`,
        body,
      });
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shippingCommand
  .command('areas')
  .description('Look up shipping areas (GET /api/v1/shipping/areas)')
  .option('--keyword <q>', 'search keyword (city, postcode, area name)')
  .action(async (options: { keyword?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const qs = options.keyword
        ? `?keyword=${encodeURIComponent(options.keyword)}`
        : '';
      const result = await client.request<{ areas: Array<Record<string, unknown>> }>({
        method: 'GET',
        path: `/api/v1/shipping/areas${qs}`,
      });
      if (g.json) {
        printJson(result);
      } else {
        const rows = result.areas ?? [];
        printResult(
          rows,
          [
            { header: 'ID', accessor: (r) => (r['id'] as string) ?? (r['area_id'] as string) },
            { header: 'Name', accessor: (r) => (r['name'] as string) ?? (r['area_name'] as string) },
            { header: 'City', accessor: (r) => (r['city'] as string) ?? (r['city_name'] as string) },
            {
              header: 'Postal',
              accessor: (r) => (r['postalCode'] as string) ?? (r['postal_code'] as string),
            },
          ],
          formatOpts(g),
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
