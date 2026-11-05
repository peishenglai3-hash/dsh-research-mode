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
| packages ready to publish | **9** |
| excluded on purpose | 1 (`research-phase2-exec`, private: true — it executes code) |
| preflight | `PASS (109/109)` including `npm pack` tarball checks |
| **blocked on** | **`npm login`** — the machine has no npm credentials (`ENEEDAUTH`) |

## Package names

| directory | npm name | version |
|---|---|---|
| `research-host` | `@peishenglai3-hash/dsh-research-host` | 0.2.0 |
| `research-workspace` | `@peishenglai3-hash/dsh-research-workspace` | 0.2.0 |
| `research-preset` | `@peishenglai3-hash/dsh-research-preset` | 0.2.0 |
| `research-preset-cn-social` | `@peishenglai3-hash/dsh-research-preset-cn-social` | 0.1.0 |
| `research-connectors` | `@peishenglai3-hash/dsh-research-connectors` | 0.1.0 |
| `research-hub` | `@peishenglai3-hash/dsh-research-hub` | 0.1.0 |
| `research-phase2-litdb` | `@peishenglai3-hash/dsh-research-phase2-litdb` | 0.1.0 |
| `research-phase2-notebook` | `@peishenglai3-hash/dsh-research-phase2-notebook` | 0.1.0 |
| `research-phase2-replay` | `@peishenglai3-hash/dsh-research-phase2-replay` | 0.1.0 |

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
