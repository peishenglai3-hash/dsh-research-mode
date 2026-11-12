# DSH community submission

Target registry: [`dshworks/awesome-dsh-plugins`](https://github.com/dshworks/awesome-dsh-plugins)
— the index `dsh`'s Discover tab reads (`https://dsh.works/awesome-dsh-plugins/market/index.json`).

## What the registry actually requires

From that repository's README, three conditions decide whether an entry is *kept*:

1. **A published npm package.** The market index is built from entries whose `npm` name resolves
   on the public registry. A git-only entry does not appear in the Discover tab.
2. **The package declares `dsh.bundle`.** Otherwise it is not a bundle and cannot be installed.
3. **`repository.url` names the repository back.** A name is kept only when the published
   package's own `repository.url` points at the repo, so a listing cannot claim someone else's
   package.

All three are checked locally by `tools/release/npm-preflight.mjs`. It needs no npm login and
does not publish anything.

## Current state

| | |
|---|---|
| published | **9 / 9** on npm, verified by installing them back from the registry |
| current versions (2026-11-12) | host `0.2.1` · hub / litdb / notebook / replay `0.1.1` · workspace / preset `0.2.0` · connectors / preset-cn-social `0.1.0` |
| excluded on purpose | 1 (`research-phase2-exec`, private: true — it executes code) |
| registry submission | issue https://github.com/dshworks/awesome-dsh-plugins/issues/221 |
| discovery | repository topic `dsh-plugin` set, which is the registry's scan entry |

### What publishing actually required

npm refused every non-interactive path with `E403`/`EOTP`:

- a granular token without "bypass 2FA" → `E403`;
- the session token from `npm login` → `EOTP`;
- `deprecate` (a write on an existing package) → `EOTP` too.

The account uses a **security key (WebAuthn)**, not a TOTP app, so there was no 6-digit code to
supply. The working path was the browser challenge with the "do not challenge npm publish from
this IP for 5 minutes" box ticked, after which a single `npm publish --workspaces` in a real TTY
published the remaining eight in that window.

This is worth recording because the failure messages point at the token, and the token is not the
problem: npm now requires interactive 2FA for writes and is restricting bypass-2FA tokens for
direct publishing.

## Package names

| directory | npm name | version |
|---|---|---|
| `research-host` | `@peisheng_lai/dsh-research-host` | 0.2.0 |
| `research-workspace` | `@peisheng_lai/dsh-research-workspace` | 0.2.0 |
| `research-preset` | `@peisheng_lai/dsh-research-preset` | 0.2.0 |
| `research-preset-cn-social` | `@peisheng_lai/dsh-research-preset-cn-social` | 0.1.0 |
| `research-connectors` | `@peisheng_lai/dsh-research-connectors` | 0.1.0 |
| `research-hub` | `@peisheng_lai/dsh-research-hub` | 0.1.0 |
| `research-phase2-litdb` | `@peisheng_lai/dsh-research-phase2-litdb` | 0.1.0 |
| `research-phase2-notebook` | `@peisheng_lai/dsh-research-phase2-notebook` | 0.1.0 |
| `research-phase2-replay` | `@peisheng_lai/dsh-research-phase2-replay` | 0.1.0 |

Versions are **not** unified: the three 0.2.0 packages are the older, more-exercised ones and
downgrading them to match would be a lie about their maturity.

## Procedure (run after `npm login`)

```bash
npm login                      # interactive; then: npm whoami
node tools/release/npm-preflight.mjs --pack     # must be PASS
(cd plugins/active/research-host && npm publish --access public)
# ... repeat for the other eight directories
```

Then open a PR against `dshworks/awesome-dsh-plugins` adding one entry per package to
`data/plugins.json`, copying the field shape of a neighbouring entry and setting:

| field | value |
|---|---|
| `name` | the npm name above |
| `repository.url` | `https://github.com/peishenglai3-hash/dsh-research-mode` |
| `repository.directory` | `plugins/active/<directory>` |
| `evidence` | `package.json#dsh.bundle` |
| `metadata.category` | `knowledge` |
| `metadata.labels` | `knowledge`, `observability` |
| `verifiedAgainst` / `lastVerified` | the dsh version you verified on, and the date |

Keep the entry to what the schema accepts: the registry validates structure, and a wrong
`evidence` path is rejected rather than silently accepted.

## Why nine entries and not one

A single umbrella bundle would give users one install command. It is **not** included yet,
because an umbrella can only be verified end-to-end once its nine dependencies resolve from npm —
which needs the publication above. Shipping an unverified bundle that claims to install nine
others would be exactly the kind of claim this project refuses to make.

When publishing works, the umbrella becomes a small, verifiable follow-up: a package whose
`cordis.patch.yml` inserts the nine rows, tested by installing it into a scratch profile and
diffing `--dump-config`.
