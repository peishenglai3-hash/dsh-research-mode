# W03 · 架构维度差距（gap-arch）

- **基线：** `b5f6c16` / 分支 `w03-reading`；范围 `plugins/active/`（10 bundle / 24 工具）
- **方法：** 只读源码阅读 + 10 份 `package.json` 逐份解析。**未运行**任何测试、未挂载插件、未开 GUI、未访问任何真实 `.research` 数据。证据等级一律为 `READ`（源码可核对），不是 `OBSERVED`（本轮实跑）。
- **改动等级：** C0 = 只改文档/口径；C1 = 单 bundle 内改动，不动磁盘格式；C2 = 跨 bundle 契约或字段语义变更（按 `CONTRIBUTING.md:11-12` 需先写决策）；C3 = 安装面/架构重构。
- **裁决基准：** ①工程纪律保护自由探索 ②让实际科研活动决定工程构型 ③有条件放开、优化基础、删繁就简。

**总判断（一句话）：** 这套系统的切分标准在 bundle 层和 UI 标签层是同一个——**"它读写哪个目录/文件"**，而不是"研究者要完成哪个动作"；代价是一份没有版本、没有归属模块、没有跨 bundle 测试的隐性文件契约，以及 8 处互不通报的"当前项目"判定。

<!-- findings:begin -->

- id: ARCH-01
  dimension: architecture
  claim: |-
    十 bundle 按"交付面 + 目录"切，不按"能力"切，三个可核对的事实：
    (1) 同一能力被切成两个 bundle：notebook 的只读检查在 `research-phase2-notebook`、执行在 `research-phase2-exec`；replay 的计划在 `research-phase2-replay`、执行在 `phase2-exec`；litdb 的写入在 `phase2-litdb`、读取展示在 `research-hub`。能力图与安装图不同形，用户要装两次才拿到一件事。
    (2) 真正共享的是文件布局，不是代码：10 个 bundle 中 7 个硬编码 `.research/projects`（host 是唯一写者；workspace / hub / litdb / notebook / replay / exec 是读者），而"从 cwd 剥出 workspace"的正则 `/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/` 在 5 个文件里逐字复制。
    (3) 没有任何 bundle 依赖另一个（10/10 `package.json` 无 `dependencies`/`peerDependencies`），且 host 的 `exports` 只有 `.` 与 `./package.json`，所以 `researchRoot`/`projectPath` 即使存在也无法被别的 bundle 引用。
    隐性契约确实存在，内容是"路径字面量 + sidecar JSON 形状 + `cwd` 约定"，三者都无版本：唯一带版本号的是归档清单 `FORMAT = 'science/1'`，而真正决定互操作的 `project.json` 与 artifact sidecar 没有 `schemaVersion`。同一份 containment 职责还出现了两套实现（inspect 用 realpath，exec 只用 resolve），且分歧落在更危险的那一侧（可执行）；可利用性未做实测。
  evidence:
    - "plugins/active/research-host/lib/store.js:4-8, 19, 52-65"
    - "plugins/active/research-host/index.js:219-222"
    - "plugins/active/research-phase2-notebook/index.js:9"
    - "plugins/active/research-phase2-replay/index.js:9"
    - "plugins/active/research-phase2-litdb/index.js:11, 19"
    - "plugins/active/research-phase2-exec/index.js:14-16"
    - "plugins/active/research-workspace/client.js:438, 442, 446"
    - "plugins/active/research-hub/client.js:34, 103, 107, 120"
    - "plugins/active/research-host/package.json:5-8"
    - "plugins/active/research-phase2-notebook/lib/inspect.js:16-21 vs plugins/active/research-phase2-exec/index.js:22-32"
    - "CONTRIBUTING.md:41（测试不挂载插件，也没有跨 bundle 契约测试：13 个测试文件无一 import 另一个 bundle）"
  severity: P1
  recommendation: |-
    让布局成为唯一真源并让它可以被引用：在 host 增 `exports: { "./layout": "./lib/layout.js" }`（或独立 `dsh-research-layout` 包），集中导出 `researchRoot/projectPath/projectJsonPath/artifactPaths/reviewPath/litdbDir/FACE_KEYS`；5 处正则与 7 处路径拼接改为调用它；`project.json` 与 sidecar 增 `schemaVersion`；加一个跨 bundle 契约测试（两端 import 同一对象后互读一次）。这一步是 C1（不动既有磁盘数据）。合并 notebook/replay 的检查与执行属于可选的 C2。
  cost: M
  falsifier: |-
    若任一 bundle 通过 import/共享包取得布局（而不是字面量），或改掉布局常量后跨 bundle 读取照旧成功（说明契约是活的而非字面量），本条错。
  mission_principle: 删繁就简

