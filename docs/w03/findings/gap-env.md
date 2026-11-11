# W03 · 环境适应性诊断（只读轮）
#
# 唯一写入 = 本文件。未改任何 plugins/ skills/ profile/ .github/，未碰 .research 真实数据，未出网，
# 未安装任何东西，未执行 git 写操作。
#
# 基线：冻结 b5f6c16（w03-base）。本轮进行中工作树被并行工作反复前移：HEAD 依次经过
# 068c181 / 8263d23 / 57b6c78，收尾时为 898bf75（"docs: teach the install path"）；README.md 在
# 898bf75 里被重写，行号发生位移。因此本文行号取「收尾时的工作树」，凡引用 README 处同时给出
# 内容锚点；被前几个提交改过的 store.js / hub/client.js / litdb/index.js / notebook/inspect.js /
# replay/plan.js，凡引用均在本轮重新 grep 复核过行号。并行工作的另外四份 findings（crit-hci /
# crit-prod / crit-algo / …）不在我的写入范围，也不参与本文索引。
#
# 证据等级：OBSERVED（本轮命令或读码）/ DOC（仓内文档、或他人已记录且本机不可复跑）/ NOT VERIFIED。
# P 级：P0 不可用或坏数据；P1 主路径在常见环境坏；P2 降级或不可诊断；P3 口径/文案。
# C 级：沿用 gap-func.md:8-15（C0 只改口径，C1 契约文本可机检，C2 单工具/单点改造，C3 跨 bundle 新能力）。
#
# 本轮实跑（命令 → exit）：
#   1. node tools/release/profile-composition.mjs --profile w02-alpha --dsh C:/definitely/not/here/dsh.exe
#      → exit 2；stderr "failed to run ... spawnSync ... ENOENT"（复现 W03-BASELINE.md:43）
#   2. node（内建 FTS5 + tokenize='trigram' 建表并 MATCH '劳动过程'）→ exit 0，sqlite_version=3.51.3；
#      同一库 MATCH '劳动'（2 字）→ 0 行（trigram 需 ≥3 字，与 research_litdb_search 的 LIKE 回落一致）
#   3. node（zlib.zstd* / globalThis.WebSocket / fetch / AbortSignal.timeout 存在性）→ exit 0
#   4. node（execFileSync(node, -e 'console.log; console.error')）→ 返回值仅 "OUT\n"，stderr 不并入
#   5. node（fetch('http://127.0.0.1:45999/x')）→ "TypeError: fetch failed | cause=ECONNREFUSED"，exit 0
#   6. node（解析已装宿主 app.asar 头 + 字节面 grep）→ 213,202,918 B；sidebar*/sandboxPolicy 等名字均命中（见 ENV-03）
#   7. git status / git log → 见上述「基线」；除本文件外没有我的写入
#
# 明确未验证（NOT VERIFIED）：
#   a. Node 22.19 上 node:sqlite 内建 SQLite 是否带 FTS5/trigram（本机只有 v24.15.0）；
#   b. Cordis 在 inject 服务缺失时是否连 apply 都不调用（依据框架语义推断，本仓不可证）；
#   c. MCP toolCallTimeoutMs=60000 的 schema 在仓外，本文只沿用 lead-probes.md:112 的抄录；
#   d. macOS/Linux 上的实际失败形态（本机 Windows，只做静态判定，未跑跨平台）。

