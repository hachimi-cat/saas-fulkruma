/**
 * `fulkruma webhooks …` — endpoints (list/create/update/delete) + events list.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
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

const events = new Command('events').description('Webhook event history');

events
  .command('list')
  .description('List webhook events')
  .option('--limit <n>', 'page size', parseIntArg)
  .option('--cursor <cursor>', 'pagination cursor')
  .option('--type <type>', 'filter by event type')
  .action(
    async (options: { limit?: number; cursor?: string; type?: string }, cmd) => {
      const g = getGlobalOpts(cmd);
      try {
        const client = getClient(g);
        const result = await client.webhooks.listEvents(options);
        if (g.json) {
          printJson(result);
        } else {
          printResult(
            result.events,
            [
              { header: 'ID', accessor: (e) => e['id'] as string },
              { header: 'Type', accessor: (e) => e['type'] as string },
              { header: 'Status', accessor: (e) => e['status'] as string | undefined },
              { header: 'Created', accessor: (e) => e['createdAt'] as string | undefined },
            ],
            formatOpts(g),
          );
        }
        process.exit(0);
      } catch (err) {
        handleError(err, g);
      }
    },
  );

webhooksCommand.addCommand(events);
