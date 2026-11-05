# research-core

Phase 1 Research Mode bundle for DeepSeek Harness.

- **Client half**: one native `sidebar.panellist` entry (`id = research`) and one
  `main` page (`key = research`). The page is a Host-only, cross-session research
  workspace: it reads `<workspace>/.research`, starts sessions, and copies Agent
  instructions; it keeps no localStorage project/artifact index and renders no
  conversation or right rail.
- **Host half**: 7 tools (`research_project_create/list`, `research_artifact_record/list`,
  `research_provenance_get`, `research_science_export/import`) plus the
  `preset-research` composition. The bundle imports no `@deepseek-ai/*` runtime package.
- **No dependency on `dsh-better-sidebar`.** Right-side evidence tabs use the native
  `ctx.sidebarRightTabs` + `sidebar.right.pane.tab` path.

## Why the page and right rail are separate

When a global `main` panel is selected, DSH has no on-screen Session and collapses
the right column; `ctx.sidebarRight.openTab` throws `no session surface is mounted`.
So the Research Workspace is the cross-session hub, while Artifacts / Provenance /
Reviewer tabs live on the session (Phase 1).

## Install (test profile)

```bash
dsh plugin --profile researchtest add "<workspace>/dsh-plugins/..."
dsh --profile researchtest --dump-config
```

Phase 1 验收通过后已按用户批准安装到 `desktop`（44 bundles）。安装前在测试 profile 验证；安装后刷新或重启 Harness 以加载浏览器 bundle。

## Rollback

Uninstall the bundle from the test profile (or delete the profile) and remove this
directory. On `desktop`, use `plugin_manager remove_bundle @local/research-core`.
No user data is written by this bundle's UI; project data lives under `.research` and is not deleted on uninstall.
