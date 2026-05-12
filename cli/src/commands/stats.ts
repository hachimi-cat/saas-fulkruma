/**
 * `fulkruma stats …` — overview counters + recent activity.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { getGlobalOpts, handleError } from '../lib/util.js';
import { printJson } from '../lib/output.js';

export const statsCommand = new Command('stats').description('Aggregate counters and recent activity');

statsCommand
  .command('overview')
  .description('Show stats overview')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const overview = await client.stats.overview();
      printJson(overview);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
