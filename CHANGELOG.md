# Changelog

All notable changes to this repository. Versions here are **repository milestones**; the
individual npm packages carry their own versions (see each `plugins/active/*/package.json`), and a
repository milestone does not imply every package moved.

## [0.1.1] — 2026-11-11

Read-path integrity, project-id validation, and self-verification. No new tools, no schema
changes, no changes to provenance field semantics.

### Security

- **Project ids can no longer traverse.** `research_notebook_inspect`, `research_replay_plan` and
  the litdb cache writer accepted `.` and `..` as a project id, because the validator's character
  class allows a dot. With `..`, the project root resolved to `<workspace>/.research` and a
  relative notebook path could read a **sibling project's** notebook (reproduced before the fix).
  The three call sites now refuse the two navigational names explicitly.
- **Export refuses a payload that no longer matches its id.** Previously the manifest was rebuilt
  from whatever bytes were on disk, so a tampered artifact exported into an archive that verified
  perfectly on import — the change was laundered rather than reported.

### Added

- `research_provenance_get` now returns **`payloadVerified`** and **`payloadBytes`**, computed by
  re-reading the payload and re-hashing it. A deleted payload reports `false` instead of throwing.
  An untouched sidecar still reports the recorded checksum; the two answers are deliberately
  separate.
- **CI** (`.github/workflows/verify.yml`): tests, path-containment probes, skill/tool contract,
  offline npm metadata preflight, and the reading-evidence loop now run on every push.
- `tools/w03/run-tests.mjs` — a cross-platform test entry that enumerates test files itself
  (the Windows runner's shell does not expand globs).
- `tools/w03/verify-reading-loop.mjs` — proves that a reading note's quotes are verbatim present at
  the anchors they cite (with a fabricated-quote negative control), that the note records as a
  content-addressed artifact, and that read-back verifies the bytes. It runs without the PDF
  parser on purpose.

### Fixed

- **The hub's provenance count now means the same thing as the tool's.** The panel said the review
  face was derived at read time but counted only the immutable sidecar, so an artifact with a
  recorded review showed a lower number than `research_provenance_get`. Extracted as a pure
  `faceSummary` with tests; the label now says "recorded", not "verified".
- README taught an install path that did not exist: it said npm publication was "in preparation"
  in the same tree that recorded nine published packages, and its relative `link:` resolves
  against the profile directory rather than the clone.

### Documentation

- `docs/w03/` — ten read-only diagnosis and destructive-critique reports, the six binary
  oppositions they produced, the three-criterion arbitration, the reading-loop receipt, and the
  next-round plan. Two of the author's own earlier claims are corrected in place.

### Known limits (unchanged)

- Reading through the Docling MCP path needs `toolCallTimeoutMs` raised; measured conversions of
  the same two-page fixture took **115 s and 317 s**, and the MCP surface exposes **anchors, not
  page numbers**.
- `provenance.reproducibility.available` still means "a checksum was recorded", not "reproduced".
- There is still no per-tool authorization gate, and `research-phase2-exec` remains unpublished.
