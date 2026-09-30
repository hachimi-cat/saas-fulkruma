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
      const { apiKeys: keys } = await client.apiKeys.list();
      const columns: readonly Column<KeyRow>[] = [
        { header: 'ID', accessor: (k) => k['id'] as string },
        { header: 'Key ID', accessor: (k) => k['keyId'] as string },
        { header: 'Name', accessor: (k) => k['name'] as string | undefined },
        { header: 'Scopes', accessor: (k) => ((k['scopes'] as string[] | undefined) ?? []).join(',') },
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
  .requiredOption('--name <text>', 'a name for the key')
  .option('--scopes <list>', 'comma-separated: read, write, admin (default: the server\'s)')
  .action(async (options: { name: string; scopes?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const scopes = options.scopes
        ? (options.scopes.split(',').map((x) => x.trim()).filter(Boolean) as Array<'read' | 'write' | 'admin'>)
        : undefined;
      const { apiKey, secret } = await client.apiKeys.create({ name: options.name, ...(scopes ? { scopes } : {}) });
      const key: KeyRow = { ...apiKey, secret };
      const columns: readonly Column<KeyRow>[] = [
        { header: 'ID', accessor: (k) => k['id'] as string },
        { header: 'Key ID', accessor: (k) => k['keyId'] as string },
        { header: 'Secret (shown once)', accessor: (k) => k['secret'] as string | undefined },
        { header: 'Name', accessor: (k) => k['name'] as string | undefined },
        { header: 'Scopes', accessor: (k) => ((k['scopes'] as string[] | undefined) ?? []).join(',') },
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
        { id, revoked: Boolean(result.apiKey?.revokedAt) },
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
