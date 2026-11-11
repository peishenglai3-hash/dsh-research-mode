# W03 · 破坏性 HCI 批判（只读）

**范围：** 右栏 Hub（`research-hub/client.js`）+ 左栏工作台（`research-workspace/client.js`）+ 它们背后的 `research-host/lib/store.js`。
**基线：** `w03-reading` @ `b5f6c16`。**引用时刻：** 2026-11-11T18:39–18:47 +08:00。
**未改动：** 任何源码、profile、skill、`.research` 数据；未安装；未出网；未开 GUI。本文件之外的写操作：无。

## 证据等级

| 标记 | 含义 |
|---|---|
| `OBSERVED` | 源码里直接读到，附行号 |
| `INFERRED` | 由源码结构推得，未经运行确认 |
| `NOT VERIFIED` | 只能在 GUI 里跑一次才确认（本轮未做） |

## 行号约定（重要）

读的过程中工作树被并行提交了三次（`068c181` projectId 的 `.`/`..` 守卫、`8263d23` 读时重算载荷哈希、
`57b6c78` Hub 派生 review 面）。**本文行号以 `57b6c78` 为准**，即读时的 HEAD，可用下列哈希核对：

| 文件 | 行数 | sha256:16 |
|---|---|---|
| `research-hub/client.js` | 316 | `6b3833c04f8e6055`（基线 301 / `b9b28270c703d7c5`） |
| `research-workspace/client.js` | 490 | `419500bff416662c`（未变） |
| `research-host/lib/store.js` | 747 | `6f24109a41a785b5`（基线 728） |

`client.js` 相对基线整体 **+15 行**（`:66` 处插入 `faceSummary`），必要时标 `[b5f6c16:NNN]`。若日后哈希
对不上，用 `git show 57b6c78:plugins/active/research-hub/client.js` 复核，勿按旧行号猜。

### 已被 `8263d23` / `57b6c78` 修掉、本文不再重复主张的

- `faceSummary(row, reviews)` 把 `reviews/` join 回 artifact，分母固定 7（:73-83, :287-295）→ B3 的
  「review 面 Hub 不派生」不成立；`:241` 的说明句与行内数字现在一致。
- 文案从 `${available}/${faces.length} faces available` 改成
  `${available}/${faceTotal} 面有记录（available ≠ 已验证…）`（:293-294）→ 原先中文句里嵌的英文短语没了。
- `getProvenance` 新增 `payloadVerified` / `payloadBytes`，读时重算载荷哈希（`store.js:278-297`）。
- `litdb` / `notebook` / `replay` 三处 `projectId` 补了 `.`/`..` 守卫。

**以下 7 条只保留在「修过之后依然成立」的层面上**——尤其是 `payloadVerified` 已经算出来、却没有任何
界面消费它（HCI-01），这是本轮 HCI 最值得下手的缺口。

## 严重度 / 优先级 / 成本（与 `gap-ux.md` 对齐以便合并）

- **severity** — `high`：让用户得出错误结论，或把「读不到」当成「没有」；`medium`：显著提高放弃概率。
- **recommendation** — `C0` 承诺已被打破 / `C1` 本轮 / `C2` 下轮 / `C3` 设计项。
- **cost** — `S` < 0.5 天 / `M` 0.5–2 天 / `L` > 2 天。

## 一句话结论

这套产品的证据模型是诚实的，**但诚实只走到了工具边界**：`reason`（store 为每一个不可用面写的人话解释）、
`payloadVerified`（刚加上的载荷核对）、`reviewSource`（`derived-from-reviews` / `reviews-unreadable`）
都在 host 侧算好了，右栏一个都不渲染；于是右栏剩下的全部可信度语言就是一个 `/7` 的分数和一个英文单词
`available`——**读者被要求用一个没有刻度、没有来源、没有时间的数字，去承担「信不信」这个判断**。

---

