# W04 · 政治经济学 / 学术出版制度 · v1

> 只裁一条线：**谁付钱、谁被记名、谁有权说"这东西算数"。**
> 不重打已立的主干（认识论=证据语义、HCI=首屏与摩擦、架构=真源与发布拓扑、算法/安全/维护），只在需要交接处引用它们。

## 0. 读法与基线

- **只读。** 源码引用一律来自 `git show HEAD:<path>`，`HEAD = 20a2df7`（分支 `w03-reading`）。**为什么不用工作树**：本轮开工时该 checkout 里有 61 个 `D` 条目（并行作业正在改树），工作区文件不可信、`HEAD` 对象可信。复现一条：`git -C <repo> show HEAD:plugins/active/research-host/lib/store.js`，下文所有 `file:line` 都是 **HEAD 行号**。
- 未出网、未安装、未开 GUI、未运行任何 `research_*` 工具、未碰真实 `.research`、未改代码；除本文件外未写任何文件。
- 证据等级：`OBSERVED`（HEAD 里直接读到）／`DOC`（仓内文档记载）／`INFERRED`（由代码结构推得）／`NOT VERIFIED`（要出网或第二台机器）。
- **不属于本维度**的判断：七条愿景里"自由、开放、探索、通俗、易交互"归 HCI；"人与 AI 共创共享知识"的认识论前提归证据语义维度。我只裁"知识普惠 / 开源共享 / 超越旧制度"这三个词的物质条件——**它们在制度里不是形容词，是成本分担与责任归属**。

---

## 1. 一句话结论

**记录层免费，生产层计价。MIT 保的是你可以 fork 这九个包，不保你有算力把它们跑到同等质量；所以此处的"开源"是形式自由 + 实质依附。证据链把"产物"记成一等公民，把"生产产物的劳动、成本与权利"记成零等公民；于是它能替期刊省掉"获取"的钱，省不掉"认可"的钱——抽成不会被取消，只会换收款人：从订阅费/APC 换成推理费 + 声誉租金。**

三处实证骨点（都不是"执行不力"，是结构）：

1. 六个调用方面里没有一面对应"谁生产的、花了多少"：`code / log / environment / messages / review / literature`（`research-host/index.js:85-90`），模型贡献只能塞进 `code` 或 `log` 的自由文本，不可查询、不可比较。
2. 归档已会说 RO-Crate（`store.js:645-663`），但 `Dataset` 只有 `name / description / hasPart`（`store.js:656-661`）——**恰好省掉了 `author`、`license`、`datePublished`**，即机构库认领一份沉积物时最先问的三项。
3. 认证口子已经留好，但默认关：`RESEARCH_REVIEW_AUTH` 缺省 `off`（`lib/auth.js:34`），`virtual:` 身份 `verified:false`（`auth.js:42-45`），只有 `oidc` 模式产出 `verified:true`（`auth.js:47-62`）——**"接受"在文件里与"我自己接受"同形**，除了多一个 `auth` 小对象（`store.js:380`）。

---

## 2. 破坏（5 条）

### D1 · 抽成搬家：免费的是记录，计价的是生产

