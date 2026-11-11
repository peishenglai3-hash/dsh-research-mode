# W03 · 可维护性维度差距（gap-maint）

- **基线：** `b5f6c16` / 分支 `w03-reading`；范围 `plugins/active/`（10 bundle / 24 工具）+ `skills/` + `docs/` + `tools/`。
- **方法：** 只读源码与目录比对，**并在 `os.tmpdir()` 内实跑**了四条验证命令中的三条和两个探针。全程未改任何 `plugins/` `skills/` profile 源码，未读写任何真实 `.research` / `.research` 库数据，未出网。
- **证据等级：** `OBSERVED`（本轮实跑/实探）、`READ`（源码可核对）、`DOC`（文档记载但本轮未复现）、`NOT VERIFIED`。
- **改动等级（沿用 `gap-arch.md` 口径）：** C0 = 只改文档/口径或纯 CI 配置（不动运行语义）；C1 = 单 bundle 内改动，不动磁盘格式；C2 = 跨 bundle 契约/字段语义变更（按 `CONTRIBUTING.md:11-12` 需先写决策）；C3 = 安装面/架构重构。
- **严重度：** P0 = 结论已不可信；P1 = 有实据的失守或"验证"声明不可复现；P2 = 维护成本/回归风险。
- **裁决基准（`W03-BASELINE.md:85-87`）：** ①工程纪律是为了保护自由探索，不是让探索服从纪律本身 ②让实际科研活动决定工程构型 ③有条件放开 + 优化基础 + 删繁就简。

**总判断（一句话）：** 这套系统的重复不是"抄错"，而是**同一不变量没有单一真源、又没有任何一处自动化在检查它**——于是同一个守卫只补进了 4 份里的 1 份（我实测可跨项目读），同一份 `VERIFY.md` 指着三条已不存在路径却仍写着"pass"，CI 文件写好了但还没进版本库，所以"66 个测试"至今仍是一句**需要人记得**的断言。

<!-- findings:begin -->

- id: MAINT-01
  dimension: maintainability
  claim: |-
    同一不变量（"projectId 只能落在 `.research/projects/<id>` 内"）被复制成 4 份校验器，安全加固只落进了其中 1 份；另 3 份可被 `projectId: ".."` 带出被声明的项目根——**本轮已实测复现**。
    - 4 份校验器同一正则 `/^[\p{Letter}\p{Number}._-]+$/u`：只有 `research-phase2-exec` 追加了 `|| projectId === '.' || projectId === '..'`，`research-phase2-notebook`、`research-phase2-replay`、`research-phase2-litdb` 三份没有。
    - 实测（tempdir，未触碰真实数据）：`inspectNotebook(ws, '..', 'projects/victim/analysis.ipynb')` 成功返回**另一个项目**的 notebook 路径；`replayPlan(ws, '..')` 成功读到 workspace 级 `.research/project.json`。二者都未抛错。（`OBSERVED`）
    - 对照：被加固的 `research-phase2-exec` 有专测 `test/security.test.mjs:134-143`（"rejects project ids that are dot segments"）；三个兄弟 bundle 无任何对应用例——**测试缺口正是加固缺口的镜像**。
    - 同族重复：把 cwd 剥回 workspace 的正则 `/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/` 在 6 个文件里逐字出现，其中客户端那份（`research-hub/client.js:34`）还多带 `/i`，与 5 份宿主实现的大小写语义不同。
  evidence:
    - "plugins/active/research-phase2-exec/index.js:10（唯一带 dot-segment 守卫）"
    - "plugins/active/research-phase2-notebook/lib/inspect.js:14 + :15-21"
    - "plugins/active/research-phase2-replay/lib/plan.js:30 + :31-34"
    - "plugins/active/research-phase2-litdb/index.js:16 + :19-22（无守卫且 mkdir/write 到 `.research/projects/../.litdb`）"
    - "plugins/active/research-phase2-exec/test/security.test.mjs:134-143（加固侧有测）；三个兄弟 test 目录无 dot-segment 用例"
    - "6 份 cwd 正则：research-host/index.js:221, research-phase2-exec/index.js:14, research-phase2-litdb/index.js:11, research-phase2-notebook/index.js:9, research-phase2-replay/index.js:9, research-hub/client.js:34"
    - "本轮实测脚本（tempdir 内联，已删除）：inspectNotebook/replayPlan 对 projectId='..' 均返回项目外内容"
  severity: P1
  recommendation: |-
    C1：先做最小闭环——给 `inspect` / `plan` / `litdb` 三处补同一守卫，并在三个 test 目录各加一条 `projectId='..'` 的复现用例（复制 phase2-exec 的写法即可）。紧接着做 C2：把这套路径与项目 id 的判据收敛成一个可被 import 的模块（`@peisheng_lai/dsh-research-layout` 或 host 的 `./layout` 子导出），6 处正则改为调用它，客户端的 `/i` 差异显式化。
    注意与 `gap-arch.md` ARCH-01 重叠：那边把 containment 两套实现记为"可利用性未做实测"，本条把其中一处升级为 `OBSERVED`，并补上"1/4 加固"这个可维护性依据。
  cost: S（补守卫+3 条用例）；共享模块另计 M
  falsifier: |-
    若三处兄弟 bundle 在 `projectId='..'` 时抛错，或存在测试文件对它们断言该行为，或仓库已有跨 bundle 共享的 project-root 模块（而非 6 份字面量），则本条错。
  mission_principle: 边界必须被强制，而不是被注释

