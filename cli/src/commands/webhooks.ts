/**
 * `fulkruma webhooks …` — endpoints (list/create/update/delete) and the
 * delivery log (events list/get/retry).
 */
import { randomUUID } from 'node:crypto';
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError } from '../lib/util.js';
import { printJson, printResult } from '../lib/output.js';

export const webhooksCommand = new Command('webhooks').description('Webhook endpoints and event history');

const endpoints = new Command('endpoints').description('Manage webhook endpoints');

endpoints
  .command('list')
  .description('List endpoints')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { endpoints: rows } = await client.webhooks.listEndpoints();
      printResult(
        rows,
        [
          { header: 'ID', accessor: (e) => e['id'] as string },
          { header: 'URL', accessor: (e) => e['url'] as string },
          { header: 'Active', accessor: (e) => e['active'] as boolean | undefined },
          { header: 'Events', accessor: (e) => (e['events'] as string[] | undefined)?.join(',') },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

endpoints
  .command('create')
  .description('Create an endpoint')
  .requiredOption('--url <url>', 'destination URL')
  .option('--events <list>', 'comma-separated event types', (v) => v.split(',').map((s) => s.trim()))
  .option('--description <text>', 'human-readable description')
  .action(async (options: { url: string; events?: string[]; description?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { endpoint } = await client.webhooks.createEndpoint({
        url: options.url,
        events: options.events,
        description: options.description,
      });
      printJson(endpoint);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

endpoints
  .command('update <id>')
  .description('Update an endpoint')
  .option('--url <url>', 'destination URL')
  .option('--events <list>', 'comma-separated event types', (v) => v.split(',').map((s) => s.trim()))
  .option('--description <text>', 'description')
  .option('--active <bool>', 'true|false')
  .action(async (id: string, options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const patch: Record<string, unknown> = {};
      for (const k of ['url', 'events', 'description'] as const) {
        if (options[k] !== undefined) patch[k] = options[k];
      }
      if (options['active'] !== undefined) {
        patch['active'] = options['active'] === 'true' || options['active'] === true;
      }
      const { endpoint } = await client.webhooks.updateEndpoint(
        id,
        patch as Parameters<typeof client.webhooks.updateEndpoint>[1],
      );
      printJson(endpoint);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

endpoints
  .command('delete <id>')
  .description('Delete an endpoint')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.webhooks.deleteEndpoint(id);
      printResult(
        { id, deleted: result.deleted },
        [
          { header: 'ID', accessor: (r) => r.id },
          { header: 'Deleted', accessor: (r) => r.deleted },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

webhooksCommand.addCommand(endpoints);

const events = new Command('events').description('Webhook delivery log: what was sent, every attempt, retries');

// The delivery-log calls go through the SDK's signed `client.request`
// (the passthrough shipping.ts uses): `webhooks.listEvents(params)`,
// `getEvent` and `retryEvent` arrive in @forjio/fulkruma-node 0.6.0, and
// this CLI still resolves 0.5.x until that is published.
type DeliveryRow = Record<string, unknown> & { deliveryAttempts?: Array<Record<string, unknown>> };

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

events
  .command('list')
  .description('List webhook deliveries, newest first (50 by default)')
  .option('--limit <n>', 'rows per page, 1-200', (v) => Number.parseInt(v, 10))
  .option('--cursor <id>', 'nextCursor from the previous page')
  .option('--type <eventType>', 'only this event type, e.g. fulkruma.shipment.created.v1')
  .option('--status <status>', 'pending | sent | failed')
  .option('--endpoint <id>', 'only deliveries to this endpoint')
  .action(
    async (options: { limit?: number; cursor?: string; type?: string; status?: string; endpoint?: string }, cmd) => {
      const g = getGlobalOpts(cmd);
      try {
        const client = getClient(g);
        const result = await client.request<{ events: DeliveryRow[]; nextCursor: string | null }>({
          method: 'GET',
          path: `/api/v1/webhooks/events${query({
            limit: options.limit, cursor: options.cursor, type: options.type, status: options.status, endpointId: options.endpoint,
          })}`,
        });
        if (g.json) {
          printJson(result);
        } else {
          printResult(
            result.events ?? [],
            [
              { header: 'ID', accessor: (e) => e['id'] as string },
              { header: 'Type', accessor: (e) => e['type'] as string },
              { header: 'Status', accessor: (e) => e['status'] as string | undefined },
              { header: 'Attempts', accessor: (e) => e['attempts'] as number | undefined },
              { header: 'Code', accessor: (e) => (e['responseCode'] as number | null | undefined) ?? '' },
              { header: 'Next retry', accessor: (e) => (e['nextRetryAt'] as string | null | undefined) ?? '' },
              { header: 'Created', accessor: (e) => e['createdAt'] as string | undefined },
            ],
            formatOpts(g),
          );
          if (result.nextCursor) process.stdout.write(`\nMore: --cursor ${result.nextCursor}\n`);
        }
        process.exit(0);
      } catch (err) {
        handleError(err, g);
      }
    },
  );

events
  .command('get <id>')
  .description('One delivery with every attempt made at it')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.request<{ event: DeliveryRow }>({
        method: 'GET',
        path: `/api/v1/webhooks/events/${encodeURIComponent(id)}`,
      });
      printJson(result.event);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

events
  .command('retry <id>')
  .description('Queue one more attempt now (a failed delivery, or a sent one again)')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.request<{ event: DeliveryRow }>({
        method: 'POST',
        path: `/api/v1/webhooks/events/${encodeURIComponent(id)}/retry`,
        idempotencyKey: `idem_${randomUUID()}`,
      });
      printJson(result.event);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

webhooksCommand.addCommand(events);
