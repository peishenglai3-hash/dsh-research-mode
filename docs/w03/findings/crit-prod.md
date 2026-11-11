# W03 · 破坏性产品批判（只读轮）

- **基线：** 分支 `w03-reading`，起始 HEAD `30cda91`（= `b5f6c16` + W03 C0 提交：CI 入口、基线冻结、S1 六份 findings）。`b5f6c16` 是 `w03-base` 冻结树，**也是 `main` 与公开仓默认分支的现状**（`git log main -1` → `b5f6c16`）。我动手后该分支又落下三笔并行修复：`8263d23`（读时复核 payload 字节）、`57b6c78`（Hub 派生 review 面）、`898bf75`（npm 安装文档），结束 HEAD = `898bf75`。**本文件行号一律以 `30cda91` 为准**；`8263d23` 会把 `store.js` 的 manifest 段从 568 推到 587，我在原处标注。
- **范围：** 产品面——干净机器能否装上、第一次打开看到什么、价值主张与实际是否对得上、版本与维护能否自洽、文档承诺、社区回路。**不重打** `gap-func`（链路承接）、`gap-arch`/`crit-arch`（证据语义）、`gap-ux`（界面缺口）、`gap-maint`（重复与漂移）已立的主干；只在产品决策需要时引用它们。
- **方法：** 只读。读源码/文档/`package.json`、`git show`/`git ls-tree`/`git tag`、目录存在性检查、逐 bundle 计工具名；并跑了一次宿主内嵌 CLI 的 `dsh --help`（只打印用法，不建 profile、不安装、不出网）。**未改任何 `plugins/` `skills/` `tools/` profile、未碰真实 `.research` 数据、未安装、未出网、未做 git 写。** 本轮只写本文件。
- **证据等级：** `OBSERVED`（本轮自己跑/读到，附行号）/ `DOC`（文档记载，本轮无法离线复核）/ `INFERRED`（由代码或工具链语义推得）/ `NOT VERIFIED`（需 GUI 或第二台机器才能定级，本轮明确未做）。
- **工作树状态：** 本轮结束时 `git status` 只剩四份未跟踪的并行 findings（`crit-algo.md`、`crit-hci.md`、`gap-env.md`、本文件；前三份非本作者）。我动手时曾见到 `M README.md`，该改动其后由 `898bf75 docs: teach the install path that actually exists` 提交到 `w03-reading`——**但没有进 `main`**，所以公开仓访客读到的仍是 `b5f6c16` 的旧 README。凡在 `898bf75` 下已失效的断言，我在 PROD-01 / PROD-06 里逐条标注。另：`898bf75` 新增的一句「`verify-acceptance.mjs` … reports PARTIAL on a clean machine by design」**与代码不符**——`check()` 只有 PASS/FAIL 两种结果（`tools/w01/verify-acceptance.mjs:20-29`），D1（`:208-217`）缺 profile 时抛 ENOENT 即计 FAIL；"PARTIAL" 要先加该状态才存在。

| 严重度 | 含义（与 `gap-ux` 同口径） |
|---|---|
| `high` | 直接决定「装了会不会用、用了会不会回来」；用户会因此得出错误结论或直接放弃。≈ `P1` |
| `medium` | 显著降低留存或可信度，但不产生错结论。≈ `P2` |

`recommendation` 前缀 C0–C3 与 `cost`（S < 0.5 天 / M 0.5–2 天 / L > 2 天）沿用 `gap-ux.md:15-19`。

---

## 一句话结论

**证据模型本身是诚实的，产品面缺的是"让诚实在第一分钟可见"。**

具体地：九行安装配方里没有一行写「已发布到 npm」，而九行里有九行都要用户手填绝对路径；装完之后首屏自己声明"本页只读"；最像科研的那一步（读 PDF 并定位到页）在产品里既无工具也无证据字段；版本在四处各有各的说法，且没有任何一处记录「这份证据是哪个版本的工具写的」。

**「会不会用第二次」的直接回答：** 第一次**可能**用成——前提是用户已经从 `skills/literature-review/SKILL.md:57-65` 或 preset persona（`research-preset/cordis.patch.yml:14`）里读到"要让 agent 调 `research_artifact_record`"，并且真的照做。第二次**不会自己回来**：产品没有为回访做任何结构——没有「上次留下什么」的入口、没有「还缺什么」的清单、artifact 行没有时间与来源（`store.js:195-213` 无 `sessionId`、无 `recorder`），右栏 scope 只由当前会话 cwd 决定（`research-hub/client.js:47-61`）。`.research/` 目录在磁盘上是持久的，在界面里不是。留存当前依赖**用户自己养成的习惯**，不依赖产品。

**反向如实记（不算缺陷，但不记就不公平）：** 66 个测试本轮实跑仍通过（`node --test` 见 `W03-BASELINE.md:40`，`gap-maint` 复跑 66/66）；`docs/EVIDENCE-MODEL.md` 是本仓写得最好的一篇文档，且与代码基本无漂移（`gap-maint` 已逐条对照）；九包确实已在 npm 上（`docs/REGISTRY-SUBMISSION.md:24`，`DOC`）；两个 `client.js` 全部用 `--dsw-alias-*` token，无硬编码色值。下面六条打的是**摩擦与自相矛盾**，不是"造假"——只有两处属于"文档说了假话"，都标在 PROD-01 与 PROD-04 里。

---