- id: ARCH-02
  dimension: architecture
  claim: |-
    "当前项目"有 8 处独立实现、4 种失败策略（严格 fail-closed / 歧义 fail-closed / fail-open 取任意 / fail-open 并创建），互不通报，0/1/多项目语义也不一致：
    - host 写路径：`projectId` 是工具参数，先读 `project.json` 才动手 → fail-closed；但 `artifact_list`/`review_list` 对不存在的项目返回 `[]`，与"项目存在但没有产物"不可区分；`provenance_get` 只读 sidecar，项目不存在时报的却是 `unknown artifact`。同一个 bundle 内三套。
    - host 的 workspace 不是参数，是从 `cwd` 正则剥出来的。
    - hub：`cwd` 命中 `.research/projects/<id>` 即 `status=explicit`，不再核对该项目是否仍在列表里；0 项目=none，1 项目=selected，多项目=ambiguous 且 `projectId=null`（唯一一处明确做对的 fail-closed）。但 explicit 的幽灵项目会一路渲染成"还没有本地产物"，把失败显示成空。
    - workspace：根本不选项目，选"一个会话"当文件读取通道；该 workspace 下没有任何会话时，整页显示"Host 还没有项目"，即使 `.research/projects/*` 都在。路径比较还无条件转小写，在大小写敏感文件系统上可能匹配到另一个真实存在的目录。
    - exec：`projectId` 只做字符集校验，拼路径不验存在，命令照跑并把不存在的 `projectRoot` 写进结果 → fail-open。
    - litdb：同样不验存在，且 `mkdir -p` 会给拼错的项目造出幽灵目录 → fail-open + 写副作用。
    - notebook / replay：`readFile` / 缺 `project.json` 即抛 → fail-closed。
    另外 hub 的 cwd 正则无条件带 `/i`（注释却说是 Windows），与 workspace 的小写化是同一类"假设大小写不敏感"的隐性前提。
  evidence:
    - "plugins/active/research-host/lib/store.js:163-165（写时校验）, 218-226 与 449-456（list 返回 []）, 239-244（只读 sidecar）"
    - "plugins/active/research-host/index.js:221-222"
    - "plugins/active/research-hub/client.js:47-61, 103-112, 120-133, 163-171"
    - "plugins/active/research-workspace/client.js:119-129, 435-439, 449-457"
    - "plugins/active/research-phase2-exec/index.js:9-17, 96-113"
    - "plugins/active/research-phase2-litdb/index.js:15-23"
    - "plugins/active/research-phase2-notebook/lib/inspect.js:14-22"
    - "plugins/active/research-phase2-replay/lib/plan.js:29-33"
  severity: P1
  recommendation: |-
    把 resolver 收敛到唯一有写权的层（host），产出 `{workspaceRoot, projectId|null, status: explicit|selected|none|ambiguous|missing, projects[]}`，以工具 + Client API 暴露，hub/workspace/phase2 全部消费；exec 与 litdb 必须先解析成功才允许执行/落缓存（禁止用 mkdir 造目录）；list 类工具对不存在的 id 返回带 status 的错误而不是 `[]`；路径比较只在 `win32` 上折叠大小写。C2（跨 bundle 行为契约变更）。
  cost: M
  falsifier: |-
    若已有 bundle 消费统一 resolver，或 list 对错误 id 会报错而非返回空，或 exec/litdb 在项目不存在时会拒绝执行，本条错。
  mission_principle: 证据诚实