- id: MAINT-02
  dimension: maintainability
  claim: |-
    同一份 litdb 只读契约有两套活实现，且已在**上限**和**表结构校验**上分叉；Python 那套的 6 个用例不在任何被文档化或被 CI 引用的命令里。
    - 两套实现：`skills/litdb/scripts/litdb.py`（228 行，CLI：stats/relations/search/lookup，`unittest` 6 例）vs `research-phase2-litdb/lib/query.js`（100 行，工具：search/snapshot）。
    - **已分叉 1（上限）**：Node `searchLitdb` 硬顶 `Math.min(20, topK)`；Python `MAX_TOP_K = 50` 且越界抛错。同一次 `top-k=30` 查询，工具给 20 条、CLI 给 30 条。
    - **已分叉 2（校验）**：Python 在 `open_read_only` 里严格比对九字段表结构并拒绝不符；Node 只 `SELECT` 九字段，表结构不符时抛的是底层 SQLite 错误而非契约错误。
    - **已分叉 3（能力）**：Python 有 `stats/relations/lookup`、无 snapshot；Node 有 `snapshot`（写 `.litdb/index.json`）、无另三者。所谓"同一契约"其实只有 search 一项重叠。
    - **可发现性**：`skills/litdb/test/test_litdb.py`（6 例）既不在 `README.md:68-73` 的四条命令，也不在 `verify.yml` 的步骤里；且它依赖真实 1,560 条样本库，CI 上无数据即不可跑。
  evidence:
    - "plugins/active/research-phase2-litdb/lib/query.js:51（`Math.min(20, ...)`）vs skills/litdb/scripts/litdb.py:36, 165-166（`MAX_TOP_K = 50`）"
    - "skills/litdb/scripts/litdb.py:78-88（九字段严格校验）vs plugins/active/research-phase2-litdb/lib/query.js:29, 64-87（无表结构断言）"
    - "skills/litdb/scripts/litdb.py:12-17（四命令）vs plugins/active/research-phase2-litdb/index.js:32, 58（search/snapshot）"
    - "README.md:68-73 与 .github/workflows/verify.yml:35-45 均未包含 test_litdb.py"
    - "skills/litdb/test/test_litdb.py:49-87（6 个 `def test_`）；:4-6 自述用真实样本库"
  severity: P2
  recommendation: |-
    C1：不做合并，先做**如实化**——在两处文档写清"Node 工具与 Python CLI 不是同一接口：上限 20 vs 50、能力集不同"，并把 `test_litdb.py` 收进一条显式命令（`python skills/litdb/test/test_litdb.py`，标注"需真实样本库"），同时修正 `research-host/VERIFY.md:14` 与 `research-workspace/VERIFY.md:14` 里那条已不存在的 `.agents/` 路径。C2（可选）：把 FIELDS 与上限常量提成一份 JSON 由两边同读，使"分叉"变成编译期可见。
  cost: S（如实化+路径修正）；常量共享另计 S
  falsifier: |-
    若两套实现共享同一份上限常量或表结构断言，或 `test_litdb.py` 出现在 README/CI 的某条命令中，或 Node 工具的 topK 上限也是 50，则本条错。
  mission_principle: 不夸大自己能证明的东西

