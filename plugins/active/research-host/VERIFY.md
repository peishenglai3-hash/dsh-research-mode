# research-core · 验证记录（Phase 1）

- 路径：**architectural**（插件 + Host 工具 + 原生 UI 接口面）。
- 状态：Phase 1 核心路径已实现；最新门禁见 `31-Phase1-自动化修复与验收.md` 与 `audit/`。
- 注意：本文件只记录 research-core 自身；跨插件 Playwright/冷启动/卸载演练以项目报告为准。

## 已跑命令与结果

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node --check dsh-plugins/research-core/client.js` | exit 0 |
| 2 | `node --check dsh-plugins/research-core/index.js` | exit 0 |
| 3 | `node --test dsh-plugins/research-core/test/client.test.mjs` | **1 pass / 0 fail**：`sidebar.panellist` id=`research`、`main` key=`research` |
| 4 | `python .agents/skills/litdb/test/test_litdb.py` | **6 pass / 0 fail**：1560 / 520×3 / 2018–2026 / 9 字段 / page_count=16 / scan_sha256=294273… / 2 字 LIKE 回退 / lookup 9 字段 |
| 5 | `node --test dsh-plugins/research-connectors/test/*.test.mjs` | **8 pass / 0 fail**（6 函数 + 1 fallback + 1 tool registration） |
| 6 | `dsh --profile researchtest --from-default-profile web --dump-config` | exit 0；`research-core` / `research-connectors` 行出现 |
| 7 | `dsh plugin --profile researchtest add <research-core>` / `<research-connectors>` | exit 0；profile `dsh.profile.bundles` 追加两行 |
| 8 | `dsh --profile researchtest --port 0 --no-open` | 启动成功；HTML 200；boot payload 含 `@local/research-core`；client module HTTP 200 / 10,598 B |
| 9 | desktop profile（安装前基线） | 42 bundles；未新增 `research-*`；安装后见 #10 |
| 10 | desktop 安装（用户批准） | `plugin_manager install_bundle` → `application=applied`；desktop bundles 42 → 43，含 `@local/research-core` |
| 11 | desktop 截图 | `desktop-research-core.png`（左栏“科研”入口）；`desktop-research-autoopen.png`（临时 smoke bundle 自动打开后的科研页） |
| 12 | 临时 smoke bundle | `@local/research-smoke` 已从 desktop profile 卸载；profile 仍为 43 bundles，仅保留 research-core |

## 未验证 / UNKNOWN

1. **真实浏览器点击**侧栏“科研”后 `main` 切换、页面渲染：未用浏览器自动化，只验证了 boot payload 与模块 200。
2. **真实 DSH 工具注册 schema 接受**：单元测试验证了 6 个 ToolDefinition 的形状；实际 profile 启动未出现明显错误，但未从运行态 `Tool.listTools` 读出 6 个工具。
3. **ILOSTAT 实际数据端点**：422/500，已降级 P1/UNKNOWN。
4. **NBS 实际 CSV**：用户快照 `test.csv` 已 live 通过。
5. **Phase 1 未完成项**：desktop 冷启动、UI `.science` 文件级下载（现为 Host-only 指令）、验收 1 首条 prompt/预置行为。

## 回滚

- 删除 `dsh-plugins/research-core/`、`dsh-plugins/research-connectors/`、`.agents/skills/litdb/`。
- 删除测试 profile：`<home>\.dsh\profiles\researchtest\`（本机为测试而建；desktop 已装 research-core，用 `plugin_manager remove_bundle @local/research-core` 回滚）。
- 测试 profile 仅含 web 模板 + 两个本地 bundle；无用户数据。
