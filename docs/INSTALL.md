# Install

Research Mode is a set of plugin bundles for DeepSeek Harness (DSH). It is **not** a standalone
app: DSH provides the runtime, the agent loop, and the UI slots these bundles fill.

## Requirements

- DSH with plugin support (developed against `0.2.x`).
- Node.js 24+ (the bundles use `node:sqlite` and `zlib.zstd*`; no third-party runtime deps).
- Windows, macOS or Linux for the data layer. The UI was exercised on Windows; other platforms
  are unverified.

## Profile layout

A DSH profile is a directory under `$DSH_HOME/profiles/<name>/` with a `package.json` that lists
bundles. The relevant part:

```json
{
  "dependencies": {
    "@local/research-host": "link:/path/to/repo/plugins/active/research-host",
    "@local/research-workspace": "link:/path/to/repo/plugins/active/research-workspace",
    "@local/research-preset": "link:/path/to/repo/plugins/active/research-preset",
    "@local/research-preset-cn-social": "link:/path/to/repo/plugins/active/research-preset-cn-social",
    "@local/research-connectors": "link:/path/to/repo/plugins/active/research-connectors",
    "@local/research-hub": "link:/path/to/repo/plugins/active/research-hub",
    "@local/research-phase2-litdb": "link:/path/to/repo/plugins/active/research-phase2-litdb",
    "@local/research-phase2-notebook": "link:/path/to/repo/plugins/active/research-phase2-notebook",
    "@local/research-phase2-replay": "link:/path/to/repo/plugins/active/research-phase2-replay"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@local/research-host",
        "@local/research-workspace",
        "@local/research-preset",
        "@local/research-preset-cn-social",
        "@local/research-connectors",
        "@local/research-hub",
        "@local/research-phase2-litdb",
        "@local/research-phase2-notebook",
        "@local/research-phase2-replay"
      ]
    }
  }
}
```

Verify the composition without booting a UI:

```bash
dsh --dump-config --profile <name>
```

You should see nine `@local/research-*` rows and **no** `research-phase2-exec`.

### The profile this repository was actually tested against

The matrix is generated, not written: [`PROFILE-COMPOSITION.md`](./PROFILE-COMPOSITION.md) lists
every composed bundle row by row, and says which ones come from this repository, which from the
harness, and which from neither. Regenerate it after changing a profile:

```bash
dsh --dump-config --profile <name> > dump.txt     # capture once
node tools/release/profile-composition.mjs --profile <name> --from dump.txt
```

The verified reference profile composes **13 rows**: 9 from this repository, 2 from the harness
(`dsh-base`, `dsh-web-app`), 1 profile-level patch, and **1 external** (`@local/porting-docling`).
That last one is the point of the matrix: a clone of this repository reproduces 9 of 13 rows, and
the document says so rather than implying full reproducibility.

### A failure mode worth knowing

If a profile lists a bundle whose dependency was never installed, `--dump-config` still prints a
tree — but the first line is a skip notice:

```text
dsh: skipping profile bundle "@local/porting-docling": ... cannot resolve ...
```

The tree then *looks* healthy while that row is simply absent. `profile-composition.mjs` treats
that line as a warning and refuses to print an empty matrix, because a silently incomplete
composition is exactly the failure this document exists to catch. Repair with the command the
harness itself suggests:

```bash
dsh plugin --profile <name> install
```


## Deliberately not included

`research-phase2-exec` (notebook cell execution and argv replay) is **absent on purpose**. Those
two tools still exist in `plugins/` for reference, but the reference profile does not register
them: they execute code, they have no per-tool authorization, and their sandbox declares no
network isolation. If you enable them, do it knowingly.

General shell execution is a *host* capability and stays available regardless of Research Mode.
Removing the research exec bundle does **not** make a session unable to run commands.

## Local literature database (optional)

`research-phase2-litdb` reads a local SQLite database at:

```
$RESEARCH_LITDB_PATH   (default: ~/.dsh/research/knowledge/litdb/literature.db)
```

It is opened read-only and never written. If the file is absent, the tools report the error and
search is simply unavailable — nothing crashes and nothing is created.

Expected table shape: a `literature` table with `uid, title, authors, year, journal, abstract,
research_theme, relationship_chain, source_url`, plus an FTS index. See
`plugins/active/research-phase2-litdb/README.md`.

## PDF parsing (optional, external)

Artifact recording works without any parser. If you want the *reading* workflow (PDF → page-anchored
note), you need [Docling](https://github.com/docling-project/docling):

```bash
uv tool install docling          # provides the `docling` CLI
uv tool install docling-mcp      # optional: provides docling-mcp-server for MCP clients
```

Then:

```bash
docling convert paper.pdf --to json --output ./out
```

The JSON carries `prov[].page_no` per text item, which is what makes page-level citations
verifiable. Known issue: a single MCP `convert` call can exceed the MCP client call timeout
(the conversion itself takes 15–35 s on a small PDF). Using the CLI avoids that timeout.

## Where data goes

Everything is written under `<workspace>/.research/`. There is no server, no database daemon, and
no telemetry. Copy the directory to move your research; `grep -r` it to audit it.