- id: MAINT-03
  dimension: maintainability
  claim: |-
    文档与代码漂移至少 10 处，其中 `VERIFY.md` 整份指向**本 checkout 里已不存在**的路径却仍宣称 pass；三处 connectors 注释/测试名写着 "six" 而同文件注册 8 个；README 的 "24 工具" 无法按 INSTALL 复现。
    - (1) `research-connectors/index.js:4` "Six read-only research connectors" —— 实注册 8（同文件 `:155` 的 `TOOLS` 数组）。
    - (2) `research-connectors/cordis.patch.yml:3` "six read-only tools are registered by index.js" —— 同为 8。
    - (3) `research-connectors/test/plugin.test.mjs:6` 测试名 "apply registers six tools" —— 第 `:19` 行却断言 `registered.length === 8`；测试名与其断言自相矛盾。
    - (4) `research-host/VERIFY.md:11-13` 三条命令全指向 `dsh-plugins/research-core/...`，该路径不存在（实际 `plugins/active/research-host`）；`:13` 宣称 `test/client.test.mjs` 1 pass，而 research-host 根本没有 `client.test.mjs`（其 `test/` 为 auth/reviews/store/tools 四文件）。
    - (5) `research-host/VERIFY.md:14` 与 `research-workspace/VERIFY.md:14` 都写 `python .agents/skills/litdb/test/test_litdb.py` —— 本 checkout 无 `.agents/`；`tools/w01/s1-check-skill-contracts.mjs:79-80` 自己在跑的时候打印 "SKIPPED: no .agents/skills in this checkout"。
    - (6) `research-host/VERIFY.md:15` connectors "8 pass" —— 两个测试文件实际 10 个 `test(`（9 + 1）。
    - (7) `research-host/VERIFY.md:27` "6 个 ToolDefinition" —— 实际 10 个（`test/tools.test.mjs:24` 断言 10）。
    - (8) `research-host/index.js:1` 注释 `@local/research-core` —— `package.json` 的名字是 `@peisheng_lai/dsh-research-host`。
    - (9) `README.md:27` "Ten bundles, 24 tools"，但 `README.md:29-40` 的表格只列 9 个 bundle（缺提供 2 个工具的 `research-phase2-exec`）；`INSTALL.md:96-99` 又明说参考 profile 故意不含它，`INSTALL.md:57` 要求"应该看到九行且没有 phase2-exec"。按 INSTALL 装完实注册 **22** 个工具，"24" 只在把 exec 也算上时成立。
    - (10) `research-host/VERIFY.md` 与 `research-workspace/VERIFY.md` **字节完全相同**（同为 36 行、同 SHA256 `750B5EF6…`），两份都叫 "research-core · 验证记录（Phase 1）"、都只记录 `research-core` 与 `research-connectors`——**没有一句描述 research-workspace**，而 `research-workspace/package.json` 的 `files` 又把这份 VERIFY.md 当发布物一起发出去。
    - **反向如实记：** `docs/EVIDENCE-MODEL.md` 我逐条对照了代码且**基本没有漂移**——manifest 形状（`:72` vs `store.js:568-574`）、七面顺序（`:21-29` vs `store.js:28-29`）、review 的"顶层镜像 + history[]"（`:16-17` vs `store.js:349-363`）、`readOnlyEnforced` 是实测而非声明（`:81` vs `store.js:698-723`）均一致。漂移集中在 `VERIFY.md` 与 connectors 的 "six"，不在证据模型文档。
  evidence:
    - "plugins/active/research-connectors/index.js:4, :155"
    - "plugins/active/research-connectors/cordis.patch.yml:3"
    - "plugins/active/research-connectors/test/plugin.test.mjs:6 vs :19"
    - "plugins/active/research-host/VERIFY.md:11-13, :14, :15, :27"
    - "plugins/active/research-workspace/VERIFY.md:14"
    - "`git diff --no-index plugins/active/research-host/VERIFY.md plugins/active/research-workspace/VERIFY.md` → exit 0（完全相同）；两者 SHA256 均 750B5EF6D2D83AB1FAD89B07E783405077CC0BF999A7E41732FE9A39DA4BC08B（OBSERVED）"
    - "plugins/active/research-host/index.js:1 vs plugins/active/research-host/package.json:2"
    - "README.md:27, :29-40；INSTALL.md:57, :96-99"
    - "tools/w01/s1-check-skill-contracts.mjs:79-80（mirror 检查实为 SKIPPED）"
    - "本轮实跑：node tools/w01/s1-check-skill-contracts.mjs → 'mirror-identical — SKIPPED: no .agents/skills in this checkout'（OBSERVED）"
    - "对照无误：docs/EVIDENCE-MODEL.md:72 vs research-host/lib/store.js:568-574；:16-17 vs store.js:349-363"
  severity: P1
  recommendation: |-
    C0：这是纯口径修复，且直接损害本项目最核心的承诺（"对能证明什么保持诚实"）。按此优先级改：① 重写 `research-host/VERIFY.md` 为"当前可跑的三条命令 + 本轮真实输出"，把它从 Phase-1 历史记录改成现状记录（或明确标注为历史归档并另起 `VERIFY-w03.md`）；`research-workspace/VERIFY.md` 不能继续做它的副本，要么删掉从包的 `files` 里移除，要么写成 workspace 自己的验证记录。② connectors 的 "six" 三处一次改为 8，并把测试名改成与断言一致；③ README 表格补上 `research-phase2-exec` 行并注明"24 = 22（默认装）+ 2（默认不装）"，与 INSTALL 的九行口径对齐。
  cost: S
  falsifier: |-
    若上述行号处的文本已与代码一致（"six" 已改 8、VERIFY.md 路径已存在、README 表已含 exec 行），或 `.agents/skills/litdb/test/test_litdb.py` 在本 checkout 中真实存在，则本条错。
  mission_principle: 不夸大自己能证明的东西