- id: ENV-01
  dimension: environment
  claim: >-
    运行时下限有两个口径，且只被一个版本验证：10 个 bundle 都声明 engines.node
    "^22.19.0 || >=24.0.0"（research-host/package.json:19 等），docs/INSTALL.md:9 却写 "Node.js 24+"，
    而仓内唯一的运行时执行点是 .github/workflows/verify.yml:33 的 node-version: '24'；没有任何代码读
    engines.node（npm-preflight.mjs:53 只检查 engines.dsh 是否存在），所以 ^22.19 这条分支既不在 CI、
    也没有安装期提示。载重能力是三个 22.x 线引入的 API：node:sqlite（litdb/query.js:5、
    verify-acceptance.mjs:14）、zlib.zstd*（s1-aba-trial.mjs:14）、全局 WebSocket（cdp.mjs:3,38，注释自称
    "Node 24 ships a global WebSocket"）。本机 v24.15.0 上三者均可用（实跑 2、3），22.19 分支 = NOT VERIFIED。
    真正没被 engines 表达的是 SQLite 编译能力：litdb 的排序/召回依赖 FTS5+trigram（query.js:60-72），
    而 engines 无法声明"你的内建 SQLite 必须带 FTS5"。两者叠加的后果在 ENV-06 的静默降级里结算。
  evidence:
    - "plugins/active/research-host/package.json:19-20；research-hub/package.json:19-20；research-phase2-litdb/package.json:18-19；research-phase2-exec/package.json:9（十个 bundle 同一对 engines）"
    - "docs/INSTALL.md:9 —— 'Node.js 24+ (the bundles use node:sqlite and zlib.zstd*; no third-party runtime deps)'，与 engines 下限 ^22.19 不同调"
    - ".github/workflows/verify.yml:23,33 —— runs-on: windows-latest；node-version: '24'（单值，无矩阵）"
    - "加载点：research-phase2-litdb/lib/query.js:5；tools/w01/verify-acceptance.mjs:14；tools/w01/s1-aba-trial.mjs:14；tools/w01/cdp.mjs:3,38"
    - "OBSERVED：node --input-type=module 内建 FTS5 trigram 建表 + MATCH '劳动过程' → exit 0，sqlite_version=3.51.3；zstd/WebSocket/fetch 存在性 → exit 0"
    - "DOC：npm-preflight.mjs:53 只查 engines.dsh；全仓无 engines.node 的读取点"
  severity: P2
  recommendation: >-
    C1：把声明收成一句可验的话——engines.node 收窄为 ">=24 <25"（或保留区间但在 INSTALL.md 写明
    "只验证 Node 24，22.x 未验证"），并在 litdb 的返回里带 sqlite_version() 与 backend，让"我跑在哪个
    SQLite 上"成为证据而不是猜测。若要做 22.19，就在 CI 加一条 node-version: '22' 的 job（先只跑
    run-tests.mjs），用它换取声明权。
  cost: S
  falsifier: >-
    CI 增加 Node 22.19 job 且 run-tests（66 例）与一次 FTS 检索（backend=fts）全绿，或 engines.node
    收窄为单版本、INSTALL 与之一致 → 本条被推翻/消解。
  mission_principle: >-
    W03-BASELINE §5 初心 3："不必把架构写得太死……有条件地放开"。放开的前提是边界可被检验；
    声明两个主版本却只验一个，等于把未验的那半边写进了发布物。

- id: ENV-02
  dimension: environment
  claim: >-
    "读全文"只有一条外部能力路径（Docling MCP），而它在默认配置下必然超时：MCP client 的
    toolCallTimeoutMs 默认 60000（lead-probes.md:112 的 schema 抄录；P-02 在本会话实测冷启动 >60 s），
    仓内 0 处覆盖（全仓 grep toolCallTimeoutMs → 仅文档命中，0 处代码/配置），也 0 处 docling 调用代码。
    默认 60000 由并行 lead 探针在本机实测（lead-probes.md:38-46：冷启动 >60 s）；
    INSTALL.md:136-137 承认这个超时，但把原因写成"转换本身 15–35 s"，并建议改用 CLI——
    而 CLI 同样在首次转换时联网拉模型（lead-probes.md:55-63：Fetching model … 7.98 s），
    文档没有"首次使用需预热/联网"这一步。于是三层环境风险叠在一条路径上：默认超时、
    首次联网、模型版本不 pin（uv tool install，INSTALL.md:124-127）。失败时产品面只有"这次调用超时"，
    无法区分超时 / 模型未下载 / Docling 崩——而 preset 文本也没有要求 agent 把这种情况报成「解析失败」。
  evidence:
    - "README.md:121（收尾时；898bf75 改写过该文件，行号会再漂）—— reading/parsing 依赖外部 PDF parser 'including its known timeout issue'"
    - "docs/INSTALL.md:119-137 —— 外部可选；:124-127 uv 安装，无 pin、无离线预热；:136-137 'Known issue: a single MCP convert call can exceed the MCP client call timeout (the conversion itself takes 15–35 s)'"
    - "DOC：lead-probes.md:38-46（P-02 默认 60000 → 超时）；lead-probes.md:52-63（P-03 首次转换发生 HuggingFace 拉取 7.98 s）；lead-probes.md:112（toolCallTimeoutMs schema）"
    - "OBSERVED：全仓 Select-String 'toolCallTimeoutMs|docling'（js/mjs/yml/md/json）→ 只命中文档与 profile-composition 快照，0 处运行时配置或代码"
    - "NOT VERIFIED：60000 默认值本身在仓外 MCP client，本仓无法复核；超时后 agent 实际看到的消息文本未在本轮复现"
  severity: P1
  recommendation: >-
    C2：在受控 profile 的 porting-mcp-docling 行显式写 toolCallTimeoutMs（lead-probes.md:115 已给出
    300000 的做法），把"安装 Docling + 预下载模型"写进 INSTALL 的一次性步骤（离线预热），
    并在 preset 里加一句"PDF 解析失败时报 timeout/未预热，不要报成没读到全文"。三处都小，
    但缺任何一处，"读全文"在受控实例里就仍是一句愿望。
  cost: M
  falsifier: >-
    仓内出现 toolCallTimeoutMs 覆盖，或出现第二条不依赖 MCP 的 PDF 抽取路径，或默认配置下
    lead-probes 的 60 s 超时不再复现 → 本条被推翻。
  mission_principle: >-
    §5 初心 2："让实际科研活动决定工程构型"。现在反过来：唯一外部解析器的默认超时决定了一个
    研究活动（读 PDF 全文）能不能发生。