- **主张。** 愿景说"发挥 AI 最大的科研赋能 + 知识普惠"，但本仓交付的是**记录普惠**：9 个 MIT 包、无第三方运行时依赖（`CONTRIBUTING.md:38`）、本地文件树。真正稀缺的东西——把一份空白 project 填成一篇能提交的稿子所需的推理——按 token 计价、按供应商合同供给，而这笔支出在证据模型里没有字段。**新制度的抽成比旧制度更难被质询**：期刊抽成至少有一张可核对的价目表（订阅费/APC），模型抽成是私人合同、按次计量，且被"证据优先"的话语正当化为"技术成本"。
- **机制（为什么换收款人划算）。** 旧制度的抽成买三样东西：优先权登记、同行认证、长期保存。MIT + 本地存储把第一样的**获取成本**降到零，却把第一样的**担保**也降到了零（`createdAt` 是本地时钟，`store.js:200`）；第二样默认自签（D3）；第三样只有 tar.gz。省下的钱没有消失，它变成了研究者的推理账单——**并且这张账单不进入证据链**，所以下一代评审无法审计"这篇东西是怎么生产出来的、代价多少"。
- **证据。** 六面清单 `index.js:85-90`；侧车字段 `store.js:195-213`（`id/title/kind/projectId/createdAt/bytes/checksum/source/provenance`，无 producer、无 cost）；`.science` 清单 `store.js:640-644`（`format/project/createdAt/readOnly/files`）；全仓 `git grep -i "model|provider|cost|token"` 在插件源码里只命中 OSF 的 `filter[provider]` 与 litdb 的分词 `tokens`，**零处记录模型或花费** `OBSERVED`；README 的愿景段（`README.md:148-150`）把问题定为"数字不平等、社会原子化、自动化知识生产下的问责"，但工具没有承接"问责"的那一栏 `DOC`。推理计价的现实性 = `NOT VERIFIED`（本轮不出网，未核价目）。
- **falsifier。** 在任一 `artifacts/<sha>.json` 或 `.science` 清单里读到 `producedBy`（模型/provider/effort），且仓库外第三方拿它做过跨模型或跨项目的成本比较；**或**一个完全离线（本地模型）部署在同等质量下跑完同一批 artifact 且成本入账。二者满足其一，本条被削弱。
- **severity.** high。

### D2 · "共享"降级为"可拷贝"：归档不能自带权利

- **主张。** 用户拿到的是一份**法律上无主**的知识包。MIT 覆盖 9 个包（`LICENSE:1-21`），不覆盖任何一份由这些包产出的 artifact；仓内也没有一句默认授权（全仓无"用本工具产出的内容以 X 许可发布"之类表述）。因此 `.science` 交给第三方时，接收方**默认无再分发权**（无声明 ≠ 公共领域）。最该普惠的东西，恰好是唯一没有许可的东西——"locally first 让共享名存实亡"在这里不是比喻：**共享退化为"你自己拷给别人"，而知识普惠需要的是可被机构接收、可被继续分发的公共物。**
- **机制。** 工具自己知道数据条款，却只把它们留在**工具描述**里：World Bank `CC BY 4.0 (attribute World Bank)`（`research-connectors/index.js:63`）、ILO `terms must be reviewed before redistribution`（`:87`）、OSF `each preprint carries its own license`（`:101`）、OpenAlex `metadata is CC0`（`:135`）、Crossref `metadata terms apply`（`:146`）。这些字符串一次也没有进入产物——连接器返回的 `source` 是数据源名，artifact 侧车的 `source` 是**文件名**（`store.js:203`）。结果是：一个"证据优先"的系统，对它自己搬运的材料的**权利来源**没有证据。
- **证据。** 上述五行 `OBSERVED`；`.science` 清单与 RO-Crate 存根无 `license/author`（`store.js:640-661`）；`DOC` 自述"minimal RO-Crate 1.1 description"（`docs/EVIDENCE-MODEL.md:100`）。RO-Crate 1.1 是否确实提供 `author/license/datePublished` 属性 = `NOT VERIFIED`（未对照规范原文）。
- **falsifier。** 清单或 crate 存根里出现 `author|license|datePublished` 任一；或仓内某文件写明产出物的默认许可；**或**第三方收到归档后无需联系作者即可回答"我能否再分发、该署谁的名"。
- **severity.** high。

### D3 · 认证仍在"名字"里：可识别性没有被替代