```yaml
- id: PROD-01
  dimension: product
  claim: |
    干净机器安装：文档教的是最难、且本仓无法自证的那条路。
    (a) 已发布渠道缺失：九包已上 npm（REGISTRY-SUBMISSION.md:24「published 9 / 9 … verified by
    installing them back from the registry」），但 README 与 INSTALL 里**一次** `npm install` /
    `npm i` 都没有（grep 两文件只有 README.md:60 的 `dsh plugin … add link:…` 与 INSTALL.md:90 的
    `dsh plugin … install`）。README.md:119-121 还写着「Packaging: the bundles are currently installed
    by `link:` from a clone. npm publication is in preparation」——与同一 commit 里刚记录的"九包已发布"
    直接矛盾。用户读到的安装路径，比仓库实际具备的能力落后一整轮。
    **并行修复（已提交 `898bf75`，但只在 `w03-reading`）：** README 已改成 npm 九包安装，并明确写出
    「a relative `link:` resolves against the **profile** directory … use an absolute path」，所以 (a)(b) 是
    **基线事实**、已被**文本**修正；但修正没有进 `main`，公开仓访客读到的仍是旧 README。而且它的正确性
    仍取决于「九行 `dsh plugin add @peisheng_lai/dsh-research-*` 能否在一台干净机器上装成」——没有任何提交
    或 CI 跑过这件事；(c)(d)(e)(f) 在这笔提交里一处未动。
    (b) 相对 link: 的解析基准不是 clone 目录：README.md:57-60 说「clone into your harness plugins area」
    然后 `link:./plugins/active/research-host`；但 `dsh plugin --profile <name> <pnpm-args...>` 是把参数
    转给 profile 目录里的 pnpm（本轮 `dsh --help` 的用法行与示例 `dsh plugin --profile tui add <package>`
    已确认，`OBSERVED`），所以 `./plugins/...` 从 profile 目录解析，落空。唯一正确的写法只在
    INSTALL.md:21（绝对路径 `link:/path/to/repo/…`）出现一次。
    (c) 仓库不含 profile fixture：顶层只有 `.github docs plugins skills tools`，没有 `profiles/`，也没有
    根 `package.json`（`Test-Path` 两者皆 False）。INSTALL.md:15-49 给的是**要用户手填九条绝对路径**的
    JSON 片段；INSTALL.md:90 的 `dsh plugin install` 只能装"已经写进 package.json 的东西"。没有生成脚本
    （`tools/release/` 四个脚本都是校验/发布，不是生成 profile）。
    (d) 被验证的那份组合复现不了：INSTALL.md:70-73 与 PROFILE-COMPOSITION.md:14-17,34 自己写着 13 行里
    有 1 行 `@local/porting-docling` 不在本仓；而这份矩阵的输入 dump（PROFILE-COMPOSITION.md:4
    的 `w02-alpha-dump-lai.txt`）也不在仓里（全仓无 `*dump*` 文件）——所以"照着复现"连矩阵本身都重算不出来。
    (e) 运行前置没有任何一句检查：INSTALL.md:8 只写「DSH with plugin support (developed against 0.2.x)」，
    而十个 package.json 的 `engines.dsh` 都是 `>=0.2.1-rc.2 <0.3.0`；本机 PATH 上的 `dsh` 曾是 0.1.7-rc.2
    （W03-BASELINE.md:56，`DOC`），文档从不要求先 `dsh --version`。
    (f) Node 要求自相矛盾：INSTALL.md:9 要求「Node.js 24+」，十个 package.json 的 `engines.node` 都写
    `^22.19.0 || >=24.0.0`；而 `research-phase2-litdb/lib/query.js:5` 用的是 `node:sqlite`。在 Node 22.19
    上是否需要 `--experimental-sqlite` 本轮无法验证（本机只有 24.15），故只断言"文档与 engines 不一致"。
  evidence:
    - "README.md:119-121（link: 是现行安装方式 / npm publication is in preparation）vs docs/REGISTRY-SUBMISSION.md:24（published 9/9）—— 同一 commit b5f6c16 内自相矛盾 [OBSERVED]；该句其后由 898bf75 在 w03-reading 上重写（README.md +26/−16），但 898bf75 不在 main 上，基线事实不变、修正未发布 [OBSERVED]"
    - "README.md:57-60（clone into your harness plugins area + `link:./plugins/active/research-host`）[OBSERVED 文本]；相对 link 的解析基准 = profile 目录 [INFERRED：pnpm 语义 + `dsh --help` 的 `dsh plugin --profile <name> <pnpm-args...>`]"
    - "INSTALL.md:21（唯一的绝对路径写法）；INSTALL.md:15-49（手填 JSON）；INSTALL.md:90（install 只能装已声明的）[OBSERVED]"
    - "Test-Path profiles/ → False；Test-Path package.json → False；tools/release/ = {npm-preflight, npm-prepare, profile-composition, publish-all}.mjs，无生成器 [OBSERVED]"
    - "INSTALL.md:70-73 与 docs/PROFILE-COMPOSITION.md:14-17,34（9/13，porting-docling external）；PROFILE-COMPOSITION.md:4 的输入 dump 不在仓内（Get-ChildItem -Filter *dump* → 空）[OBSERVED]"
    - "十个 package.json：engines.dsh='>=0.2.1-rc.2 <0.3.0'，engines.node='^22.19.0 || >=24.0.0'；INSTALL.md:8-9 写 0.2.x / Node 24+ [OBSERVED]"
    - "research-phase2-litdb/lib/query.js:5 `import { DatabaseSync } from 'node:sqlite'`；22.x 是否需要 flag = NOT VERIFIED"
    - "阅读链的额外前置：INSTALL.md:119-137（`uv tool install docling`，要出网）+ INSTALL.md:137 自认 MCP convert 会超时 + lead-probes.md:38-63（P-02 默认 60s 下 Request timed out；P-03 CLI 46.7s、首次拉模型 7.98s；主控实测，我本轮未复跑）"
    - "参考 profile 的 preset 行还隐式依赖 `@deepseek-ai/dsh-agent-preset` 这个宿主插件（research-preset/cordis.patch.yml:2-3），INSTALL 未提 [OBSERVED]"
  severity: high
  recommendation: |
    C0（半天，纯文档 + 一个 fixture）：
    (1) README「Quick start」改成两条并列的路——**A 已发布渠道**：`dsh plugin --profile <p> add @peisheng_lai/dsh-research-host`（九个包名列成表，或等 umbrella），**B 开发者**：`cd` 到 repo 根、用绝对路径 link；
    (2) 删掉 README.md:119-121 那句，改为指向九包版本表；
    (3) 把实测过的组合以 `profiles/reference/package.json` 入库（去掉 external 行、写清 9 行 = 22 工具），并附一条 `dsh --dump-config` 的期望输出片段，让"九行、无 exec"可被 diff 而不是被相信；
    (4) INSTALL 顶部加三行前置检查：`dsh --version` 必须 ≥0.2.1-rc.2、`node -v` 必须是 24（或把 engines 与文档统一到一边）、`node -e "require('node:sqlite')"`；
    (5) 把 Docling 小节从 "optional" 改标为「阅读链前置」，写明 `toolCallTimeoutMs: 300000`（键名见 lead-probes.md:109-115）与首次转换会出网拉模型。
    C1（1 天）：`npm-prepare.mjs` 增加 `--emit-profile` 分支，直接产出 `profiles/reference/package.json`，避免手填九条路径。
  cost: S（C0）/ M（C1）
  falsifier: |
    在只能上网、没有本仓 checkout 的机器上，仅按 README.md:53-63 逐字执行，若能得到 9 行组合并成功调用
    `research_project_create`，则本条 (a)(b)(c) 被推翻；若 README.md:119-121 与 REGISTRY-SUBMISSION.md:24
    已一致，则 (a) 被推翻；若仓库根存在 `profiles/` 或能生成 profile 的脚本，则 (c) 被推翻。
  mission_principle: |
    初心二（W03-BASELINE.md:86）「让实际科研活动决定工程构型」。今天决定"能不能开始研究"的不是研究活动，
    是一段要手填九条绝对路径的 JSON。README 说 local-first；local-first 的第一步得是装得上。

- id: PROD-02
  dimension: product
  claim: |
    首次体验：装完之后没有一个"第一条证据"的动作，首屏由产品自己声明"这里什么都不能做"。
    用户看到的顺序是：左栏「科研」→ 一页写着自己「本页只读并启动会话」（research-workspace/client.js:26）、
    「项目/产物只由 Host 工具写入 .research」（:42）的工作台；四张模板卡（:112-117）的唯一动作是把一段提示词
    复制到剪贴板（:290-298，`gap-ux` UX-01 已量化 15 步）；「Host 项目」区空态只有一句陈述句与一个刷新按钮
    （:346-347）；下面两张卡是静态文案（:381-389）。没有"创建示例项目"、没有"给我看一个已有项目长什么样"、
    没有截图、没有 tour。
    更关键的是**没有参照物**：仓库没有 `examples/`、没有样例 `.research`、没有任何一段真实输出（artifact id、
    七面 JSON、`.science` 路径）被贴进文档。全仓 grep `getting started|quickstart|tutorial|walkthrough`
    只命中 README.md:53 的标题本身。工具名在 UI 里零枚举（`gap-ux` UX-06），所以"我现在能干什么"只能靠读
    README——而 README 唯一的具体段落是"它不能做什么"（见 PROD-05）。
    最后是数字对不上：README.md:27 承诺「Ten bundles, 24 tools」；按 INSTALL 装出来的是 **22** 个工具
    （host 10 + connectors 8 + litdb 2 + notebook 1 + replay 1；exec 的 2 个按 INSTALL.md:96-99 不进 profile，
    我逐 bundle 数过工具名）。用户第一次读到的数，和第一次能用的数，不是同一个。
  evidence:
    - "research-workspace/client.js:26（subtitle：Host `.research` 是唯一真源；本页只读并启动会话）[OBSERVED]"
    - "research-workspace/client.js:42（hostHint）、:47（noHostProjects：Host 还没有项目；发送上面的创建指令给 Agent）、:52（emptyHint：先在会话中调用 research_project_create）[OBSERVED]"
    - "research-workspace/client.js:112-117（四张模板）+ :290-298（唯一动作 copyPrompt）+ :318-324（Host-only 创建按钮把模板写死 literature-review，用户选的模板不进入这条路径）[OBSERVED，同 gap-ux UX-01]"
    - "research-workspace/client.js:381-389（local litdb 与最近会话两张卡：只有 h2 + 两段 p，无列表、无按钮；:397 其实已注入 sessions）[OBSERVED]"
    - "顶层无 examples/、无样例 .research（Get-ChildItem -Directory → .github docs plugins skills tools）；grep getting started|quickstart|tutorial|walkthrough 仅 README.md:53 [OBSERVED]"
    - "工具计数（本轮实测 grep research_[a-z_]+ 去重）：host 10、connectors 8、litdb 2、notebook 1、replay 1、exec 2 → 默认装 22 [OBSERVED]；README.md:27 写 24，README.md:29-39 的表列 9 个 bundle"
    - "唯一写清「何时该记录证据」的地方是技能文本：skills/literature-review/SKILL.md:57-65；十个 skill 不被任何 client.js 引用（gap-ux UX-06） [OBSERVED]"
    - "首屏无加载态、无可点的下一步（gap-ux UX-02/UX-04 已列行号）；本轮未开 GUI 复核渲染 [NOT VERIFIED]"
  severity: high
  recommendation: |
    C0（半天）：
    (1) 在 README 放一段**真实 transcript**（20 行以内：`research_project_create` → 写一份内容 →
    `research_artifact_record` → `research_provenance_get` 的七面输出 → `research_science_export` 的路径），
    这是本仓唯一能替代"相信我"的东西，素材可以现从 `tools/w01/verify-acceptance.mjs` 的夹具里取，不必编；
    (2) README.md:27 改成「22 tools（默认装）+ 2（执行类，默认不装）」，与 INSTALL.md:57,96-99 对齐；
    (3) 首屏空态从陈述句改成三步编号（1 复制 → 2 回到会话粘贴 → 3 回来点刷新），并把 `refresh` 换成"我已发送，刷新"这类动作文案。
    C1（2 天）：空态加一个「创建示例项目」按钮——直接把**完整**提示词（含模板与默认名）复制过去，而不是让用户
    先填名再复制；更彻底的做法是给 client 一条只调 `research_project_create` 的只读通道（C2，`gap-ux` UX-01 已说明
    当前 client 无写权限）。
  cost: S（C0）/ M（C1）
  falsifier: |
    若 README 或 docs 中存在任何一段可复制的端到端示例（含真实 artifact id / 七面输出 / .science 路径）或一张截图，
    本条"没有参照物"被推翻；若按 INSTALL 装完实注册 24 个工具，则"22 vs 24"被推翻；若首屏存在任何会创建项目或
    写出文件的按钮，则"首屏只读"被推翻。
  mission_principle: |
    初心一（W03-BASELINE.md:85）「工程纪律是为了保护自由探索，而不是让自由探索服从工程纪律本身」。
    纪律（先建项目、再记录、再复核）是对的；但用户的第一分钟不该由纪律的目录结构来教，而该由一个做成的例子来教。

- id: PROD-03
  dimension: product
  claim: |
    价值主张 vs 实际：「artifact 是单位、证据优先」这个差异只有在用户**主动想到要它**时才出现；而最像科研的
    那一步——读 PDF 并定位到页——在产品里既不实现，也无法进入证据模型。用户因此很难说出"这跟普通聊天有什么不同"。
    (a) 阅读链 0 承接：24 个工具没有一个接受文档路径/URL 返回正文（`gap-func` FUNC-01 已立；我复核了 repo-wide
    `pdf|docling`，除两个图表导出 skill 与 INSTALL 的 optional 小节外无命中）；唯一解析器是仓外
    `@local/porting-docling`（PROFILE-COMPOSITION.md:34）。
    (b) 页锚点无法入证据：`literature` 面的 schema 是一个自由文本 string（`store.js:211`；`EVIDENCE-MODEL.md:29`
    写「citation locators (free text)」）。于是 INSTALL.md:135-136 承诺的「page-level citations verifiable」
    在数据模型里**没有字段承载**——"可核验"这件事靠模型在正文里写页码。
    (c) 产品内那条路默认失败：INSTALL.md:137 自认 MCP `convert` 会超时、建议改用 CLI；lead-probes P-02（默认
    `toolCallTimeoutMs=60000` 下实调返回 Request timed out，P-06 给出键名与默认值）、P-03（CLI 46.7s，其中首次
    从 HuggingFace 拉模型 7.98s）。推荐路径（shell + 外部 CLI）恰恰**绕开了产品**：CLI 产出的 docling JSON 没有任何
    工具能读，只能由 agent 手工把 `prov[].page_no` 抄进一段自由文本。
    (d) 差异不可见在"第二次"：artifact 行没有时间、没有来源会话（`store.js:195-213` 的侧车字段只有
    id/title/kind/projectId/createdAt/bytes/checksum/source/provenance），右栏 scope 由当前会话 cwd 决定
    （`research-hub/client.js:47-61`），所以会话一关，"上次留下的东西"在界面里没有路标；持久化只发生在磁盘上。
    (e) 唯一让这个行为稳定发生的是 preset 的一句 persona 文本（`research-preset/cordis.patch.yml:14`
    「Record deliverables with research_artifact_record and cite their checksums」），没有工具层强制、没有 UI 提示，
    不遵守时也没有任何可见后果。
  evidence:
    - "Select-String 'docling|pdf' 全仓（排除 .git）：仅 skills/figure-*/SKILL.md、docs/INSTALL.md:119-137、README.md:112、skills/litdb/SKILL.md:53 [OBSERVED]"
    - "store.js:211 `literature: face(input.literature, 'literature anchors were not recorded')` → 自由文本；docs/EVIDENCE-MODEL.md:21-29 七面清单无 readSource/page 结构 [OBSERVED]"
    - "docs/INSTALL.md:135-137（prov[].page_no 是「页码级引用可核验」的依据 / MCP convert 会超时；用 CLI 避免）[OBSERVED 文本]；超时与耗时 = lead-probes.md:38-63（主控实测，本轮未复跑）"
    - "docs/PROFILE-COMPOSITION.md:34（@local/porting-docling = external，clone 不可复现）[OBSERVED]"
    - "store.js:195-213（侧车字段，无 sessionId / 无 recorder / 无 updatedAt）；store.js:568-574（.science manifest 字段；HEAD 898bf75 上已因 8263d23 移到 587-593）[OBSERVED]"
    - "research-hub/client.js:47-61（scope 由会话 cwd 解析，歧义时 fail-closed）[OBSERVED]"
    - "research-preset/cordis.patch.yml:9-65（preset 的 plugins 列表里没有 mcp-client、没有 shell/pwsh 工具；:14 是唯一的记录要求）[OBSERVED]"
  severity: high
  recommendation: |
    C1（1–2 天，先做最小可证伪的一步）：
    (1) 侧车与 manifest 增加 `readSource: {status:'available'|'unavailable', document, pages:[..], anchor}`——**新增键**，不动 `literature` 的现有语义，因此不触发 CONTRIBUTING.md:11-12 的"字段语义变更"门；
    (2) 把 `literature` 从 string 升级成 `{locators:[{document,page,quote}]}` 的向后兼容形式（读到旧 string 就包成单个无页码 locator）——**这一步改语义，按 CONTRIBUTING.md:11-12 必须先写一份决策**，本文件只登记为待决；
    (3) 提供 `tools/reading/docling-to-locators.mjs`（≤80 行）：读 `docling convert --to json` 的输出，把 `prov[].page_no` 映射成 locator 列表，供 agent 一次调用后直接 `research_artifact_record`；这条脚本把"阅读"从文档变成可执行动作，而不需要内置解析器；
    (4) 在 Hub 的 artifact 行补 `createdAt` 与来源会话（数据已在侧车里，只差渲染）。
    C3（内置解析、把 page 一起写进面）不做，直到有第二个真实用户——现在做它，就是把(a)的洞挖得更深。
  cost: M（C1）/ L（C3）
  falsifier: |
    若七面里存在承载"读自哪份文档 + 页码"的结构化字段，或任一 `research_*` 工具接受 pdf/url 并返回带 page 的正文，
    则 (a)(b) 被推翻；若 Hub 的 artifact 行显示 createdAt 或来源会话（或侧车已有 sessionId），则 (d) 被推翻；
    若 preset 之外还有工具层或 UI 层的记录强制，则 (e) 被推翻。
  mission_principle: |
    README.md:6「把产物与证据链做成一等对象」。如果"读"这个动作没有面，那证据链记录的是**产物**，不是**阅读**；
    而社会科学的证据恰恰产生在阅读里。README.md:103「Unknown is a first-class state」——今天"有没有读全文"
    连 unknown 都不是，它没有位置。

- id: PROD-04
  dimension: product
  claim: |
    版本与维护：同一个 bundle 在四个地方有四个身份，四个地方有四种版本口径，且没有任何地方记录"这份证据是
    哪一版工具写的"。发新版之后索引由谁更新，答案是"一个人记得"。
    (a) 名字四份：目录 `research-hub` / npm `@peisheng_lai/dsh-research-hub` / 社区索引行
    `dsh-research-hub-peisheng`（W03-BASELINE.md:68，`DOC`）/ patch 内 `name:`（cordis.patch.yml:3）；
    仓库名 `dsh-research-mode` 与哪一个都不同。用户按任何一个名字搜索，命中的都不是同一处。
    (b) 版本四份：git tag 只有 `v0.1.0`（2026-11-05, `00ec54b`）与 `w03-base`；而 `v0.1.0` 指向的那棵树里
    research-host 的版本**已经是 0.2.0**（`git show v0.1.0:plugins/active/research-host/package.json`）——
    也就是说仓库的版本标签从未对应过任何包的版本。npm 上是 3 个 0.2.0 + 6 个 0.1.0
    （REGISTRY-SUBMISSION.md:48-61，`DOC`）。全仓无 CHANGELOG。→ 用户无法回答"我装的是哪版、比上版改了什么"。
    (c) 证据不记录工具版本：artifact 侧车字段是 id/title/kind/projectId/createdAt/bytes/checksum/source/provenance
    （`store.js:195-213`），`.science` manifest 是 format/project/createdAt/readOnly/files（`store.js:568-574`；HEAD 898bf75 上已因 8263d23 移到 587-593）——
    都没有 recorder 版本。一个以"记录发生了什么"为卖点的工具，无法记录**自己**是哪个版本记的；在 9 包混版、
    两个 client 分属 0.2.0/0.1.0 的现状下，这不是洁癖问题。
    (d) 发版与索引都是手动：发布是 `npm publish --workspaces` 起不来、只能逐目录九次（REGISTRY-SUBMISSION.md:63-70；
    `tools/release/publish-all.mjs` 只循环，不 bump 版本、不写 changelog）；索引是"Then open a PR against
    dshworks/awesome-dsh-plugins … set verifiedAgainst / lastVerified"（:72-83），人工、逐条、无自动化。
    (e) 没有任何东西会告诉你索引过期了：`docs/PROFILE-COMPOSITION.md:51-52` 声称「`docs/profile-composition.json`
    … so CI can diff the composition against a known-good baseline」，但 `.github/workflows/verify.yml:35-45`
    的四步里没有这一步，全仓也没有任何脚本读这个 JSON 做对比（只有生成器自己写它/比它）。更基础地：**main 分支
    根本没有 `.github/`**（`git ls-tree -r b5f6c16` 无 `.github`），CI 只存在于未合并的 `w03-reading`/`30cda91`。
    (f) 徽章：README.md:8 只有 license 一个 badge，没有 CI / npm / version。用户判断"这东西在维护吗"的工具，一个都没给。
  evidence:
    - "plugins/active/research-hub/cordis.patch.yml:3（name）；package.json:2（npm 名）；W03-BASELINE.md:68（索引行名 dsh-research-hub-peisheng）[OBSERVED/DOC]"
    - "git tag -l → v0.1.0 / w03-base；git log -1 v0.1.0 → 00ec54b；git show v0.1.0:plugins/active/research-host/package.json → \"version\": \"0.2.0\" [OBSERVED]"
    - "Get-ChildItem -Recurse -File -Include CHANGELOG* → 空 [OBSERVED]"
    - "store.js:195-213 与 :568-574（无 recorder/version 字段）[OBSERVED]"
    - "docs/REGISTRY-SUBMISSION.md:63-70（逐目录 publish）与 :72-83（PR 里手填 verifiedAgainst/lastVerified）[OBSERVED 文本]"
    - "tools/release/publish-all.mjs:1-40（只循环 publish，不 bump/不写 changelog）[OBSERVED]"
    - "docs/PROFILE-COMPOSITION.md:51-52 vs .github/workflows/verify.yml:35-45（无 profile-composition 步骤）[OBSERVED]；git ls-tree -r b5f6c16 | grep .github → 空，main 无 CI [OBSERVED]"
    - "README.md:8（仅 license badge）[OBSERVED]"
    - "npm 上九包版本分布 = REGISTRY-SUBMISSION.md:48-61 [DOC，本轮不出网]"
  severity: medium
  recommendation: |
    C1（1 天）：
    (1) 侧车与 manifest 加 `recorder: {name:'research-mode', version, bundles:{…}}`——只加键、旧文件仍可读，这是
    "证据能说明自己"最小的一步；
    (2) 打一次 `v0.2.0` 让 tag 与 npm 对齐，之后每版一 tag + 用 `git log` 生成 CHANGELOG（不手写，避免断更）；
    (3) 把 `profile-composition.json` 的对比接进 `verify.yml`——现在它是死文件，要么用起来要么删掉；
    (4) REGISTRY-SUBMISSION.md 末尾加一节「发布之后」：九包版本表 → 索引行的 `verifiedAgainst`/`lastVerified` →
    谁改、什么时候改；并加一条 weekly job（唯一允许联网的 job）比对 npm 上九包版本与仓库 package.json；
    (5) README.md:8 补 CI / npm / version 三个 badge——这是陌生人两秒内能做的唯一尽调。
  cost: S（(1)(2)(5)）/ M（(3)(4)）
  falsifier: |
    若 artifact 侧车或 `.science` manifest 已含 recorder/版本字段，或仓库存在 CHANGELOG 且有 ≥2 个版本 tag 与
    npm 对齐，或 `.github/workflows/verify.yml` 已读取并比对 `docs/profile-composition.json`，或 main 分支上有 CI，
    则相应部分被推翻。
  mission_principle: |
    docs/EVIDENCE-MODEL.md:85-88「读者必须知道每个字段是什么意思」——读者同样必须知道**是哪个版本的软件**写了这些字段。
    一个证据系统若不能自证版本，"可交接"就少一环：接手的人不知道该用哪版解释这堆面。

- id: PROD-05
  dimension: product
  claim: |
    文档承诺：README 的「What this software does NOT do」是全文最具体的一段，且与 EVIDENCE-MODEL 大面积重复；
    真正缺的那一段是"做了什么、你会看到什么"。
    (a) 比例：README.md:80-98 共 8 条 bullet（19 行），带具体断言（`available` ≠ reproduced / signature 不证明身份 /
    `.science` 只读未强制…）；README.md:25-51「What it actually does」是一张 9 行能力表，全是动词
    （"provides"、"read-only"），**零输出样例**。全文没有任何一行真实 artifact id、七面 JSON 或 `.science` 内容。
    (b) 重复：README.md:85-96 的 8 条与 `docs/EVIDENCE-MODEL.md:36-40,44-48,59-65,79-81` 是同一批事实的两种写法，
    EVIDENCE-MODEL 更完整（它有"字段 → 意味着什么"的对照表）。删掉其中 6 条不损失信息，只减少首屏重量。
    (c) 免责压过功能的具体后果：README.md:82-83 自己写「This section is longer than usual on purpose.」——解释了
    为什么免责长，却没有一句解释"那你为什么还应该装它"；README.md:109-113 的 Status 段又把同一批局限复述一遍
    （early / v0.1.0 / Docling timeout）。同一份文档里，限制被说了三次，能力被展示了零次。
    (d) 真正会改变安装决策的只有 4 条：available ≠ reproduced、available ≠ reviewed、`confirm=true` ≠ 人类同意、
    `.science` 只读未强制（README.md:85-96）。其余 4 条（environment 自动填充、review verify 不证明历史完整、
    无 per-tool 授权、不声称科学有效性）属于内部语义细节，EVIDENCE-MODEL 已经写清。
    **我的判断：有过之而无不及地免责，本身不是劝退原因**——劝退原因是**免责成了全文唯一可验证的东西**：
    读者读完能核对 8 条限制，却没有一条能核对的收益。
  evidence:
    - "README.md:80-98（8 bullet / 19 行；:82-83 自述 long on purpose）；README.md:25-51（9 行能力表，无样例）[OBSERVED]"
    - "docs/EVIDENCE-MODEL.md:36-40（四项 available 的精确含义）、:44-48（environment/reproducibility 的 callout）、:59-65（signature 三条不证明）、:79-81（import 只读未强制）[OBSERVED]"
    - "README.md:109-113（Status 段重复 early / v0.1.0 / Docling timeout）[OBSERVED]"
    - "全仓无 examples/、无截图、无 transcript（见 PROD-02 证据）；README.md:8 唯一 badge 是 license [OBSERVED]"
  severity: medium
  recommendation: |
    C0（30 分钟）：把 8 条压成 4 条（只留会改变决策的那几条），每条一行；被移走的 4 条原地留一句
    「剩下 4 条语义细节见 docs/EVIDENCE-MODEL.md」；Status 段只保留版本与已知阻塞项，删掉与免责重复的句子；
    腾出的版面放 PROD-02 要的那段真实 transcript。**先做减法再做加法**：README 现在的限制密度已经足够说服
    一个谨慎的读者，不需要再加，只需要在同样的版面里放一个他能核对的收益。
  cost: S
  falsifier: |
    若 README 中存在一段真实端到端输出样例（artifact id、七面输出、`.science` 路径），则"零输出样例"被推翻；
    若 README 的免责条目与 EVIDENCE-MODEL 不重复，则"冗余"被推翻；若删掉 6 条会让 README 漏掉某个别处没有的
    事实，则"可删"被推翻。
  mission_principle: |
    CONTRIBUTING.md:45-51「不要写 verified，除非你跑的命令证明了它」——这条是对的。但对首次读者，诚实的反面不是
    更长的免责，而是更早的一个具体例子：先让他看见一次真的，再告诉他哪一部分不能当真。

- id: PROD-06
  dimension: product
  claim: |
    社区面：唯一的增长回路（陌生人提 PR）有三处前置在本仓不成立，而 `CONTRIBUTING.md` 恰好承诺了这三处。
    (a) 「verification must be green」但主干没有 CI：CONTRIBUTING.md:16-22 写「the verification below must be green,
    and it merges to main」，并要求改组合时跑 `profile-composition.mjs`；该命令要宿主 `dsh`（W03-BASELINE.md:43 /
    lead-probes P-05：`spawnSync dsh ENOENT`，exit 2），且其输入 dump 不在仓里（PROFILE-COMPOSITION.md:4）。
    同时 main 分支没有 `.github/`（见 PROD-04(e)），"green"在贡献者眼里没有落点。
    (b) 承诺的守卫空转：CONTRIBUTING.md:53-56「`skills/` and `.agents/skills/` must stay byte-identical;
    `s1-check-skill-contracts.mjs` fails if they drift」——本 checkout 没有 `.agents/`（`Test-Path .agents` → False），
    该检查恒输出 `SKIPPED: no .agents/skills in this checkout`（`tools/w01/s1-check-skill-contracts.mjs:78-80`）；
    更糟的是同一文件里"skill 里提到的工具必须真实存在"的交叉校验（`:93-104`）**被写在了 `else` 分支里**，
    所以在单份布局下连它也不跑。而 README.md:74 把这条命令描述为「skill <-> tool contract + mirror drift」，
    `verify.yml:41-42` 也照跑——CI 绿，但这两项在该仓库里一项都不成立。
    (c) 最能证明"能用"的那套测试不在 CI：基线 README.md:72 把 `verify-acceptance.mjs`（13 项）列为四条验证之一，
    它是唯一验"七面 / 三轮 review 存活 / `.science` 往返 / 篡改检出"的端到端套件；而 `.github/workflows/verify.yml:35-45`
    跑的是 tests / probe-containment / skill-contracts / npm-preflight——**acceptance 不在里面**。而且它按现在的写法
    也进不去：D1（`:208-217`）会读 `~/.dsh/profiles/w01-alpha/package.json`，干净 runner 上没有这个文件。
    (d) 贡献规则的唯一裁决标准是"overstates what it proves"（CONTRIBUTING.md:3-4），既无定义也无例子；仓内没有
    issue 模板、没有 CODE_OF_CONDUCT、没有 SECURITY.md（全仓 `.yml` 只有 `verify.yml`）。对一个 0 issue / 1 star
    的仓（W03-BASELINE.md:65，`DOC`；本轮不出网未复核），陌生人没有可复制的第一个入口，而维护者手上没有
    任何机制区分"异议"与"没人来"。
  evidence:
    - "CONTRIBUTING.md:16-22（must be green / 要求跑 profile-composition）vs git ls-tree -r b5f6c16 无 .github（main 无 CI）[OBSERVED]；profile-composition 需宿主 = W03-BASELINE.md:43 + lead-probes.md:82-92（主控实测，本轮未复跑）"
    - "CONTRIBUTING.md:53-56 vs Test-Path .agents → False；tools/w01/s1-check-skill-contracts.mjs:78-80（SKIPPED 分支）与 :93-104（交叉校验位于 else 分支内）[OBSERVED]"
    - "README.md:74（该命令自述覆盖 skill<->tool contract + mirror drift）vs 上述实际两项皆空转；.github/workflows/verify.yml:41-42 仍执行它 [OBSERVED]"
    - "基线 README.md:72（verify-acceptance 13 项）vs .github/workflows/verify.yml:35-45（无该步骤；以 npm-preflight 作第四步）[OBSERVED]；已提交的 898bf75 已把它移出四条、改为散文，并声称「clean machine 上 PARTIAL by design」——代码只有 PASS/FAIL（verify-acceptance.mjs:20-29），该句为假 [OBSERVED]"
    - "tools/w01/verify-acceptance.mjs:1-17（自述 tmpdir 内跑、不读真实 .research、无出网）**但** :208-217 的 D1 读 `~/.dsh/profiles/w01-alpha/package.json`（本机专有）→ 原样进干净 runner 会失败，需先让 D1 在 profile 缺失时报 SKIP [OBSERVED]"
    - "CONTRIBUTING.md:3-4（唯一裁决标准）；Get-ChildItem -Recurse -Include SECURITY*,CODE_OF_CONDUCT*,*.yml → 只有 .github/workflows/verify.yml [OBSERVED]"
    - "0 issue / 1 star = W03-BASELINE.md:65 [DOC，本轮不出网]"
  severity: medium
  recommendation: |
    C1（半天）：
    (1) 先把 `verify-acceptance.mjs` 的 D1（`:208-217`）改成「profile 不存在则 SKIP 并写明原因」（这需要给
    `check()` 加 SKIP/PARTIAL 这一状态，见 `:20-29`），再在 `verify.yml` 里增加一步跑它——12/13 项跑在 tmpdir、
    无出网，是把"能用"变成 CI 证据的最短路径；别用 npm-preflight 顶替它（两者验的不是同一件事）；
    同时把 898bf75 写进 README 的那句「reports PARTIAL … by design」删掉或补上真实状态码；
    (2) 把 `s1-check-skill-contracts.mjs:93-104` 的交叉校验移出 `else`，让"skill 里写的工具必须存在"在单份布局下也跑；
    若坚持双份布局，就在 CI 里造 `.agents/skills` 的软链/复制再跑 mirror 对比，别让 SKIPPED 冒充 pass；
    (3) CONTRIBUTING 的"overstates"给三个可判定的反例（例：没重放却写 reproduced；把 `available` 说成 verified；
    引用未读的全文），并补 issue 模板 / SECURITY.md；
    (4) README 顶部加 CI badge，让"它绿不绿"两秒可见。
  cost: S
  falsifier: |
    若 `.agents/skills` 在发布仓中存在，或 `s1-check-skill-contracts.mjs` 在无 `.agents` 时仍执行工具交叉校验，
    或 `verify.yml` 已包含 `verify-acceptance.mjs`，或仓内已有 issue 模板 / CODE_OF_CONDUCT / SECURITY，则相应部分被推翻。
  mission_principle: |
    CONTRIBUTING.md:50-51「When you find that a previous claim was wrong, record the correction rather than quietly
    editing the claim. The history of being wrong is data.」——一个 0 issue 的仓不是没有异议，是**没有入口**。
    而 CI 里那一步 SKIPPED，正是"悄悄把断言改成通过"的自动化版本。
```