- id: ENV-03
  dimension: environment
  claim: >-
    宿主面对本包是全字面量、无版本断言的：engines.dsh 十个 bundle 同值 ">=0.2.1-rc.2 <0.3.0"
    （research-host/package.json:20 等），当前宿主 0.2.2-rc.1 落在区间内（W03-BASELINE.md:57），但仓内
    没有一处运行时版本检查或契约测试，发布物里也没有 os 限制或"宿主面缺失时怎么办"的降级说明。依赖面包括 host 侧
    inject ['tools','fs','sandboxPolicy']（research-host/index.js:232，其中 sandboxPolicy 只被
    ctx?.sandboxPolicy?.resolve?.() 可选读取——io.js:19，属"必选声明 + 可选使用"）、exec 侧
    ['tools','workingDirectory','sandbox']（phase2-exec/index.js:121，与 host 的 sandboxPolicy 是两套名字），
    以及客户端 7 个服务名（workspace/client.js:397）与 hub 的 6 个（hub/client.js:302）。
    防御只在调用点、且是降级式的：ctx.get?.() / typeof 判断（workspace/client.js:400,403,470,478）；
    而 ctx.sessions.list.getSnapshot() 无守卫（:421,:428），形状一变就被 :461-463 的 catch → [] 吞成
    "0 个项目"，整个 apply 的失败只落 ctx.logger?.warn?.（:483-484）。宿主侧注册失败同样只 warn
    （research-host/index.js:243；connectors/index.js:164-166）。按 Cordis 语义，inject 服务缺失时插件
    根本不 apply，连 warn 都没有（NOT VERIFIED，见标头 b）。本轮对已装 0.2.2-rc.1 的 app.asar
    （213,202,918 B）做字节面 grep：sidebarRightTabs 43 次、sidebar.right.pane.tab 87 次、
    sidebar.panellist 30 次、sandboxPolicy 207 次、workspaceFiles 494 次命中——名字今天还在，
    但"还在"没有被任何东西检查。
  evidence:
    - "plugins/active/research-host/package.json:20；research-hub:20；research-phase2-litdb:19；research-phase2-exec:9（engines.dsh 六处同值）"
    - "research-host/index.js:232,236-238,243 —— inject 含 sandboxPolicy；ioFactory 在 ctx.fs 缺失时回落 undefined；注册失败只 logger?.warn?"
    - "research-host/lib/io.js:19 —— policy 用可选链取 ctx?.sandboxPolicy?.resolve?.(...)（必选声明、可选使用）"
    - "research-phase2-exec/index.js:121 —— inject ['tools','workingDirectory','sandbox']；:14-15 靠 exec.agent/exec.signal 第二参数（工具 execute(args, exec) 的调用约定未在仓内声明）"
    - "research-workspace/client.js:397（inject 7 名）、:421,:428（ctx.sessions.list.getSnapshot 无守卫）、:461-463（catch → []）、:483-484（apply 失败 → warn）"
    - "research-hub/client.js:302（inject 6 名，含 'remote.workspaceFiles'）、:304-312（apply 无 try/catch）"
    - "OBSERVED：node 解析 app.asar 头（headerSize 5,748,124）并做字节 grep，五个宿主名字全部命中；未做挂载验证"
  severity: P2
  recommendation: >-
    C2：把"静默不激活"改成"可见的未加载"——每个 bundle 在 apply 前显式检查宿主面（typeof/ctx.get），
    缺什么就把一条 warn 升级为一次用户可见的「研究模式未加载：缺 X」；把 inject 里未被使用的
    sandboxPolicy 降为可选（或删掉），把 exec 的第二参数约定写进 README/VERIFY；再给 engines.dsh 配一条
    能在 CI 跑的最小版本断言（--dump-config 抓一行版本即可）。
  cost: M
  falsifier: >-
    在宿主重命名 slots / workspaceFiles / sandboxPolicy 之一后插件仍能加载（说明存在更强的兼容层），
    或仓内出现版本断言/契约测试，或注入缺失时用户能看到明确报错 → 本条被削弱或推翻。
  mission_principle: >-
    §5 初心 3："有条件地放开 + 批准 + 优化基础"。静默不激活是"放开"与"批准"之间的空档：
    没有报错，也没有同意。