- **主张。** 旧出版制度最被痛恨的是评审权力，但它至少把权力绑在**可追责的机构**上（署名、编委、ISSN/DOI、可被投诉的主体）。这里权力被解绑到个人声誉：默认 `off`、签名是 unkeyed hash（`docs/EVIDENCE-MODEL.md:52-65`）、`virtual:` 身份明确 `verified:false`（`auth.js:42-45`）。于是"超越旧制度"在最贵的一环（认证）没落地，只在最便宜的一环（获取）落地。**结果是"可识别性"的稀缺性原封不动，只是担保人从期刊变成了你认不认识那个人**——这正好落回本项目自己的问题域（评价装置与可识别性），却是以复现它的方式落回。
- **机制（含最可能的收编路径）。** 因为 `.science` 只需要"可被接收"，最省力的采纳方式是出版社把它当作**补充材料格式**：格式进标准，DOI 与编委不动。那一天"超越"就变成"被吸收"，而抽成一分没少。代码其实已经给反方向留了门（`oidc` 分支校验 `iss/aud/exp/kid`，`auth.js:47-62`；`store.js:380` 把 `auth:{sub,mode,verified}` 写进记录），但门是关着的，且没有 issuer 白名单——`verified:true` 只证明"某个 OIDC 签发者签了"，不证明"这个签发者算数"。
- **证据。** `auth.js:34`（默认 off）、`:42-45`（virtual, verified:false）、`:47-62`（oidc）；`index.js:143-145`（非 off 模式下 `accept` 强制 token）；`store.js:327,352`（`authority` 只是 `author|reviewer|auditor` 三选一的**自述**）；`docs/EVIDENCE-MODEL.md:57-65`（明确写签名不建立身份）`OBSERVED/DOC`。
- **falsifier。** 默认模式变为 `oidc`；或默认配置下 `accept` 必须有可验证第三方身份；或仓内出现 issuer/机构白名单并进入 review 记录与 `research_review_verify` 输出。
- **severity.** high。

### D4 · 公共品的搭便车：agent 规模 × 志愿者基础设施

- **主张。** 连接器 UA 是 `dsh-research-connectors/0.1 (+local research workspace)`（`connectors.js:10`）——**无联络邮箱**；只有 30 s 超时（`:11`），**无缓存、无 `Retry-After` 处理、无调用计数**。"开放"在协议层免费，在运维层不免费：一个人跑一下午的 agent 循环，请求量可以是人类研究者的百倍，成本落在志愿者维护的元数据服务上。一个以普惠为名的工具若把外部性留在公共品上，**就是把普惠的账单转嫁给下一个用户**。
- **机制。** 这不是道德问题而是可持续性问题：公共品被 agent 规模化消费后，最先出现的不是封禁而是**门槛化**（要求 key、要求机构订阅、限制批量），而那正是"知识普惠"要拆的东西。**搭便车的尽头是给自己造墙。**
- **证据。** `connectors.js:10-11,16,26`（UA/超时/headers），全文件无 cache、无 backoff、无计数器 `OBSERVED`；OpenAlex 的 polite pool 是否按 `mailto` 授予 = `NOT VERIFIED`（未取条款原文）。
- **falsifier。** 请求里出现可配置的 `mailto`/联络标识；或实现 429/`Retry-After` 退避；或结果里报告 `cached`／调用次数——三者有其一，且在实际发出的请求中可见。
- **severity.** medium。

### D5 · 单点治理 + 只出版"记录装置"

- **主张。** 公共品的供给者只有一个人：29 个提交、3 个 git 身份实为同一人、无 `funding` 字段、无 `SECURITY.md`/`CODE_OF_CONDUCT`、9 个包挂在个人 npm scope `@peisheng_lai` 下、`repository.url` 指向个人 GitHub。MIT 允许任何云厂商把这 9 个包打进"科研版"，而缺陷报告回到一个人身上。更尖锐的是**能力分层**：`research-phase2-exec` 是 `private:true`、`@local/` scope、且**连 `license` 字段都没有**（`package.json`），理由诚实——它执行代码且无逐工具授权闸（`README.md:137-138`、`docs/REGISTRY-SUBMISSION.md:26`）。其分布后果是：**公众得到的是"记录装置"，作者保留"重放装置"**；而"可复现"恰恰是本项目最想证明的那件事（`docs/EVIDENCE-MODEL.md:46-48` 自认 "There is no replay in this release"）。
- **机制。** 愿景要求"共创共享"，工程约束（零第三方依赖、单人评审、无资金、主干无 CI——`docs/w03/findings/crit-prod.md` PROD-06(a) 已核）把贡献门槛设在只有作者能跨过的高度。这不是抱怨维护者，是指出一种**许可—劳动错配**：许可证把使用成本降到零，同时把维护成本集中到一人，收益（若来）则归最先把它产品化的一方。
- **证据。** `git shortlog -sne HEAD`（18/10/1 三身份）、`rev-list --count HEAD` = 29、全仓无 funding/sponsor `OBSERVED`；exec 的 `package.json` 无 `license`、`private:true` `OBSERVED`；`README.md:137-138`、`REGISTRY-SUBMISSION.md:26` `DOC`。
- **falsifier。** 出现 funding/赞助通道；或 `git shortlog` 里有两个不同 human 身份的实质提交；或 exec 以任何可安装形式公开。
- **severity.** medium。

