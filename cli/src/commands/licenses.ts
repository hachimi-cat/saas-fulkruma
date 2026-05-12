/**
 * `fulkruma licenses …` — list, issue, revoke, validate, activate, deactivate.
 */
import { Command } from 'commander';
import type { License } from '@forjio/fulkruma-node';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

const licenseColumns: readonly Column<License>[] = [
  { header: 'ID', accessor: (l) => l.id },
  { header: 'Key', accessor: (l) => l.key },
  { header: 'Product', accessor: (l) => l.productId },
  { header: 'Customer', accessor: (l) => l.customerId },
  { header: 'Status', accessor: (l) => l.status },
  { header: 'Activations', accessor: (l) => `${l.activations}/${l.maxActivations}` },
  { header: 'Expires', accessor: (l) => l.expiresAt },
];

export const licensesCommand = new Command('licenses').description('Software license keys');

licensesCommand
  .command('list')
  .description('List licenses')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { licenses } = await client.licenses.list();
      printResult(licenses, licenseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

licensesCommand
  .command('issue')
  .description('Issue a new license')
  .requiredOption('--product-id <id>', 'product id')
  .requiredOption('--customer-id <id>', 'customer id')
  .option('--max-activations <n>', 'maximum activations', parseIntArg)
  .option('--expires-at <iso>', 'ISO-8601 expiry timestamp')
  .option('--external-source <name>', 'external source')
  .option('--external-ref <id>', 'external reference id')
  .action(async (options: Record<string, unknown>, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { license } = await client.licenses.issue({
        productId: options['productId'] as string,
        customerId: options['customerId'] as string,
        maxActivations: options['maxActivations'] as number | undefined,
        expiresAt: options['expiresAt'] as string | undefined,
        externalSource: options['externalSource'] as string | undefined,
        externalRef: options['externalRef'] as string | undefined,
      });
      printResult(license, licenseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

licensesCommand
  .command('revoke <id>')
  .description('Revoke a license')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { license } = await client.licenses.revoke(id);
      printResult(license, licenseColumns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

licensesCommand
  .command('validate <key>')
  .description('Validate a license key')
  .option('--product-id <id>', 'product id (optional, narrows match)')
  .action(async (key: string, options: { productId?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.licenses.validate({
        key,
        productId: options.productId,
      });
      printResult(
        result,
        [
          { header: 'Key', accessor: (r) => r.key },
          { header: 'Valid', accessor: (r) => r.valid },
          { header: 'Status', accessor: (r) => r.status },
          { header: 'Product', accessor: (r) => r.productId },
          { header: 'Activations', accessor: (r) => `${r.activations ?? 0}/${r.maxActivations ?? 0}` },
          { header: 'Expires', accessor: (r) => r.expiresAt },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

licensesCommand
  .command('activate <key> <instanceId>')
  .description('Activate a license for a specific instance')
  .action(async (key: string, instanceId: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.licenses.activate({ key, instanceId });
      printResult(
        result,
        [
          { header: 'Key', accessor: (r) => r.license.key },
          { header: 'Status', accessor: (r) => r.license.status },
          { header: 'Activations', accessor: (r) => `${r.license.activations}/${r.license.maxActivations}` },
          { header: 'Instance', accessor: (r) => r.activation.instanceId },
          { header: 'Already Active', accessor: (r) => r.alreadyActive },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

licensesCommand
  .command('deactivate <key> <instanceId>')
  .description('Release a previously-activated instance')
  .action(async (key: string, instanceId: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.licenses.deactivate({ key, instanceId });
      printResult(
        result,
        [
          { header: 'Deactivated', accessor: (r) => r.deactivated },
          { header: 'Already Deactivated', accessor: (r) => r.alreadyDeactivated },
          { header: 'Activations', accessor: (r) => r.activations },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
