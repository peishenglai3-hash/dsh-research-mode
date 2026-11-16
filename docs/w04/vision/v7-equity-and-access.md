# W04 · 愿景批判 v7：教育公平 / 知识普惠

> 维度：教育公平与知识普惠（只做深，不做广）。本轮唯一写入 = 本文件。
> 只读：未改 `plugins/` `skills/` `profile/` `.research/`；未出网；未安装任何东西。
> 读码说明：源码引用以 `git show HEAD:<path>` 为准（HEAD = `20a2df7`；工作树在本轮中途被并行工作清空又恢复，行号不应随工作树漂移）。
> 证据等级：`[OBSERVED]` 本轮实跑/读码 · `[DOC]` 仓内文档或他人已记录 · `[EXTERNAL]` 标准/通识，未联网核验 · `[NOT VERIFIED]`。
> 成本口径：S ≤ 0.5 人日，M 1–3 人日，L > 3 人日；C 级沿用 `docs/w03/findings/gap-func.md:8-15`（C0 口径 / C1 文本可机检 / C2 单点改造 / C3 跨 bundle）。
> 采样偏差（先攻击自己）：我这台机器是 Windows、Node 24.15、SSD、有 CNKI 权限、读得懂英文。**默认用户就是我。** 下面每一条都先假设“我不是我”，看哪一步先断。

## 0. 一句话

“知识普惠”在本项目里目前是一个**存储命题**：数据在本地、可 `grep`、可搬走。这一条是真的，也是本项目最硬的资产（`README.md:41-51,119`）。
它还不是一个**可及性命题**：谁能在 4 GB 内存、受限网络、中文母语、没有 CNKI 权限、或看不见屏幕的条件下，完成一次**同等质量**的研究。
差别不在态度，在机制。下面把“普惠”拆成四道能被证伪的门槛，再给四个最小机制。

## 1. 破坏（5 条）

### EQ-01 设备与算力：1 GB 安装只是第一道门（P2）

**主张**：产品事实上的最低配置是“能装 Node 24 的 Windows + 约 1 GB 宿主 + 一个未 pin 的外部 Docling”。不满足的机器不是“体验差”，而是**读不了全文、只能记摘要**——而摘要恰好是这套证据纪律反复警告不要当成全文的东西。

**证据**
- `[OBSERVED]` 本机 DSH 安装 **1,057.8 MB / 7,882 文件**；`~/.cache/huggingface` **635.1 MB**（是否 Docling 模型 `[NOT VERIFIED]`）；litdb 10.4 MB。首屏之外的真实门槛是磁盘和内存，不是点击。
- `[DOC]` `docs/INSTALL.md:9` 要求 Node 24+；CI 只跑 `windows-latest` + Node 24（`.github/workflows/verify.yml`），macOS/Linux 的 UI 明写“未验证”（`INSTALL.md:10-11`）。
- `[DOC]` Docling 是**外部**解析器，`uv tool install docling` 不 pin 版本（`INSTALL.md:124-127`）；同一两页样本转换 **115 s / 317 s**（`README.md:127-128`），MCP 默认 60 s 超时（`docs/w03/W03-GAP-MATRIX.md:50`）。
- `[OBSERVED]` 仓内没有低配/低内存开关（`git grep -n -i -E "lowbandwidth|lowspec" HEAD -- plugins` 0 命中）；Docling 的启动与内存行为不在本仓测试内。

**谁被排除**：4 GB 内存的旧笔记本、机械硬盘、无管理员权限的高校机房、不能装 Python 的受控电脑。他们能写 artifact，不能读 PDF；而“读全文”是文献综述的主路径。

**证伪器**：在 4 GB / 2 核 / HDD / 无管理员的 Windows 10 上冷装，完成“安装 → 首个 artifact → 解析一份 10 页中文 PDF”，若 ≤30 min、峰值 RSS ≤1.5 GB、解析 ≤10 min，本条推翻。
**严重度**：P2（可绕过：有第二台机器的人不受影响）。

### EQ-02 离线：local-first 只覆盖“存”，不覆盖“找、读、想”（P1）