```yaml
- id: HCI-01
  dimension: hci
  claim: |
    先直接回答「界面上有没有把 available 呈现成绿勾/已完成/已验证」：**没有绿勾，没有「已完成」，也没有把
    面数说成「已验证」**——两个 client 里 grep `success|green|✓|已完成` 零命中，唯一的 Icon 是左栏的
    ResearchIcon；工作树新加的那句 `available ≠ 已验证`（:294）反倒是主动否认，方向是对的。
    README 设计原则 2 与 CONTRIBUTING §Claims 被守住了。但守得太省：被删掉的是
    视觉确认，留下的却是一个**看起来像成绩单的分数**。工作树里它是 `6/7 面有记录`，仍是一个无刻度的比例：
    (a) 七个面没有逐面呈现，用户无法知道少的那个是哪个，更不知道「六个都只是有记录」；
    (b) store 为每个不可用面写的那句人话理由（`review has not run`、`producer code was not recorded`、
    `literature anchors were not recorded`）**从未被任何界面渲染**——全系统最该出现在这一刻的文本，被算完就丢了；
    (c) 刚加上的 `payloadVerified`（载荷是否仍等于 id）同样没有 UI 消费；
    (d) 这个数字用 `C.muted`、11.5px 渲染，而装饰性的 `Phase 2` 徽章倒用了 accent 色（:217）。
    结论：用户不会误以为「已验证」，但会误以为「这是个可以横比的完成度」——尤其当他在两个 artifact 之间比较
    `6/7` 与 `7/7`，而其中那 1 面的差别恰好只是「调用方多填了一个自由文本字段」。
  evidence:
    - >-
      research-hub/client.js:73-84 — faceSummary 只返回 {available, total:7, reviewDerived}，
      不返回 face 名、不返回 reason、不返回 payloadVerified。[OBSERVED]
    - >-
      research-hub/client.js:293-294 — 逐行只渲染一个字符串 ${available}/${faceTotal} 面有记录（…），
      样式 color: C.muted、fontSize 11.5px；同一行没有任何 `<details>`/title/图例。[OBSERVED]
    - >-
      research-host/lib/store.js:139-147 — face() 把每个面的语义压成 {status:'unavailable', reason}；
      :205-211 七个面各写一句理由。client 侧 grep `reason` 零命中 → 一次都没被读过。[OBSERVED]
    - >-
      research-host/lib/store.js:278-297 — 工作树新增 payloadVerified/payloadBytes；research-hub/client.js
      全文 grep `payload` 零命中 → Hub 仍只读 sidecar 的 checksum 并 slice(0,16)（:286-295）。[OBSERVED]
    - >-
      research-hub/client.js:217 — 'Phase 2' 徽章 color: C.accent；:241 的说明句与 :293 的数字都是 C.muted。
      强调层级与实际判断价值相反。[OBSERVED]
    - >-
      research-hub/client.js:286 — checksum 取 row.checksum?.value ?? row.id 后 slice(0,16)：缺校验和时显示
      artifact id，肉眼与真哈希不可区分；16 位截断也让人无法手工核对载荷。[OBSERVED]
    - >-
      「6/7 与 7/7 的差别可能只是一个自由文本字段」= code/execution/messages/literature 四面均取自
      input.*（store.js:204-212），任何非空字符串都算 available。[OBSERVED]
  severity: high
  recommendation: |
    C1 · 把「一个分数」换成「七个小格 + 一句人话」：(1) 每个面渲染为 chip，四类信号分色或分符号：
    computed（reproducibility）/ declared-by-caller（code·execution·messages·literature·environment）/
    derived-at-read-time（review）/ not-recorded；不可用面把 store 的 `reason` 原文放进 title 与 chip 文案；
    (2) 单独一行「载荷：已核对 / 缺失 / 内容已变（记录 X 字节，磁盘 Y 字节）」，直接消费 payloadVerified 与
    payloadBytes——数据已经在 host 侧算好，改的只是渲染；(3) 数字提级到与 `Phase 2` 同级的视觉重量，或干脆
    删掉 `Phase 2` 徽章腾位置；(4) checksum 显示改为可复制的完整值（`<code>` + 复制按钮），缺失时显示
    「sidecar 未写校验和」而不是回落成 id。
  cost: M
  falsifier: |
    在任一 client.js 里找到对 ``face.reason`` / `payloadVerified` / `reviewSource` 的渲染（字符串或 props），
    即推翻「host 侧语义未到屏幕」；找到逐面 chip 或 `<details>` 展开即推翻「只有一个分数」；
    在 store.js 里找到「非字符串也判 available」的分支收紧（例如要求结构字段），则「自由文本即可得分」被推翻。
  mission_principle: |
    初心一（W03-BASELINE §5）：「科研模式的工程纪律是为了保护自由探索」。判断一个产物可不可信，是科研
    自由的核心动作；现在它被压缩成一个 11.5px 的次级文本，读者只能凭印象，而这正是纪律反过来规定探索的样子。

- id: HCI-02
  dimension: hci
  claim: |
    界面上唯一**带颜色**的「结论」在复核 tab：`row.decision` 用 `C.accent` 渲染成一个 `<code>`
    （:267）。它比 `/7` 更像绿勾——它是单词（accept / revise / reject），是品牌色，和标题同一行、
    右对齐，正是「判定」的经典版式。问题在于这一行把三种强度完全不同的信号并排：
    (a) `decision` —— 调用方自述，`research_review_auth` 默认 `off`，`verifyReviewerToken` 直接返回 null，
        身份不校验；(b) `Signature` —— 未设密钥的 sha256，只能证明「文件没被随手改」，证明不了身份、
    完整性或正确性；(c) `auth` —— 记录里其实有 `{sub, mode, verified}`（store.js:363），但界面**不渲染它**。
    于是「某人说可以通过」和「签名校验通过」在屏幕上长得一样，而文档里唯一区分它们的那三句
    （EVIDENCE-MODEL.md:57-62）不在界面里。同一 artifact 在复核 tab 里给出 decision，在证据链 tab 里只得到
    「N 面有记录」加一句派生说明（:293-294）；两个 tab 之间没有互链——用户看到「有记录」，却没有路径走到
    「谁、按了什么」。
  evidence:
    - >-
      research-hub/client.js:267 — h('code', { color: C.accent }, row.decision ?? 'unknown')：
      唯一的品牌色结论；:269 同一段文字里并列 Reviewer / Template / Authority（三者都是自述字段）。[OBSERVED]
    - >-
      research-hub/client.js:268-287 — 复核卡渲染 title/decision/Round/Reviewer/Template/Authority/
      Signature/notes/history；**没有** auth.verified、没有 createdAt、没有 artifact 的 checksum 复核结果。[OBSERVED]
    - >-
      research-host/lib/auth.js:33-36 — reviewAuthMode 默认 'off'；:38-40 在 off 模式直接 return null。[OBSERVED]
    - >-
      research-host/lib/store.js:356-366 — entry.auth 仅在 input.identity 存在时写入，内容为
      {sub, mode, verified}；off 模式下该字段整体缺失，界面也不显示它。[OBSERVED]
    - >-
      docs/EVIDENCE-MODEL.md:57-62 — 明确写「An unkeyed hash…does not establish Identity / Completeness /
      Correctness」；grep 该文档名于 plugins/ 无命中，界面不引用。[OBSERVED]
    - >-
      research-hub/client.js:288-295 — 同一 artifact 在证据链 tab 只得到一行面数与一句派生说明，
      与复核 tab 的 decision 无任何交叉引用（没有 artifactId/标题互链、没有「查看复核」）。[OBSERVED]
  severity: high
  recommendation: |
    C1 · 拆成三行、三个中性标签，把颜色留给「不确定」而不是「结论」：
    (1) 「结论（记录者自述）」——decision 用中性 chip，不放 accent；
    (2) 「身份」——row.auth?.verified === true ? '已由 IdP 校验：' + sub : '未校验（记录者自填：' + reviewer + '）'，
       off 模式下必须显式说「本机未启用身份校验」；
    (3) 「签名」——折叠成一行「内容完整性：未设密钥，仅防误改」，链接到 EVIDENCE-MODEL.md:57-62 的那三句；
    (4) 复核卡加 artifactId 短哈希 + createdAt，并从证据链行提供互链。
  cost: S
  falsifier: |
    在 research-hub/client.js 里找到 row.auth 或 verified 的渲染，即推翻 (c)；
    找到 decision 的语义映射表（accept → 已通过 之类）或非 accent 配色，即推翻「唯一品牌色结论」；
    若 RESEARCH_REVIEW_AUTH 在文档推荐配置里被要求设为 oidc，则身份那条降级，但「同一视觉重量」不受影响。
  mission_principle: |
    CONTRIBUTING §Claims：「Do not write "verified", "certified", "reproduced" unless the specific command
    you ran establishes it」。界面没有写 verified，但把未设密钥的哈希和一个可能出自作者本人的单词
    放在同一行、同一视觉层级，等于让读者自己补上那个词。

- id: HCI-03
  dimension: hci
  claim: |
    四种坏状态在右栏退化成同一句话，而且**没有一种能从右栏自己恢复**：
    (1) 没有任何项目 →「还没有研究项目：在会话里让 Agent 创建项目后，这里会出现。」（唯一带下一步的文案，
        但下一步在另一个面板里）；
    (2) 读取被拒/服务未就绪 → 与 (1) 不可区分：`if (!listed.ok) continue` 之后 entries 为空，scope 变
        `none`，于是同样一句「还没有研究项目」；
    (3) sidecar / review 的 JSON 损坏 → `catch {}` 静默丢弃，那一行直接消失，用户看到的是「少了」而不是「坏了」；
    (4) 插件或 `workspaceFiles` 服务缺失 → 显示「未连接会话」（:190）——把**插件没挂上**说成**会话没连上**，
        用户会去反复开会话，而正确的动作是查 profile。
    更硬的两点：`:165` 的 `load().catch` 是唯一的错误出口，但 load 内部每一处失败都被 `if(!ok) continue`
    和空 catch 吞掉，所以「读取失败: …」这行**实际不可达**；而 litdb 索引若缺 `rows`（合法 JSON、旧版或手写
    快照），`:169-176` 的 `litdbIndex.rows.filter` 会在 render 期抛 TypeError，插件侧没有 error boundary。
    四处失败里唯一「看得见」的那个，是让面板崩掉。
  evidence:
    - >-
      research-hub/client.js:187-204 — scopeLabel/emptyText 的完整分支表；只有 status==='none' 与
      'ambiguous' 两句带动作提示，resolved 之后的空态一律是陈述句。[OBSERVED]
    - >-
      research-hub/client.js:118-127 — files.list 失败直接跳过（无计数、无提示），project.json 解析失败
      空 catch；:143-158 三个 read 各自只判 read.ok。[OBSERVED]
    - >-
      research-hub/client.js:165 — load().catch(...) 是唯一 setError 点；:238 渲染「读取失败: …」。[OBSERVED]
    - >-
      research-hub/client.js:189-190 — effective 为 null（含 scope 未加载、服务缺失两种）时显示「未连接会话」。
      [OBSERVED；「插件缺失」落到这条分支的走法为 INFERRED：:139-142 在 !session?.cwd || !files 时 setScope(null)]
    - >-
      research-hub/client.js:169-176 — litdbRows = litdbIndex ? litdbIndex.rows.filter(...).slice(0,50) : ...；
      没有 Array.isArray 守卫，插件里也没有 class boundary / componentDidCatch（grep 零命中）。[OBSERVED]
    - >-
      research-hub/client.js:177-186 — 五个空态字符串全是陈述句；整个面板只有一个按钮组（四 tab）和一个
      「刷新」，没有一个是「下一步」。[OBSERVED]
  severity: high
  recommendation: |
    C1 · 四态状态机 + 收口失败：
    (1) 给 effect 一个 `phase: idle|loading|ready|error|partial`，loading 渲染骨架而不是空态文案
      （现在首帧会闪一次「未连接会话」+「还没有本地产物」，:189-204）；
    (2) 所有 `if(!ok) continue` 改为累加 `failed[]`，ready 时若有失败显示「N 个文件未读到（原因）」条；
    (3) 「未连接会话」拆成三句：插件未加载 / 服务未就绪（可重试）/ 本会话无 cwd；
    (4) 空态一律配一个动作：artifacts 空 → 「复制记录指令」；reviewer 空 → 「复制复核指令」；litdb 空 →
      「说明如何生成索引（research_litdb_snapshot）」；error → 「重试」；
    (5) litdbRows 前加 Array.isArray 守卫 + 一个最小 error boundary，崩溃时显示「右栏渲染失败」而不是白屏。
  cost: M
  falsifier: |
    在 client.js 里 grep `abort(|setTimeout|retry|Array.isArray(litdbIndex.rows)` 有命中即推翻部分主张；
    在任一空态分支里出现 onClick/button 即推翻「无动作」；把 .research/projects 置空并在无会话工作区打开
    右栏——若显示的不是「还没有研究项目」而是错误原因，则 (2) 被推翻。[NOT VERIFIED：未开 GUI]
  mission_principle: |
    README 设计原则 2：「Unknown is a first-class state. Missing evidence is recorded as unavailable,
    never inferred」。把「读不到」渲染成「没有」，就是这条原则在界面层的反例；而 CONTRIBUTING §Claims
    要求「不要用看似合理的猜测替代缺失」，界面上正好做了这件事。

- id: HCI-04
  dimension: hci
  claim: |
    右栏没有时间。effect 的依赖是 `[sessionId, refreshNonce, chosen]`（:167），不轮询、不订阅
    workspaceFiles 变更、不显示「读取于何时」；tab 切换也不重读（mode 只是 state）。后果是两个方向相反的
    错结论，用户无从分辨：(a) 他刚在会话里让 Agent 记了一个 artifact，回右栏没看到 → **「没记上」**
    （然后重跑、或放弃记录）；(b) 他昨天被 reject、今天已修订，右栏如果一直开着，仍显示 reject →
    **「还卡着」**。第三种更糟：MCP/连接器超时在右栏完全不可见——右栏不渲染工具调用状态，超时只出现在
    对话里，右栏安静地保留上一次成功的数据。整个面板连一个「上次读取」的时间戳都没有，于是「陈旧」和
    「当前」在屏幕上完全同形。
  evidence:
    - >-
      research-hub/client.js:167 — useEffect 依赖 [sessionId, refreshNonce, chosen]；全文 grep
      `setInterval|subscribe|onChange|watch` 零命中。[OBSERVED]
    - >-
      research-hub/client.js:211-216 — 唯一的手动重读入口是 10.5px 的「刷新」按钮，无快捷键、无提示刷新会
      清空再读（:103-107 setArtifacts([]) 先清空）。[OBSERVED]
    - >-
      research-hub/client.js:268-287 — 复核卡不渲染 createdAt（store.js:364 有写）；证据链行也不渲染
      createdAt（store.js:195-213 sidecar 有写）。界面上没有一处时间。[OBSERVED]
    - >-
      research-hub/client.js:73-84, :287-295 — 渲染只依赖一次快照；:103-107 读前先 setArtifacts([])，
      刷新期间行会先消失再出现（闪烁即「数据没了」）。[OBSERVED]
    - >-
      右栏不消费任何工具结果（inject 里只有 remote.workspaceFiles / sessions / sidebarRightTabs / locale，
      :302）→ 连接器超时、research_* 调用失败都不会在右栏留下痕迹。[OBSERVED]
  severity: high
  recommendation: |
    C1 · 给面板一个时间基准，并把「旧」画出来：
    (1) 顶部一行「读取于 HH:MM:SS · 手动/自动」，与「刷新」按钮并排；
    (2) 刷新时保留旧行、叠一层 loading（不要先清空），失败时保留旧行 + 黄条「上次读取 HH:MM，本次失败」；
    (3) 若 `remote.workspaceFiles` 或 sessions 提供变更事件，订阅它做 1s 去抖自动重读（仓库里已有 30×1s
      轮询的先例，成本同量级）；没有事件就退化为 15s 轮询 + 「自动」标识；
    (4) 每行补 createdAt（数据已在 sidecar/复核记录里）。
  cost: M
  falsifier: |
    在 client.js 里找到 setInterval/订阅/`读取于` 字样或 createdAt 渲染，即推翻对应断言；
    若 workspaceFiles 在宿主侧本身会推送并触发组件重渲染（需读宿主 client 服务），则「不自动更新」被推翻，
    但「无时间戳」仍独立成立。[NOT VERIFIED]
  mission_principle: |
    README 设计原则 1：「Conversation is a channel that produces artifacts」。右栏是这条通道的观察窗；
    观察窗如果不可信地滞后，用户会把「通道没工作」当成结论——这正是数字不平等里最典型的一种：
    不是没有数据，而是数据的**时态**不可见。

- id: HCI-05
  dimension: hci
  claim: |
    四个 tab 的信息架构仍然不成立，而且把两种不同作用域的证据混在一屏：
    (1) 默认 tab 是 `artifacts`（:85）；而「证据链」不是独立视图——它和 artifacts 共用同一个列表，
    唯一差别是行尾一行字（:288-295）→ 用户点开它期待「链」，得到的是同一个列表换了副标题；
    (2) 跨会话与会话内混在一起：面板的 scope 由**当前会话 cwd** 推出（:47-61, :101-114），但渲染出的
    artifact 属于**整个 project**，可能由另一条会话写入；sidecar 里没有 sessionId 字段
    （store.js:195-213），行内不显示 createdAt，也没有「来源会话」；
    (3) 唯一像「身份」的页脚是 `${tab.kind} · ${tab.title}`（:297），而它注册为
    `kind:'research-hub'`、`title:'科研 / Research'`（:308-310）→ 恒定输出「research-hub · 科研 / Research」，
    是同义反复，占掉了本该写「哪个项目 · 什么时候 · 哪条会话」的位置；
    (4) 「文献库」tab 的名字承诺一座库，实际是一个可能不存在的缓存：没有 index.json 时只显示
    「还没有 litdb 查询缓存或索引。」，从不说明它需要 Agent 先调 `research_litdb_snapshot`。
  evidence:
    - >-
      research-hub/client.js:85 — useState('artifacts') 为默认；:17-22（基线）四 tab 定义。[OBSERVED]
    - >-
      research-hub/client.js:288-295 — provenance 分支 = artifacts 行 + 一行面数字；行结构与
      checksum 分支（:296）除这一行外完全相同。[OBSERVED]
    - >-
      research-hub/client.js:297 — 页脚 `${tab.kind} · ${tab.title}`；:308-310 注册值固定 →
      文本恒定，不携带项目/时间/会话信息。[OBSERVED]
    - >-
      research-host/lib/store.js:195-213 — sidecar 字段：id/title/kind/projectId/createdAt/bytes/
      checksum/source/provenance；**无 sessionId**。[OBSERVED]
    - >-
      research-hub/client.js:184-186 — litdb 空态只说没有缓存或索引，不点名 research_litdb_snapshot；
      :245 的索引头只在已存在时出现。[OBSERVED]
    - >-
      跨会话可见性：scope 来自 session.cwd（:101-114），行数据来自 project 目录全量读取 → 会话 A 的产物
      在会话 B 的右栏一模一样的出现，且没有任何区分标记。[INFERRED，依据为上述两处代码]
  severity: medium
  recommendation: |
    C2 · (1) 把 provenance 折叠进 artifacts 行（点开看七面），腾出的 tab 改成真正的「待补证据」队列；
    (2) 页脚改成 `项目 <id> · 读取于 <时间> · 本会话写入 N / 其他会话 M`（N/M 需要 sidecar 加 sessionId，
      写入路径在 host，属跨包改动）；(3) 行内补 createdAt 与来源会话短 id（无则显示「未记录来源」）；
    (4) litdb 空态改成一句可执行指令 + 一键复制，与工作台里那张 litdb 卡合并成一处。
  cost: M
  falsifier: |
    在 client.js 里找到 provenance 分支渲染出 artifacts 之外的数据结构（例如按面分组、按面过滤），即推翻 (1)；
    页脚渲染出非恒定字符串即推翻 (3)；sidecar 里出现 sessionId 即推翻「无会话归因」。
  mission_principle: |
    初心二（§5）：「让实际科研活动决定工程构型」。用户真正的问题是「这条结论是哪次会话、什么时候、
    谁做的」；现在的构型回答的是「这个项目下有哪些 json 文件」。

- id: HCI-06
  dimension: hci
  claim: |
    「我现在能做什么」在装完之后无解，而且比 24 个工具更严重的是：**10 个 skill 根本不在安装路径里**。
    INSTALL.md 从头到尾没有 skill 一步；十个 bundle 的 package.json `files` 都不含 skills/；工作区/预设
    也没有把 skills/ 挂进任何扫描根（`dsh.profile.bundles` 只有 bundle）。CONTRIBUTING §Skills 要求
    `skills/` 与 `.agents/skills/` 保持逐字节一致，而公开树里 `.agents/skills/` **不存在**（基线 §2 的 mirror
    检查因此 SKIPPED）。于是照文档装完的用户拿到 24 个工具、0 个 skill——README:39 承诺的「the discipline」
    这一层是空的，而 skill 只能靠描述匹配自然语言触发，用户既看不到名字，也没有触发它的词汇。
    同一层面的第二个坑在数据卡：工作台的「本地文献库」卡静态写着「1,560 条中文社科样本库」（workspace
    client.js:54），不管这台机器上有没有那个 db；而右栏索引真正渲染时最多 50 行（:175 slice(0,50)），
    头部却显示 `litdbIndex.count`（:245），1560 与 50 同时出现且没有任何「已截断」提示。
  evidence:
    - >-
      docs/INSTALL.md 全文（142 行）grep `skill` 零命中；README.md:20/39/106 提到 skills 但没有安装步骤；
      plugins/active/*/package.json 的 files 数组全部不含 skills（grep `skills` 于 plugins/*.json 零命中）。[OBSERVED]
    - >-
      CONTRIBUTING.md:53-56 — 要求 skills/ 与 .agents/skills/ 逐字节一致；仓库根目录无 .agents/（README
      的验证命令自述 SKIPPED: no .agents/skills in this checkout，W03-BASELINE §2）。[OBSERVED]
    - >-
      research-preset/cordis.patch.yml — 预设里确实挂了 skill-filesystem 与 tool-skill，即宿主具备能力；
      但仓库不提供把 skills/ 送进扫描根的任何路径。[OBSERVED；具体扫描根未核，NOT VERIFIED]
    - >-
      research-workspace/client.js:53-55 — litdb 卡文案写死「1,560 条中文社科样本库（只读）：三刊 2018–2026」
      与「只读 · 本地 · 可整目录删除」，与 db 是否存在无关（:381-385 只渲染两段静态文字）。[OBSERVED]
    - >-
      research-hub/client.js:175 — .slice(0, 50)；:245 — 头部显示 litdbIndex.count 条。二者之间无
      「显示前 50 条」字样。[OBSERVED]
    - >-
      research-hub/client.js:308-316 — guide 只有一条 title+description（注册在 :308-313），不是能力清单；
      两个 client 里唯一出现工具名的地方是被复制的提示词。[OBSERVED]
  severity: medium
  recommendation: |
    C1 · (1) 加一张静态「能力卡」：24 工具按用途分组（检索/记录/复核/导出/只读检查），每组一句可点击的
      示例提示词；十个 skill 同样列名 + 一行「它管什么」。内容用脚本从工具注册表与 skills/*/SKILL.md 生成，
      避免漂移（仓库已有 tools/release/profile-composition.mjs 这种「生成而非手写」的先例）；
    (2) INSTALL.md 增加一节「Skills 安装」：明确把 skills/<name>/ 放到宿主的扫描目录（并在 CI 里校验
      CONTRIBUTING 要求的双份一致），或把 skills 纳入某个已发布包的 files；
    (3) 工作台的 litdb 卡改成两态：读到索引 →「1,560 条 · 索引于 HH:MM」；未读到 →「未检测到本地库，
      需要 RESEARCH_LITDB_PATH + research_litdb_snapshot」；
    (4) 列表头部显示「显示 50 / 共 N 条」并允许继续加载。
  cost: M
  falsifier: |
    在 INSTALL.md 里找到 skills 安装步骤，或在任一 package.json 的 files 里找到 skills，即推翻「装不上」；
    在 client.js 里 grep 到工具名数组或 skill 名清单，即推翻「零枚举」；工作台 litdb 卡出现条件渲染即推翻 (3)。
  mission_principle: |
    初心一（§5）：「科研模式的工程纪律是为了保护自由探索，而不是让自由探索服从工程纪律本身」。
    如果「我能做什么」只能靠读 README 才知道，也没有一条会告诉你「该先调哪个工具」，那么纪律就变成了
    文档阅读能力的筛选器——这正是本项目的关怀（数字不平等）在自家产品里的复现。

- id: HCI-07
  dimension: hci
  claim: |
    文案与可访问性是两个独立的缺口。文案：中英混排且术语未落地，三处原文——
    (a) `证据链：${artifacts.length} 个 artifact；7 面中 review 面按 reviews/ 读取时派生，其余 6 面来自不可变 sidecar。`（:241）
    (b) `Round: ${row.round ?? 1} · Reviewer: ${row.reviewer || '—'} · Template: ${row.template || 'general'} · Authority: ${row.authority || 'reviewer'}`（:269）
    (c) `本地索引：${litdbIndex.count} 条 · db sha256: ${litdbIndex.dbSha256}`（:245，同一 64 位十六进制也在 :257 再出现一次）
    `artifact` / `sidecar` / `面` / `sha256` 对社科读者都不是自解释词，而 (c) 把一串 64 字符哈希当装饰印在
    11.5px 的说明行里——它既不能点、不能复制、也不对应任何可执行动作，属于「看起来像校验」的装饰。
    可访问性：两个 client 合计只有 **4 处** aria 属性（refresh / litdb 搜索框 / 项目名输入 / 图标 aria-hidden），
    `role=` 与 `aria-live` 各 **0 处**；四个「tab」是一组无 `role="tablist"` 的按钮，选中态只靠颜色
    （:234-235），读屏用户既不知道当前在哪个 tab，也听不到「读取失败」「已复制」这类动态文本
    （:238、workspace :326）。颜色 token 的语义是被复用的：`--dsw-alias-brand-primary` 同时表示
    选中 tab 边框、可点击 chip 边框、错误文本、复核结论、成功/失败提示；更硬的一处是**「已选中」与
    「可点击」在像素级同形**——歧义项目 chip 用 `background: C.hover + 1px accent`（:225），
    选中 tab 用完全相同的两个值（:234-235），于是「我已经选了它」和「你可以点它」无法区分。
  evidence:
    - >-
      research-hub/client.js:241 — 中英混排句原文（artifact / review / sidecar 三处英文词）。[OBSERVED]
    - >-
      research-hub/client.js:269 — Round / Reviewer / Template / Authority 四个英文键 + 未翻译枚举值
      （template 的 general/evidence/reproducibility、authority 的 author/reviewer/auditor 原样输出）。[OBSERVED]
    - >-
      research-hub/client.js:245, :257 — db sha256 全文出现两次，无复制按钮、无「这是什么」。[OBSERVED]
    - >-
      grep 'aria-|role=' 于 plugins/active/*/client.js — 共 4 处：hub:214 aria-label='refresh research hub'、
      hub:251 aria-label='litdb search'、workspace:137 aria-hidden、workspace:314 aria-label=项目名。
      role= / aria-live / aria-selected / tabIndex / `title=` 全部零命中（即全产品没有任何 tooltip 可以承载
      术语解释）；两处 aria-label 是英文，界面其余是中文。[OBSERVED]
    - >-
      research-hub/client.js:225 vs :234-235 — 歧义 chip 与选中 tab 的 background/border 取值完全相同
      （C.hover / 1px C.accent）。[OBSERVED]
    - >-
      research-hub/client.js:238 错误文本 color: C.accent；:217 Phase 2 徽章 color: C.accent；
      :267 decision color: C.accent；workspace/client.js:326 成功与失败提示共用 C.accent。[OBSERVED]
    - >-
      research-hub/client.js:251 — litdb 搜索框只有 placeholder 与英文 aria-label，没有可见标签；
      :241 与 :293 的说明文字都是 `color: C.muted` 的 11–11.5px。[OBSERVED]
  severity: medium
  recommendation: |
    C1 · (1) 词汇表落地：artifact→「产物（artifact）」首次出现加括号原词，sidecar→「侧车文件」，
    面→「面（7 项来源记录）」；枚举值走映射表；sha256 折叠进「详情」并提供复制；
    (2) Hub 接上已注入的 locale（:302 的 inject 里有 'locale'，apply 完全没用），照抄 workspace 的
    DICT + ctx.locale.register 模式，零新增依赖；
    (3) a11y：`role="tablist"` + 每个 tab `role="tab" aria-selected aria-controls`，键盘左右切换；
    动态区域加 `role="status" aria-live="polite"`；错误加 `role="alert"`；两个英文 aria-label 改中文；
    (4) 颜色语义拆分：新增 danger/success token，选中态改用「左侧强调条 + aria-selected」而不是与可点击
    chip 同形；(5) 搜索框补一个可见 `<label>`（placeholder 不算标签）。
  cost: S
  falsifier: |
    在 research-hub/client.js 里找到 locale 调用、role=、aria-live、aria-selected 任一命中，即推翻对应断言；
    在宿主 token 表里若 --dsw-alias-brand-primary 与某个 danger token 实际同值，则「同色」需要重算，但
    「同一 token 承担四种语义」仍成立（需读宿主 token 表，[NOT VERIFIED]）。
  mission_principle: |
    README 收尾：「Built as part of a sociology-of-AI practice… digital inequality, social atomisation, and
    what accountability looks like」。右栏是这套产品唯一的证据阅读面；它只对读中文、能读英文术语、
    且用鼠标的人开放——这是产品自己生产的一小块数字不平等。
```

---

## 附：合并提示

1. **与 `gap-ux.md` 的分工**：UX-01…07 讲的是「链条太长 / 四态坍缩 / 语义没上屏 / 没有能力清单 / i18n」；
   本文只保留在**工作树已修过一遍之后仍然成立**的层面，新增三条不在 `gap-ux` 里的东西：
   `reason` 与 `payloadVerified` 算而未显（HCI-01）、`decision` 是界面唯一品牌色结论（HCI-02）、
   无时间基准导致「陈旧读成坏掉/通过」（HCI-04）。
2. **C1 里最便宜的三刀**（合计 < 1 天，且不需要新通道）：渲染 `reason` 与 `payloadVerified`（HCI-01）、
   复核卡拆身份/签名两行（HCI-02）、加 `role="tablist"` + `aria-live` + 把选中态与可点击 chip 分开（HCI-07）。
3. **需要跨包改动**才成立的两条：sidecar 加 `sessionId`（HCI-05）、skills 纳入安装路径（HCI-06）。
4. 本文所有「用户会看到什么」仍标 `INFERRED` / `NOT VERIFIED`：按 CONTRIBUTING.md:40-43，GUI 不在
   测试覆盖内，本轮也没开 GUI。