- id: MAINT-04
  dimension: maintainability
  claim: |-
    13 个测试文件、66 个用例，但**只有 10 个工具被真正穿过 `tool.execute()`**；12 个只有库函数级测试；`research_replay_plan` 连"注册存在"都没测；两个 preset bundle 零测试。
    - 穿过 `execute()` 的 10 个：host 的 9 个（`project_list` 除外）+ `research_notebook_execute`。
    - 仅库级（register 有断言或无、execute 从未被调用）12 个：`research_project_list`、8 个 connectors、`research_litdb_search`、`research_litdb_snapshot`、`research_notebook_inspect`。
    - 只有注册、无任何行为：`research_replay_execute`（`exec.test.mjs:18-23` 只断言两个名字）。
    - 连注册都没测、只有库级：`research_replay_plan`（`replay.test.mjs:9` 只 import `lib/plan.js`，从不 `apply()`）。
    - 零测试的 bundle：`research-preset`、`research-preset-cn-social`（各自 3 文件，无 `test/`）。
    - 因此 connectors 的 `asText` 截断、`output` 契约、`isConcurrencySafe` 这些**只在 tool 层存在**的行为，与 replay 两个工具的注册/参数校验，都无回归保护。
  evidence:
    - "plugins/active/research-host/test/tools.test.mjs:24（断言 10 个）、:28-72（只调 9 个 execute，`research_project_list` 未被调用）"
    - "plugins/active/research-phase2-exec/test/security.test.mjs:164-189（第 10 个：`research_notebook_execute` 的 execute 被调）"
    - "plugins/active/research-connectors/test/plugin.test.mjs:19-39（只查形状，不调 execute）；行为在 test/connectors.test.mjs:36-237（库函数级）"
    - "plugins/active/research-phase2-replay/test/replay.test.mjs:9（只 import lib/plan.js，文件内无 apply）"
    - "plugins/active/research-phase2-exec/test/exec.test.mjs:18-23（只断言工具名）"
    - "本轮实跑 node --test → tests 66 / pass 66 / fail 0（OBSERVED，与 README.md:69 的 66 一致）"
    - "plugin 级 case 统计：connectors 9+1、host 3+16+2+1、hub 10、exec 2+12、litdb 5、notebook 2、replay 1、workspace 2 = 66"
  severity: P2
  recommendation: |-
    C1：按"最贵的未测行为"排序补三条——① connectors 一条经 tool 层的用例（覆盖 `asText` 截断与 `output.schema`），② `research_replay_plan` / `research_replay_execute` 各一条 注册 + execute（replay 的 execute 涉及沙箱，可在无沙箱服务时断言"必抛 DSH sandbox service is unavailable"，与 security.test.mjs:187-189 同法）；③ 两个 preset 一条结构断言（persona 文本含三条阅读护栏——`verify-acceptance.mjs` 的 D2 已在做同类检查，可复用而不必新写）。C2：给 14 个未穿 execute 的工具补一张"必须在 tool 层验证的行为"清单，避免以后再靠库级测试冒充覆盖。
  cost: M
  falsifier: |-
    若存在测试文件对上述 14 个工具调用 `.execute(` 或对其注册做断言，或 `research-preset*` 目录下存在 `test/`，则本条错。
  mission_principle: 让"它通过了"是可核对的，而不是可转述的

