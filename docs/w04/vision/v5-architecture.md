# W04 愿景 · 软件架构 / 本地优先系统

> 只做深，不做广。本维度只回答一个问题：**单机插件要承载"共创共享"，架构上必须先承认什么、放弃什么。**
> 基线：公开仓 HEAD `20a2df7`（分支 `w03-reading`，README 自称 v0.1.2），10 bundle / 24 工具 / 9 个 npm 包 / 7 面 provenance；插件代码按 `git ls-tree` 全量统计 **5101 行** js+mjs。
> **禁网**；只读；本轮不执行任何实验。凡从源码推出而没跑过的标 `CODE`，凡"预期"都写成可执行步骤。
> 与 W03 的 `crit-arch.md` 不重复：那里打的是"现在哪里坏"，这里打的是"v5 若照这个形状长大，会长成什么"。

## 0. 证据等级、两处口径更正、一次现场

| 标记 | 含义 |
|---|---|
| `OBSERVED` | 本轮在当前机器/仓库里直接读到，附路径或行号。工作树会变，代码结论一律取 `git show HEAD:` |
| `CODE` | 从源码结构推出，未执行 |
| `NOT TESTED` | 没有任何实验直接检验 |
| `LIT*` | 凭记忆的既有研究，禁网未核；只当机制假设，不当证据 |

**更正 1（面数）**：代码是 **7 面**。`FACE_KEYS` 七项（`research-host/lib/store.js:27-30`），README 与 `docs/EVIDENCE-MODEL.md:19-29` 也写 7 面；全仓和 W03 文档里我找不到"九面"的依据。若 v5 要写九面，必须在同一节点名第 8、9 面**由谁写**（caller / computed / derived / imported）——否则"九面"就是愿景自己先漂移的第一例。

**更正 2（profile 数）**：任务书写"本机 7 个 profile 各带一套"。本轮开头（22:35 前）实测：带 research 依赖的 4 个（desktop 23 个 research/porting 包、phase1-closure 5、phase2 11、researchtest 3），另有 w01-alpha / w02-alpha / w02-npmtest 三个研究期 profile 在场但未挂 research 包。22:35:28，后六个（phase1-closure、phase2、researchtest、w01-alpha、w02-alpha、w02-npmtest）从磁盘消失，到 22:39:58 未回来；desktop 还在。我不判定是谁删的，只把它当证据：**漂移的终局不是"多一套"，是"无法证明刚才有几套"**。

**一次现场（这条比任何论证都硬）**：22:36 前后，公开仓 `git status` 里 `plugins/` 有 61 个已跟踪文件显示 `D`（工作树大面积清空）；22:39:58 再看，67/67 全部回到工作树，`git status` 干净。**在 git 里的东西自己回来了；不在 git 里的六个 profile 没有回来。** 本轮所有代码结论因此只取自 `git show HEAD:`。

## 1. 判断

**单机插件不是"小一号的云平台"，它是"只有一个写者、靠约定协作的存储"。它已经能记录证据，但还不能承载共创共享：共享的入口是分叉、复核心跳是整文件覆盖、组合的身份是路径。三处单点叠起来，就是本地优先在多人场景的失效面。**

**总闸（全节否证条件）**：若在没有第二处存储的单机上，能做到"两人各写一份 → 合成一份 → 第三人独立验证没人删改过"，则 §1 整段作废，本维度让位给产品维度继续优化。

## 2. 破坏（5 条）

### D1 · 共享的终态是分叉，不是合并

- **机制**（`OBSERVED`+`CODE`）：`importScience` 把 `.science` 解到 `.research/imports/<id>/payload`（`store.js:694,760`），而 `listProjects` 只读 `.research/projects`（`store.js:119`）。24 个工具里没有 merge / join / rebase 任何一个。
- **若为真**：共享一次 = 多一棵树 + 零合并 + 那棵树不进项目列表；导入的 `.science` 只写不读（`readOnly` 是声明，`readOnlyEnforced` 只是探针结果，`store.js:769-794`）。
- **falsifier**：项目 A `research_science_export` → workspace B `research_science_import` → 调 `research_project_list`：预期被导入项目**不出现**；再在 A、B 各对同一 artifact 记一轮 review：预期**没有任何命令**能把两份 history 合成一份。若 list 出现，或存在合并命令，本条推翻。
- **成本**：承认它 0；修它要新算子（P3/P4）。

### D2 · 复核历史是"一叠各自签名的纸"，合并会把它洗成一条假线性史