---

## 3. 理论构型（≤5 条，逐条标冲突点）

**T1 · 坚持：记"生产"，不只记"产物"；但以附键落地，不增第八面。**
证据链现在记下了"字节是什么"，没记"这份字节是怎么来的、谁付的钱"。马克思的读法很直白：物化在 artifact 里的是**活劳动**（人的与模型的），只记物、不记劳动，就是把生产关系从账上抹掉。**冲突（认识论维度）**：对方会坚持"证据只该记可核验的事实；模型自报的成本不可核验，记进去会污染 `available` 的语义，正是我们反对的那种"看起来有证据"。" 我的回答：可核验性不是入场的唯一门槛——`environment` 缺省自动填充已被承认为"有记录 ≠ 实测"（`docs/EVIDENCE-MODEL.md:44-45`），成本同样可以记成 `reported` 并显式标注 `mode`。冲突的落点是**面的纯度**：所以只能用附键（`ledger`），绝不动七面。

**T2 · 放弃："开放许可 = 公共性"。**
MIT 解决的是使用许可，不解决再生产的物质条件（推理费、维护工时、语料获取）。把"开源"当"普惠"是**把分配问题误认成法律问题**——这是本维度最容易被自己人骗过去的一条。**冲突（架构维度）**：对方会说"格式开放 + 零依赖 + 本地优先 = 可迁移，因此已经是公共的"。**冲突（HCI 维度）**：对方会说"普惠 = 第一分钟能用"。两者都必要但不充分：公共性还需要一个**愿意并有能力长期承担运维与认证的第三方角色**，否则公共品没有供给者（D5 就是没有供给者的现场）。

**T3 · 坚持：认证权外挂给可追责的主体，而不是内建为自签。**
`issuer > signature`。**冲突（认识论维度，正面冲突）**：对方会坚持 unkeyed hash 才是对的——"任何 keyed 签名都把信任重新交回机构，而机构正是我们要超越的东西。" 我的回答：超越机构不等于取消追责；`auth:{mode,verified}`（`store.js:380`）已经证明同一份记录能同时容纳两种信任，代码比话语更诚实。真正的分歧是**默认值**（`off` vs `oidc`）和**愿景文本要不要承诺一种部署形态**。
**但我要把自己这条标成高风险**：见 §5 的自我反驳。

**T4 · 放弃："以期刊为唯一对手"。**
对手不是刊号，是**计价的稀缺**。旧制度有三功能：优先权登记、认证、长期保存。工具替代了"获取"（最便宜的一项），另两项没有承接者。理论构型因此应是"三功能分别找承接者"（P3/P4 就是各找一个），而不是"我们比期刊更先进"。**冲突（产品/维护维度）**：对方会说"这是范围蔓延，v0.2 的洞还没补完"。我同意排序——**不要求在 v0.2 做**；只要求在愿景文本里**不宣称已超越**，把"超越"改成"三功能中已完成一项，另两项留空并标注 `unavailable`"。这与本仓自己的证据纪律一致：未知是一等状态。

**T5 · 坚持：reciprocity 是一等设计约束（外部性记账）。**
连接器要有联络标识、退避、缓存、调用预算。这不是礼貌，是把"普惠"从**消费姿态**改成**成员姿态**。**冲突（HCI）**：多一个 mailto 配置就多一步摩擦。**冲突（架构）**：缓存是否成了第二个真源。回答：缓存只在会话内存里，不落盘，结果里显式报 `cached:true`；mailto 只写进请求串，不写进 artifact。

