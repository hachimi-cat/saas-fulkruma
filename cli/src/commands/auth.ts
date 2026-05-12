/**
 * `auth login` / `auth whoami` / `auth logout`
 *
 * Fulkruma is a partner SDK, not a user-facing OIDC product, so auth =
 * HMAC API key + secret stored at `~/.fulkruma/credentials` in INI
 * multi-profile format. `@forjio/sdk`'s `Session` doesn't fit (it
 * models OIDC tokens with refresh + expiry).
 */
import { Command } from 'commander';
import chalk from 'chalk';
import {
  clearCredentials,
  credentialsPath,
  listProfiles,
  maskKey,
  resolveProfileName,
  saveCredentials,
  tryLoadCredentials,
} from '../lib/credentials.js';
import { formatOpts, getGlobalOpts, handleError } from '../lib/util.js';
import { printJson, printMessage } from '../lib/output.js';

export const authCommand = new Command('auth').description(
  'Manage HMAC credentials for Fulkruma',
);

authCommand
  .command('login')
  .description('Save HMAC credentials to the active profile')
  .option('--key-id <id>', 'HMAC access key id (e.g., AKIAFULK…)')
  .option('--secret <secret>', 'HMAC secret access key')
  .action(async (options: { keyId?: string; secret?: string }, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const keyId = options.keyId ?? process.env['FULKRUMA_KEY_ID'];
      const secret = options.secret ?? process.env['FULKRUMA_SECRET'];
      if (!keyId || !secret) {
        throw new Error(
          'both --key-id and --secret are required (or set FULKRUMA_KEY_ID + FULKRUMA_SECRET).',
        );
      }
      const profile = saveCredentials({ profile: g.profile, keyId, secret });
      if (g.json) {
        printJson({
          ok: true,
          profile,
          keyPrefix: maskKey(keyId),
          path: credentialsPath(),
        });
      } else {
        printMessage(
          `${chalk.green('✓')} Saved credentials for profile ${chalk.bold(profile)} at ${credentialsPath()}`,
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

authCommand
  .command('whoami')
  .description('Show the active profile + key prefix')
  .action((_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const profile = resolveProfileName(g.profile);
      const stored = tryLoadCredentials(g.profile);
      const fmt = formatOpts(g);
      if (!stored) {
        if (fmt.json) {
          printJson({
            ok: false,
            profile,
            authenticated: false,
            path: credentialsPath(),
            availableProfiles: listProfiles(),
          });
        } else {
          process.stdout.write(
            `${chalk.yellow('Not signed in.')} Run \`fulkruma auth login --key-id <id> --secret <secret>\`.\n`,
          );
          const profiles = listProfiles();
          if (profiles.length > 0) {
            process.stdout.write(
              chalk.dim(`Available profiles: ${profiles.join(', ')}\n`),
            );
          }
        }
        process.exit(1);
      }
      if (fmt.json) {
        printJson({
          ok: true,
          profile: stored.profile,
          keyPrefix: maskKey(stored.keyId),
          path: credentialsPath(),
        });
      } else {
        process.stdout.write(
          `${chalk.green('Profile')}    ${chalk.bold(stored.profile)}\n` +
            `${chalk.green('Key')}        ${maskKey(stored.keyId)}\n` +
            `${chalk.green('Store')}      ${credentialsPath()}\n`,
        );
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });

authCommand
  .command('logout')
  .description('Clear credentials for the active profile')
  .action((_options, cmd) => {
    const g = getGlobalOpts(cmd);
    try {
      const profile = resolveProfileName(g.profile);
      const removed = clearCredentials(g.profile);
      if (g.json) {
        printJson({ ok: true, profile, removed });
      } else if (removed) {
        printMessage(`${chalk.green('✓')} Cleared profile ${chalk.bold(profile)}.`);
      } else {
        printMessage(chalk.dim(`No credentials stored for profile ${profile}.`));
      }
      process.exit(0);
    } catch (err) {
      handleError(err, g);
    }
  });