- id: MAINT-05
  dimension: maintainability
  claim: |-
    基线 `b5f6c16` **没有 CI**；本轮看到的 `.github/workflows/verify.yml` 与 `tools/w03/run-tests.mjs` 都还是 **UNTRACKED**，所以今天四项检查仍全靠人记得跑，其中一项在干净环境里跑不起来。
    - `git status --porcelain --untracked-files=all` → `?? .github/workflows/verify.yml` / `?? tools/w03/run-tests.mjs` / `?? docs/w03/W03-BASELINE.md`（`OBSERVED`）。基线 tree 里 `git ls-tree -r b5f6c16 | grep github` 为空，即 CI 从未进过版本库。
    - 未提交即不触发：GitHub Actions 只跑仓库里已跟踪的 workflow，因此"66 个测试"目前仍是**声明**。
    - 四项检查的本轮真实状态：① `node --test plugins/active/*/test/*.test.mjs` → 66 pass（`OBSERVED`）② `node tools/w01/verify-acceptance.mjs` → 13 checks / 13 pass（`OBSERVED`）③ `node tools/w01/probe-containment.mjs` → 12 vectors / PASS（`OBSERVED`）④ `node tools/release/profile-composition.mjs` → **未跑**；`W03-BASELINE.md:43` 记其 `spawnSync dsh ENOENT`、exit 2（`DOC`），且它依赖宿主二进制，CI 上不可复现。
    - 第 4 项失守的后果不是"少跑一条"：没有它，`INSTALL.md:70-73` 的"13 行组合矩阵"（9 本仓 / 2 宿主 / 1 profile patch / 1 external）无命令可复核；矩阵错位时会**静默**表现为"少一行"，而 `INSTALL.md:77-82` 描述的那个 skip-notice 失效模式正是为此存在。
    - 另有第 5 项无人管的：`skills/litdb/test/test_litdb.py`（6 例，见 MAINT-02）不在任何命令里。
    - `NOT VERIFIED`：workflow 一旦提交后 GitHub 上是否真绿（本会话不出网，无法验证 runner 行为）；`mirror-identical` 那一项的实际效力（见 MAINT-03(5)，本 checkout 里恒为 SKIPPED）。
  evidence:
    - "git status --porcelain --untracked-files=all → `?? .github/workflows/verify.yml`, `?? tools/w03/run-tests.mjs`, `?? docs/w03/W03-BASELINE.md`"
    - "git ls-tree -r --name-only b5f6c16 | grep -i github → 空（基线与 CI 无关）"
    - ".github/workflows/verify.yml:1-2（自述：'Before this workflow existed, none of them ran on push'）、:35-45（四个步骤）"
    - "tools/w03/run-tests.mjs:38-41（无测试文件即 exit 3，拒绝报告成功）"
    - "docs/w03/W03-BASELINE.md:43（第 4 条 FAIL exit 2）、:69（'CI：.github/ 不存在'——冻结时为真）"
    - "README.md:68-73（四条命令与 '66 tests' / '13 acceptance checks' / '12 vectors'）"
    - "本轮实跑输出：tests 66 pass 0 fail；'W01 GATE-A ACCEPTANCE: PASS checks 13 · pass 13 · fail 0'；'PROBE RESULT: PASS (12 vectors, 0 unexpected)'"
  severity: P1
  recommendation: |-
    C0：把 `verify.yml` + `tools/w03/run-tests.mjs` 纳入版本控制，这是唯一能把"it works"从断言变成命令的动作，且不动任何运行语义。同批把 `profile-composition.mjs` 标成 post-install 手动项（`verify.yml:9-11` 已这样注释，但 `README.md:68-73` 仍把它与另外三条并列成"run it yourself"，口径需对齐）。C1：给 `run-tests.mjs` 再加一眼"测试文件数是否为 13"的断言，使"新增测试文件却忘了接进命令"这类漂移当场可见。
  cost: S
  falsifier: |-
    若 `.github/workflows/verify.yml` 已在基线提交中被跟踪（`git ls-tree -r b5f6c16` 能列出它），或 GitHub 上已有该仓库的 Actions 运行记录证明其生效，则本条错。
  mission_principle: "it works" 应当是命令，而不是断言