- **机制**（`OBSERVED`+`CODE`）：`signReview` 只覆盖 artifactId/decision/notes/reviewer/authority/template/auth/createdAt 八个字段（`store.js:329-340`）——**不覆盖前轮签名，也不覆盖 round 号**；`verifyReview` 逐轮独立验签、round 就是数组下标（`store.js:418-436,472-475`）；`recordReview` 读-改-写整个文件（`store.js:354,384,400`）。全部 5101 行里 `lock` / `fsync` / `O_EXCL` / 原子 `rename` 计数为 **0**（`rename` 只出现在一个测试里）。
- **若为真**（三条后果，都静默）：① 两个写者并发/离线各写一轮，后者覆盖前者；② 用 git 把两份 history 并起来，同号 round 变成长度 3 的"合法"历史，`verify` 仍报 `valid:true`；③ 连"谁先谁后"都没被签——重排数组下标即重排轮次，签名照样有效。`limitations` 只承认"删最早轮不可检测"（`store.js:477-481`），没承认重复轮、乱序轮、并出来的轮。
- **falsifier**：造 `history=[r1,r2]` 与 `[r1,r2']`，并成 `[r1,r2,r2']` → `research_review_verify`：预期 `valid:true` 且 `roundCount=3`；再把 r1 挪到末尾：预期仍 `valid:true`。任一预期不成立，本条推翻。
- **要点**：这不是"签名不够强"。加密钥只把纸签得更结实，**签名没有覆盖历史**这件事不会变。
- **成本**：C2，见 P3。

### D3 · "当前项目"不是运行时对象，是被 8 处载体复述的约定

- **机制**（`OBSERVED`）：`projectId` 每次由调用者作工具参数给（`research-host/index.js:80,102,115,129,161,175,188`）。八处载体：① host 的 cwd→root 正则（`index.js:212-223`）；②③④⑤ litdb / notebook / replay / exec 各自**逐字节相同**的正则（`phase2-litdb/index.js:11`、`phase2-notebook/index.js:9`、`phase2-replay/index.js:9`、`phase2-exec/index.js:14`）；⑥ hub 的 `/i` 变体加 `resolveProjectScope`（`hub/client.js:31-60`，多项目时返回 `ambiguous` 让用户选，选择只活在 React state）；⑦ workspace 按 session 反推（`workspace/client.js:436-445`）；⑧ preset 散文（`research-preset/cordis.patch.yml:14-17`："Keep project data under the project's .research/"），其后还有 skills 与 agent 记忆。**10 个 bundle 的 `dependencies` 全部为空**：耦合 100% 在约定里，所以 `package.json` 根本看不见它。
- **若为真**：作用域、授权、漂移检测都无处可挂——任何工具可对任何 `projectId` 生效；会话一死，"我在哪个项目"随之消失；"无逐工具授权"的根不是没做闸，是**闸的粒度（路径）由被校验方提供**。
- **falsifier**：在 cwd = 项目 A 的会话里调 `research_artifact_record(projectId=B)`：预期成功写进 B，无任何 scope 校验。若被拒，本条推翻。

### D4 · 可核查的共享必须有树外锚点；锚点选错就是云平台

- **机制**（`OBSERVED`）：`docs/EVIDENCE-MODEL.md:87-89` 自己写：要检测整体替换，缺的是"攻击者写不到的认证锚——带密钥签名，或复制到别处的 append-only log"。今天没有任何工具产出这两种东西；review 的签名无密钥，唯一的"身份"通道要么是自报的 `virtual:`（`lib/auth.js:42-45`，`verified:false`），要么是联网 OIDC JWKS（`lib/auth.js:47-61`）。
- **若为真**：本地优先的诚实边界是一条定理——**没有第二处存储，就没有可核查的共享**。三种锚：git（本机已有，远端由用户自选）、时间戳服务（云）、物理交接（`.science` + 纸质清单）。选哪个是架构决策，不是实现细节。
- **falsifier**：单树机器上做整体替换（删旧 id、写新 id + 配套 sidecar + review），跑全部 24 个工具：预期**无一报"替换"**（README 已承认，W03-QA §4 复现过）。若某工具能报，本条推翻。
- **立场**：v5 选 git 作锚，且**不许**自己有服务器。任何"同步/协作"功能一旦需要我们的服务端，D4 就变成"我们改名叫云平台"。

### D5 · 漂移的根不是 profile 数量，是"组合"没有内容身份

