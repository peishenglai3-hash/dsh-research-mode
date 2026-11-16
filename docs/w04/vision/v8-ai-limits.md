# v8 · AI 能力边界与评测：量具本身

**维度：** AI 能力边界 / 评测。只做深，不做广。
**与兄弟文件的分工：** v1 生产/权利，v2 证据语义，v3 人的认知，v4 交互（它把本文的 warrant 词表当作 M3 的数据基础），v5 架构（复核历史的分叉），v6 承认的社会学，v7 公平（无遥测的盲区）。本文只管一件事：**拿什么去测"AI 能不能做这件事"，以及这个量具现在测到了什么。**
**基线：** `HEAD = 20a2df7`（分支 `w03-reading`）。源码引用一律用 `git show HEAD:<path>`，行号为 HEAD 行号；工作树有并行删除（`git status` 大量 `D`，见 v1 §0），不可作为引用来源。
**方法：** 只读、未联网、未运行任何 `research_*` 工具、未改代码；唯一写入是本文件。
**证据标记：** `[OBSERVED]` 直接读到 / `[INFERRED]` 由结构推得 / `[NOT VERIFIED]` 需跑一次才知道。

## 0. 一句话

这套产品的证据层是**成功者的档案馆**：只有被显式记录下来的成功才存在，失败不留档、会话不入证、判据不存在。因此它能报"记了多少"，报不出"失败率"，更报不出"读得对不对"。评测缺的不是一个更大的分数，而是**三个现在根本不存在的数据点**：失败的次数、真实尺度下的耗时、以及一次"读错了"的样本。

## 1. 破坏（5 条）

### E1 · 幸存者偏差：失败不产生 artifact，所以证据库只统计成功 [P1]

[OBSERVED] artifact 只有两条写入路径——显式记录（`research_artifact_record`）与归档导入（`research_science_import`），没有"尝试/失败"入库路径（`README.md:41-51` 的布局里只有 `project.json`、`artifacts/`、`reviews/`、`exports/`，没有 log/attempt 目录）。Docling 超时（`docs/w03/findings/lead-probes.md:38-46`）返回一个错误字符串，然后什么都不剩。
[OBSERVED] `messages` 面在两个真实 artifact 上都是 `status:"unavailable"`，`reason:"session message anchor was not recorded"`（私有仓 `projects/it-looks-complete/` 的两份 sidecar）。所以连"发生过什么"的会话也不在证据里。
**机制：** 存档单位是"成功产出"，丢失单位是"尝试"。任何从 artifact store 里算出来的比率（覆盖率、复核率、artifact 数）分母都只含成功者。这不是数据脏，是**抽样框错了**：它测的是"记录行为"的频率，不是"能力"的频率。v7 T4 已把同一句话用在公平侧（无遥测 → 看不见"被谁放弃"）；推到能力侧就是：**也看不见"哪一步失败过"**。
**falsifier：** 找到任一条自动捕获失败尝试的路径（宿主日志落盘、attempt artifact、失败的 tool call 进 `messages` 面）。预期找不到；若找到，本条削弱为"未接上"。

### E2 · 唯一的外部效度数字来自 1,486 B 夹具，真实输入大 60 倍 [P1]

[OBSERVED] 同一个 1,486 B 的两页合成 PDF，两次转换 115.2 s / 316.6 s（`from_cache=false`），initialize 15.2/15.9 s；`toolCallTimeoutMs` 默认 60000，产品内默认路径是 `Request timed out`（`lead-probes.md:38-46,119-137`）。方差 2.75×，n=2。
[OBSERVED] 真实输入量级：`it-looks-complete` 的论文抽取 88,984 B，是夹具的 60 倍。仓库里没有第二个规模点的计时。
**机制：** 耗时由进程冷启动+模型加载主导、不由文档大小主导，所以"夹具通过"不能外推到"论文可读"；2.75× 方差说明通过的是某个尾部分位，不是稳定能力。夹具与真实输入在**尺寸、页映射、语言混排、版式**四个轴上都不同分布——而"阅读能力"恰好定义在这四个轴上。
**falsifier：** 真实 50–100 页论文、默认配置、产品内读一遍 < 60 s 且给出页级定位 → 本条推翻（产品更好）。若失败，记下失败形态，这就是 P3 的第一条种子。

### E3 · 复核记录作为量具：分母缺 4/6，分子会随轮次漂移 [P1]

