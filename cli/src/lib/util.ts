/**
 * Per-command helpers: global option resolution, error formatting,
 * JSON body parsing for commands that accept --body.
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { isFulkrumaError, type GlobalOpts } from './client.js';
import { type FormatOptions, printError } from './output.js';

export function getGlobalOpts(cmd: Command): GlobalOpts {
  let p: Command = cmd;
  while (p.parent) p = p.parent;
  return p.opts() as GlobalOpts;
}

export function formatOpts(g: GlobalOpts): FormatOptions {
  return {
    json: Boolean(g.json),
    noColor: process.env['NO_COLOR'] === '1',
  };
}

export function handleError(err: unknown, g: GlobalOpts): never {
  // Re-throw test sentinels (vitest stubs `process.exit` to throw with
  // a `__exit:<code>` message). Without this, the action's `try/catch`
  // turns successful runs into spurious failures during testing.
  if (err instanceof Error && err.message.startsWith('__exit:')) {
    throw err;
  }
  if (isFulkrumaError(err)) {
    printError(
      { code: err.code, message: err.message, requestId: err.requestId },
      formatOpts(g),
    );
    process.exit(err.status === 401 || err.status === 403 ? 2 : 1);
  }
  const msg = err instanceof Error ? err.message : String(err);
  printError({ code: 'error', message: msg }, formatOpts(g));
  process.exit(1);
}

/**
 * Parse `--body` value. Accepts either:
 *   - inline JSON string (e.g., `'{"courierCode":"jne"}'`)
 *   - `@path/to/file.json` to read from disk
 *   - `-` to read from stdin (only when stdin is a pipe)
 */
export function parseBody(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let text = raw;
  if (raw.startsWith('@')) {
    text = readFileSync(raw.slice(1), 'utf8');
  } else if (raw === '-') {
    text = readFileSync(0, 'utf8');
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('--body must decode to a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to parse --body: ${msg}`);
  }
}

export function parseIntArg(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`invalid integer: ${value}`);
  return n;
}
