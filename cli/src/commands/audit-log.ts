/**
 * `fulkruma audit-log …` — list audit log entries.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { formatOpts, getGlobalOpts, handleError, parseIntArg } from '../lib/util.js';
import { printJson, printResult } from '../lib/output.js';

export const auditLogCommand = new Command('audit-log').description('Inspect audit log entries');

auditLogCommand
  .command('list')
  .description('List audit log entries')
  .option('--limit <n>', 'page size', parseIntArg)
  .option('--cursor <cursor>', 'pagination cursor')
  .option('--since <iso>', 'only entries after this ISO timestamp')
  .option('--event-type <type>', 'filter by event type')
  .action(
    async (
      options: { limit?: number; cursor?: string; since?: string; eventType?: string },
      cmd,
    ) => {
      const g = getGlobalOpts(cmd);
      try {
        const client = getClient(g);
        const result = await client.auditLog.list(options);
        if (g.json) {
          printJson(result);
        } else {
          printResult(
            result.entries,
            [
              { header: 'ID', accessor: (e) => e['id'] as string },
              { header: 'Type', accessor: (e) => e['eventType'] as string | undefined },
              { header: 'Actor', accessor: (e) => e['actor'] as string | undefined },
              { header: 'Resource', accessor: (e) => e['resource'] as string | undefined },
              { header: 'At', accessor: (e) => e['createdAt'] as string | undefined },
            ],
            formatOpts(g),
          );
        }
        process.exit(0);
      } catch (err) {
        handleError(err, g);
      }
    },
  );