**主张**：“本地优先”被读成“离线可用”，但研究闭环的四段里只有存储和导出在本地。检索要网（7 个联网 connector；第 8 个 NBS 是本地 CSV），解析要一次联网预热（Docling 拉模型），推理要远端模型。断网时产品不是降级，是**只剩三刊样本**，而且没有任何机制强迫 agent 说出来。

**证据**
- `[OBSERVED]` `plugins/active/research-connectors/lib/connectors.js:11`：`TIMEOUT_MS = 30_000`；`requestJson` 无重试、无退避、无缓存；`connectors/index.js` 的 `TOOLS` 数组是 8 项 = 7 个 https + 1 个本地 NBS。
- `[DOC]` connector 里唯一的离线源是 NBS 本地 CSV（`research-connectors/README.md`），本机 `~/.dsh/research/knowledge/nbs/` 只有 **82 B 的 `test.csv`** `[OBSERVED]`；litdb 本身离线，但只有三刊样本（见 EQ-03）。
- `[DOC]` Docling 首次转换会联网拉模型（`docs/w03/W03-READING-CLOSED-LOOP.md:47`）；`INSTALL.md` 把这段写成“optional”，没写“首次必须出网”。
- `[OBSERVED]` 两个 preset 的 persona 全文（`research-preset*/cordis.patch.yml`）没有 offline / 缓存 / 降级 / “检索面为 0”的任何措辞。断网时 agent 的自由度就是它自己的措辞。
- `[NOT VERIFIED]` 推理走宿主配置的模型（账号、额度、价格都在仓外）；本机未见本地模型路径，因此“完全离线”在原理上是否可达取决于宿主，插件层无法回答。

**谁被排除**：按流量计费的手机热点、校园网国际出口不稳定、田野驻点、涉密/内网机器。他们得到的是一份**看起来完整、实际只搜了本地样本**的综述——这比报错更糟。

**证伪器**：拔网线，用 `literature-review` skill 做一个已知有 3 篇文献的主题。若 (a) 所有工具要么返回数据、要么返回带层级的降级说明；(b) 输出明写“离线 / 仅本地样本 / 未检索联网来源”；(c) 没有把 `ECONNREFUSED` 写成“没有相关文献”——三条全过，本条推翻。
**严重度**：P1（主路径在常见环境下给出误导性完整感）。

### EQ-03 母语与中文覆盖：能“发现”不等于能“读到”（P1）

**主张**：中文优先目前只有三样东西：中文 UI、中文 persona 一段话、一个三刊等额样本库。检索层最自然的中文查询（两个字）拿到的是**按年份排序**而不是按相关度；覆盖层的每条记录都指向一个需要 CNKI 权限的 token 链接；解析层没有任何中文 PDF fixture。于是“中文社科”在机制上是“汉语 UI + 三刊摘要”。

**证据**
- `[OBSERVED]` 本机 litdb：10,375,168 B，SHA256 `533ACECB…`，**1,560 行**；三刊各 **520** 行；完整年份每刊 **57–63** 行；2018–2026，2026 合计只有 **155** 行。九字段 `uid/title/authors/year/journal/abstract/research_theme/relationship_chain/source_url`，**无 DOI、无全文、无关键词**（SQL 直查 + `pragma table_info`）。
- `[OBSERVED]` **1,560/1,560** 条 `source_url` 都是 `kns.cnki.net/kcms2/article/abstract?v=…` token 链接；`skills/litdb/SKILL.md` 自认“可能过期、未验证可逐条解析”。发现 ≠ 获取：没有 CNKI 权限的人能看见标题，读不到正文。
- `[OBSERVED]` 两字查询（`阶层`、`教育`）在 FTS5 trigram 上实测返回 **0 行**，回落 `LIKE`；`LIKE` 分支是 `ORDER BY year DESC`（`research-phase2-litdb/lib/query.js:77-86`），不是相关度。三字以上才走 `ORDER BY rank`。
- `[OBSERVED]` `quoteFts` 把整条查询包成短语（`query.js:44-46`）：`教育 不平等` 只能精确匹配这几个字，没有 OR/布尔。会用检索语法的用户和不会的用户，拿到的不是同一个库。
- `[OBSERVED]` 仓内唯一阅读 fixture 是英文合成两页 PDF（`tools/w03/fixtures/reading-parse.json`），**没有中文 PDF fixture**；工具 `description` 无中文（grep 0 命中），UI 的两处 aria-label 是英文（`research-hub/client.js:214,251`）。
- `[DOC]` 无 DOI 意味着中文记录**无法与 Crossref/OpenAlex 按 DOI 连接**：本地中文库和联网英文库是两个孤岛，跨库综述只能靠标题模糊匹配。