- **机制**（`OBSERVED`）：bundle 集合只活在 profile 的 `package.json`（名字 + `link:` 路径或版本范围）、`cordis.patch.yml`、`node_modules` 三处，由四类动作各自改写（`dsh plugin add`、plugin_manager、手改、pnpm）。`engines.dsh` 只约束宿主**版本**（`research-host/package.json`：`>=0.2.1-rc.2 <0.3.0`），不约束宿主**补丁内容**——PROFILE-COMPOSITION 自己记着 `dsh-base` 97 行、`dsh-web-app` 99 行 profile 级 patch；client 侧 `dsh.client.inject` 列的三个宿主 client 插件名没有版本约束。同一份代码可以两个包名并存：本机 desktop 的依赖表里同时有 `@local/research-hub`（link）与 `@peisheng_lai/dsh-research-hub@0.1.0`（版本），而捕获下来的组合名单（`dsh.profile.bundles`）只认其中一个——两份名单之间没有任何一致性检查。工具注册冲突被 `catch` 成 `warn`（`research-host/index.js:241-243`）。
- **若为真**：本机此刻无法回答"我这一份到底由什么组成"；22:35 的事实说明它能在两分钟内变成另一个东西，而且**没有人会被通知**。
- **falsifier**：把 `plugins/active/research-host` 临时改名，重启：预期 research 的 10 个工具消失、其余照常、界面上没有错误（只有日志 warn）。若启动直接失败并指名缺失 bundle，本条推翻。
- **根治**：不是同步 7 个 profile，是让组合**可寻址**（P1）。

## 3. 理论构型（5 条原则）

| # | 原则 | 禁止 | 与认识论的冲突 | 与产品的冲突 | 可检验形式 |
|---|---|---|---|---|---|
| T1 | **单一真源 = 单一解析器 + 单一写者**（目录唯一不够） | 禁止第二份 cwd→root 正则、第二份 project id 校验；禁止两处写同一棵树的同一文件 | "真源"若指字节，会话记忆不是真源；若指**判断**，agent 的记忆比磁盘更真——两者会被混为一谈 | 一写者会砍掉"两个会话同时干"的体验；产品会想放宽它 | P2 的 resolver 计数断言（今天 6，目标 1） |
| T2 | **内容寻址只回答"这串字节"；集合与历史要 根哈希 + 树外锚 + 派生边** | 禁止把"payloadVerified"读成"没被换过"；禁止只加面、不加边 | 内容身份是**唯名论身份**：改一个标点就是另一个存在者。没有派生边，"修订"与"替换"在数据上同一形状 | 派生边要让 UI 画树；"一个 artifact 一个 id"的叙事会被打破 | P4 的 replacement 检测；P3 的 fork 检测 |
| T3 | **能力边界显式化**：bundle 声明 {工具, 路径前缀, 是否执行, 是否出网} | 禁止把 `cordis.patch.yml` 当声明——它是**任意宿主配置**；禁止用"未发布"代替"不可执行"（exec 只是没上 npm，桌面上装着） | 声明≠控制；但无声明时，"我们能证明什么"连边界都没有 | 显式声明抬高第三方 bundle 门槛，与"插件即自由扩展"冲突 | 加一个越界工具 → 加载被拒并指名 bundle（今天只会 warn） |
| T4 | **可组合而非可堆叠**：只经 host 服务与布局契约通信；缺依赖要**显式降级** | 禁止 `catch → []`（读不到与没有，在 UI 上是同一个答案）；禁止 prose 引用工具名而不校验它存在 | 静默降级会让"缺失证据"变成"没有证据"，正好违反"unknown 是一等状态" | 降级横幅不好看；产品倾向隐藏它 | preset 装了但 host 缺 → 启动即报"research 工具缺失" |
| T5 | **文件即接口，但布局要版本化** | 禁止在无 `research/2` 双读窗口时改 sidecar 结构；payload 永不迁移，只迁 sidecar | 迁移会改写"记录时的事实"；只迁 sidecar 且保留旧读者，才不篡改历史 | 双读窗口让代码难看一阵 | 旧 sidecar 在新版本里仍可读；新 sidecar 在旧版本里报"未知版本"而非误读 |

**两条最尖的冲突，写开一点：**

- **T2 × 认识论**：内容寻址把"同一论证的第二稿"变成两个不可比的对象。知识论上要的是"谁从谁改出来"（派生边），数据上今天只有"两串字节"。所以 v5 若只把 7 面加到 9 面而不加边，得到的只是**更厚的唯名论**。
- **T3 × 产品**：显式能力声明与"插件即自由扩展"直接冲突；而声明也换不来控制——`confirm=true` 不是同意，README 自己承认。v5 应当把 T3 的目标写成"**可审计**"，不是"可阻止"。

## 4. 实践方案（4 个）

C 分级（本节自用）：**C0** 只加测试/文档；**C1** 局部代码、无 schema 变化；**C2** 新机制/新文件/迁移；**C3** 改发布拓扑或协议。

### P1 · `research.manifest.json`（C1 + 一半 C2；0.5–1 人日）

