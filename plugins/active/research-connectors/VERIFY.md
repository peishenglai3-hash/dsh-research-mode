# research-connectors · 验证记录

- 路径：architectural（新增 Host 插件与 6 个工具）。
- Seams：`lib/connectors.js` 的 6 个导出函数 + `apply` 的 6 个 ToolDefinition。

## 已跑结果

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node --check index.js` / `lib/connectors.js` | exit 0 |
| 2 | `node --test test/connectors.test.mjs test/plugin.test.mjs` | **8 pass / 0 fail**（6 函数 + 1 fallback + 1 registration） |
| 3 | 真实 World Bank smoke | OK，4 行；`SI.POV.GINI` / CHN / 2020–2023 |
| 4 | 真实 DataCite smoke | OK，3 行 |
| 5 | 真实 OSF/SocArXiv smoke | 精确 title 0 命中时回退 `list-filter-any-token`，返回 3 行 |
| 6 | 真实 PKU Dataverse smoke | OK，3 行；CFPS 元数据 DOI `10.18170/DVN/45LCSO` |
| 7 | test profile boot | `research-connectors` 行参与组合；未观察到启动错误 |

## 未验证

- ILOSTAT 真实 dataflow/key 未跑通；只验证 URL 构造与 CSV 文本处理。
- NBS 真实用户 CSV 未提供；只测本地临时 CSV；路径被限制在 `$RESEARCH_NBS_DIR`（默认 `~/.dsh/research/knowledge/nbs`），越界会拒绝。
- 运行态 `Tool.listTools` 未读出 6 个工具；单元测试验证了注册形状。
- 未安装到 desktop profile（按 Phase 0 约束）。

## 回滚

卸载 `researchtest` profile 中的 bundle，或删除 `dsh-plugins/research-connectors/`；desktop 不动。