**谁被排除**：教育学/传播学/史学等非三刊领域的学生（本地命中为 0）、没有 CNKI 权限的人、习惯两个字检索的人、繁体中文用户（无繁简归一）、需要读中文 PDF 的人。

**证伪器**：(a) 合法导出 10k 行含 DOI/全文链接的 CNKI 库，经 `RESEARCH_LITDB_PATH` 载入后工具能检索且描述不再谎称 1,560 条；(b) 20 个两字查询、3 人标注 top-5，重排后 precision@5 ≥0.6；(c) 10 份中文 PDF 页锚点 ≥9 份正确。三项全过，本条推翻。
**严重度**：P1（这是产品的“中文社科”承诺本身）。

### EQ-04 残障可及性：4 个 aria、0 个 role、0 个 aria-live（P1）

**主张**：界面是给“看得见、用鼠标、读中文”的人写的。读屏用户听到的是英文控件名 + 中文正文；低视力用户面对 10.5 px 的按钮；键盘用户能按到按钮，但不知道四个“tab”里哪个被选中；错误出现时没有任何播报。没有任何自动检查拦这件事。

**证据**
- `[DOC]` `docs/w03/findings/crit-hci.md:379-382`：两个 client 合计 **4 处** aria 属性，`role=`、`aria-live`、`aria-selected`、`tabIndex` 全部 0；两处 aria-label 是英文，界面其余是中文。
- `[OBSERVED]` 本轮复核：`role=|aria-live|aria-selected|tabIndex|lang=` 在 `plugins/active` 下 **0 命中**。字号 10.5 / 11 / 11.5 / 12 / 12.5 px；刷新按钮 10.5 px + 3 px padding + 1 px border ≈ **20.6 px** 高，低于 WCAG 2.2 SC 2.5.8 的 24 px 目标[EXTERNAL]（按 normal 行高 1.2 估算）。
- `[OBSERVED]` CI 的五个验证步骤（`verify.yml`）没有一步是 a11y；测试套件也没有 DOM 断言。
- `[OBSERVED]` 正面资产：颜色全走宿主 token（`--dsw-alias-*`），暗色模式跟随宿主，不写死颜色——这条应保留，不要为修 a11y 改回硬编码。

**谁被排除**：NVDA/JAWS 中文用户、低视力用户、只能键盘操作的用户、需要 200% 缩放的用户。他们是“知识普惠”里最容易被写成“我们关心”却从不被测的一群人。

**证伪器**：NVDA 中文语音 + 只用键盘完成 3 个任务（切换四个 tab / 搜“阶层” / 让错误被播报），3/3 通过；静态规则 R1–R5 零违规；所有目标 ≥24 px。全过则本条推翻。
**严重度**：P1（类别性排除，不是体验瑕疵）。

### EQ-05 数字素养与“普惠”修辞：没有画像，就没有主张（P2）

**主张**：安装路径要 9 条 `dsh plugin add`、绝对 `link:` 路径、`--dump-config` 验证、可选 uv/Docling 与三个环境变量；核心概念是 7 面 provenance、artifact、review、`.science`。这套纪律对“可交接的证据”是必要的，对第一次用的人是一道**素养税**。项目又没有遥测，因此**看不见谁在第三步放弃**——“普惠”于是只能靠语气成立。

