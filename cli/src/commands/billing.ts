/**
 * `fulkruma billing …` — plans, current-plan, usage, invoices, checkout, cancel.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printJson, printResult } from '../lib/output.js';

export const billingCommand = new Command('billing').description('Plans, invoices, usage');

billingCommand
  .command('plans')
  .description('List available plans')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const plans = await client.billing.plans();
      if (g.json) {
        printJson(plans);
      } else {
        printResult(
          plans,
          [
            { header: 'ID', accessor: (p) => p['id'] as string },
            { header: 'Name', accessor: (p) => p['name'] as string },
            { header: 'Price', accessor: (p) => p['priceCents'] as number | undefined },
            { header: 'Interval', accessor: (p) => p['interval'] as string | undefined },
          ],
          formatOpts(g),
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

billingCommand
  .command('current-plan')
  .description('Show the current plan + subscription state')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const plan = await client.billing.currentPlan();
      printJson(plan);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

billingCommand
  .command('usage')
  .description('Show current period usage')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const usage = await client.billing.usage();
      printJson(usage);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

billingCommand
  .command('invoices')
  .description('List invoices')
  .option('--limit <n>', 'page size', parseIntArg)
  .option('--cursor <cursor>', 'pagination cursor')
  .action(async (options: { limit?: number; cursor?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.billing.invoices({
        limit: options.limit,
        cursor: options.cursor,
      });
      if (g.json) {
        printJson(result);
      } else {
        printResult(
          result.invoices,
          [
            { header: 'ID', accessor: (i) => i['id'] as string },
            { header: 'Status', accessor: (i) => i['status'] as string },
            { header: 'Amount', accessor: (i) => i['amountCents'] as number | undefined },
            { header: 'Period', accessor: (i) => (i['period'] as Record<string, unknown> | undefined)?.['from'] as string | undefined },
            { header: 'Issued', accessor: (i) => i['issuedAt'] as string | undefined },
          ],
          formatOpts(g),
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

billingCommand
  .command('checkout <planId>')
  .description('Start a checkout flow for a plan')
  .option('--success-url <url>', 'redirect URL on success')
  .option('--cancel-url <url>', 'redirect URL on cancel')
  .action(async (planId: string, options: { successUrl?: string; cancelUrl?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.billing.checkout({
        planId,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
      });
      printResult(
        result,
        [
          { header: 'Session', accessor: (r) => r.sessionId },
          { header: 'URL', accessor: (r) => r.url },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

billingCommand
  .command('cancel')
  .description('Cancel the current subscription')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.billing.cancel();
      printJson(result);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
