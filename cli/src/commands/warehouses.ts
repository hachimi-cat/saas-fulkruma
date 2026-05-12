/**
 * `fulkruma warehouses …` — list, create, update, archive.
 */
import { Command } from 'commander';
import type { Warehouse } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const warehouseColumns: readonly Column<Warehouse>[] = [
  { header: 'ID', accessor: (w) => w.id },
  { header: 'Name', accessor: (w) => w.name },
  { header: 'City', accessor: (w) => w.city },
  { header: 'Postal', accessor: (w) => w.postal },
  { header: 'Default', accessor: (w) => w.isDefault },
  { header: 'Archived', accessor: (w) => w.archived },
];

export const warehousesCommand = new Command('warehouses').description('Manage warehouses');

warehousesCommand
  .command('list')
  .description('List warehouses')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { warehouses } = await client.warehouses.list();
      printResult(warehouses, warehouseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

warehousesCommand
  .command('create')
  .description('Create a warehouse')
  .requiredOption('--name <name>', 'warehouse name')
  .option('--address <text>', 'street address')
  .option('--city <city>', 'city')
  .option('--postal <code>', 'postal code')
  .option('--phone <phone>', 'phone number')
  .option('--lat <number>', 'latitude', (v) => Number.parseFloat(v))
  .option('--lng <number>', 'longitude', (v) => Number.parseFloat(v))
  .option('--default', 'set as default warehouse')
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { warehouse } = await client.warehouses.create({
        name: options['name'] as string,
        address: options['address'] as string | undefined,
        city: options['city'] as string | undefined,
        postal: options['postal'] as string | undefined,
        phone: options['phone'] as string | undefined,
        lat: options['lat'] as number | undefined,
        lng: options['lng'] as number | undefined,
        isDefault: options['default'] as boolean | undefined,
      });
      printResult(warehouse, warehouseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

warehousesCommand
  .command('update <id>')
  .description('Update a warehouse')
  .option('--name <name>', 'warehouse name')
  .option('--address <text>', 'street address')
  .option('--city <city>', 'city')
  .option('--postal <code>', 'postal code')
  .option('--phone <phone>', 'phone number')
  .option('--default <bool>', 'set as default (true|false)')
  .action(async (id: string, options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const patch: Record<string, unknown> = {};
      for (const k of ['name', 'address', 'city', 'postal', 'phone'] as const) {
        if (options[k] !== undefined) patch[k] = options[k];
      }
      if (options['default'] !== undefined) {
        patch['isDefault'] = options['default'] === 'true' || options['default'] === true;
      }
      const { warehouse } = await client.warehouses.update(id, patch);
      printResult(warehouse, warehouseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

warehousesCommand
  .command('archive <id>')
  .description('Archive a warehouse')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.warehouses.archive(id);
      printResult(
        { id, archived: result.archived },
        [
          { header: 'ID', accessor: (r) => r.id },
          { header: 'Archived', accessor: (r) => r.archived },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