**证据**
- `[DOC]` `README.md:59-69` 的安装循环与绝对 `link:` 说明；`INSTALL.md:104-117` 的 litdb 路径、`connectors.js:221` 的 `RESEARCH_NBS_DIR`、`research-host/lib/auth.js:34` 的 `RESEARCH_REVIEW_AUTH`；24 个工具（`README.md:27`）。
- `[OBSERVED]` provenance 的 `environment` 面默认只写 `{platform, arch, node, python: process.env.PYTHON_VERSION}`（`research-host/lib/store.js:189-194`）；全仓无模型名 / token 用量 / 费用字段（`git grep -i -E "model|token|cost|price|usage"` 只命中 reviewer token 与 auth 代码，无计量字段）。证据链不能回答“这次研究用了哪个模型、花了多少钱”——**成本不对称在证据层是不可见的**。
- `[DOC]` 无遥测、无服务器（`docs/INSTALL.md:139-142`）。隐私立场是对的，但它让“谁被排除”在方法上不可知。
- `[OBSERVED]` 已有的公平设计（应写进愿景而不是埋着）：preset 明写 “Open reading needs no project”，探索态不强制落盘（`research-preset-cn-social/cordis.patch.yml`）。这是降低素养税的正确方向。
- `[OBSERVED]` 但 UI 仍以项目为中心：hub 的空态是“还没有研究项目”（`research-hub/client.js:196,201`），与“开放阅读不需要项目”相反。产品维度的冲突在这里，不在文案。

**谁被排除**：第一代大学生、非英语读者、没有“项目/证据链”心智模型的人、在共享电脑上不愿留痕的人。

**证伪器**：5 名社会学硕士生，无人工协助，45 min 内完成安装 + 首个 artifact，且能正确解释“available ≠ verified”，≥4/5 通过 → 安装素养门槛的主张推翻。对“修辞”那一半：`docs/ACCESS.md` 连续两个 release 公布分画像任务成功率；若数字达到门槛，则“可见性只能靠语气”被推翻；若公布后仍回避数字，则修辞问题成立。
**严重度**：P2。

## 2. 理论构型（4 条）

### T1 四道门槛：把“普惠”写成可测的发布门

“普惠”不是形容词，是四个**可被机器采集**的门槛。每个门槛都要有数字、测试机器、和“未测”标记。
离线层级先定义清楚，否则“离线可用”无法测：**L0** 全程离线（本地模型）· **L1** 装好后断网可用核心（本地库、artifact、导出）· **L2** 需一次联网预热（模型下载）· **L3** 每次使用都需联网（connector、远端推理）。

| 门槛 | 可测定义（草案） | 现状（本轮证据） | 与架构/产品的冲突 |
|---|---|---|---|
| G1 低配可跑 | 4 GB / 2 核 / HDD / 无管理员；冷装 ≤30 min，首个 artifact ≤20 min，峰值 RSS ≤1.5 GB，1366×768 可用 | 1.06 GB 安装 + 外部 Docling（未 pin，2 页 115–317 s）；Node 24；仅 Windows 验证 | Docling 在仓外，pin 版本会增大安装；低配模式若跳过 OCR，就违反“不得把摘要当全文” |
| G2 离线可用（明确定义到层） | L1 = 装好后断网仍能：本地检索、写 artifact、导出 `.science`、声明覆盖 | 存储与本地检索在 L1，connector 发现在 L3，解析 L2+（首次拉模型），推理 L3（除非本地模型） | connector 是 host fetch；加缓存要新增写路径并解决新鲜度；证据模型不允许把 cached 说成 fresh |
| G3 母语优先 | 两字中文 precision@5 ≥0.6；繁简同结果；10 份中文 PDF 页锚点 ≥9 正确；UI/工具/报告默认中文 | 两字走 LIKE 按年份；无繁简归一；无中文 fixture；工具描述英文 | 库只读，不能加索引/改 schema，只能在内存重排；skill 的“正式流程 16 页全量扫描” token 成本高 |
| G4 可迁移 | 拷 `.research` 到另一台机器，一条命令校验全绿；`.science` 脱离工具可读 | 基本满足（plain files + tar.gz + manifest）；但 `.science` 导入在 Windows 只读未强制（`README.md:110`），且无签名 | 可搬运 ≠ 可验证作者；内容寻址不签 artifact 集合 |

**写法建议**：愿景里每个“普惠”句都必须能指到表里一行；指不到的句子删掉。这是 C0，但它是所有其它机制的前提。

