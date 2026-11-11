# W03 · 交互体验缺口（只读诊断）

**范围：** `plugins/active/research-*` 的 client 半（`research-workspace/client.js`、`research-hub/client.js`）+ 它们对应的文档面。
**分支：** `w03-reading` @ `b5f6c16`。**本轮未改动任何源码、profile、skill、`.research` 数据；未安装；未出网。**
**方法：** 源码静态推断，**未打开 GUI**。因此凡是「用户在屏幕上会看到什么」都需要一次真实运行才能定级，逐条标了 `INFERRED` / `NOT VERIFIED`。

## 证据等级

| 标记 | 含义 |
|---|---|
| `OBSERVED` | 在源码里直接读到，附行号 |
| `INFERRED` | 由源码结构推得，未经运行确认 |
| `NOT VERIFIED` | 只能在 GUI 里跑一次才能确认（本轮明确未做） |

## 严重度 / 优先级 / 成本

- **severity** — `high`：直接破坏「留下可复核证据」这个核心承诺，或让用户得出错误结论；`medium`：显著提高放弃概率，但不产生错结论。（同族 `gap-arch.md` / `gap-maint.md` 用 `P1`/`P2`：本文件 `high` ≈ `P1`、`medium` ≈ `P2`，合并时按此归一。）
- **recommendation 前缀 C0–C3** — C0 立刻（承诺已被打破）；C1 本轮；C2 下轮；C3 设计项。
- **cost** — `S` < 0.5 天 / `M` 0.5–2 天 / `L` > 2 天。

## 一句话结论

这套产品的证据模型是诚实的（`docs/EVIDENCE-MODEL.md` 写得比大多数同类工具都清楚），**缺口几乎全部在「诚实的语义没有走到屏幕上」这一步**：同一个 `available` 既代表计算值也代表调用方自述，同一个空态既代表「没有」也代表「读不到」，同一张模板卡既许诺工作流又只改一个字符串。

---

