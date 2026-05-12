/**
 * `fulkruma api-keys …` — list, create, revoke.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError } from '../lib/util.js';
import { printResult, type Column } from '../lib/output.js';

type KeyRow = Record<string, unknown>;

export const apiKeysCommand = new Command('api-keys').description('Manage Fulkruma API keys');

apiKeysCommand
  .command('list')
  .description('List API keys')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { keys } = await client.apiKeys.list();
      const columns: readonly Column<KeyRow>[] = [
        { header: 'ID', accessor: (k) => k['id'] as string },
        { header: 'Key ID', accessor: (k) => k['keyId'] as string },
        { header: 'Description', accessor: (k) => k['description'] as string | undefined },
        { header: 'Scope', accessor: (k) => k['scope'] as string | undefined },
        { header: 'Revoked', accessor: (k) => k['revokedAt'] as string | undefined },
        { header: 'Created', accessor: (k) => k['createdAt'] as string | undefined },
      ];
      printResult(keys, columns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

apiKeysCommand
  .command('create')
  .description('Issue a new API key')
  .option('--description <text>', 'human-readable description')
  .option('--scope <scope>', 'scope (defaults to merchant)')
  .action(async (options: { description?: string; scope?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const { key } = await client.apiKeys.create({
        description: options.description,
        scope: options.scope,
      });
      const columns: readonly Column<KeyRow>[] = [
        { header: 'ID', accessor: (k) => k['id'] as string },
        { header: 'Key ID', accessor: (k) => k['keyId'] as string },
        { header: 'Secret', accessor: (k) => k['secret'] as string | undefined },
        { header: 'Description', accessor: (k) => k['description'] as string | undefined },
        { header: 'Scope', accessor: (k) => k['scope'] as string | undefined },
      ];
      printResult(key, columns, formatOpts(g));
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

apiKeysCommand
  .command('revoke <id>')
  .description('Revoke an API key')
  .action(async (id: string, _options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const result = await client.apiKeys.revoke(id);
      printResult(
        { id, revoked: result.revoked },
        [
          { header: 'ID', accessor: (r) => r.id },
          { header: 'Revoked', accessor: (r) => r.revoked },
        ],
        formatOpts(g),
      );
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
