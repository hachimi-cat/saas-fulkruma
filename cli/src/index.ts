/**
 * @forjio/fulkruma-cli entrypoint.
 *
 * Wires the auth command + 10 product command groups (plus integrations,
 * stats, webhooks, audit-log bonuses) on top of @forjio/fulkruma-node.
 *
 * Global flags:
 *   --json              emit raw JSON instead of chalk tables
 *   --profile <name>    select a credential profile (default: "default")
 *   --base-url <url>    override the API base URL
 *   --on-behalf-of <id> forward X-Fulkruma-On-Behalf-Of (platform admin only)
 */
import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { productsCommand } from './commands/products.js';
import { warehousesCommand } from './commands/warehouses.js';
import { stockCommand } from './commands/stock.js';
import { addressesCommand } from './commands/addresses.js';
import { shipmentsCommand } from './commands/shipments.js';
import { shippingCommand } from './commands/shipping.js';
import { licensesCommand } from './commands/licenses.js';
import { deliveriesCommand } from './commands/deliveries.js';
import { billingCommand } from './commands/billing.js';
import { apiKeysCommand } from './commands/api-keys.js';
import { integrationsCommand } from './commands/integrations.js';
import { statsCommand } from './commands/stats.js';
import { webhooksCommand } from './commands/webhooks.js';
import { auditLogCommand } from './commands/audit-log.js';

const brand = process.env['FORJIO_BRAND'] ?? 'fulkruma';

export function buildProgram(): Command {
  const program = new Command()
    .name(brand)
    .description(`CLI for ${brand} — part of the Forjio commerce suite.`)
    .version('0.3.0')
    .option('--json', 'emit JSON instead of human-readable tables')
    .option('--profile <name>', 'credential profile name (default: "default")')
    .option('--base-url <url>', 'override the Fulkruma API base URL')
    .option('--on-behalf-of <accountId>', 'forward X-Fulkruma-On-Behalf-Of (platform admin keys only)');

  program.addCommand(authCommand);
  program.addCommand(productsCommand);
  program.addCommand(warehousesCommand);
  program.addCommand(stockCommand);
  program.addCommand(addressesCommand);
  program.addCommand(shipmentsCommand);
  program.addCommand(shippingCommand);
  program.addCommand(licensesCommand);
  program.addCommand(deliveriesCommand);
  program.addCommand(billingCommand);
  program.addCommand(apiKeysCommand);
  program.addCommand(integrationsCommand);
  program.addCommand(statsCommand);
  program.addCommand(webhooksCommand);
  program.addCommand(auditLogCommand);

  return program;
}

// Only auto-run when invoked as the CLI binary — not when imported by
// tests via `buildProgram`. Detect by comparing the resolved entrypoint
// of import.meta.url to argv[1].
const isCliEntry = (() => {
  if (process.env['FULKRUMA_DISABLE_AUTORUN'] === '1') return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  // bin/cli.js imports dist/index.js, which imports this file at runtime.
  return /\/(bin\/cli\.js|dist\/index\.js)$/.test(argv1);
})();

if (isCliEntry) {
  const program = buildProgram();
  program.parseAsync(process.argv).catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
