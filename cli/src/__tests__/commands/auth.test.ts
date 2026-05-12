/**
 * Auth command tests — exercises the credentials INI store via
 * FULKRUMA_CREDENTIALS_FILE pointed at a tmpdir.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProgram } from '../../index.js';
import { listProfiles, loadCredentials, saveCredentials } from '../../lib/credentials.js';
import { runCli, silenceStdio } from '../helpers.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'fulkruma-cli-'));
  process.env['FULKRUMA_CREDENTIALS_FILE'] = join(tmp, 'credentials');
  delete process.env['FULKRUMA_KEY_ID'];
  delete process.env['FULKRUMA_SECRET'];
  delete process.env['FULKRUMA_PROFILE'];
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env['FULKRUMA_CREDENTIALS_FILE'];
});

describe('auth login', () => {
  it('saves credentials to the default profile', async () => {
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['auth', 'login', '--key-id', 'AKIAFULKTEST', '--secret', 'shh']);
    } finally {
      s.restore();
    }
    expect(existsSync(process.env['FULKRUMA_CREDENTIALS_FILE']!)).toBe(true);
    const contents = readFileSync(process.env['FULKRUMA_CREDENTIALS_FILE']!, 'utf8');
    expect(contents).toMatch(/\[default\]/);
    expect(contents).toMatch(/key_id = AKIAFULKTEST/);
    expect(contents).toMatch(/secret = shh/);

    const loaded = loadCredentials();
    expect(loaded).toEqual({ profile: 'default', keyId: 'AKIAFULKTEST', secret: 'shh' });
  });

  it('saves credentials to a named profile via --profile', async () => {
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        '--profile',
        'staging',
        'auth',
        'login',
        '--key-id',
        'AKIAFULKSTAGE',
        '--secret',
        'stg',
      ]);
    } finally {
      s.restore();
    }
    expect(listProfiles()).toEqual(['staging']);
    expect(loadCredentials('staging').keyId).toBe('AKIAFULKSTAGE');
  });
});

describe('auth whoami', () => {
  it('reports the active profile + masked key', async () => {
    saveCredentials({ keyId: 'AKIAFULKLIVE', secret: 'x' });
    const out: string[] = [];
    const restore = (process.stdout.write as unknown as (s: string) => boolean);
    process.stdout.write = ((chunk: string) => {
      out.push(chunk);
      return true;
    }) as typeof process.stdout.write;
    try {
      await runCli(buildProgram, ['auth', 'whoami']);
    } finally {
      process.stdout.write = restore as never;
    }
    const blob = out.join('');
    expect(blob).toMatch(/default/);
    expect(blob).toMatch(/AKIAFULKLI/);
  });

  it('exits non-zero when not signed in', async () => {
    const s = silenceStdio();
    let caught: unknown = null;
    try {
      await runCli(buildProgram, ['auth', 'whoami']);
    } catch (err) {
      caught = err;
    } finally {
      s.restore();
    }
    expect((caught as Error | null)?.message).toMatch(/__exit:1/);
  });
});

describe('auth logout', () => {
  it('clears the active profile', async () => {
    saveCredentials({ keyId: 'AKIAFULKLIVE', secret: 'x' });
    expect(listProfiles()).toContain('default');
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['auth', 'logout']);
    } finally {
      s.restore();
    }
    expect(listProfiles()).not.toContain('default');
  });
});