- id: ENV-04
  dimension: environment
  claim: >-
    平台假设全部押在 Windows 上，而 CI 也只跑 windows-latest（verify.yml:4-5,23），所以"跨平台"既
    没有被声明为边界，也没有被验证。会坏的具体位置（静态判定）：(1) tools/w01/cdp.mjs:11 硬编码
    C:\Program Files\Google\Chrome\...\chrome.exe，mac/Linux 上 spawn 报 ENOENT，但 :16 没有 'error'
    监听，外层只会在 20 s 后抛 "chrome did not expose a page target"（:25-36）——把 ENOENT 伪装成超时；
    (2) research-phase2-exec/index.js:72 直接执行 ['python','cell.py']，多数 Linux 只有 python3，
    失败以 signal:'SPAWN_ERROR' 回在 JSON 里（run.js:38）而不是工具错误；(3) run.js:17-24 的子进程 env 是
    Windows 白名单（PATH/SYSTEMROOT/TEMP/TMP/ELECTRON_RUN_AS_NODE），没有 HOME/TMPDIR/LANG，
    POSIX 上 Python 的 Path.home() 与 locale 行为直接变样；(4) research-workspace/client.js:120 的
    normalizePath 无条件 toLowerCase()，在大小写敏感文件系统上把 /w/A 与 /w/a 当成同一根（:127 前缀匹配
    随之误判）；(5) tools/release/profile-composition.mjs:112-113 的脱敏只认 C:\Users\ 与
    C:\DSH-Projects\，:229-230 的自检也只查这两种，POSIX 绝对路径（/home/x、/Users/x）可以原样落进
    已发布的 docs/PROFILE-COMPOSITION.md，唯一兜底是 HOME basename 正则（:228-230），HOME 未设即失效。
    (6) ACL：`.science` 导入的只读在 Windows 上仍是可写的（README.md:105 自述、B6）——这一条不是
    "换平台会坏"，而是"在 Windows 上本来就没做到"，说明 ACL 属于"声明了但没验"的那类平台假设。
    反例（做对的）：.gitattributes:8 钉 eol=lf、profile-composition.mjs:45-50 按 BOM 处理 PowerShell 的
    UTF-16LE、npm-preflight.mjs:82-84 与 publish-all.mjs:49-51 按 process.platform 分流 ComSpec、
    profile-composition.mjs:53-55 处理 .cmd，说明作者知道这些坑，只是没有覆盖。
  evidence:
    - ".github/workflows/verify.yml:4-5（注释自述 Windows-first）、:23（runs-on: windows-latest）、:33"
    - "tools/w01/cdp.mjs:11,16,25-36 —— 硬编码 Chrome 路径；无 child.on('error')；失败只表现为 20 s 超时"
    - "plugins/active/research-phase2-exec/index.js:72 —— 'python' 字面量；lib/run.js:17-24（env 白名单）、:38（SPAWN_ERROR 形态）、:44（networkIsolated:false 自述）"
    - "plugins/active/research-workspace/client.js:120,127 —— normalizePath 无条件 toLowerCase + startsWith 判定嵌套"
    - "tools/release/profile-composition.mjs:106-115（scrub 只认盘符路径 + DSH-Projects 目录名）、:228-235（自检同样只查 Windows 形态）"
    - "对照：.gitattributes:8（eol=lf）；profile-composition.mjs:48-50（UTF-16LE BOM）；npm-preflight.mjs:82-84；publish-all.mjs:49-51"
    - "ACL：README.md:105 —— '`.science` import read-only is declared, not enforced. On Windows the copied tree is still writable'（DOC，W03-BASELINE.md:101 B6）"
  severity: P2
  recommendation: >-
    C2：加一条 ubuntu-latest job（先只跑 run-tests.mjs / probe-containment.mjs / npm-preflight.mjs，
    红一条修一条），把 cdp.mjs 的 Chrome 路径改成 --chrome 参数或 CHROME_PATH，把 'python' 改成
    process.env.PYTHON ?? (win32 ? 'python' : 'python3')，normalizePath 按 process.platform 决定是否折叠
    大小写，脱敏正则扩到 (^|[\\/])(Users|home)[\\/] 并在 HOME 为空时拒绝生成已发布文档。
  cost: M
  falsifier: >-
    ubuntu-latest 上上述三条命令全绿、且 cdp.mjs 换参数后能在非 Windows 上截图、且 Linux 上
    research_notebook_execute 能找到解释器 → 本条被推翻。
  mission_principle: >-
    §5 初心 2：科研活动不都发生在 Windows。"Windows-first"是此刻的事实，不是可以写进
    engines 与发布物的边界——九个包发布到公共 npm，却没有一个字节说明这一点。