- id: MAINT-06
  dimension: maintainability
  claim: |-
    "改一处必须同时改三处"确有其事，两处实例已量化：两个 preset 是三件套的第二份实现（persona 改一次要改两份且已漂移）；两个 client 各自再推一遍同一套项目路径（版本还不同）。
    - **preset 对**：`research-preset` vs `research-preset-cn-social`——`index.js`（2 行）**字节相同**；`package.json` 仅差 4 行（name、version 0.2.0→0.1.0、description、repository.directory）；`cordis.patch.yml` 差 8 插入 / 5 删除（= **13 个改动行**，65 行 vs 66 行），其中 2 行只差一个 BOM、2 行是文件尾多出的空行。实质差异只有 4 个字段替换 + 1 条追加的因果语言规则。
    - 已发生的漂移：cn-social 多一条 "For Chinese social-science claims, keep causal language proportionate…"（`cordis.patch.yml:18`），而 base preset 没有——这条规则若该对两边都生效，就必须被记得抄两次。
    - **client 对**：`research-workspace/client.js`（0.2.0，左栏 `sidebar.panellist` + `main`）与 `research-hub/client.js`（0.1.0，右栏 `sidebar.right.pane.tab`）虽占不同槽位、不是同一个界面，却各自重推 `.research/projects/<id>` 布局并各自读 `project.json` / artifacts / reviews / `.litdb/*`。两处 cwd 正则也不一致（hub 带 `/i`，见 MAINT-01）。
    - **文档对**：`research-host/VERIFY.md` 与 `research-workspace/VERIFY.md` 字节相同（见 MAINT-03(10)）——于是"更新验证记录"这件事天然是"改一份、得记得同步另一份"，而当前两份都已失效。
    - `W03-BASELINE.md:100` 把这条记为"两个 preset 的 patch 只差 11 行"——按 `git diff --stat` 实为 13 个改动行；"11" 应是扣掉 BOM 那一对之后的实质行数，两个口径都对，但写在文档里的数字需标清口径。
  evidence:
    - "git diff --no-index --stat research-preset research-preset-cn-social → cordis.patch.yml 13 changed（8 insertions, 5 deletions）、package.json 8 changed（4/4）、index.js 无差异"
    - "plugins/active/research-preset/cordis.patch.yml:1-8（id/name/description 四处替换 + BOM）vs research-preset-cn-social/cordis.patch.yml:1-8"
    - "plugins/active/research-preset-cn-social/cordis.patch.yml:18（base 中不存在该行）"
    - "plugins/active/research-preset/package.json:2-3, :5, :29 vs research-preset-cn-social/package.json:2-3, :5, :29"
    - "plugins/active/research-workspace/client.js:412-413, :482, :438-442（左栏 panel + main，读 .research/projects）"
    - "plugins/active/research-hub/client.js:291-297, :103-141（右栏 tab，读 .research/projects/{project.json,artifacts,reviews,.litdb}）"
    - "docs/w03/W03-BASELINE.md:100（'只差 11 行'，口径待标注）"
  severity: P2
  recommendation: |-
    C2：preset 侧把 `research-preset-cn-social` 改成对 base 的**增量**（只声明 `persona.prefix` 的追加段与 name/description，其余继承），或用一个 30 行生成器从一份 base 产出两个 patch，使 persona 文本只有一份。client 侧抽一个 `readProjectTree(files, sessionId, projectId)` 供 hub 与 workspace 共用，并把两边 cwd 正则统一到同一处（与 MAINT-01 的共享模块合并做）。在合并前，先在 `W03-BASELINE.md:100` 把 "11 行" 改标为 "13 改动行（含 BOM）/ 11 实质行"。
  cost: M
  falsifier: |-
    若两个 preset 共享同一份 persona 文本源（如 cn-social 用 include/override 而非复制），或两个 client 已共用同一数据访问模块，或 `git diff --stat` 显示 patch 差异不是 13 个改动行，则本条错。
  mission_principle: 删繁就简

<!-- findings:end -->

---

## 附录 A · Q1(a) `skills/` 与 `.agents/skills/` 是否双份 —— **本 checkout 只有一份**

如实说：**本 checkout 没有 `.agents/`**（`Test-Path .agents` → False）。`skills/` 下 10 个技能、12 个文件，是唯一一份。

因此"逐字节双份"在**本仓库不成立**，而 `W03-BASELINE.md:100` 的 B5 首句（"`skills/` 与 `.agents/skills/` 是逐字节双份"）在 `dsh-research-mode-public` 里是**错的**。三个可核对的事实：

1. `tools/w01/s1-check-skill-contracts.mjs:79-80` 自己就是证据——mirror 那一项在本 checkout 恒为 `SKIPPED: no .agents/skills in this checkout (single-copy layout is valid)`，本轮实跑确认。也就是说这个守卫**在被发布的仓库里是空转的**。
2. 双份布局在**另一棵树**上存在：`D:\DSH-Projects\dsh-research-mode`（私有证据档案仓）有 `.agents/`；`dsh-research-mode-public` 没有。B5 大概是在私有仓比的。`NOT VERIFIED`：两边内容是否逐字节相同（本次只做了存在性检查，未逐文件哈希）。
3. 双份的"化石"仍留在发布仓的文档里：`research-host/VERIFY.md:14` 与 `research-workspace/VERIFY.md:14` 都写着 `python .agents/skills/litdb/test/test_litdb.py`，而该路径在本 checkout 不存在（真实路径 `skills/litdb/test/test_litdb.py`）。见 MAINT-03(5)。

## 附录 B · Q1(b) litdb 的 Python 脚本 vs Node 工具

见 MAINT-02。摘要：两套实现、仅 `search` 一项能力重叠；**上限 20（Node）vs 50（Python）**、表结构校验有/无、命令集不同；Python 的 6 个用例不在任何被文档化或被 CI 引用的命令里。

## 附录 C · Q1(c) 两个 preset 的 `cordis.patch.yml` 差异行数

`git diff --no-index --stat`：**8 insertions / 5 deletions = 13 个改动行**（65 行 vs 66 行）。

