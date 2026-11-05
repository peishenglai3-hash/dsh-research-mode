# Contributing

This project has an unusual contribution rule: **a change that improves the software but
overstates what it proves will be rejected.**

## Before you write code

1. Say which layer you are touching: `store` (data/evidence), `tools` (agent surface),
   `ui` (slots/clients), or `skills` (text discipline).
2. Write down how the change will be verified, and what the failure would look like.
3. If it changes what an existing field *means*, stop — that needs a written decision first,
   because existing `.research` directories on disk would silently change meaning.

## This repository is the source of truth

Development happens here, not in a private mirror. A change lands as a branch, the verification
below must be green, and it merges to `main`. If you change which bundles a profile composes,
regenerate the matrix in the same PR:

```bash
dsh --dump-config --profile <name> > dump.txt
node tools/release/profile-composition.mjs --profile <name> --from dump.txt
```

`docs/PROFILE-COMPOSITION.md` is generated — a hand-edited copy will be overwritten, and a stale
copy is worse than none.

## Verification

```bash
node --test plugins/active/*/test/*.test.mjs
node tools/w01/verify-acceptance.mjs
node tools/w01/probe-containment.mjs
node tools/w01/s1-check-skill-contracts.mjs
node tools/w01/normalize-eol.mjs --check
```

All must pass. There are no third-party runtime dependencies and we would like to keep it that way.

Two things these commands do **not** cover, which you must therefore state explicitly in a PR:
a mounted-bundle check (tests import internals; they do not mount the plugin), and a GUI check
(headless Node cannot see the sidebar). If your change touches either, say "not verified" rather
than implying the suite covers it.

## Claims

- Do not write "verified", "certified", "reproduced" unless the specific command you ran
  establishes it.
- Missing evidence is recorded as `unavailable`. Do not replace it with a plausible guess.
- When you find that a previous claim was wrong, record the correction rather than quietly
  editing the claim. The history of being wrong is data.

## Skills

`skills/` and `.agents/skills/` must stay byte-identical; `s1-check-skill-contracts.mjs` fails if
they drift. A skill that mentions a tool must mention a tool that actually exists.