- id: ARCH-03
  dimension: architecture
  claim: |-
    七面不是"一种"面：4 面是调用方文本快照（code / execution / messages / literature，任意非空字符串即 available），1 面是缺省自动填充（environment），1 面是写入时按字节算出（reproducibility），1 面是读取时派生（review）。
    读取时派生**没有**破坏"artifact 不可变"：sidecar 只在不存在时写，派生分支不写回，测试还把 sidecar 的 sha256 钉死。被破坏的是"同一 artifact 的同一面只有一种值"——三个消费者读出三种东西：
    (1) `provenance_get` = 6 快照 + 1 派生，并用 `reviewSource`/`reviewSnapshot` 标注来源，调用方**能**分辨；
    (2) hub 完全不派生：只读 `artifacts/*.json`，按 `row.provenance` 数 `status==='available'` 的个数，却在同一屏写"review 面按 reviews/ 读取时派生"——UI 的说明与它自己的数据路径相反；且 provenance tab 只输出"N/7 faces available"，看不到缺哪面、值是什么，所以"证据链"页实际是一个计数器；
    (3) `replay_plan` 是第三种：code/execution/environment 取 sidecar，review 现查 `reviews/` 只取 decision，不标派生。
    还有一处结构性问题：sidecar 里的 review 面记不住真正的复核——`recordReview` 要求 artifact 先存在才能记，所以创建时不可能已有该复核记录，被复核过的 artifact 在 sidecar 里通常仍是 `unavailable`；若调用方当时顺手传了 `review` 字符串，hub 读到的也是那个字符串，而不是 `reviews/` 里的记录。
  evidence:
    - "plugins/active/research-host/lib/store.js:143-147, 189-194, 204-213, 239-287, 306-317"
    - "plugins/active/research-hub/client.js:133, 225-226, 271-280"
    - "plugins/active/research-phase2-replay/lib/plan.js:46-49, 57-64"
    - "plugins/active/research-host/test/reviews.test.mjs:156-178"
    - "docs/EVIDENCE-MODEL.md:28"
  severity: P1
  recommendation: |-
    给每一面加 `{origin: recorded|derived|synthesized, source, readAt}`（把 `reviewSource` 从顶层字段升级为 per-face 字段），environment 缺省时标 `synthesized` 或直接 `unavailable`；hub 的 provenance tab 改为调用与 `research_provenance_get` 相同的读函数（而不是自己扫 sidecar），并渲染逐面状态与值。C1（只改读语义与 UI 读路径，不动磁盘格式）。
  cost: S
  falsifier: |-
    若 hub 的 provenance tab 实际调用了派生逻辑，或能显示逐面细节；或 `getProvenance` 的每个 face 已带来源标记，本条错。
  mission_principle: 证据诚实