- id: ENV-05
  dimension: environment
  claim: >-
    仓库宣称的验证命令里，有多条依赖"这台机器"而不是依赖仓库，因此"验证过"在不同机器上不是同一个
    命题。(a) profile-composition.mjs 依赖宿主 dsh：本轮实跑 --dsh C:/definitely/not/here/dsh.exe → exit 2，
    stderr "failed to run ... spawnSync ... ENOENT"（与 W03-BASELINE.md:43 一致；源码用 execFileSync
    （:13），Node 的报错文案仍写 spawnSync）。它有 --from（:42-50）但没有受控 dump；而且 live 模式下
    execFileSync 只回 stdout（:55,:57），宿主打在 stderr 的 "skipping profile bundle ..." 永远进不了
    skippedBundles（:88-92 只在 tree 上扫）——组合矩阵会在"Warnings: none"里假装健康。(b) verify-acceptance.mjs
    的 D1 读 ~/.dsh/profiles/w01-alpha/package.json（:209-215），profile 名写死；干净机器上这是 FAIL 而不是
    SKIP，而它恰是"exec 不许进 W01 profile"的唯一检查。(c) s1-aba-trial.mjs 读 ~/.dsh/sessions/*/*/
    session.v4.jsonl.zstd（:137-141），依赖宿主会话存储版本与 zstd 帧格式。(d) normalize-eol.mjs:14 与
    update-manifest.mjs:42 依赖 git；npm-preflight.mjs:82-84、publish-all.mjs:49-51 依赖 npm；cdp.mjs 依赖
    本机 Chrome 与 GUI。CI 跑四条（verify.yml:36-45），其中 npm-preflight 并不在 W03-BASELINE.md:38-43
    记的四条能力验证里；那四条中的 profile-composition 缺席，gap-maint 附录列的第二条 verify-acceptance
    也缺席——于是"自动化"与"被宣称的验证"是两套清单。
  evidence:
    - "OBSERVED：node tools/release/profile-composition.mjs --profile w02-alpha --dsh C:/definitely/not/here/dsh.exe → exit 2（stderr: spawnSync ... ENOENT）"
    - "OBSERVED：node -e execFileSync(node,...) 返回值仅 \"OUT\\n\"；stderr 直接进终端，不并入返回值（exit 0）"
    - "tools/release/profile-composition.mjs:13,44-50,53-62,88-92"
    - "tools/w01/verify-acceptance.mjs:209-215（homedir()/.dsh/profiles/w01-alpha/package.json）；:74-81（自造 ctx 挂载 host+litdb，需仓内两文件同时可 import）"
    - "tools/w01/s1-aba-trial.mjs:137-141（~/.dsh/sessions/**/session.v4.jsonl.zstd）；tools/w01/normalize-eol.mjs:14、update-manifest.mjs:42（git）；tools/release/npm-preflight.mjs:82-84、publish-all.mjs:49-51（npm）；tools/w01/cdp.mjs:11（Chrome）"
    - ".github/workflows/verify.yml:36-45 —— 只跑 run-tests / probe-containment / skill-contracts / npm-preflight"
  severity: P2
  recommendation: >-
    C1：给每条验证命令标 SELF（只依赖仓库）与 HOST（依赖本机宿主/profile/Chrome/npm），README 与
    RUNBOOK 只承诺 SELF 可复现；verify-acceptance 的 D1 在 profile 缺失时改 SKIP 并说明原因，
    profile 路径走 --profile；profile-composition 用 stdio:['ignore','pipe','pipe'] 抓 stderr 再把
    skipped 并进树（或直接要求 --from 并随仓提供一份 dump）。两处都只是十几行，但它们决定"验证"
    这两个字是否可被另一个人重放。
  cost: S
  falsifier: >-
    在无宿主、无 w01-alpha profile、无 Chrome 的容器里跑 verify-acceptance.mjs 仍 exit 0，
    或某个 CI job 里出现了第三条能力验证且为绿 → 本条被推翻。
  mission_principle: >-
    §5 初心 1："工程纪律是为了保护自由探索"。一条只在作者机器上成立的纪律保护不了任何人；
    它只会把"我记得跑过"变成"我不知道它现在还行不行"。

