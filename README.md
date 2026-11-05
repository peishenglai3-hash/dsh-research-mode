# Research Mode for DeepSeek Harness

**Evidence-first research workflow — local-first, file-based, and honest about what it can prove.**

> 把科研还给具体的人：一个本地优先、证据优先的科研工作流。
> 它不是"会写论文的聊天框"，而是把**产物（Artifact）**和**证据链（Provenance）**做成一等对象。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## Why this exists

Most AI research tools optimise for *answers*. That is the wrong unit for research, because an
answer cannot be re-checked, handed over, or challenged. This project optimises for the thing
that can be: **a content-addressed artifact with a provenance record that says where it came from,
what was actually run, and what remains unknown.**

It is a set of plugins for [DeepSeek Harness](https://github.com/) (a plugin-based agent runtime),
plus skills that encode research discipline rather than research marketing.

Designed for social-science work first (small samples, textual sources, local literature) — the
first preset ships a Chinese social-science persona — but the evidence model is field-agnostic.

## What it actually does

Ten bundles, 24 tools, no third-party runtime dependencies (Node builtins only).

| Bundle | What it provides |
|---|---|
| `research-host` | Artifact store with 7-face provenance, review records with per-round content signatures, `.science` archive export/import |
| `research-workspace` | Left-sidebar research workspace: project templates, Host project list, launch a session scoped to a project |
| `research-hub` | Single right-pane entry with four tabs: artifacts · provenance · reviews · local library |
| `research-connectors` | 8 read-only connectors (OpenAlex, Crossref, DataCite, OSF/SocArXiv, PKU Dataverse, World Bank, ILOSTAT, NBS snapshot) |
| `research-phase2-litdb` | Read-only search over a **local** Chinese social-science sample database (FTS5 with LIKE fallback) |
| `research-phase2-notebook` | Read-only `.ipynb` inspection: cells, execution counts, imports, reproducibility gaps |
| `research-phase2-replay` | Read-only replay plan: artifacts, reviews, exports, gaps |
| `research-preset` / `research-preset-cn-social` | Agent presets: evidence-first persona + reading guardrails |
| `skills/` (10) | The discipline: literature review, evidence audit, review, reproduction, design, figures, narrative, litdb, environment |

**Data layout** — everything lives in a plain directory you own:

```text
.research/
  projects/<id>/
    project.json
    artifacts/<sha256>          # immutable payload, content-addressed
    artifacts/<sha256>.json     # sidecar: 7-face provenance
    reviews/<artifactId>.json   # per-round history + signature
    exports/<name>.science      # tar.gz, manifest + RO-Crate stub + payload
```

## Quick start

```bash
# 1. clone into your harness plugins area
git clone https://github.com/peishenglai3-hash/dsh-research-mode.git

# 2. add the bundles to a profile (see docs/INSTALL.md)
dsh plugin --profile <your-profile> add link:./plugins/active/research-host
#    ... repeat for the other bundles, then
dsh --profile <your-profile> --dump-config
```

Read `docs/INSTALL.md` for the full profile recipe, and `docs/EVIDENCE-MODEL.md` for what the
seven provenance faces mean.

## Verification (run it yourself)

```bash
node --test plugins/active/*/test/*.test.mjs   # 66 tests
node tools/w01/verify-acceptance.mjs           # 13 acceptance checks
node tools/w01/probe-containment.mjs           # 12 path-containment vectors
node tools/w01/s1-check-skill-contracts.mjs    # skill <-> tool contract + mirror drift
```

All of these are zero-dependency Node scripts. They exist because "it works" should be a
command, not a claim.

## What this software does **not** do

This section is longer than usual on purpose. A provenance tool that oversells itself is worse
than none.

- **`provenance.reproducibility.available` does not mean "reproduced".** It means a checksum,
  byte count and source were recorded. Nothing was re-run.
- **`provenance.environment.available` does not mean "reproducible environment".** If you did not
  pass one in, the tool fills in `{platform, arch, node, python}` automatically. Compare the keys
  before trusting it.
- **`provenance.review.available` does not mean "reviewed by a human".** Signature =
  unkeyed content hash. It proves the record was not edited; it does not prove identity.
- **`review verify → valid` does not prove history is complete.** A single file cannot prove older
  rounds were not deleted or reordered. Rounds without signatures are reported as legacy, not valid.
- **There is no per-tool authorization gate.** A tool call is not approved by a human at runtime.
- **`confirm=true` is a tool parameter, not human consent.** It is a speed bump, not a control.
- **`.science` import read-only is declared, not enforced.** On Windows the copied tree is still writable.
- **Nothing here claims scientific validity.** It records what happened; it does not judge whether
  your argument is true.

## Design principles

1. **The artifact is the unit, not the answer.** Conversation is a channel that produces artifacts.
2. **Unknown is a first-class state.** Missing evidence is recorded as `unavailable`, never inferred.
3. **Content addressing over mutable files.** Identity = sha256 of the bytes.
4. **Local-first, file-based, no database server.** You can `grep` your own research.
5. **Discipline lives in text, not in a workflow engine.** The skills say what good practice is;
   the tools record what actually happened. We do not pretend the two are the same.

## Status

Early. The evidence layer and the local data layout are exercised by a real acceptance suite;
the reading/parsing path currently depends on an external PDF parser (Docling) and is documented
as such, including its known timeout issue. Interfaces may change before 1.0.

## License

MIT — see [LICENSE](./LICENSE).

Built as part of a sociology-of-AI practice: the questions that drove it were about
**digital inequality, social atomisation, and what accountability looks like when knowledge
production is automated**. The code is the smallest possible answer we could make honest.
