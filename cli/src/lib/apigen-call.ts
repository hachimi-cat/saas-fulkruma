/**
 * How the generated `fulkruma api <area> <action>` commands (commands/api.generated.ts)
 * make their call: this CLI's own credentials and client (the SDK's signed `request`),
 * its own output and errors.
 */
import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import { getClient } from './client.js';
import { getGlobalOpts, handleError } from './util.js';
import { printJson } from './output.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function callRoute(
  cmd: Command,
  method: string,
  path: string,
  query: Record<string, unknown>,
  body: Record<string, unknown> | undefined,
): Promise<void> {
  const g = getGlobalOpts(cmd);
  try {
    const qs = new URLSearchParams(
      Object.entries(query).map(([k, v]): [string, string] => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
    ).toString();
    const client = getClient(g);
    const data = await client.request<unknown>({
      method: method as Method,
      path: qs ? `${path}?${qs}` : path,
      // The server hashes an empty JSON body as '' (middleware/hmac-auth.ts), the SDK as
      // '{}': send no body at all when no field was given, so the signatures agree.
      body: body && Object.keys(body).length ? body : undefined,
      idempotencyKey: method === 'GET' ? undefined : `idem_${randomUUID()}`,
    });
    printJson(data);
    process.exit(0);
  } catch (err) {
    handleError(err, g);
  }
}

/** Bad input to a generated command (a missing field, a value the spec does not allow). */
export async function failRoute(cmd: Command, err: unknown): Promise<never> {
  handleError(err, getGlobalOpts(cmd));
}
