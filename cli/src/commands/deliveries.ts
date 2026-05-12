/**
 * `fulkruma deliveries …` — list, get, create digital download deliveries.
 */
import { Command } from 'commander';
import type { Delivery } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const deliveryColumns: readonly Column<Delivery>[] = [
  { header: 'ID', accessor: (d) => d.id },
  { header: 'Product', accessor: (d) => d.productId },
  { header: 'Customer', accessor: (d) => d.customerId },
  { header: 'Checkout', accessor: (d) => d.checkoutSessionId },
  { header: 'Downloads', accessor: (d) => `${d.downloadCount}/${d.maxDownloads}` },
  { header: 'Expires', accessor: (d) => d.expiresAt },
];

export const deliveriesCommand = new Command('deliveries').description('Digital deliveries');

deliveriesCommand
  .command('list')
  .description('List deliveries')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { deliveries } = await client.deliveries.list();
      printResult(deliveries, deliveryColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

deliveriesCommand
  .command('get <id>')
  .description('Get a single delivery')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { delivery } = await client.deliveries.get(id);
      printResult(delivery, deliveryColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

deliveriesCommand
  .command('create')
  .description('Create a delivery')
  .requiredOption('--product-id <id>', 'product id')
  .requiredOption('--customer-id <id>', 'customer id')
  .requiredOption('--checkout-session-id <id>', 'checkout session id')
  .option('--max-downloads <n>', 'maximum downloads', parseIntArg)
  .option('--expires-at <iso>', 'ISO-8601 expiry timestamp')
  .option('--external-source <name>', 'external source')
  .option('--external-ref <id>', 'external reference id')
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { delivery } = await client.deliveries.create({
        productId: options['productId'] as string,
        customerId: options['customerId'] as string,
        checkoutSessionId: options['checkoutSessionId'] as string,
        maxDownloads: options['maxDownloads'] as number | undefined,
        expiresAt: options['expiresAt'] as string | undefined,
        externalSource: options['externalSource'] as string | undefined,
        externalRef: options['externalRef'] as string | undefined,
      });
      printResult(delivery, deliveryColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
