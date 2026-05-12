/**
 * `fulkruma addresses …` — list, create, delete customer addresses.
 */
import { Command } from 'commander';
import type { CustomerAddress } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const addressColumns: readonly Column<CustomerAddress>[] = [
  { header: 'ID', accessor: (a) => a.id },
  { header: 'Customer', accessor: (a) => a.customerId },
  { header: 'Label', accessor: (a) => a.label },
  { header: 'Contact', accessor: (a) => a.contactName },
  { header: 'Phone', accessor: (a) => a.contactPhone },
  { header: 'Postal', accessor: (a) => a.postalCode },
  { header: 'Default', accessor: (a) => a.isDefault },
];

export const addressesCommand = new Command('addresses').description('Customer shipping addresses');

addressesCommand
  .command('list')
  .description('List customer addresses')
  .option('--customer-id <id>', 'filter to a specific customer')
  .action(async (options: { customerId?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { addresses } = await client.addresses.list(
        options.customerId ? { customer_id: options.customerId } : undefined,
      );
      printResult(addresses, addressColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

addressesCommand
  .command('create')
  .description('Create a customer address')
  .requiredOption('--customer-id <id>', 'customer id')
  .requiredOption('--label <text>', 'label (e.g. "Home", "Office")')
  .requiredOption('--contact-name <name>', 'recipient name')
  .requiredOption('--contact-phone <phone>', 'recipient phone')
  .requiredOption('--address <text>', 'full street address')
  .option('--email <email>', 'recipient email')
  .option('--postal-code <code>', 'postal code')
  .option('--area-id <id>', 'Biteship area id')
  .option('--lat <number>', 'latitude', (v) => Number.parseFloat(v))
  .option('--lng <number>', 'longitude', (v) => Number.parseFloat(v))
  .option('--default', 'set as default address for the customer')
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { address } = await client.addresses.create({
        customerId: options['customerId'] as string,
        label: options['label'] as string,
        contactName: options['contactName'] as string,
        contactPhone: options['contactPhone'] as string,
        address: options['address'] as string,
        email: options['email'] as string | undefined,
        postalCode: options['postalCode'] as string | undefined,
        areaId: options['areaId'] as string | undefined,
        lat: options['lat'] as number | undefined,
        lng: options['lng'] as number | undefined,
        isDefault: options['default'] as boolean | undefined,
      });
      printResult(address, addressColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

addressesCommand
  .command('delete <id>')
  .description('Delete a customer address')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.addresses.delete(id);
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
