/**
 * FulkrumaClient factory. Loads credentials from `~/.fulkruma/credentials`
 * (or env) and constructs a SDK client with the active profile.
 *
 * Tests inject a fake client via `setClientFactory` so we never hit the
 * network in unit tests.
 */
import { FulkrumaClient, FulkrumaError } from '@forjio/fulkruma-node';
import { loadCredentials } from './credentials.js';

export interface GlobalOpts {
  json?: boolean;
  profile?: string;
  baseUrl?: string;
  onBehalfOf?: string;
}

export type ClientFactory = (opts: GlobalOpts) => FulkrumaClient;

let factory: ClientFactory = (opts) => {
  const creds = loadCredentials(opts.profile);
  return new FulkrumaClient({
    keyId: creds.keyId,
    secret: creds.secret,
    baseUrl: opts.baseUrl ?? process.env['FULKRUMA_BASE_URL'] ?? undefined,
    onBehalfOf: opts.onBehalfOf,
  });
};

/** Test seam — vitest tests replace this with a mock. */
export function setClientFactory(f: ClientFactory): void {
  factory = f;
}

/** Reset to default behaviour (load creds + new SDK client). */
export function resetClientFactory(): void {
  factory = (opts) => {
    const creds = loadCredentials(opts.profile);
    return new FulkrumaClient({
      keyId: creds.keyId,
      secret: creds.secret,
      baseUrl: opts.baseUrl ?? process.env['FULKRUMA_BASE_URL'] ?? undefined,
      onBehalfOf: opts.onBehalfOf,
    });
  };
}

export function getClient(opts: GlobalOpts): FulkrumaClient {
  return factory(opts);
}

export function isFulkrumaError(err: unknown): err is FulkrumaError {
  return err instanceof FulkrumaError;
}