---

## 4. 实践方案（4 个，按重要性排序）

### ★ P1 · 账本附键：让归档自带它自己的两笔账（权利账 + 生产账）

- **形态（文件格式，不新增工具表面）。** artifact 侧车与 `.science` 清单各加一个**附键** `ledger`，不动七面、不改任何既有字段语义（因此不触发"改语义须先写决策"的门，`CONTRIBUTING.md:11-12`）：
  - `ledger.rights = { status: 'available'|'unavailable', license, attribution, sourceTerms, redistribution: 'allowed'|'review'|'unknown' }`，来源：连接器**已有的**条款字符串（`research-connectors/index.js:63,87,101,135,146`）机械带出，用户可覆写；缺省一律 `unavailable`，绝不推断为 free。
  - `ledger.producedBy = { status, model, provider, effort, mode: 'reported'|'absent' }`，`mode` 抄 `environment` 的既有话术：**"有记录 ≠ 实测"**。
  - 导出时**只在该键 `available` 时才**把 `author/license/datePublished` 注入 RO-Crate `Dataset`（`store.js:656-661` 的现场）；缺失就不写，不编。
- **C / cost.** **C1 / M**（≈1–2 天；无迁移、无新工具、旧归档照读）。
- **最小可验证实验（"交接测试"）。** 造 3 个 artifact：① 经连接器取的 World Bank CC-BY 数据；② 本地 litdb 里的一条期刊记录（其 corpus 明确"不得再分发"，`research-phase2-litdb/index.js:49`）；③ 一篇模型写的草稿（无外部来源）。三件导出成一个 `.science`，跑离线校验器 `tools/w04/verify-ledger.mjs`（零依赖，仿 `tools/w03/verify-reading-loop.mjs` 的写法），要求：老归档（v0.1.2 产物）导入后 `rights.status === 'unavailable'` 而非 `free`；③ 的 `producedBy.mode === 'reported'`；② 的 `redistribution === 'review'` 时校验器**拒绝**把 license 写成 CC0。**然后只做一件事**：把归档交给一个不信任你的人，只问两句——"你能再分发吗？该署谁的名？" **他必须不问你就能答**；答不出，这一步就没做成。
- **冲突点。** 认识论维度会担心 `ledger` 稀释七面的语义（回答：附键，且 `unavailable` 是默认，不冒充证据）；产品维度会问"这会不会让首屏更重"（回答：首屏零变化，只在导出与 `provenance_get` 的输出里多一段）。

### P2 · 连接器 reciprocity：联络标识、退避、内存缓存、预算可见

- **形态。** ① `RESEARCH_CONTACT_EMAIL` → OpenAlex/Crossref 请求的 `mailto=`（缺省不填，但**在结果里报 `contact: 'unset'`**，让缺省可见）；② 429/`Retry-After` 退避一次后诚实报错；③ 每次会话的内存缓存（不落盘）；④ 结果带 `{source, cached, terms, calls}`。**C0/C1 · S**（半天）。
- **最小可验证实验。** 用 `test/connectors.test.mjs` 已注入的 `fetchImpl`：断言设置环境变量后 URL 串含 `mailto`；用 429 夹具断言一次重试后报错而非静默；同一查询连发 3 次时第 2、3 次 `cached:true` 且 `fetchImpl` 调用计数为 1。
- **冲突点。** HCI（多一步配置）；架构（缓存是否第二真源 → 只在内存、只读、显式报告）。

### P3 · 认证外挂的**部署形态**（而不是新代码）

- **形态。** ① 仓内加一份手写、离线、可 diff 的 `.research/trust/issuers.json`（`{iss, name, contact, scope}`）；② `research_review_verify` 的**输出**加 `issuer: {iss, trusted: 'true'|'false'|'unknown'}`（加输出键，不改记录格式）；③ `docs/` 补一页"如何用你学校的 IdP 跑 oidc 模式"。**C1（文档+输出键）/ S；若要改工具表面则升 C2 / M**。
- **最小可验证实验。** 用 `test/auth.test.mjs:33` 已有的 OIDC 夹具签一个 token 并 `accept`；然后**换一个人**，只给他仓库 + `issuers.json` + 那份 review 文件，他必须能复现 `verified:true, trusted:true`，**全程不问作者**。
- **冲突点。** 认识论（把信任交回机构）；以及 P3 与 D2 的分配后果——见下。

