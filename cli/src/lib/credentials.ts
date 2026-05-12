/**
 * HMAC credentials store for Fulkruma CLI.
 *
 * Why not @forjio/sdk's `Session`? `Session` is OIDC-focused — refresh
 * tokens, expiry, device-flow state. Fulkruma's CLI uses an AKIA-style
 * HMAC key+secret (key_id + secret) issued from the dashboard, so we
 * roll a small INI multi-profile store at `~/.fulkruma/credentials`,
 * shaped like AWS' credentials file.
 *
 * Format:
 *
 *   [default]
 *   key_id = AKIAFULK...
 *   secret = ...
 *
 *   [staging]
 *   key_id = AKIAFULK...
 *   secret = ...
 *
 * Resolution order for the active profile:
 *   1. `--profile <name>` global flag
 *   2. `FULKRUMA_PROFILE` env var
 *   3. `"default"`
 *
 * Direct env override (skips file entirely): `FULKRUMA_KEY_ID` +
 * `FULKRUMA_SECRET`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Credentials {
  keyId: string;
  secret: string;
}

export interface StoredProfile extends Credentials {
  profile: string;
}

const DEFAULT_PROFILE = 'default';

export function credentialsPath(): string {
  return process.env['FULKRUMA_CREDENTIALS_FILE'] ?? join(homedir(), '.fulkruma', 'credentials');
}

export function resolveProfileName(explicit?: string): string {
  return explicit ?? process.env['FULKRUMA_PROFILE'] ?? DEFAULT_PROFILE;
}

interface ParsedIni {
  /** profile name -> key/value pairs */
  profiles: Map<string, Map<string, string>>;
  /** ordered list of profile names as they appear in the file */
  order: string[];
}

function parseIni(content: string): ParsedIni {
  const profiles = new Map<string, Map<string, string>>();
  const order: string[] = [];
  let current: string | null = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      current = line.slice(1, -1).trim();
      if (!profiles.has(current)) {
        profiles.set(current, new Map());
        order.push(current);
      }
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || current === null) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    profiles.get(current)!.set(key, value);
  }
  return { profiles, order };
}

function serializeIni(parsed: ParsedIni): string {
  const blocks: string[] = [];
  for (const name of parsed.order) {
    const kv = parsed.profiles.get(name);
    if (!kv) continue;
    const lines = [`[${name}]`];
    for (const [k, v] of kv.entries()) lines.push(`${k} = ${v}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n') + '\n';
}

function readFile(): ParsedIni {
  const path = credentialsPath();
  if (!existsSync(path)) return { profiles: new Map(), order: [] };
  return parseIni(readFileSync(path, 'utf8'));
}

function writeFile(parsed: ParsedIni): void {
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, serializeIni(parsed), { encoding: 'utf8' });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* on Windows chmod is a no-op; ignore */
  }
}

/** Load credentials from env or file. Throws if nothing is configured. */
export function loadCredentials(profile?: string): StoredProfile {
  const envKey = process.env['FULKRUMA_KEY_ID'];
  const envSecret = process.env['FULKRUMA_SECRET'];
  if (envKey && envSecret) {
    return { profile: '(env)', keyId: envKey, secret: envSecret };
  }
  const name = resolveProfileName(profile);
  const { profiles } = readFile();
  const kv = profiles.get(name);
  if (!kv) {
    throw new Error(
      `No credentials found for profile "${name}" at ${credentialsPath()}. ` +
        `Run \`fulkruma auth login --key-id <id> --secret <secret>\` first.`,
    );
  }
  const keyId = kv.get('key_id');
  const secret = kv.get('secret');
  if (!keyId || !secret) {
    throw new Error(`Profile "${name}" is missing key_id or secret.`);
  }
  return { profile: name, keyId, secret };
}

/** Try to load without throwing — returns null if no creds. */
export function tryLoadCredentials(profile?: string): StoredProfile | null {
  try {
    return loadCredentials(profile);
  } catch {
    return null;
  }
}

/** Save credentials into a profile (creates or overwrites). */
export function saveCredentials(input: { profile?: string; keyId: string; secret: string }): string {
  const name = resolveProfileName(input.profile);
  const parsed = readFile();
  if (!parsed.profiles.has(name)) {
    parsed.profiles.set(name, new Map());
    parsed.order.push(name);
  }
  const kv = parsed.profiles.get(name)!;
  kv.set('key_id', input.keyId);
  kv.set('secret', input.secret);
  writeFile(parsed);
  return name;
}

/** Clear a profile. Returns true if removed, false if it didn't exist. */
export function clearCredentials(profile?: string): boolean {
  const name = resolveProfileName(profile);
  const parsed = readFile();
  if (!parsed.profiles.has(name)) return false;
  parsed.profiles.delete(name);
  parsed.order = parsed.order.filter((n) => n !== name);
  writeFile(parsed);
  return true;
}

/** List profile names for diagnostics. */
export function listProfiles(): string[] {
  return readFile().order.slice();
}

/** Mask the secret half of an API key for display. */
export function maskKey(keyId: string): string {
  if (keyId.length <= 10) return keyId;
  return `${keyId.slice(0, 10)}…${keyId.slice(-4)}`;
}
