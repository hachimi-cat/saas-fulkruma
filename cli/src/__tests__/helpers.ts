/**
 * Test helpers: a fake FulkrumaClient that records calls + a programmatic
 * runner for the commander program. Used by every command-group test so
 * we never hit the network.
 */
import { vi, type MockInstance } from 'vitest';
import { setClientFactory } from '../lib/client.js';

export interface RecordedCall {
  group: string;
  method: string;
  args: unknown[];
}

export interface FakeClient {
  calls: RecordedCall[];
  responses: Map<string, unknown>;
  /** Set a canned response for `<group>.<method>`. */
  on(key: string, response: unknown): void;
}

function makeProxy(group: string, calls: RecordedCall[], responses: Map<string, unknown>): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        return (...args: unknown[]) => {
          calls.push({ group, method: prop, args });
          const key = `${group}.${prop}`;
          if (responses.has(key)) return Promise.resolve(responses.get(key));
          // sensible default: empty list / empty object
          if (prop === 'list' || prop === 'listEndpoints' || prop === 'listEvents' || prop === 'couriers' || prop === 'plans') {
            return Promise.resolve({
              [group === 'webhooks' && prop === 'listEvents' ? 'events' : group]:
                [],
              endpoints: [],
              events: [],
              entries: [],
              invoices: [],
            });
          }
          return Promise.resolve({});
        };
      },
    },
  );
}

export function installFakeClient(): FakeClient {
  const calls: RecordedCall[] = [];
  const responses = new Map<string, unknown>();
  const groups = [
    'products',
    'warehouses',
    'stock',
    'addresses',
    'shipments',
    'shipping',
    'licenses',
    'deliveries',
    'billing',
    'apiKeys',
    'integrations',
    'stats',
    'webhooks',
    'auditLog',
    'admin',
  ];
  const client: Record<string, unknown> = {};
  for (const g of groups) {
    client[g] = makeProxy(g, calls, responses);
  }
  setClientFactory(() => client as never);
  return {
    calls,
    responses,
    on(key, response) {
      responses.set(key, response);
    },
  };
}

/** Run a top-level command programmatically. Returns whatever the action returns. */
export async function runCli(buildProgram: () => import('commander').Command, argv: string[]): Promise<void> {
  const program = buildProgram();
  // disable commander's process.exit so test runner survives
  program.exitOverride();
  // some action handlers call process.exit — stub it to a throw so we can catch.
  const exitSpy: MockInstance = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`__exit:${code ?? 0}`);
  }) as never);
  try {
    await program.parseAsync(['node', 'cli', ...argv]);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('__exit:')) {
      const code = Number.parseInt(err.message.slice('__exit:'.length), 10);
      if (code !== 0) throw err;
      // normal exit-0 — swallow
    } else {
      throw err;
    }
  } finally {
    exitSpy.mockRestore();
  }
}

/** Silence stdout/stderr during a test block. */
export function silenceStdio(): { restore: () => void } {
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  return {
    restore: () => {
      outSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}
