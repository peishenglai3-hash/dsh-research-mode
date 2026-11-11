# W03 · 下一轮迭代规划（ITERATION PLAN）

**前提：** W03 已把"读路径可信"与"仓库自证"补齐；本文件只排**下一轮**，不自动开工。
**排序规则：** 与 `W03-CONFLICT-MATRIX.md` 同一套三准则——M 或 R 不过的项不排进来，只进 §4 的推迟表。

---

## 1. 下一轮（W04）候选，按 C 排序

| # | 事项 | 价值 | 等级 | 为什么现在做 |
|---|---|---|---|---|
| **N1** | **让"说不"可见**：Hub 渲染每面的 `reason`、`payloadVerified`、`auth.verified`；复核卡拆"身份 / 签名"两行 | (b) 证据诚实 | C1 | 本轮把能力做进了 JSON，但界面仍只显示一个无刻度分数（HCI-01/02）。不做这一步，诚实不可见 |
| **N2** | **导入上限与压缩炸弹**：gunzip `maxOutputLength`、tar 条目/累计字节上限、路径规范化冲突（`a/b` 与 `a//b`） | 安全 + 可维护 | C1 | SEC-02/ALG-05 已有实测（1028:1；verifiedFiles=2 但只写 1 个文件） |
| **N3** | **凭据过滤扩展 + 导出侧死防御**：文件名正则只覆盖 4 种，`content` 分支完全不过滤 | 安全 | C1 | SEC-03；描述与实现不符 |
| **N4** | **差分测试钉住 litdb 双实现**（Node topK 20 / Python 50；schema 校验只有 Python 有） | (d) 删繁就简 | C1 | 不合并，但让分叉变成"已知事实"而不是漂移 |
| **N5** | **skill 纳入安装路径**：10 个 `package.json` 的 `files` 不含 `skills/`，装完是"24 工具 + 0 技能" | (a) 能力 | C2（打包） | HCI-06；需要决定 skill 归属哪个包 |
| **N6** | **离线预热脚本**：把 Docling 模型预热成显式一步，避免"第一次转换偷偷联网" | 数据边界 | C1 | P-03；与"受控实例不出网"直接冲突 |

## 2. 需要 ADR 才能动的（不进候选）

| 事项 | 为什么必须先 ADR |
|---|---|
| `reproducibility` / `environment` 加 `mode: recorded\|defaulted\|absent` | 改既有字段语义；旧 sidecar 无 `mode`，读取时要向上推断；历史 `.science` 的解释会变 |
| **页级 vs 锚点级**成为正式证据语义 | 决定 `literature` 面的最小契约；影响后续所有阅读笔记与导出 |
| 两个 client 抽共享模块 | 改发布拓扑（两个已发布 npm 包） |

## 3. 明确不做（且不记为欠债）

- 复刻 open-science 的 Prisma/沙箱/16 格式预览器——规划当年已否决。
- 逐工具授权框架——`OPEN-EXEC-AUTHZ`，C3，需要改协议，必须人类裁决。
- `research-phase2-exec` 发布——会执行代码，保持 `private:true`。

## 4. 门与证据要求（沿用 W03）

| 门 | 要求 |
|---|---|
| G0 基线 | 打 tag，工作树 clean，记录 SHA |
| G1 诊断 | 每条 finding 有 locator + falsifier；主控抽样复跑 ≥30% |
| G2 裁决 | 正反题 + 三准则打分 + 合题；无"凭感觉"项 |
| G3 施工 | 每项"改前失败 / 改后通过"；负例控制有效；`66+N` 全绿 |
| G4 QA | 未参与施工的独立 QA；反驳逐条处置 |
| G5 发布 | CI 绿 + 只发改过的包 + Release 如实写限制 |

## 5. 版本与发布

- 本轮仓库改动涉及 4 个 bundle（host / hub / notebook / replay / litdb / preset? — 见实现报告），需为**改过的包**升补丁版；
- `research-phase2-exec` 不参与；
- registry 行名 `dsh-research-hub-peisheng` 与 npm 名不一致这件事**不重命名**（会丢已有索引），只在 README 里注明。

## 6. 回滚

每个阶段一个 tag：`w03-base` → `w03-s1`（findings）→ `w03-s3`（施工）→ `w03-qa`（QA 后）→ `w03-release`。
npm 版本不可回滚，只 `deprecate` + 补丁版；因此只在 G4 之后发布。