- **机制**：仓根一个 JSON，逐 bundle 记 `{包名, 版本, 该目录的 tree digest, 工具名[], 面数, layout 版本}`。`tools/verify-manifest.mjs` 用 `git ls-tree` 对 HEAD 重算并比对；CI 一行。第二步（C2 的那一半）在 runtime 做：宿主把实际组合（相当于 dump-config 的产物）与 manifest 比对，**不匹配即 fail-closed**，并在界面指名哪个 bundle 的哪几个文件变了。
- **最小实验**：改 `research-host/lib/store.js` 里一个注释字符 → `node tools/verify-manifest.mjs` 预期红、指名文件；`git checkout` 恢复 → 预期绿。
- **退化风险**：若"加工具/改配置"之后 verify 仍是绿，manifest 就是装饰品——那说明它只哈希了 `package.json` 而不是文件树。

### P2 · 跨 bundle 契约测试（C0；半天）

- **机制**：一个 mjs（不加包、不改发布拓扑），用临时 `.research` 夹具让 host / hub / workspace / litdb / replay 的解析器各报一次 scope，断言三件事：**(a)** 同一 cwd 得到同一 root；**(b)** 解析器数量等于 1（今天 6）；**(c)** 任何新 bundle 必须出现在这个测试里。这是 v5 的**准入条件**，不是可选项。
- **最小实验**：把 hub 的 `/i` 去掉（或把 host 的正则加 `/i`）再跑 → 预期至少一处红。今天红不了，正因为没有这个测试。
- **成本**：一个测试文件 + 一条 README 布局契约声明；不新增 npm 包（当前 9 个包，每加一个都是真实成本）。

### P3 · 复核历史改签名链 + 显式分叉（C2；2–3 人日）

- **机制**：每轮 `signature` 覆盖 `prevSignature`（链），round 不再是下标而是由 `(prevSig)` 决定的拓扑序；同 `prev` 的两个后继 = **fork**，`verify` 报 `fork` 直到 `research_review_merge` 产生一个带双亲的 merge 轮。合并规则写进 `EVIDENCE-MODEL.md`，并明确"merge 轮由谁签"。
- **最小实验**：先在 C0 层写测试——造 `[r1,r2]` 与 `[r1,r2']` 并起来跑 verify，预期**红**（今天预期是绿，所以这个测试当下就红，正好证明 D2）；实现链之后，预期 fork；`merge` 之后预期 valid 且带两个 parent。
- **成本**：`store.js` 约 80 行 + 3 个测试 + 文档一节；无 payload 迁移（旧文件按 legacy 轮报告，不追溯改写）。
- **顺序约束**：P3 之前，产品文案里不许出现"多人/共创/协作"。

### P4 · 集合锚点（C2；1–2 人日）

- **机制**：`research_anchor` 把项目集合的 Merkle root（排序后的 artifact id + 每个 sidecar 的 sha256）追加进 `.research/anchors.jsonl`；用户用 `git commit` 把它带到第二处（自己的远端、另一个盘、一次 U 盘）。`research_anchor_verify` 读 `git log -p -- .research/anchors.jsonl` 里的历史 root 做比对。
- **最小实验**：整体替换后 verify 预期 `replacement-detected` 并给出两个 root；没有 git 仓库时预期 `unanchored`（**不是** `valid`）。
- **成本**：一个工具 + 一个 jsonl 约定 + 一节文档；不引入服务器，不需要网络。
- **代价（要写在承诺里）**：锚点只在"用户真的把它带出去"时成立；没带出去就只是"未锚定"。这不是缺陷，是把 D4 的定理变成可操作的选择。

## 5. 顺序与守卫

- **顺序**：P2（今天，C0）→ P1（本周，C1）→ P4（下一轮，C2）→ P3（下一轮，C2）。P3 落地前，任何"多人协作"文案都是空头；P4 落地前，任何"可核查共享"文案都是空头。
- **与邻维的分工**：对 v2（认识论）只答应一件事——**不做子 artifact，只做集合根锚点**（P4），claim 级账本挂在 artifact 内部、不改 id；对 v6（科学社会学）的优先权诉求，架构上只给"库外锚 + 双锚比对"，不给"谁先"的判断；对 v1（政治经济学）的"低成本证据与高成本证据同权"，本维度只能保证**锚定成本不落在每次记录上**（P4 的代价是"带出去一次"）。
- **本节的守卫**（我不主张的）：不主张"本地优先做不了多人"，只主张**当前形状**下它的共享是分叉；不主张 git 是唯一锚，只主张 v5 必须**选一个并写进承诺**（不选 = 默认 OIDC 联网）；不评价 UI / HCI / 产品取舍（另有维度）；本轮没有跑任何实验，falsifier 全部写成可执行步骤，谁跑谁得结论。
- **给 lead 的现场提醒**：22:35 那次清理，把"证明漂移存在过"的证据一起删掉了。若 v5 要写"根治漂移"，第一句应当是"**证据先于根治**"——先让组合可寻址，再谈收敛到一套。