### T2 三个被混为一谈的词：local-first / offline / free

| 命题 | 数据在哪 | 算在哪 | 要网吗 | 要钱吗 |
|---|---|---|---|---|
| local-first | 本地 | 远端模型 | 要（推理） | 要（token） |
| offline-capable | 本地 | 本地或无 | 不要 | 不要 |
| free（MIT） | — | — | — | 不要 |

本项目今天的确切位置是：**本地存储 + 远端推理 + 混合检索 + 外部解析**。它可以是 free，可以是 local-first（数据），但**不是 offline-capable（研究闭环）**。把三者当同义词，是“普惠”变成营销词的最短路径。
冲突：要做真 offline，就得引入本地模型或把 LLM 调用做成可插拔——这超出插件边界，属于宿主的决定；插件能做的只是**把层级说清楚**（见 P3），而不是假装跨过去。

### T3 机会公平 vs 结果公平：证据纪律是税，不是门槛

- 机会公平：能装上、能跑、不崩。
- 结果公平：同样主题、同样时间，产出的质量可比。后者取决于模型、中文语料、复核者，产品只能部分影响。
- 本项目的独特点：它用**证据纪律**提高下限，但纪律本身是素养税。初学者的路径应该是“先读、先想，再决定要不要落盘”，而不是“先建项目、再填 7 面”。
- 已有正确设计：preset 的 open reading（`cordis.patch.yml`）。冲突在 UI：空态与导航仍假设“项目优先”。
- 结论：分层，而不是降低标准——探索态默认不落盘；交付态强制全链。**不要**为了“普惠”把 provenance 变可选交付；那会把公平变成不可验证。

### T4 度量单位：具名画像 × 任务成功率

- 不用“10 bundles / 24 tools”证明普惠，用画像：
  - P1 无 CNKI 权限的本科生（4 GB 笔记本 + 手机热点）；
  - P2 视障研究生（NVDA 中文）；
  - P3 不用英文的县域中学教师；
  - P4 断网田野研究者。
- 每个门槛先测 2 个画像，5–8 人/画像，任务式（不是满意度），原始记录公开（脱敏）。
- 自反困境：无遥测（这是对的）意味着项目**在方法上看不见自己被谁放弃**。解法只能是 opt-in 的任务研究；不做这一步，“普惠”就只能算价值宣言，不能算产品主张。这是本文最不客气的一句，也是对我自己的约束：我也没有做这 5 个人的测试。

## 3. 实践方案（4 个，最小机制）

### P1 可及性账本（C0+C1，S）
**机制**：新增 `docs/ACCESS.md`，一张表：G1–G4 × 实测值 × 测试机器 × 未测项；每次 release 由 `tools/w04/access-ledger.mjs` 从固定命令采集（安装体积、Node 版本、litdb count、两字查询 backend、a11y 规则命中数）。README 的 “What this software does not do” 指向它。
**最小实验**：3 台机器（本机 / 4 GB 虚拟机 / 无 CNKI 网络）跑采集；表里至少 3 行写“未测”而不是“通过”。通过标准：每个门槛至少一台机器有数字；失败标准：出现无出处的形容词（“轻量”“流畅”）。
**反营销词规则**：没有数字的普惠句，不进 README/愿景。

### P2 中文优先的检索路由与覆盖标签（C1+C2，S–M）
**机制**
(a) `litdb_search` 的 LIKE 分支在 JS 内重排：title ×3、theme ×1、abstract ×1、年份 ×0.5；返回 `backend: like-reranked`。1,560 行上成本可忽略（本轮实测 LIKE 0.4–12.9 ms）。
(b) 繁→简归一表（约 200 对）在检索前执行，返回 `normalized: true`。
(c) Hub 的“本地索引 N 条”改为“三刊样本 · N 条 · 2018–2026 · 非全量 · 摘要级”；工具描述不再硬编码 1,560（自定义 `dbPath` 时以返回 count 为准）。
(d) `skills/literature-review/SKILL.md` 加路由句：中文主题先 litdb 再 connector；英文主题先 connector；两边都为 0 时写“检索面为 0”，不写“没有文献”。
**最小实验**：20 个两字查询，3 人标 top-5；重排前后 precision@5 目标 +0.2 绝对；繁体“階層”与简体“阶层” top-5 一致；3 字 FTS 不回归。不动库、不加索引（只读），所以不改 schema。