[OBSERVED] `it-looks-complete` 的复核 6 轮，只有第 5、6 轮带 `signature`（2/6），前 4 轮连 `artifactId` 都没有；`verify` 的语义只是"签名轮的字段仍与签名一致"（`docs/EVIDENCE-MODEL.md:52-65`）。
[OBSERVED] 最关键的两句限定都在**未签名**轮：第 1 轮 `"DOCX extract verified; citation verification deferred."`，第 3 轮 `"accept extract for reading use."`（自设作用域）。顶层镜像只保留最后一轮（`skills/research-review/SKILL.md`），第 6 轮 `notes` 是 `"Phase 2 full-flow acceptance; signed review"`——**不带任何限定**。
[OBSERVED] `docs/w03/W03-QA.md:95-100`：`getProvenance` 从不校验 review 签名，可以把 `verifyReview` 判为 invalid 的记录报成 `available / accept`。
**机制：** 从这条记录能算出的任何指标——"复核通过率""几轮 accept""valid 比例"——分母都缺 4/6，分子是"最后一轮恰好没写限定"的那一轮。这不是造假，是指标没定义；一旦它被当 KPI，最省的策略就是少写字。（v2 EPI-03 说"复核不是反驳通道"，v5 D2 说它是"一叠各自签名的纸"；本文补的是第三句：**它作为量具，读数不稳**。）
**falsifier：** `research_review_verify` 把 legacy 轮标为 unverifiable，且顶层面携带 `scope[]`/`openConditions[]`；或第 1 轮起全签名。做到任一条，本条削弱。

### E4 · 没有金标准：能测"读没读"，测不了"读得对不对" [P1]

[OBSERVED] 七个面里没有任何字段记录"笔记相对源文的覆盖/忠实度"；`reproducibility` 只是 checksum，`execution` 是调用方自由文本（`EVIDENCE-MODEL.md:21-40`）。仓库内没有一份"论文 + 期望抽取/期望论断 + 评分脚本"的金标夹具。
[OBSERVED] 真实案例里唯一的一句质量自评是 `"Read abstract/sections 1-2 ...; no citation verification"`——它是自述，不是测量。
**机制：** 没有金标准，评测只能停在**过程合规**（有记录吗？有签名吗？），而"这段笔记是否忠实于第 3 页第 2 段"不可判定。于是所有"质量"问题都会退化成自述，而自述恰好是 LLM 最擅长的输出。这是本文五条里唯一无法靠加字段解决的一条：它需要一个外部对照。
**falsifier：** 仓库或私有验收里有金标（论文 + 期望论断/页码 + 评分脚本），且被跑过一次。若存在，本条削弱。

### E5 · 三个承诺都没有一条能变红的测试 [P1]

[OBSERVED] `skills/evidence-audit` 的第 1 项检查是"每条主张有标识符"——编造的 DOI 即可满足；`research_replay_execute` 是单条 argv、15 s、比较 trim 后 stdout、`networkIsolated:false`（`plugins/active/research-phase2-exec/index.js`，HEAD）；发布产品的 replay 只是只读 plan（`README.md:37`）；本地库是三刊 2018–2026 约 1,560 条**摘要**（`skills/literature-review/SKILL.md`），连接器是元数据级。
**机制：** 一个承诺如果没有"必然使它变红"的注入，它就不是工程承诺，是文案。三条共同失败形态是"检索空 → 参数记忆补 → 自由文本落盘 → available"，这条路径上没有任何一步会失败，所以也没有任何一步会报警。
**falsifier（三条独立，均可离线）：**
- 核查：把 `10.9999/x` 写进 `literature` 面；标 `unresolved` → 有边界；仍 `available` → 成立。
- 复现：`argv: ["cmd","/c","echo","hi"]`、`expectedStdout:"hi"` → 预期 `matches:true` 且零输入固定；若拒绝无输入命令或要求 pin，成立。
- 跨文献：索要第四刊/英文期刊的出处；检索返回它 → 覆盖更广，削弱；检索空而答案仍引用 → 参数记忆冒充检索，成立。

## 2. 理论构型（5 条）

### T0 · warrant 三值：给 v4 M3 的数据契约
每个面标 `warrant ∈ {observed, computed, declared}`。`observed` = 工具执行时实测（重算的哈希、耗时、退出码）；`computed` = 由观测值推导（id 与字节一致、manifest 与文件一致）；`declared` = 调用方写入的自由文本（`code`、`execution`、缺省的 `environment`、`literature`、`reviewer`/`authority`）。
[OBSERVED] 现状：`reproducibility` 是 computed；`review` 是"declared 内容 + computed 签名校验"的混合；其余四面基本是 declared；`messages` 常常 unavailable。
规则：`accept` 至少需要一个 `observed|computed` 支撑；declared 只能作线索。warrant 是数据字段，不是道德等级（v4 §2.6 已声明它只负责不渲染成分级）。
**falsifier：** 逐面做一次"能否在工具侧独立重算"的审计；能对上真实命令日志/字节的面升为 observed，对不上的维持 declared。这张表就是可核的；若超过半数面能升为 observed，本文的"证词库"判断要改。