---

## 附录 A · 本轮实际执行 / 未执行

**执行（`OBSERVED`）：** 读 README / INSTALL / EVIDENCE-MODEL / PROFILE-COMPOSITION / REGISTRY-SUBMISSION / CONTRIBUTING、两个 `client.js` 相关段、`store.js:160-214` 与 `:548-587`、两个 preset 的 patch、`verify.yml`、`s1-check-skill-contracts.mjs:60-104`、`verify-acceptance.mjs` 头、`publish-all.mjs` 与 `npm-preflight.mjs` 头；`git tag -l` / `git show v0.1.0:…` / `git ls-tree -r b5f6c16` / `git log`；`Test-Path .agents`、`package.json`、`profiles/`；逐 bundle 数 `research_*` 工具名（host 10 / connectors 8 / litdb 2 / notebook 1 / replay 1 / exec 2）；全仓 `Select-String` 查 `docling|pdf`、`CHANGELOG`、`*dump*`、`getting started|quickstart|tutorial`；宿主内嵌 CLI `dsh --help`（只打印用法，exit 0）。

**未执行（`NOT VERIFIED` / `DOC`）：** 任何 GUI 挂载与渲染（首屏文案的行号来自源码，屏幕上是否如此显示未复核）；`dsh plugin add` 的真实 pnpm 解析（相对 `link:` 的失败是 `INFERRED`）；Node 22.19 上 `node:sqlite` 是否需 flag；npm 上九包与索引行的现状（`DOC`，本轮不出网）；`profile-composition.mjs` 与 `verify-acceptance.mjs` 本轮**未复跑**（前者的失败引自 W03-BASELINE / lead-probes 的主控实测）。

**未改动：** 除本文件外未写任何文件；未改 `plugins/` `skills/` `tools/` `docs/`（除本文件）与任何 profile；未安装、未出网、未做 git 写、未碰真实 `.research` 数据。
