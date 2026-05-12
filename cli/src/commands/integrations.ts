/**
 * `fulkruma integrations …` — status of Huudis/Biteship/Plugipay/Storlaunch.
 */
import { Command } from 'commander';
import { getClient } from '../lib/client.js';
import { getGlobalOpts, handleError } from '../lib/util.js';
import { printJson } from '../lib/output.js';

export const integrationsCommand = new Command('integrations').description(
  'Check status of upstream integrations (Huudis, Biteship, Plugipay, Storlaunch)',
);

integrationsCommand
  .command('status')
  .description('Show integration status')
  .action(async (_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const client = getClient(g);
      const status = await client.integrations.status();
      printJson(status);
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