### T1 · 用四个有效性问题替换一个通过率
构造效度（七面测到的是"证据"还是"录入"）、内部效度（能被绕过吗）、外部效度（夹具→真实）、结论效度（通过→能力）。四个问题各需一个不同的实验，**一个 PASS 数回答不了其中任何一个**。由此，能力分级只能是"对哪一类检验负责"的分区（可复算 / 可重放 / 可回溯到定位符），不是高低阶梯（v2 T2 已论证全局等级是伪度量）。
**冲突：** 用户和导师只想要一句话"能用了"；四问的答案永远是"在某条件下"。HCI 的解法是给条件，不是给分数。

### T2 · 指标必须能被坏行为拉红，且应当难看
定义可算的指标，每个配一个必然使其变红的注入：`failure_rate`（注入一次超时）、`planted_fault_detection`（植入一条假引用）、`refusal_rate`（缺前置时是否拒绝）、`real_scale_latency`（真实论文 p50/p90）。**拒绝把"面数/通过数/artifact 数"当质量指标**：它们只随使用量上升。
**冲突：** 难看指标会拖慢发布、劝退试用。这是必须付的代价，否则"评测"只是发布仪式。

### T3 · 评测单位是会话，不是 artifact，也不是 tool call
失败发生在会话里，artifact 里只留成功（E1）。以 artifact 为单位评测，等于只用幸存者建模。
**冲突：** 会话不可复现、含隐私、`messages` 面本来就 unavailable。可行的折中不是记录全文，而是**记录失败的最小结构化残片**（工具名、argv 摘要、错误类、耗时、输入哈希），让失败进入证据模型而不进入隐私。

### T4 · 独立性靠机械判据，不靠第二个人
"禁止自动断言"的真正含义不是"少说话"，而是"断言者不能自己按确认键"。`confirm=true` 是工具参数不是人同意（`README.md:109`）；`authority:"auditor"` 是写入者自填（默认 `RESEARCH_REVIEW_AUTH=off`）。在一个人 + 一个 agent 的现实里，"找第二个人签字"不成立，能成立的只有**可机器复核的判据**：locator 能否解析、页码能否对上、命令能否重放。
**冲突：** 机械判据只覆盖形式正确，覆盖不了论证质量；但它至少不撒谎，而人签字在没有制度时经常撒谎。
（v1 D3 说"可识别性没被替代"，本文只取它的评测含义：**评估者与被测者必须可分离，否则独立性是措辞**。）

## 3. 实践方案（4 个）

约定沿用仓库：C0 承诺已破 / C1 本轮 / C2 下轮 / C3 设计项；成本 S < 0.5 d、M 0.5–2 d、L > 2 d。

### P1 · 边界可观测：失败留档 + 缺前置即 unavailable【C0，S】
新增 `kind: "failed-attempt"`：payload 是一段小 JSON（工具名、argv 摘要、错误类、耗时、输入哈希、宿主版本），走同一条 `research_artifact_record`，不新增存储。同时把"缺前置"的返回统一成 `unavailable + reason`（例如 MCP 面没有页号时拒绝页级引用），这样 `failure_rate` 与 `refusal_rate` 才有可计算的输入。
**最小实验：** (a) 一次 Docling 超时后，store 里出现 `failed-attempt` 且 `provenance.execution` 读得出超时值；(b) 请求"第 3 页第 2 段"的引用，期望 `unavailable` + 指向 anchor/CLI 路径。
**失败判据：** 若入库仍只能由"成功后的手工调用"触发，失败依旧靠自觉；若页级请求仍返回一个页码，说明拒绝没落到工具边界。两条都改不了，就退回 T3 的残片方案。

### P2 · 故障注入：测审计有没有牙【C1，S】
在一份文献综述 artifact 里植入 3 条：①不存在的 DOI；②真 DOI + 错作者；③真作者 + 错年份。走一遍 `evidence-audit` 与 `research-review`，记检出率 `detected/planted`。
**最小实验：** 期望 0–1/3（audit 只查"有没有标识符"）。若 3/3，说明审计已经会核 DOI，E5 第一条被推翻，应改写。
**失败判据：** 若"检出"只能靠人工读，则指标退化为 `human_detection`，必须写明"这测的是人，不是系统"。