拆分：4 处字段替换（`id` / `config.id` / `name` / `description`）各 1 删 1 增 = 8 行；文件首行只差一个 **BOM** = 2 行；文件尾多 2 个空行 = 2 行；persona 内追加 1 条中文社科因果语言规则 = 1 行。故"实质差异 11 行 / 改动行 13 行"两个口径都成立，需标注口径（见 MAINT-06）。

同目录另两文件的差异：`index.js` **字节相同**；`package.json` 差 4 行。

## 附录 D · Q1(d) `research-workspace/client.js` 与 legacy

**仓库内没有名为 `legacy` 的文件**（全仓 grep `legacy|deprecat|superseded` 命中的都是 `store.js` 的"遗留单轮 review"语义，与前端无关）。

若"legacy"指"另一份研究面板实现"，则它是 **`research-hub/client.js`**（291 行，0.1.0，右栏 tab）对 **`research-workspace/client.js`**（469 行，0.2.0，左栏 panel + main 页）。二者**不是同一槽位的重复品**（一个 `sidebar.right.pane.tab`，一个 `sidebar.panellist` + `main`），README 的描述也分别准确（`:32` 左栏 / `:33` 右栏）。真正的重复在**数据访问层**：两边各自拼 `.research/projects/<id>` 并各读 `project.json` / artifacts / reviews / `.litdb/*`，且 cwd 正则不一致（hub 带 `/i`）。详 MAINT-06。

## 附录 E · Q1(e) 项目文件读取逻辑散落在多少处

**8 处**推导项目位置（宿主 6 + 客户端 2），其中 6 处逐字复制同一条 cwd 正则：

| # | 位置 | 角色 |
|---|---|---|
| 1 | `research-host/lib/store.js:53-62`（+ `index.js:221`） | 唯一写者，自建 `projectPath` 与 id 校验 |
| 2 | `research-phase2-exec/index.js:9-17` | 读；**唯一带 dot-segment 守卫** |
| 3 | `research-phase2-litdb/index.js:11, 16, 19` | 读 + **写** `.litdb/`；无守卫 |
| 4 | `research-phase2-notebook/lib/inspect.js:14-15` | 读；无守卫 |
| 5 | `research-phase2-replay/lib/plan.js:30-31` | 读；无守卫 |
| 6 | `research-connectors/lib/connectors.js:219-228` | 另一套根（`$RESEARCH_NBS_DIR`），与 `.research` 无关，不计入重复 |
| 7 | `research-hub/client.js:34, 103-141` | 客户端再推一遍（带 `/i`） |
| 8 | `research-workspace/client.js:438-442` | 客户端再推一遍 |

加上 `research-host/lib/io.js:81-82` 的通用 `readText/readBytes`，以及 `research-phase2-*` 各自直连 `node:fs/promises` 的 5 处 `readFile`，**共有 7 个文件直接读文件、6 个文件各自推导项目根**。

## 附录 F · Q2 24 工具"有测试 / 无测试"清单（13 文件 / 66 用例的映射）

测试文件 → bundle：`research-connectors` 2（connectors 9 + plugin 1）、`research-host` 4（auth 3 + reviews 16 + store 2 + tools 1）、`research-hub` 1（10）、`research-phase2-exec` 2（exec 2 + security 12）、`research-phase2-litdb` 1（5）、`research-phase2-notebook` 1（2）、`research-phase2-replay` 1（1）、`research-workspace` 1（2）。**`research-preset` 与 `research-preset-cn-social` 无测试。**

| 工具 | 穿过 execute() | 库级行为测试 | 注册断言 |
|---|---|---|---|
| `research_project_create` | ✅ `tools.test.mjs:28` | ✅ | ✅ `:24` |
| `research_project_list` | ❌ | ✅ `store.test.mjs:18`（`listProjects`） | ✅ `:24`（计数） |
| `research_artifact_record` | ✅ `:32` | ✅ | ✅ |
| `research_artifact_list` | ✅ `:45` | ✅ | ✅ |
| `research_provenance_get` | ✅ `:48` | ✅ | ✅ |
| `research_review_record` | ✅ `:51, :60` | ✅ `reviews.test.mjs`（16 例） | ✅ |
| `research_review_verify` | ✅ `:58` | ✅ | ✅ |
| `research_review_list` | ✅ `:66` | ✅ | ✅ |
| `research_science_export` | ✅ `:70` | ✅ `store.test.mjs:47-53` | ✅ |
| `research_science_import` | ✅ `:72` | ✅ `store.test.mjs:55-58` | ✅ |
| `research_worldbank_indicator` | ❌ | ✅ `connectors.test.mjs:36` | ✅ `plugin.test.mjs:19` |
| `research_datacite_search` | ❌ | ✅ `:64` | ✅ |
| `research_ilostat_data` | ❌ | ✅ `:93` | ✅ |
| `research_socarxiv_search` | ❌ | ✅ `:110, :137` | ✅ |
| `research_pku_dataverse_search` | ❌ | ✅ `:164` | ✅ |
| `research_nbs_snapshot` | ❌ | ✅ `:188` | ✅ |
| `research_openalex_search` | ❌ | ✅ `:208` | ✅ |
| `research_crossref_search` | ❌ | ✅ `:237` | ✅ |
| `research_litdb_search` | ❌ | ✅ `litdb.test.mjs:144, :166` | ✅ `:205` |
| `research_litdb_snapshot` | ❌ | ✅ `:189` | ✅ `:205` |
| `research_notebook_inspect` | ❌ | ✅ `notebook.test.mjs:26` | ✅ `:40` |
| `research_replay_plan` | ❌ | ✅ `replay.test.mjs:29` | ❌ **无** |
| `research_notebook_execute` | ✅ `security.test.mjs:167-189`（4 例） | ✅ | ✅ `:164` |
| `research_replay_execute` | ❌ | ✅ `exec.test.mjs:6`（`runConfined`） | ✅ `:18-23` |

