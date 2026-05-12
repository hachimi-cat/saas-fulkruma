/**
 * `fulkruma stock …` — levels, movements, reservations, adjust.
 */
import { Command } from 'commander';
import type { StockMovement, StockMovementReason, StockReservation, VariantStock } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const levelColumns: readonly Column<VariantStock>[] = [
  { header: 'Variant', accessor: (s) => s.variantId },
  { header: 'Warehouse', accessor: (s) => s.warehouse?.name ?? s.warehouseId },
  { header: 'Qty', accessor: (s) => s.quantity },
  { header: 'Updated', accessor: (s) => s.updatedAt },
];

const movementColumns: readonly Column<StockMovement>[] = [
  { header: 'ID', accessor: (m) => m.id },
  { header: 'Variant', accessor: (m) => m.variantId },
  { header: 'Warehouse', accessor: (m) => m.warehouseId },
  { header: 'Δ', accessor: (m) => m.delta },
  { header: 'Reason', accessor: (m) => m.reason },
  { header: 'Note', accessor: (m) => m.note },
  { header: 'At', accessor: (m) => m.createdAt },
];

const reservationColumns: readonly Column<StockReservation>[] = [
  { header: 'ID', accessor: (r) => r.id },
  { header: 'Variant', accessor: (r) => r.variantId },
  { header: 'Warehouse', accessor: (r) => r.warehouseId },
  { header: 'Qty', accessor: (r) => r.quantity },
  { header: 'Checkout', accessor: (r) => r.checkoutSessionId },
  { header: 'Expires', accessor: (r) => r.expiresAt },
];

export const stockCommand = new Command('stock').description('Inventory levels, movements, reservations');

stockCommand
  .command('levels')
  .description('Show stock levels')
  .option('--variant-id <id>', 'filter to a single variant')
  .action(async (options: { variantId?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { stock } = await client.stock.levels(
        options.variantId ? { variant_id: options.variantId } : undefined,
      );
      printResult(stock, levelColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

stockCommand
  .command('movements')
  .description('Show stock movements')
  .option('--variant-id <id>', 'filter to a single variant')
  .action(async (options: { variantId?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { movements } = await client.stock.movements(
        options.variantId ? { variant_id: options.variantId } : undefined,
      );
      printResult(movements, movementColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

stockCommand
  .command('reservations')
  .description('Show outstanding stock reservations')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { reservations } = await client.stock.reservations();
      printResult(reservations, reservationColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

const adjustCmd = stockCommand
  .command('adjust <variantId> <warehouseId> <delta>')
  .description(
    'Adjust stock for a variant in a warehouse. <delta> is a signed integer ' +
      '(positive to add, negative to remove).',
  )
  .requiredOption('--reason <reason>', 'reason: manual_adjust|initial_stock|damaged|returned_to_supplier|import|transfer_in|transfer_out')
  .option('--note <text>', 'optional human-readable note');
// allow negative-number positional delta (commander treats leading `-` as flag by default)
adjustCmd.configureHelp({ showGlobalOptions: false });
adjustCmd.action(
    async (
      variantId: string,
      warehouseId: string,
      delta: string,
      options: { reason: string; note?: string },
      cmd,
    ) => {
      const g = getGlobalOpts(cmd);
      try {
        const client = getClient(g);
        const result = await client.stock.adjust({
          variantId,
          warehouseId,
          delta: parseIntArg(delta),
          reason: options.reason as StockMovementReason,
          note: options.note,
        });
        printResult(
          result,
          [
            { header: 'Variant', accessor: (r) => r.stock.variantId },
            { header: 'Warehouse', accessor: (r) => r.stock.warehouseId },
            { header: 'New Qty', accessor: (r) => r.stock.quantity },
            { header: 'Movement', accessor: (r) => r.movement.id },
            { header: 'Δ', accessor: (r) => r.movement.delta },
            { header: 'Reason', accessor: (r) => r.movement.reason },
          ],
          formatOpts(g),
        );
        process.exit(0);
      } catch (err) {
        handleError(err, g);
      }
    },
  );