### P3 离线 / 低带宽 / 低配降级（C2，M）
**机制**
(a) 新增 `research_access_status`：返回 `{litdb:{present,count,sha}, connectors:{lastProbe,reachable}, docling:{declared}}`；`declared` 只报“用户声明已预热”，不假装验证过（沿用 available ≠ verified）。
(b) `RESEARCH_LOW_BANDWIDTH=1` 时 connector 用 8 s 超时、pageSize 5、一次重试；成功结果缓存到 `~/.dsh/research/cache/connectors/`，带 `fetchedAt/url/cached`，agent 必须说“来自缓存”。
(c) `litdb_snapshot` 加体积闸：>20k 行或输出 >20 MB 时拒绝并给分页建议（当前每次检索都用 `readFileSync` 整库算 sha；10 MB 没事，2 GB 的库会每次分配 2 GB）。
(d) preset 加一句：断网时先报层级与覆盖，不得把“只搜了本地样本”写成“文献综述完成”。
**最小实验**：断网跑一次综述，输出必须含“离线/仅本地样本/未检索联网来源”；1 Mbps/300 ms 下 5 次查询，中位 ≤8 s、≤200 KB/次、5/5 有结果或明确降级；50k 行合成库 snapshot 拒绝而不 OOM。
**风险**：缓存与证据模型的新鲜度冲突——缓存必须带时间戳，且不得进入 `literature` 面冒充原始检索。

### P4 可访问性机检 + 三处修复（C1+C2，S）
**机制**：`tools/w04/a11y-check.mjs`（零依赖、静态扫两个 client）：
R1 可交互元素有可访问名；R2 中文界面不出现英文 aria-label；R3 按钮高度 ≥24 px（fontSize+padding+border 估算）；R4 动态错误/状态有 `role=status/alert` + `aria-live`；R5 tab 组有 `tablist/tab/aria-selected`。
先修三处：错误提示 `aria-live`、四个 tab 的 role/aria-selected、刷新按钮目标尺寸（10.5 → 12 px，padding 5×10）。
**最小实验**：HEAD 上跑 → 预期 ≥8 条违规；修完 → R1–R5 为 0；NVDA 中文语音 + 只用键盘完成 3 个任务，3/3 通过。
**失败闸**：静态规则误报 >30% 就降级为 C0 人工清单，不硬塞进 CI。

## 4. 边界（不在本文范围）

- 不讨论模型定价政策、CNKI 版权、学校采购、硬件援助——这些是条件，不是本项目的设计变量。
- 少数族群语言只留一个证伪器：把一份维吾尔语 PDF 走 Docling，若 OCR 语言与 UI 都无法处理，则“中国社科”的边界应写明“汉语文献”，不要用“中国”覆盖它没覆盖的人。
- 不做跨境可达性判断（禁网）；Node `fetch` 是否走系统代理标 `[NOT VERIFIED]`。
- 不把“普惠”做成第 25 个工具。它是发布门，不是功能。

## 5. 未验证清单（交给下一轮）

1. `~/.cache/huggingface` 的 635 MB 是否 Docling 模型（本机有 `docling.exe`，但 `~/.cache/docling` 不存在）。
2. Docling 对中文 PDF 的页锚点质量（仓内唯一 fixture 是英文合成两页 PDF）。
3. DSH 是否可配本地模型——决定“完全离线”在原理上是否可达。
4. connector 在强制代理网络下的行为（Node `fetch` 默认不读系统代理）。
5. 颜色对比度：UI 用宿主 token，未取得 `--dsw-alias-*` 实际色值，未算 WCAG 比值。
6. macOS/Linux 的实际可用性（CI 只跑 Windows）。
7. 4 GB / HDD 机器上的峰值内存与首次解析耗时（本轮未跑，只用本机 1 GB 安装体积与文档中的 115–317 s 做外推）。
