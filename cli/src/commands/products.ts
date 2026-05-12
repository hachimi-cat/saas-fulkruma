/**
 * `fulkruma products …` — list, get, create, update, archive.
 *
 * All calls go through `FulkrumaClient.products` from `@forjio/fulkruma-node`.
 */
import { Command } from 'commander';
import type { Product, ProductType } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const productColumns: readonly Column<Product>[] = [
  { header: 'ID', accessor: (p) => p.id },
  { header: 'Name', accessor: (p) => p.name },
  { header: 'SKU', accessor: (p) => p.sku },
  { header: 'Type', accessor: (p) => p.type },
  { header: 'Archived', accessor: (p) => p.archived },
  { header: 'Variants', accessor: (p) => p.variants?.length ?? 0 },
];

export const productsCommand = new Command('products').description('Manage products');

productsCommand
  .command('list')
  .description('List products')
  .option('--archived', 'include archived products')
  .action(async (options: { archived?: boolean }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { products } = await client.products.list(
        options.archived ? { archived: true } : undefined,
      );
      printResult(products, productColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

productsCommand
  .command('get <id>')
  .description('Get a single product')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { product } = await client.products.get(id);
      printResult(product, productColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

productsCommand
  .command('create')
  .description('Create a product')
  .requiredOption('--name <name>', 'product name')
  .option('--sku <sku>', 'SKU')
  .option('--description <text>', 'description')
  .option('--type <type>', 'product type: physical|digital|license', 'physical')
  .option('--weight <grams>', 'weight in grams', parseIntArg)
  .option('--license-enabled', 'enable license issuance')
  .option('--max-activations <n>', 'max activations per license', parseIntArg)
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { product } = await client.products.create({
        name: options['name'] as string,
        sku: options['sku'] as string | undefined,
        description: options['description'] as string | undefined,
        type: options['type'] as ProductType | undefined,
        weight: options['weight'] as number | undefined,
        licenseEnabled: options['licenseEnabled'] as boolean | undefined,
        maxActivations: options['maxActivations'] as number | undefined,
      });
      printResult(product, productColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

productsCommand
  .command('update <id>')
  .description('Update a product')
  .option('--name <name>', 'product name')
  .option('--sku <sku>', 'SKU')
  .option('--description <text>', 'description')
  .option('--type <type>', 'product type: physical|digital|license')
  .option('--weight <grams>', 'weight in grams', parseIntArg)
  .option('--license-enabled <bool>', 'enable license issuance (true|false)')
  .option('--max-activations <n>', 'max activations per license', parseIntArg)
  .action(async (id: string, options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const patch: Record<string, unknown> = {};
      if (options['name'] !== undefined) patch['name'] = options['name'];
      if (options['sku'] !== undefined) patch['sku'] = options['sku'];
      if (options['description'] !== undefined) patch['description'] = options['description'];
      if (options['type'] !== undefined) patch['type'] = options['type'];
      if (options['weight'] !== undefined) patch['weight'] = options['weight'];
      if (options['licenseEnabled'] !== undefined) {
        patch['licenseEnabled'] = options['licenseEnabled'] === 'true' || options['licenseEnabled'] === true;
      }
      if (options['maxActivations'] !== undefined) patch['maxActivations'] = options['maxActivations'];
      const { product } = await client.products.update(id, patch);
      printResult(product, productColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

productsCommand
  .command('archive <id>')
  .description('Archive a product')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.products.archive(id);
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