```yaml
- id: UX-01
  dimension: interaction
  claim: |
    「从打开 Harness 到第一条可复核证据」是一条跨面板的剪贴板往返，而且界面上没有任何一步真正创建项目：
    4 张模板卡与「Host-only 创建」按钮都只是把一段提示词写进剪贴板，建项目这件事只能由用户自己切到会话里
    粘贴发送、由 Agent 调工具完成。链条共 15 个步骤（其中「等 Agent 建项目 / 等 Agent 记录产物」是用户不可见的
    往返），即至少 12 个用户动作、跨 2 个面板、1 次剪贴板往返。更具体的两个坑：(a)「Host-only 创建」区的按钮把模板硬编码成
    literature-review，用户在卡面上选的模板不会进入这条路径；(b) 项目名留空时不报错，直接拿占位符文本
    「例如：社会原子化的经验检验」当项目名发出去。
  evidence:
    - >-
      plugins/active/research-workspace/client.js:290-298 — 4 张模板卡的唯一动作是 copyPrompt(template.id)，
      没有工具调用，也没有任何会改磁盘的调用。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:318-324 — 「Host-only 创建」区的按钮是
      copyPrompt('literature-review')，模板写死；:310-316 的输入框只把项目名带进提示词。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:227 — const name = projectName.trim() || tr('projectPlaceholder','')，
      空名回落成占位符文案，:233 仍然提示「指令已复制」。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:38-39 — 复制成功文案要求用户「在 research 会话中发送给 Agent」，
      但此刻用户手上没有 research 会话（那正是链条后面才创建的东西）。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:397 + 438/444 — 注入的只有 remote.workspaceFiles，且只用到
      list/read；两个 client 文件里都不存在任何写 .research 的通道，所以「界面创建项目」在实现上不可能。[OBSERVED]
    - >-
      12 步拆解（打开 → 点左栏「科研」 → 选卡 → 填名 → 复制 → 返回会话 → 粘贴发送 → 等 Agent 建项目 →
      回「科研」 → 等轮询 → 点「用此项目启动」 → 在新会话提需求 → 等 Agent record → 开右栏 tab →
      点「产物」），其中 3 步发生在对话里、界面无进度。[INFERRED，依据为上述代码 + DSH 默认布局]
  severity: high
  recommendation: |
    C1 · 四小改，都不需要新通道：(1) 名称为空时禁用复制并内联报错，去掉占位符兜底；
    (2) 把用户点过的模板带进「Host-only 创建」区，删掉 literature-review 硬编码；
    (3) 复制后把 payload 原地以只读 <pre> 展开——用户不依赖剪贴板权限也能看到自己将要发送什么；
    (4) 文案从「在 research 会话中发送」改成编号的下一步（1 复制 / 2 打开会话 / 3 粘贴发送）。
  cost: S
  falsifier: |
    grep -n "research_project_create|projectPath|writeFile" plugins/active/*/client.js——若命中任何 UI 侧写入或
    工具调用，则「界面不可能创建项目」被推翻。另：若 worker 实际点一次卡后项目文件出现在磁盘上（不经过会话），
    本条的主干即被推翻。[NOT VERIFIED]
  mission_principle: |
    初心二（W03-BASELINE §5）：「让实际科研活动决定工程构型，而不是反过来让工程构型规定科研活动必须是什么样子」。
    现在第一步的形状是由「client 没有写权限」这个工程约束决定的（所以要有剪贴板），不是由研究动作决定的。

- id: UX-02
  dimension: interaction
  claim: |
    「科研」主面板把四种完全不同的状态渲染成同一句假话：「Host 还没有项目」。四态是：工作区里没有任何会话、
    .research 读取被拒、project.json 解析失败、以及真的没有项目。最要命的是第一种：整页依赖「工作区里先有一个
    会话」才能列文件，所以一个全新装上、磁盘上已有项目的机器，看到的是「Host 还没有项目」。读空之后它还会用
    1s×30 的静默轮询继续试，每次重试内部又要先等最多 15s 服务就绪，全程没有 spinner、没有进度、没有原因——
    用户看到的不是「在加载」，而是「这里什么都没有」。
  evidence:
    - >-
      plugins/active/research-workspace/client.js:436-437 — 找不到匹配 cwd 的会话就 continue，
      于是没有任何会话时永远列不出项目，哪怕 .research/projects 下有东西。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:438-439 — listed.ok 为假直接 continue；权限失败与「没有项目」
      在这里已经不可区分。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:444-457 — read 失败 continue，JSON.parse 失败被空 catch 吞掉，
      注释写着「A partial project.json is skipped」；:461-462 整段外层 catch 直接 return []。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:216-219 — 列表为空时 setTimeout(load, 1000) 重试，最多 30 次。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:419-424 — 每次调用先循环 30 次 × 500ms 等 workspace/sessions
      两个 service phase 变成 ready，即单次最多 15s；最坏情况约 30×15s 的静默轮询。[INFERRED]
    - >-
      plugins/active/research-workspace/client.js:346-347 — 空态文案 noHostProjects，是一句陈述，不是状态说明，
      也没有任何按钮。[OBSERVED]
    - >-
      grep 'loading|isLoading|spinner|skeleton' plugins/active/research-workspace/client.js — 无匹配。[OBSERVED]
  severity: high
  recommendation: |
    C1 · 把这一处拆成四态状态机：loading / no-session（提示「先在本工作区建一个会话」+ 建会话按钮）/
    no-project（当前文案）/ read-error（显示原因 + 重试按钮）。loading 用骨架屏代替空态文案；
    轮询上限降到 3 次，超时后显示「读取超时」而不是继续装作没有数据。
  cost: S
  falsifier: |
    grep -n "loading\|spinner\|skeleton" plugins/active/research-workspace/client.js 有命中即推翻「无加载态」。
    在 GUI 里新建一个 workspace、一个会话都不建、同时 .research/projects 下放一个项目：若仍能列出，则
    「无会话即不可见」被推翻。[NOT VERIFIED]
  mission_principle: |
    README 设计原则 2「Unknown is a first-class state: missing evidence is recorded as unavailable, never inferred」。
    把「读不到」渲染成「没有」，正是这条原则在界面层的反例。

- id: UX-03
  dimension: interaction
  claim: |
    用户能看到的唯一可信度数字是右栏的「N/7 faces available」，但这个数字把三种不同强度的信号压成一类：
    (a) 计算得到（checksum）、(b) 调用方自述（code / execution / literature / reviewer / authority）、
    (c) 读时派生（review）。其中 environment 与 reproducibility 两个面对任何 artifact 都自动为真，
    所以真实下限是 2/7 而不是 0/7，分母本身不可解释（还可能因为手写/旧版 sidecar 变成 5/5、0/0）。
    更糟的两点：Hub 根本不派生 review 面（它只读不可变 sidecar），但面板顶部那句说明**声称**它派生；
    而把 available 读成「已验证」的那段警告只写在 docs/EVIDENCE-MODEL.md 与 README，界面里一处都没有
    （无 tooltip、无 title、无图例、无链接）。
  evidence:
    - >-
      plugins/active/research-hub/client.js:279 — `${available}/${faces.length} faces available`；英文短语嵌在
      中文句里，无 gloss。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:271-273 — available = faces.filter(status==='available').length，
      纯字符串统计；faces 来自 row.provenance，即 sidecar JSON 本身，分母随文件而变。[OBSERVED]
    - >-
      plugins/active/research-host/lib/store.js:143-147 — face() 的判定只有一个条件：值非空 → status='available'。
      available 的语义是「有这个字段」，不是「验证过」。[OBSERVED]
    - >-
      plugins/active/research-host/lib/store.js:189-194 与 :209 — environment 缺省自动填
      {platform,arch,node,python}，reproducibility 由 {checksum,bytes,source} 直接算出；两者恒为 available
      （即 baseline B1/B2）。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:224-226 — 说明句称「review 面按 reviews/ 读取时派生」，但 :272 的面
      取自 artifact sidecar，Hub 从不派生；派生逻辑只存在于 store.js:245-277 的 provenance_get。这句文案对它
      所在这块面板是假的。[OBSERVED]
    - >-
      plugins/active/research-host/lib/auth.js:33-36 — RESEARCH_REVIEW_AUTH 默认 off，身份不校验；而
      research-hub/client.js:252 把 row.decision / row.reviewer / row.authority（声明值）与 row.signature
      （可校验的内容完整性）放在同一行、同一颜色渲染。[OBSERVED]
    - >-
      docs/EVIDENCE-MODEL.md:33-48 与 README.md:85-91 已逐条写明 available ≠ reproduced / ≠ verified；
      grep -r "EVIDENCE-MODEL" plugins/ — 无匹配，界面不引用它。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:287 — inject 列表里有 'locale'，apply() 从未使用。[OBSERVED]
  severity: high
  recommendation: |
    C0 · 把「一个数」换成逐面 chip，每个 chip 标出信号种类：computed / declared-by-caller /
    derived-at-read-time / not-recorded；environment 与 reproducibility 固定打「自动填充·未重放」角标；
    把 EVIDENCE-MODEL.md 的四行原文（available ≠ reproduced 等）放进折叠说明或 title；
    reviewer/authority 与 signature 分行，分别标「未验证的身份声明」「已验证的内容完整性」。
    review 面的派生可以直接在前端补：Hub 在 client.js:133 同一作用域里已经同时加载了 artifacts 与 reviews，
    缺的只是一个按 artifactId 的 join，不需要新通道。
  cost: M
  falsifier: |
    在任一 client.js 里找到对 available 的 gloss/tooltip/图例/文档链接，即推翻「界面不解释」；
    在 research-hub/client.js 里找到把 reviews join 回 artifacts 并重算面数的代码，即推翻「Hub 不派生」。
    另：若 README 之外的生产文档要求 RESEARCH_REVIEW_AUTH 设为 virtual/oidc，则 reviewer 身份那条的强度下降
    （但「同一视觉重量」不受影响）。
  mission_principle: |
    docs/EVIDENCE-MODEL.md 收尾句：「as long as the reader knows which fields mean what, which is what this
    document is for」。文档承担了「让读者知道字段含义」的义务，界面把这个义务推回给了没读过文档的人。

- id: UX-04
  dimension: interaction
  claim: |
    四种应当被区分的坏状态在界面上全部退化成「还没有…」，而且都没有下一步按钮：
    (1) sidecar 或 review 文件 JSON 损坏 → 被空 catch 静默丢弃，行直接消失；
    (2) artifact 载荷文件被删或被改动 → 界面完全看不出来，因为列表和 provenance 都只读 .json 侧车，
        没有任何读路径去 stat 或重算 artifacts/<sha256>；
    (3) 读取超时 → 不存在：client 构造了 AbortController 却从不 abort，也没有任何超时；
    (4) 权限/列表失败 → 与「空」合并（见 UX-02）。
    另外侧车缺 checksum 时会回落到 artifact id 再截断显示，一个缺失的哈希看起来和真哈希一模一样。
  evidence:
    - >-
      plugins/active/research-hub/client.js:129 — try { rows.push(JSON.parse(read.value.text)) } catch {}，
      损坏的 review 侧车静默消失；:110-111 对 project.json 同样处理。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:104-113 — listed.ok 为假直接跳过，最终 scope.status='none'，
      于是渲染「还没有研究项目」；:223 的「读取失败: …」只挂在 :150 的 load().catch 上，常见失败走不到那里。[OBSERVED]
    - >-
      plugins/active/research-host/lib/store.js:218-236 — listArtifacts 只读 *.json，跳过非 json；
      :239-287 getProvenance 也只读 artifacts/<id>.json，从不校验载荷是否存在、哈希是否仍等于 id。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:97 与 plugins/active/research-workspace/client.js:432 — 构造
      AbortController 只取 .signal；两个文件里 grep '\.abort\(' 无匹配 → 无超时、无取消。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:271 — checksum = row.checksum?.value ?? row.id，再 slice(0,16)；
      缺失的校验和被显示成 artifact id，与真哈希不可区分。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:162-171 / 183-189 — 每个空态文案都是陈述句，没有一个是动作。[OBSERVED]
    - >-
      plugins/active/research-phase2-replay/lib/plan.js:42-50 — 工具侧其实已经算好了四条 gaps
      （no artifact / no export / environment-code-execution unavailable / no review），但没有任何界面消费它。[OBSERVED]
  severity: high
  recommendation: |
    C1 · (1) 解析失败留痕：统计 skipped 数并显示「N 个文件无法解析」，不要静默；
    (2) 逐行 stat 载荷，缺失时把该行标红并替换掉 checksum 显示（不要把 id 当哈希）；
    (3) 给 workspaceFiles 的读写加 AbortSignal.timeout，把超时渲染成独立状态；
    (4) 把 plan.js:42-50 的四条 gaps 在 client 侧同样算一遍（数据已在作用域里），作为空态下的
    「下一步」清单——这是本仓库唯一会告诉用户「还缺什么」的逻辑，值得搬到脸上。
  cost: M
  falsifier: |
    在 client.js 里 grep 'abort(' 有命中即推翻「无超时」；任一空态分支里出现 button/onClick 即推翻「无动作」；
    store.js 读路径里出现对 artifacts/<sha256> 的 stat 或哈希复核即推翻「载荷缺失不可见」。
  mission_principle: |
    CONTRIBUTING §Claims：「Missing evidence is recorded as unavailable. Do not replace it with a plausible
    guess」。把损坏或不可读的侧车渲染成「还没有」，正是用一个看似合理的猜测替掉了「读不到」这个真事实。

- id: UX-05
  dimension: interaction
  claim: |
    四 tab 的信息架构不成立，并且暗示了代码并不支持的工作流：provenance 不是独立视图，而是同一个 artifacts
    列表外加一行字符串；主面板的「最近会话」「本地文献库」两张卡是静态文案（无数据、无按钮、无入口）；
    4 张研究模板卡没有任何代码分支读取 project.json.template，模板只改变一个显示字符串和 .science manifest
    里的一句描述——卡面文案许诺了机制，机制不存在；左栏项目行只有 name·template 与 cwd，看不到证据进度。
    跨会话与会话内也确实混在一起：右栏 scope 由当前会话 cwd 决定，但渲染出的 artifact 属于整个 project、
    可能来自别的会话，而行里没有 createdAt、没有会话来源，侧车里也根本没有 sessionId 字段。
  evidence:
    - >-
      plugins/active/research-hub/client.js:162 — rows 的选择里 mode==='provenance' 与 'artifacts' 走同一个
      artifacts 分支；:278-280 两者唯一差异是一行字符串。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:17-22 定义四 tab，:213-222 渲染成四个按钮。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:386-389 —「最近会话」只有 h2 + 说明段，没有任何列表
      （而 :397 已经注入了 sessions）；:379-385 的 litdb 卡同样只有两段文字。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:112-117 定义 4 个模板；plugins/active/research-host/lib/store.js:84-106
      只把 template 存进 project.json；全仓 template 的出现都是回显（client.js:358、plan.js:52、store.js:588），
      没有任何分支据此改变行为——即 baseline B4。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:358-359 — 项目行 = `${name} · ${template}` + cwd，
      没有 artifact 数、没有最新复核结论、没有最后活动时间。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:27/166（'Phase 1 · Host-only'）与
      plugins/active/research-hub/client.js:202（'Phase 2'）——相邻两个面板各挂一个不同的阶段徽章。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:47-61 与 :86-103 — 右栏 scope 由当前会话 cwd 解析（歧义时 fail-closed）；
      :274-280 渲染的行没有任何来源字段；store.js:195-213 的侧车只有 id/title/kind/createdAt/checksum/provenance，
      没有 sessionId（归因只能靠调用方自填的 messages 文本）。[OBSERVED]
  severity: medium
  recommendation: |
    C2 · (1) provenance 折叠进 artifacts 行（点开看 7 面），独立 tab 改成真正的「待补证据」队列（复用
    plan.js 的 gaps）；(2) 两张死卡要么接数据要么删——「最近会话」可以直接用已注入的 ctx.sessions 渲染；
    (3) 模板要么删，要么让 store 按模板写不同的目录骨架（现在只是文案承诺了机制）；
    (4) 项目行补 artifact 数与最新复核结论；artifact 行补 createdAt 与来源会话；
    (5) 两个 Phase 徽章合并成一个「当前能力」标签。
  cost: M
  falsifier: |
    在 store.js 或 client.js 里找到任何读 project.json.template 并改变行为的分支，即推翻「模板不驱动任何东西」
    （注意 store.js:588 只是把 template 写进 manifest 描述）。provenance tab 若渲染出 artifacts 之外的任何数据结构，
    即推翻「不是独立视图」。
  mission_principle: |
    初心三（§5）：「有条件地放开 + 批准 + 优化基础 + 删繁就简，为后续第三第四周乃至 release 做好准备」。
    四 tab 与两张死卡属于该删的「繁」，而且它们不是装饰——它们是承诺。

- id: UX-06
  dimension: interaction
  claim: |
    界面上无法知道「我现在能用什么」：24 个工具与 10 个技能在 UI 里零枚举。唯一的自述是右栏 guide 的一行
    description 和 4 张模板卡的文案；工具名只出现在一段被复制的提示词里——用户必须先把提示词贴进输入框，
    才第一次读到 research_science_export 这个名字。没有命令面板、没有斜杠命令、没有任何「能力清单」组件。
    安装完成后最自然的第一个问题（「那我现在能干什么」）只能靠读 README 回答。
  evidence:
    - >-
      plugins/active/research-hub/client.js:291-296 — guide 只有一条 title + description，不是能力清单。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:112-117 — 模板卡标题/描述不点名任何工具；:279-298 卡片里只有
      一个复制按钮。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:50 — 两个 client 文件里唯一出现工具名的地方是 exportPrompt 字符串，
      用户复制后才可见。[OBSERVED]
    - >-
      skills/ 下 10 个 SKILL.md（env-management / evidence-audit / figure-composer / figure-style / litdb /
      literature-review / paper-narrative / research-design / research-reproduction / research-review），
      任何 client.js 都不引用（grep 无匹配）。[OBSERVED]
    - >-
      24 = host 10（index.js:48-210）+ connectors 8（index.js:61-155）+ litdb 2 + notebook 1 + exec 2 + replay 1；
      其中 exec 的 2 个按 docs/INSTALL.md:94-99 默认不进 profile。[OBSERVED]
    - >-
      preset 的 description「Evidence-first research mode with project, artifact, provenance and .science tools」
      会出现在 preset 选择处，但那是一句形容词，不是能力清单。[INFERRED：取决于宿主如何展示 preset]
  severity: medium
  recommendation: |
    C1 · 加一张静态「能力卡」：24 个工具按用途分组（检索 / 记录 / 复核 / 导出 / 只读检查），每组给一条
    可点击的示例提示词；10 个技能同样列名。内容由一个生成脚本从工具注册表产出（仓库里已有
    tools/release/profile-composition.mjs 这种「生成而非手写」的先例，可避免漂移）。
    同时给 research_replay_plan 一个按钮——它是唯一会告诉用户「还缺什么」的工具。
  cost: M
  falsifier: |
    在任一 client.js 里 grep 到工具名枚举（例如包含 'research_' 的数组）或技能清单，即推翻「零枚举」。
    若 DSH 原生界面本身已有工具清单页，本条降级为「未与本研究模式集成」而非「无法知道」。[NOT VERIFIED：本轮未开 GUI]
  mission_principle: |
    初心一（§5）：「科研模式的工程纪律是为了保护自由探索，而不是让自由探索服从工程纪律本身」。
    如果「我能做什么」必须靠读 README 才知道，探索的自由度实际上由文档阅读能力决定。

- id: UX-07
  dimension: interaction
  claim: |
    语言与可访问性在左右两半之间不一致：左半 zh/en 双语齐备，右半 Hub 全部硬编码中文（locale 已注入却从不使用），
    于是英文界面下左页英文、右栏中文；同一个句子里还混排英文短语（faces available）与未翻译的枚举值
    （decisions 原样输出 accept/revise/reject/unknown）。可访问性方面：交互状态只靠颜色表达——错误、提示、
    复核结论、可点击文字全部用同一个 --dsw-alias-brand-primary；tab 没有 role=tablist/aria-selected，
    提示与错误没有 aria-live，读屏用户既不知道哪个 tab 选中，也听不到「复制失败」。
  evidence:
    - >-
      plugins/active/research-workspace/client.js:21-100 — 完整 zh/en DICT；
      plugins/active/research-hub/client.js 全文 25 行含中文、0 处 locale 调用
      （:194/201/204/224-226/244/252/275-280 全是硬编码中文）。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:287 — inject 里有 'locale'，apply() 完全没用；文件里唯一的 'locale'
      字样是 :52 的 localeCompare（无关）。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:252 — `${row.decision ?? 'unknown'}` 直接打印枚举；:279 的
      'faces available' 是中文句里嵌的英文。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:213-222 — tab 按钮无 role/aria-selected/aria-controls；
      对照 :199 与 :236 有 aria-label，说明作者知道这回事但没贯彻到状态。[OBSERVED]
    - >-
      plugins/active/research-hub/client.js:223 与 plugins/active/research-workspace/client.js:326 — 状态文本用
      C.accent（= --dsw-alias-brand-primary），与可点击文字同色；两个文件 grep 'aria-live|role=' 均无匹配。[OBSERVED]
    - >-
      两个文件都用 --dsw-alias-* token，无硬编码色值——问题不在 token 规范，而在语义复用（同一 token 承担
      可点击、提示、错误、复核结论四种含义）。[OBSERVED]
    - >-
      plugins/active/research-workspace/client.js:186-193 — tr() 的 fallback 一律传 ''，缺 key 时渲染空白而不是
      英文兜底；zh/en 之外的界面语言会得到空标签。[INFERRED：取决于 DSH locale 是否回落到 en]
  severity: medium
  recommendation: |
    C1 · Hub 照抄 workspace 的 DICT + ctx.locale.register 模式（locale 已经注入，零新增依赖）；
    decisions 走映射表；错误/成功改用独立的 danger/success token 并加 role="status" + aria-live="polite"；
    tab 加 role="tablist" / aria-selected / aria-controls；tr() 缺 key 时回落英文而不是空串。
  cost: S
  falsifier: |
    在 research-hub/client.js 里找到 locale 调用或 zh/en 字典，即推翻「Hub 无 i18n」；找到 role=/aria-live/
    aria-selected 即推翻对应的可访问性断言。若宿主 token 定义里 --dsw-alias-brand-primary 与某个 danger token
    实际同值（需读宿主 token 表，[NOT VERIFIED]），则「错误与可点击同色」的对比度部分需重算。
  mission_principle: |
    README 开篇：「把科研还给具体的人」。右栏是这套产品唯一的证据阅读面，却只对读中文的人开放。
```
