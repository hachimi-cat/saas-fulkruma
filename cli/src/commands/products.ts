/**
 * `fulkruma products …` — list, get, create, update, archive.
 *
 * Includes a `variants` subgroup (list/get/create/update/archive). The
 * SDK exposes addVariant/updateVariant/archiveVariant directly, but does
 * not have variant list/get endpoints — variants are returned as part of
 * the parent product, so list+get derive from `products.get(id).variants`.
 *
 * All calls go through `FulkrumaClient.products` from `@forjio/fulkruma-node`.
 */
import { Command } from 'commander';
import type { Product, ProductType, ProductVariant } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseBody, parseIntArg } from '../lib/util.js';
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

// ─── Variants ────────────────────────────────────────────────

const variantColumns: readonly Column<ProductVariant>[] = [
  { header: 'ID', accessor: (v) => v.id },
  { header: 'Name', accessor: (v) => v.name },
  { header: 'SKU', accessor: (v) => v.sku },
  { header: 'Price', accessor: (v) => v.priceCents },
  { header: 'Default', accessor: (v) => v.isDefault },
  { header: 'Archived', accessor: (v) => v.archived },
];

const variantsCommand = new Command('variants').description('Manage product variants');

variantsCommand
  .command('list <product-id>')
  .description('List variants on a product (derived from products.get)')
  .action(async (productId: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { product } = await client.products.get(productId);
      const variants = product.variants ?? [];
      printResult(variants, variantColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

variantsCommand
  .command('get <product-id> <variant-id>')
  .description('Get a single variant (filters products.get response)')
  .action(async (productId: string, variantId: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { product } = await client.products.get(productId);
      const variant = (product.variants ?? []).find((v) => v.id === variantId);
      if (!variant) {
        throw new Error(`variant ${variantId} not found on product ${productId}`);
      }
      printResult(variant, variantColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

variantsCommand
  .command('create <product-id>')
  .description('Create a variant on a product (use --body for JSON payload)')
  .requiredOption('--body <json>', 'variant payload (inline JSON, @file, or "-")')
  .action(async (productId: string, options: { body: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const body = parseBody(options.body);
      if (!body) throw new Error('--body is required');
      const { variant } = await client.products.addVariant(
        productId,
        body as unknown as Parameters<typeof client.products.addVariant>[1],
      );
      printResult(variant, variantColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

variantsCommand
  .command('update <product-id> <variant-id>')
  .description('Update a variant (use --body for JSON patch)')
  .requiredOption('--body <json>', 'variant patch (inline JSON, @file, or "-")')
  .action(
    async (productId: string, variantId: string, options: { body: string }, cmd) => {
      const g = getGlobalOpts(cmd);
      try {
        const client = getClient(g);
        const body = parseBody(options.body);
        if (!body) throw new Error('--body is required');
        const { variant } = await client.products.updateVariant(
          productId,
          variantId,
          body as Parameters<typeof client.products.updateVariant>[2],
        );
        printResult(variant, variantColumns, formatOpts(g));
        process.exit(0);
      } catch (err) {
        handleError(err, g);
      }
    },
  );

variantsCommand
  .command('archive <product-id> <variant-id>')
  .description('Archive a variant')
  .action(async (productId: string, variantId: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.products.archiveVariant(productId, variantId);
      printResult(
        { productId, variantId, archived: result.archived },
        [
          { header: 'Product', accessor: (r) => r.productId },
          { header: 'Variant', accessor: (r) => r.variantId },
          { header: 'Archived', accessor: (r) => r.archived },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

productsCommand.addCommand(variantsCommand);