- id: ARCH-04
  dimension: architecture
  claim: |-
    slot 的注册边界只对齐了一半。三个注册点本身是干净的：workspace 占 `sidebar.panellist`(id=research, order=30) + `main`(key=research)，hub 占 `sidebar.right.pane.tab`(key=research.hub) + sidebarRightTabs 类型。跨会话/会话内也确实按表面分开：main 页跨会话（遍历所有 workspaceRoot），右栏 tab 会话内（吃 `sessionId` prop）。
    但职责边界在四处漏：
    (1) 跨会话视图寄生在会话内 API 上——跨会话列表要挑"一个会话"当文件通道（先找 cwd==root，找不到就取任意 cwd 在 root 之下的会话），没有会话就整页说"还没有项目"。跨会话的视野由一次会话的存在与否决定。
    (2) 两个入口同名"科研"；litdb 在两处都出现，workspace 是一张纯文案卡（不查库、不可点），hub 才是可搜索的 tab——同一能力一份装饰一份实现。
    (3) 四个 tab 不是四种能力，是三个目录：artifacts 与 provenance 读同一批 sidecar，reviewer 读 `reviews/`，litdb 读 `.litdb/`；provenance 与 artifacts 的差别只有一个计数。切法与 bundle 层同源：按文件系统目录切，不按研究动作切。
    (4) slot 组件拿不到 ctx，hub 用 `window.__researchHubContext` 传服务引用——注册边界不带依赖，靠全局变量补；HMR/多实例下行为未验证。
    结论：单入口 + 四 tab 没有把"跨会话"和"会话内"混进同一个 slot，但把"能力"混成了"目录"，并让跨会话读取寄生于会话。
  evidence:
    - "plugins/active/research-workspace/client.js:23, 123-129, 381-385, 412-414, 435-459, 482"
    - "plugins/active/research-hub/client.js:17-22, 69, 85-86, 133, 137-143, 162, 271-280, 287, 290-297"
    - "plugins/active/research-hub/test/client.test.mjs:9-23（只断言注册，不断言数据路径）"
  severity: P2
  recommendation: |-
    明确"一处索引 + 一处详情"：main 页只做跨会话索引与启动，删掉 litdb 装饰卡；右栏四 tab 收敛为"产物/证据链（同一视图含逐面） + 复核 + 文献库"，或至少让 provenance tab 变成真正的逐面视图；跨会话读取若宿主没有不依赖会话的通道，就在 UI 上明说"至少需要一个会话"，不要把"没有会话"渲染成"没有项目"；用注册时注入的 service 替代 window 全局。C2（UI 结构 + 依赖宿主能力确认）。
  cost: M
  falsifier: |-
    若 hub 的 provenance 与 artifacts 两个 tab 渲染的不是同一批数据，或跨会话读取已有不依赖会话的通道，或四 tab 的数据源各自独立（不是三个目录），本条错。
  mission_principle: 删繁就简

- id: ARCH-05
  dimension: architecture
  claim: |-
    内容身份被当成了全部身份。`id = sha256(bytes)`，payload、sidecar、review 全部以同一个 digest 命名，于是"内容相同""同一次记录""同一份交付的演进"被压成一个键：
    (a) 同字节不同来源被去重，且**静默丢弃第二次的输入**：命中已有 sidecar 就直接返回，第二次的 title/kind/source 名/code/log/environment/literature 全部不落盘。文档只说"不会建第二个 artifact"，没说"新的 provenance 会被丢弃"；测试也只重复了相同 title，没有覆盖"同字节、不同元数据"。
    (b) 后果是 provenance 补不完：artifact 一旦记录，就再也不能补 code/log/environment——而 preset 的 persona 恰恰要求"export .science only after provenance is complete"。先落产物、后找代码这条最自然的路被数据结构堵死。
    (c) 同一来源的多个版本无法表达：schema 里没有 `derivedFrom`/`replaces`/`version`，改一版就是两个互不相干的 artifact，review 也无法跨版本延续。丢的是谱系。
    (d) 内容身份从不复核：没有任何读路径重算 payload 的 sha256（provenance 只读 sidecar，hub/replay 只读字段）；export 把**实际字节**的 sha256 写进清单却从不与 artifact id 比对；import 只验"清单 vs payload"，从不验"清单 vs sidecar.checksum"。所以 payload 被替换后，provenance / export / import 三条路都照常通过。
  evidence:
    - "plugins/active/research-host/lib/store.js:180-187, 195-213, 306-317, 359"
    - "plugins/active/research-host/lib/store.js:528-563, 566-604（export 重算字节哈希，不与 id 比对）"
    - "plugins/active/research-host/lib/store.js:645-655（import 只验清单 vs payload）"
    - "plugins/active/research-host/index.js:78"
    - "docs/EVIDENCE-MODEL.md:13-17"
    - "plugins/active/research-host/test/store.test.mjs:33-39"
    - "plugins/active/research-preset/cordis.patch.yml:14"
    - "plugins/active/research-hub/client.js:271; plugins/active/research-phase2-replay/lib/plan.js:58-59"
  severity: P1
  recommendation: |-
    把 id 与谱系分开：sidecar 增 `origin[]`（每次记录追加 source/title/时间，而不是丢弃）、`derivedFrom`（可选 digest）、`face.recordedAt`（允许 unavailable→available 的单向补全）；read/export 至少校验一次 `sha256(payload) === id`，不匹配就报 `integrity-mismatch` 而不是照常返回。C2（字段语义变化，按 `CONTRIBUTING.md:11-12` 先写决策）。
  cost: L
  falsifier: |-
    若已有路径会重算 payload 哈希并与 artifact id 比对，或 sidecar 已存在 derivedFrom/版本字段，或同字节二次记录会追加而不是丢弃元数据，本条错。
  mission_principle: 能力增长