### P4 · 优先权锚：不用刊号的"先来后到"

- **形态（流程，不是工具）。** 导出 `.science` → 取其 `sha256` → 把它提交到一个**你不掌控的**公开仓库 → 在 `project.json` 里记 `anchor: {kind:'git-commit', repo, commit, committedAt, archiveSha256, strength:'weak'}`；配一个只读校验脚本 `tools/w04/verify-anchor.mjs`：给本地 clone + 锚，重算并报 `anchored:true|false`。**C1 · S**。
- **最小可验证实验。** 两个人各自独立锚定同一份 artifact，先提交者在前；任何第三方离线复算 `archiveSha256` 一致。
- **诚实的限度（必须写进文档，不许写成"已解决优先权"）。** git 提交时间是服务器时钟，**可伪造**；它防的是"重复发明"和"事后改稿"，防不住有决心的剽窃者。所以强度标 `weak`，别写 `verified`——这正是 `CONTRIBUTING.md:45-52` 要求的写法。
- **冲突点。** 架构维度会说"这是把 git 当时间戳权威"（同意，所以标 weak）；D3 那条"认证要机构"在这里反过来了：这道锚刻意**不要**机构。

---

## 5. 这一维度自己的盲区（自我攻击）

1. **我这条线最贵的一刀，可能是错的。** T3/P3 主张把认证挂到机构 IdP 上——但**有 IdP 的是有机构的人**。在一个"双一流有 SSO、地方院校只有微信群"的现实里，OIDC 认证会把已经存在的学术等级**技术化、并写进证据链**。也就是说：我用来救"可识别性"的方案，可能正好是 D2/D1 里我批评的那种**不平等的基础设施化**。这不是修辞上的自我平衡，是方案层面的真实风险；若 P3 落地，必须先答一个问题：**没有 IdP 的人在这套证据链里是什么状态？** 我的当前答案（不改方案，只加一条规则）：`trusted:'unknown'` 必须与 `trusted:'false'` 分开显示，且 `authority:'author'` 的自记录**不得**被 UI 降级为"不算数"——否则这个工具就变成了学位授予办公室的前台。
2. **我没有量过任何东西。** 没有一个 token 数、一次真实账单、一次共享行为的观测。D1/D2 是结构推断（`INFERRED`），不是测量。要把它变成经验工作，最少需要：3 个真实项目 × 推理花费记录 × 1 次真实交接。
3. **不出网 = 三条外部事实未核。** npm 上九包现状（`REGISTRY-SUBMISSION.md:24` 自述 9/9）、OpenAlex polite pool 条款、RO-Crate 1.1 属性名——全部 `NOT VERIFIED`。
4. **"收编"只是路径之一。** D3 说出版社可能把 `.science` 吸收为补充材料格式；反方向同样可能：它根本没人接收，于是"共享"从未发生过——那样 D2 就从"许可缺失"退化为"无人可分享"，我的方案会变成给一座空房子装门锁。

---

## 6. NOT VERIFIED 清单（本文件内）

- npm registry 上九个包的真实版本与可安装性（`DOC` 自述，本轮不出网）。
- 推理的实际计价与"同等质量的本地替代"是否存在（影响 D1 的强度）。
- OpenAlex polite pool 是否按 `mailto` 授予；Crossref/ILO 条款原文。
- RO-Crate 1.1 的 `author/license/datePublished` 属性名与机构库的接收要求。
- 任何 GUI 呈现（`provenance_get`/Hub 是否会显示 `ledger`）——未开 GUI。
- `.research/` 真实数据、真实 `.science` 归档——本轮未读取，全部实验设计都在 tmpdir 内可复现。