- id: ENV-06
  dimension: environment
  claim: >-
    能力缺失时，这个仓库有三种互不相同的失败模式，其中两种让"拿不到"和"没有"在证据面上同形：
    （一）静默改算法——searchLitdb 的 backend 本来有一条明写的规则（<3 字走 LIKE，query.js:60；
    README.md:35 与工具描述都写了「2 字查询回落」），但 :73-75 的 catch { backend = 'like' } 把规则扩展到
    「任何 FTS 错误也回落」：FTS5 未编译、索引损坏、查询语法错三种原因与「你只输了两个字」共用同一个
    backend 值，不可区分，召回也从 rank 排序退化为子串匹配。（二）只写日志——工具注册失败落 ctx.logger?.warn?.（research-host/
    index.js:243；connectors/index.js:164-166），logger 缺失即完全静默；宿主服务缺失时插件按 Cordis
    语义根本不 apply（NOT VERIFIED）。（三）硬失败但不可行动——8 个 connector 共用一个 30 s 的
    AbortSignal.timeout（connectors.js:11,14-31），无重试、无缓存；断网时用户看到的是
    "TypeError: fetch failed"，不含 URL 或主机（实测 loopback：fetch('http://127.0.0.1:45999/x') →
    TypeError: fetch failed | cause=ECONNREFUSED）。HTTP 错误反而可行动（connectors.js:19 "HTTP 503 from <url>"）。
    本地能力（litdb、nbs_snapshot）断网可用。客户端另一处同形：读宿主项目失败被 catch → []
    吞成空列表（workspace/client.js:461-463），"没有项目"和"读失败"在屏幕上长得一样。
  evidence:
    - "plugins/active/research-phase2-litdb/lib/query.js:60-75 —— backend 由长度决定，FTS 抛错后 catch { backend = 'like' }；:73-74 无原因、无告警"
    - "plugins/active/research-host/index.js:239-245；research-connectors/index.js:158-167 —— ctx.effect(...register) 包 try/catch，失败只 logger?.warn?"
    - "plugins/active/research-connectors/lib/connectors.js:11（TIMEOUT_MS=30_000）、:13-31（requestJson/requestText：ok=false 抛 'HTTP <status> from <url>'，网络错则原样抛 fetch 的 TypeError）"
    - "OBSERVED：fetch('http://127.0.0.1:45999/x') → 'TypeError: fetch failed | cause=ECONNREFUSED'（exit 0，消息无 URL）"
    - "plugins/active/research-workspace/client.js:459-463 —— loadHostProjects 的顶层 catch → return []（:461-462）"
    - "对照（做对的）：tools/release/profile-composition.mjs:94-98 —— 解析到 0 个 bundle 时 exit 3 而不是输出空矩阵"
  severity: P2
  recommendation: >-
    C1：给每条失败路径加"可行动的一行"——connector 错误包成 "<source> unreachable: <url> (<code>)"；
    litdb 降级时返回 {backend, degradedReason}（FTS5 missing / index error / short query 三选一）；
    注册失败累加成一次可见的「研究工具未全部加载：X/Y」；客户端 catch → [] 之前区分 read-failed 与
    empty，并让面板显示"读取失败"而不是 0 个项目。
  cost: S
  falsifier: >-
    断网时 connector 的错误文本已含 URL/主机，或 litdb 在 FTS 失败时返回了显式原因，或注册失败/
    读取失败会进 UI → 本条被推翻。
  mission_principle: >-
    §5 初心 2 与证据模型同一条底线：读不到就说读不到。静默降级让"没有数据"和"拿不到数据"
    共用同一个返回值，这正好是这套证据面最不允许的事。
