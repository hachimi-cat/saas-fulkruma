#!/usr/bin/env python3
"""Fail if the CLI's declared @forjio/fulkruma-node range matches nothing published.

The CLI pinned `"@forjio/fulkruma-node": "^0.2.0"` while the SDK in this repo
shipped 0.4.1. In 0.x semver a caret pins the MINOR — `^0.2.0` means
`>=0.2.0 <0.3.0` — so the CLI could never install the SDK it was written
against, and `npm ci` happily resolved the stale 0.2.0 instead of failing.

Nothing caught it because CI never built or tested the CLI at all; the only
job that touched sdk/ was `sync-sdk-mirrors`, which copies the source to the
public mirrors without ever compiling it. Measured 2026-08-16: `npm ci` in
cli/ installed 0.2.0, `tsc --noEmit` passed, and all 74 tests passed — the
broken state and the healthy state were indistinguishable to a build.

Two failure modes, both real:
  * the range resolves to NOTHING published  -> `npm ci` breaks outright
    (what happens if you bump the SDK in-repo and forget to publish);
  * the range resolves, but excludes the version in sdk/node/package.json
    -> the silent one. The CLI builds green against an old SDK, and every
    SDK fix published since is absent from what CLI users actually get.

Run from the repo root. Network-dependent by design: the question is what a
consumer's install would actually resolve.
"""
import json
import pathlib
import subprocess
import sys

DEP = "@forjio/fulkruma-node"


def fail(msg: str) -> None:
    print(f"CLI/SDK dependency check FAILED:\n  {msg}")
    sys.exit(1)


root = pathlib.Path(__file__).resolve().parent.parent
cli_pkg = json.loads((root / "cli" / "package.json").read_text())
sdk_pkg = json.loads((root / "sdk" / "node" / "package.json").read_text())

declared = (cli_pkg.get("dependencies") or {}).get(DEP)
if not declared:
    fail(f"cli/package.json does not depend on {DEP} at all")
local_version = sdk_pkg["version"]

print(f"cli declares {DEP}@{declared}")
print(f"sdk/node is at {local_version}")

# What would a consumer's install actually resolve this range to?
proc = subprocess.run(
    ["npm", "view", f"{DEP}@{declared}", "version", "--json"],
    capture_output=True, text=True, cwd=root,
)
raw = proc.stdout.strip()
if proc.returncode != 0 or not raw:
    fail(
        f"`{declared}` matches no published version of {DEP}.\n"
        f"  Publish sdk/node ({local_version}) before merging, or widen the range.\n"
        f"  npm said: {(proc.stderr or '').strip()[:300]}"
    )

parsed = json.loads(raw)
resolvable = [parsed] if isinstance(parsed, str) else list(parsed)
if not resolvable:
    fail(f"`{declared}` matches no published version of {DEP}")

resolved = resolvable[-1]
print(f"a consumer install resolves to {resolved}")

# The silent failure: resolvable, but not to what this repo actually builds.
if local_version not in resolvable:
    fail(
        f"the range `{declared}` cannot resolve to the SDK in this repo ({local_version}).\n"
        f"  It resolves to {resolved} instead, so the CLI ships against a different\n"
        f"  SDK than the one in sdk/node. This is exactly the ^0.2.0-vs-0.4.1 drift.\n"
        f"  Fix: bump the range in cli/package.json to match, and publish the SDK."
    )

# ── 2. the lockfile, which is what `npm ci` in CI actually installs ────
# The range and the lockfile fail in opposite directions, so a repo can be
# healthy on one and broken on the other. linksnap proved it: range ^0.1.0
# correctly admitted the in-repo 0.1.2, but the lock pinned 0.1.0, so CI
# compiled against a version no user ever received. A range-only check
# calls that healthy.
lock_path = root / "cli" / "package-lock.json"
if not lock_path.exists():
    fail("cli/package-lock.json is missing — `npm ci` cannot be reproducible")

lock = json.loads(lock_path.read_text())
entry = (lock.get("packages") or {}).get(f"node_modules/{DEP}")
if entry is None:
    fail(f"cli/package-lock.json has no entry for {DEP}; run `npm install` in cli/")

locked = entry.get("version")
print(f"cli/package-lock.json pins {locked}")

if locked != local_version:
    fail(
        f"the lockfile pins {DEP}@{locked}, but sdk/node in this repo is {local_version}.\n"
        f"  `npm ci` installs the lockfile exactly, so CI compiles and tests against\n"
        f"  {locked} while a user installing the CLI gets {resolved}.\n"
        f"  Fix: cd cli && npm install --package-lock-only, and commit the lockfile."
    )

print(f"OK - range {declared} and lockfile both resolve to the in-repo {local_version}")