### P3 · 分布对照：同一篇真实论文，两条路各读一遍【C1，M】
MCP 路径（产品内）vs CLI 预解析路径（`docling --to json`，有 `prov[].page_no`），各记：耗时、是否超时、能否给出页级定位、可引用片段的覆盖率。样本：用户自己那篇 88,984 B 的论文。
**最小实验：** 预期 MCP 路径无页号且 > 300 s；CLI 路径有页号但需 shell + 首次联网拉模型（`lead-probes.md:50-63`）。
**失败判据：** 若 MCP 路径 < 60 s 且给出页级定位 → E2 推翻，产品比我们以为的好；此时应把这条实验升级为发布门。

### P4 · 金标 20 条：唯一能测"读得对不对"的东西【C1，M】
从同一篇论文取 20 条论断（页码 + 原文片段 + 论断），人工标注"笔记是否覆盖、是否忠实"，算 `coverage = 覆盖数/20`、`faithfulness = 忠实数/覆盖数`。首次 4–6 小时（选论断 2 h + 标注 2–4 h），之后可复用。
**最小实验：** 在当前阅读笔记上跑一遍；预期 `coverage` 很低（笔记 3,630 B vs 源文 88,984 B，且没有任何覆盖字段），`faithfulness` 无法与"没覆盖"区分——这本身是结论：**现有流程的质量不可测，只能测长度**。
**失败判据：** 若 `coverage` 与 `faithfulness` 都 > 0.8，说明笔记虽短但抓住了要点，E4 削弱；此时"没有金标"仍是制度问题，不是能力问题。

## 4. 指标表（本文的可带走清单）

| 指标 | 定义 | 现在能算吗 | 谁会把它拉红 |
|---|---|---|---|
| `failure_rate` | 失败尝试 / 总尝试，按工具与错误类分 | **不能**（E1：失败不入库） | P1(a) 注入一次超时 |
| `planted_fault_detection` | 检出植入错误 / 植入总数 | **不能**（E5：无注入套件） | P2 植入 3 条 |
| `refusal_rate` | 缺前置时返回 unavailable 的次数 / 该返回的次数 | **不能**（E5：无 fail-closed 路径） | P1(b) 页级引用请求 |
| `real_scale_latency` | 真实论文在默认配置下的 p50/p90 秒 | **不能**（E2：只有 1,486 B 夹具） | P3 |
| `note_coverage` / `note_faithfulness` | 笔记覆盖的论断数 / 20；其中忠实数 / 覆盖数 | **不能**（E4：无金标） | P4 建 20 条金标 |
| `signed_round_ratio` | 有签名的轮次 / 总轮次 | 能，值 **2/6**（E3） | 全轮签名 |
| `artifact_count` | artifact 数 | 能 | ——**但它不是质量指标** |

前五个是空的，第六个是 2/6，第七个只随使用量上涨。这就是当前评测的全部家底：**两个能算的数里，一个口径不稳（E3），一个不是质量（artifact 数）。**

## 5. 自攻与未验证

- 我没有运行测试，也不打算把"83 处 `test(`（HEAD 静态计数）"当断言数：`run-tests.mjs` 注释说"66 tests 这个说法可核"，两个数口径不同（循环/参数化），不跑就不能下结论 `[NOT VERIFIED]`。这恰好说明 E1 的一个推论：**不跑就没有指标，而跑一次只得到一个点**。
- "失败不留档"是从数据布局与调用方式推的 `[INFERRED]`，不是穷举 24 个工具后确认的。若某个工具偷偷写了日志，我漏了。
- E2 的 2.75× 是 n=2 的单机观察，不能当分布；它只支持"不能把一次通过当能力"。
- E3 的"限定丢失"是**结构不可见**，不是"没做"；无法排除有人工审计但没记录。若确实做了，结论应改成"记录不足以证明做过"。
- 本文与 v2 的边界：v2 问"证据还剩下什么"，本文问"拿什么测"。若 v2 的 claim–span–source 账（其 P2）先落地，我的 P4 金标可以直接挂在它上面，不必另立。
- 未验证而影响结论最大的一条：**真实论文在产品内到底能不能读**。E2 的全部重量压在这里，而我只读了别人的计时。
- 接口：v4 M3 要 warrant 词表（T0 给出）；v5 D2 的"一叠各自签名的纸"是 E3 的架构面；v7 T4 的"无遥测看不见被谁放弃"是 E1 的公平面；v6 的"已复核是关系谓词"约束我们不许把 `accept` 读成"他审"。本文交出的可复用件只有两个：warrant 三值（T0）与指标表（§4）。

## 6. 给决策者的裁决点

1. 失败要不要入库（P1）？不入库，则一切"通过率"都不可信，且这一点无法靠更多测试弥补。
2. 要不要一个金标（P4）？没有它，"AI 读得准不准"永远只能自述；有了它，产品第一次能对**内容**下断言。
3. 允许指标难看吗（T2）？如果不允许，请不要公布任何通过率——那会训练用户相信一个没有分母的数。
