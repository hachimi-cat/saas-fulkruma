/**
 * `fulkruma shipments …` — list, get, create. Creates accept a JSON body
 * via --body for non-trivial origin/destination/items payloads.
 */
import { Command } from 'commander';
import type { Shipment } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseBody, parseIntArg } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const shipmentColumns: readonly Column<Shipment>[] = [
  { header: 'ID', accessor: (s) => s.id },
  { header: 'Status', accessor: (s) => s.status },
  { header: 'Courier', accessor: (s) => `${s.courierCode}/${s.courierServiceCode}` },
  { header: 'Tracking', accessor: (s) => s.biteshipTrackingId },
  { header: 'Customer', accessor: (s) => s.customerEmail ?? s.customerId },
  { header: 'Price', accessor: (s) => s.price },
];

export const shipmentsCommand = new Command('shipments').description('Manage shipments');

shipmentsCommand
  .command('list')
  .description('List shipments')
  .option('--status <status>', 'filter by status (pending|confirmed|in_transit|delivered|…)')
  .action(async (options: { status?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { shipments } = await client.shipments.list(
        options.status ? { status: options.status } : undefined,
      );
      printResult(shipments, shipmentColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shipmentsCommand
  .command('get <id>')
  .description('Get a single shipment')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { shipment } = await client.shipments.get(id);
      printResult(shipment, shipmentColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

shipmentsCommand
  .command('create')
  .description(
    'Create a shipment. Accepts a JSON body via --body for the full payload, ' +
      'or use --courier-code / --courier-service-code / --courier-type / --price ' +
      'with --origin/--destination/--items as JSON strings.',
  )
  .option('--body <json>', 'full JSON body (or @file or "-" for stdin)')
  .option('--courier-code <code>', 'courier code (e.g. jne)')
  .option('--courier-service-code <code>', 'courier service code')
  .option('--courier-type <type>', 'courier type (e.g. standard)')
  .option('--price <cents>', 'shipping price', parseIntArg)
  .option('--insurance <cents>', 'insurance price', parseIntArg)
  .option('--insured', 'mark as insured')
  .option('--product-id <id>', 'product id')
  .option('--customer-id <id>', 'customer id')
  .option('--customer-email <email>', 'customer email')
  .option('--checkout-session-id <id>', 'checkout session id')
  .option('--origin <json>', 'origin object as JSON string')
  .option('--destination <json>', 'destination object as JSON string')
  .option('--items <json>', 'items array as JSON string')
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body = parseBody(options['body'] as string | undefined);
      let payload: Record<string, unknown>;
      if (body) {
        payload = body;
      } else {
        const required = ['courierCode', 'courierServiceCode', 'courierType', 'price', 'origin', 'destination', 'items'];
        for (const k of required) {
          if (options[k] === undefined) {
            throw new Error(`missing --${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())} (or pass --body <json>).`);
          }
        }
        payload = {
          courierCode: options['courierCode'],
          courierServiceCode: options['courierServiceCode'],
          courierType: options['courierType'],
          price: options['price'],
          insurance: options['insurance'],
          insured: options['insured'],
          productId: options['productId'],
          customerId: options['customerId'],
          customerEmail: options['customerEmail'],
          checkoutSessionId: options['checkoutSessionId'],
          origin: JSON.parse(options['origin'] as string),
          destination: JSON.parse(options['destination'] as string),
          items: JSON.parse(options['items'] as string),
        };
      }
      const { shipment } = await client.shipments.create(
        payload as Parameters<typeof client.shipments.create>[0],
      );
      printResult(shipment, shipmentColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