- id: ARCH-06
  dimension: architecture
  claim: |-
    七面的"意思"只写在文档里，没有写进数据，所以消费方无法执行那个意思：
    - code/execution/messages/literature 接受任意非空字符串，任何字符串都会让该面变成 available；
    - environment 在缺省（undefined/null）时被自动填入 `{platform,arch,node,python}`、reproducibility 由字节直接算出，这两面在缺省路径上不可能 unavailable——7 面里已有 2 面是"默认可用"；再加上 4 面接受任意字符串，"可用"几乎是免费的；
    - 于是"7 面可用数"不是证据强度：hub 拿它当唯一指标，replay 把 code/execution 的 value 直接当步骤证据。
    文档本身是对的（README 明确写了 available 不等于 reproduced / 不等于记录了真实环境），但那是给人和模型读的散文，数据里没有对应字段，代码也没有执行这句警告的入口；`CONTRIBUTING.md` 同样承认测试不挂载插件、看不到 GUI。结果是一个"文档正确、数据无法自证"的架构：人、模型、UI 对同一份 face 各自解释。
  evidence:
    - "plugins/active/research-host/lib/store.js:143-147, 189-194, 204-213"
    - "plugins/active/research-hub/client.js:273, 279"
    - "plugins/active/research-phase2-replay/lib/plan.js:60-62"
    - "README.md:85-92"
    - "docs/EVIDENCE-MODEL.md:33-40"
    - "CONTRIBUTING.md:41"
  severity: P2
  recommendation: |-
    face 增 `origin`(caller|computed|derived) 与 `check`（可复算的 locator：argv+command、环境指纹、message id、DOI），把 `available` 拆成 `recorded` / `verifiable` 两个维度；hub 与 replay 改为按 origin 分组计数，而不是报一个 N/7。C1。
  cost: S
  falsifier: |-
    若 face 结构已带来源/可验证性字段，或 hub/replay 已按 origin 分组呈现，本条错。
  mission_principle: 证据诚实

<!-- findings:end -->

## 未验证（NOT VERIFIED，本轮故意不下结论）

1. `ctx.remote.workspaceFiles.read(path, { offset: 1 })` 的 `offset` 语义（行/字节/是否截断）属于宿主 API，不在本仓。若它是"从第 1 行起且只返回一行"，则 workspace/hub 里对多行 `project.json` 的 `JSON.parse` 会全部失败并被 `catch` 吞掉，页面会永远显示"没有项目"——这会显著改变 ARCH-04 的结论。本轮无法确认。
2. 工具到底按 profile 级还是 agent preset 级装载：本轮拿不到宿主源码（app.asar 未解包，运行时给出的 checkout 路径不存在）。因此**没有**依据"preset 的 plugin 列表里不含 research 工具"作任何断言。
3. 所有结论来自源码阅读，未执行 `node --test`、未挂载插件、未打开 GUI；与 `CONTRIBUTING.md:41` 的边界一致。