**汇总裁剪：** 有 execute 级行为测试的 **10** 个；只有库级/注册的 **13** 个；只有注册无行为的 **1** 个（`research_replay_execute`）；连注册都没有的 **1** 个（`research_replay_plan`）。

## 附录 G · Q4 没有 CI 的代价 —— "只能靠人记得跑"的检查项清单

基线 `b5f6c16` 无 CI（见 MAINT-05）。当前 workflow 仍未提交，故下列各项**全部**仍依赖人记得。

| # | 检查项 | 本轮实跑 | 一旦被忘记，失效表现 |
|---|---|---|---|
| 1 | `node --test plugins/active/*/test/*.test.mjs`（66 例） | 66 pass / 0 fail | 回归直接进主干；`reviews.test.mjs` 那 16 例是签名完整性的唯一守卫，漏跑即可让"篡改可检出"变假 |
| 2 | `node tools/w01/verify-acceptance.mjs`（13 项） | 13/13 PASS | 端到端语义无人验：七面、三轮 review 存活、`.science` 往返、篡改检出、D1"profile 不能装 exec"——这些**只有它**在查 |
| 3 | `node tools/w01/probe-containment.mjs`（12 向量） | 12/12 PASS | 路径越界回归静默放行；且它只探 phase2-exec 一个读者，**探不到** MAINT-01 那三处未加固的兄弟（探针的覆盖面本身就是缺口） |
| 4 | `node tools/w01/s1-check-skill-contracts.mjs` | PASS，但 mirror 项 SKIPPED | 技能里写了个不存在的 `research_*` 名字没人发现；mirror 项即使跑了也恒 SKIPPED（附录 A），即"看起来有守卫、实际没有" |
| 5 | `node tools/release/profile-composition.mjs` | **未跑**（`DOC`: exit 2, `spawnSync dsh ENOENT`） | 组合矩阵无命令可复核；错位时**静默少一行**（`INSTALL.md:77-82` 记的正是这个失效模式） |
| 6 | `python skills/litdb/test/test_litdb.py`（6 例） | 未跑 | 完全不在任何文档命令里；Python 侧契约分叉（MAINT-02）从此无守卫 |

**注：** 本轮另有 4 个"只能靠人记得"的**文档**一致性项（"six" 三连、VERIFY.md 路径、README 24 vs 22、B5 的 `.agents` 说法），它们没有任何自动化，且其中 3 个本来可以由 `s1-check-skill-contracts.mjs` 的 `registry-matches-sources` 顺手覆盖——该检查确实存在，但它只在 mirror 存在时才跑（`s1-check-skill-contracts.mjs:81` 的 `else` 分支），因此在本 checkout 里连这条也一起被跳过了。

## 附录 H · 本轮实际执行与未执行

**执行（`OBSERVED`）：** `node --test plugins/active/*/test/*.test.mjs`（66/66）、`node tools/w01/verify-acceptance.mjs`（13/13）、`node tools/w01/probe-containment.mjs`（12/12）、`node tools/w01/s1-check-skill-contracts.mjs`（PASS, mirror SKIPPED）、`git status/ls-tree/diff --no-index --stat`、tempdir 内 dot-segment 探针（MAINT-01）。

**未执行（`NOT VERIFIED` / `DOC`）：** `profile-composition.mjs`（需宿主 `dsh`）；任何真实 `.research` 数据；任何 GUI 挂载；任何出网请求；私有仓 `.agents/skills` 的逐字节比对（仅存在性）。

**未改动：** 除本文件外，未写任何文件；未改 `plugins/` `skills/` `tools/` `docs/`（除本文件）与任何 profile。
