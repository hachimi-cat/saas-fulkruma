/**
 * `fulkruma shipping …` — couriers, origin, set-origin, rates.
 */
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
