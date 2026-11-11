# W03 · 破坏性算法批判（只读轮）

# 基线：分支 w03-reading，HEAD b5f6c16（w03-base 冻结树）。本轮唯一写入的文件就是本文件；
# 未改动任何 plugins/、skills/、profile、git 引用，未安装依赖，未出网，未读写真实 litdb / 真实 .research 数据。
# 实测夹具全部在 %TEMP%/w03-algo 与 %TEMP%/w03-store-*（scratch，可删）：合成 32 行 FTS5 trigram 库
# %TEMP%/w03-algo/literature.db；store/review/replay 用临时 workspace 走 createProject/recordArtifact 等库函数。
# 证据等级：OBSERVED（本轮实跑）/ CODE（逐行可判定，未实跑）/ NOT VERIFIED。
# 行号以本 commit 为准（read 工具编号，含空行）。
# 与同轮其它文件的关系：content-byte 去重已由 ARCHC-02 记录、environment 死判定已由 ARCHC-05 记录、
# topK 20 vs 50 已由 MAINT-02 记录 —— 本文不复述，只在需要处引用并补它们没覆盖的算法后果。

- id: ALG-01
  dimension: algorithm
  claim: >-
    检索路由的判据是“查询总长度”，而 trigram 的真实约束是“每个词元 ≥3 字符”。Python `len(query) >= 3` /
    Node `text.length >= 3` 一旦放行 FTS，就无法回头：FTS5 trigram 对 2 字符词元**不报错、只返回空集**，
    所以总长 ≥3、却由 2 字词元组成的查询（空格、AND/OR、任何标点分隔）返回 0 行，`backend` 仍报 fts/lexical，
    既不回退 LIKE，也不告诉调用者“这条查询不可检索”。合成库里 `数字 治理` → 0 行（Python 报 lexical、Node 报 fts），
    `数字治理` → 30 行命中；用户自然会写的多词查询因此被读成“没有文献”。
    第二层分叉：Node 用 `quoteFts` 把整串包成**一个短语**，Python 把原文直接交给 MATCH，同一字符串在 Node 是短语、
    在 Python 是布尔表达式/隐式 AND：`数字治理 OR 教育公平` Python 5 行 / Node 0 行；用户自己加引号的
    `"数字鸿沟"` Python 2 行 / Node 0 行。第三层：Node 数 UTF-16 码元、Python 数码点，两个增补平面 CJK 字
    （𠀀𠀀）→ Node 走 fts、Python 走 like。SQL 本身全部参数绑定（无注入）；真正的“注入”是 Python 把用户原文
    当 FTS5 查询语法。
  evidence:
    - 'skills/litdb/scripts/litdb.py:170 backend = "lexical" if len(query) >= 3 else "like"；:177-180 MATCH 直接绑定 query 原文；:182-183 except sqlite3.Error 兜底救不到“空集”这一类；:185 pattern = f"%{query}%"'
    - 'plugins/active/research-phase2-litdb/lib/query.js:60 backend = text.length >= 3；:44-46 quoteFts 整串加引号；:51 Math.min(20, topK) 静默夹取；:79-86 LIKE 分支 ORDER BY year DESC'
    - 'plugins/active/research-phase2-litdb/index.js:38 描述“Chinese 2-character queries fall back to LIKE; 3+ uses FTS5 trigram”；skills/litdb/SKILL.md:44 同义（“3 字及以上查询可靠”）'
    - 'OBSERVED（%TEMP%/w03-algo/literature.db，32 行）：数字治理→30 行命中（top-k 5 时返回 5 行，Python lexical / Node fts）；数字 治理→0 行；数字鸿沟→2 行；“数字鸿沟”→Python 2 行 lexical / Node 0 行 fts；数字治理 OR 教育公平→Python 5 行 / Node 0 行'
    - 'OBSERVED：2 个 U+20000 字符的查询 → Node backend=fts（.length=4），Python backend=like（len=2）'
    - '证据等级：Python/Node 的单次查询属 OBSERVED；上述结果只依赖合成库，不依赖真实 litdb'
  severity: high
  recommendation: >-
    C1：先切词再判路由。抽出 splitQuery()（按空白/标点切词），规则改为“至少一个词元 ≥3 字符才进 FTS，否则整体 LIKE”；
    FTS 路径对每个 ≥3 词元生成带引号短语并用 OR 连接，<3 词元单独用 LIKE 合并；返回体加
    unsearchableTerms: [...]，把“查不到”与“查不了”分开。backend 标签统一（现在 Python 报 lexical、Node 报 fts）。
    两个实现共用同一份路由函数与同一组测试向量（与 MAINT-02 的 topK 分叉一并解决，别只改上限）。
  cost: >-
    半天到 1 人日：路由函数约 40 行 + 两套测试向量 10 条 + SKILL.md:44 与工具描述改写；无 schema 变更。
  falsifier: >-
    用一个含“数字治理”标题的 FTS5 trigram 库跑 search --query "数字 治理"：若返回 ≥1 行、或 backend 变成 like、
    或返回体带“词元过短”的说明，本条被推翻。再对同库跑 数字治理 OR 教育公平 与 "数字鸿沟"，若 Python/Node 结果一致，第二层分叉被推翻。
  mission_principle: >-
    EVIDENCE-MODEL“缺失证据显示 unavailable，不推断”：空结果集现在被当成“没有文献”，而不是“这条查询不可检索”。
    文献检索工具最不能犯的错，就是把不可检索伪装成不存在。

- id: ALG-02
  dimension: algorithm
  claim: >-
    内容字节去重已在 ARCHC-02，此处只补排序（问题 2 的另一半）。`listArtifacts`/`listProjects`/`listReviews` 用
    `String(createdAt).localeCompare` 作唯一排序键：对 ISO-8601 Z 串它与码位序一致（本轮 Node 24 对 4 个边界串
    两两比对 0 处分歧），所以**当前写入路径的时间顺序是对的**；但它不是全序——(a) 同毫秒平局没有任何 tiebreak，
    V8 稳定排序把顺序交给 readdir 的枚举顺序：实测把两个 sidecar 的 createdAt 改成同一毫秒后，列表顺序变成
    sha256 文件名顺序（second 在 first 前），与记录顺序相反；(b) createdAt 是 sidecar 里的未校验字符串，
    缺失时 `String(undefined)`="undefined" 会被当成合法键（Hub 用 `?? ""` 是另一个键），两个读者对同一缺失字段排序不同；
    (c) 去重命中不追加时间戳（ARCHC-02），排序键其实是“首次遇到时间”。结论：newest-first 只在“时间戳不同且都由本写入器产生”时成立。
  evidence:
    - 'store.js:236 return artifacts.sort((l,r)=>String(r.createdAt).localeCompare(String(l.createdAt)))；:136（projects）、:467（reviews）同型'
    - 'store.js:200 createdAt 只在创建时写；去重命中（:181-187）不追加 → 排序键=首次遇到时间'
    - 'OBSERVED：两个 artifact 的 sidecar createdAt 都改成 2026-01-01T00:00:00.000Z 后，listArtifacts 顺序 = [3fc4ccfe(second), 7692c3ad(first)]，与 readdir 文件名序一致，与记录顺序相反'
    - 'OBSERVED：2026-11-11T09:59:59.999Z 等 4 个 ISO 串两两 localeCompare 与码位比较 0 处分歧（Node 24.15，locale 未显式设置）'
    - 'research-hub/client.js:52 同一职责的第二个比较器用 String(right.createdAt ?? "")，与 store 的 String(undefined) 不同'
  severity: low
  recommendation: >-
    C0：排序键改成 (Date.parse(createdAt) ?? 0, id)，id 作确定性 tiebreak；Hub 与 store 共用同一比较器；
    非法 createdAt 显式标 invalid，不要静默字符串化。等真有导入/手写 sidecar 再升级。
  cost: >-
    0.5 小时：两处各 1 行 + 一个“同毫秒两条 artifact 顺序稳定”的测试。
  falsifier: >-
    造两个 createdAt 完全相同的 sidecar，记录 listArtifacts 顺序；再交换两个文件名（即改变 id）后重跑：
    若顺序跟着文件名变，说明平局由文件名决定、没有时间 tiebreak，本条成立。若顺序恒等于记录顺序，则被推翻。
  mission_principle: >-
    workspace 页 hostHint“唯一真源”要求同一棵树在两个读者眼里顺序一致；排序键是证据的一部分，
    不能让文件系统枚举顺序替我们决定谁新谁旧。

- id: ALG-03
  dimension: algorithm
  claim: >-
    复核的“结论”有两个来源，只有一个是验过的。`verifyReview` 验的是 history[] 每一轮的 sha256；而
    `getProvenance` 的 review 面（以及 Hub 面板）读的是文件**顶层镜像** decision/notes/round 和 history.length，
    顶层字段不在任何签名里。于是同一个文件可以同时给出互斥结论：把顶层 decision 改成 reject（history 仍是
    [reject, accept]）后，getProvenance 报 reject、verifyReview 报 accept 且 valid:true（OBSERVED）。
    其次 round 不是轮次身份而是位置：round = history.length 只在写盘时算一次，条目本身不带轮次号、也不进签名；
    删掉一轮后 verifyReview 按新下标重编号、valid 仍 true（删掉 reject 轮 → roundCount 1、decision accept、
    valid:true，OBSERVED）；复制一轮 valid:true（OBSERVED）；重排一轮 head 变化但仍 valid（OBSERVED）。
    代码自己的 limitations 只承认“删除最早几轮”不可检测（:443），实际是任意一轮的删除/重排/复制都通过。
    无密钥 sha256 可伪造与“文档已承认的 completeness 限制”不算新缺陷（EVIDENCE-MODEL:52,61）；
    新缺陷是“被验的字段”与“被展示的字段”不是同一个，以及 round 可被静默重编号。
  evidence:
    - 'store.js:293-304 signReview = sha256(JSON.stringify({artifactId,decision,notes,reviewer,authority,template,auth,createdAt}))：无密钥、不含 round、不链前一轮'
    - 'store.js:337-348 entry 无 round 字段；:348 history=[...prior,entry]；:361 round: history.length'
    - 'store.js:402-447 verifyReview 只走 history[]（:419-427），从不校验顶层 decision/notes/round；:436 valid = 每轮 status==="valid"'
    - 'store.js:258-259 getProvenance 读 review.decision（顶层）与 review.history.length；store.js:441-445 limitations 只写“deleting the earliest rounds”'
    - 'OBSERVED（%TEMP%/w03-store-*）：[reject,accept] 删 reject → {valid:true, roundCount:1, decision:"accept"}；[accept,reject] 重排 → {valid:true, head:"reject"}；复制 accept 轮 → {valid:true, roundCount:2}；顶层 decision 改 reject → getProvenance.review.decision="reject" 而 verifyReview.decision="accept"/valid:true'
  severity: medium
  recommendation: >-
    C1：把“结论”绑定到被验内容——verifyReview 以 head 为准，derived 面从验过的 head 生成（或将 history 链化：
    每条签名覆盖 prevSignature 与 round；顶层只在等于 head 时视为镜像，否则标 mirror-mismatch）。
    再加两条廉价检查：review.round === history.length、createdAt 单调不减；任一不成立降为 integrity-degraded 而非 valid。
    limitations 改写成“任意轮次的删除/重排/复制都无法从单文件检测”。
  cost: >-
    0.5–1 人日：store.js 约 25 行 + 4 个测试（删/排/复制/顶层不一致）+ Hub 面板改读 derived 面。
  falsifier: >-
    用正常写路径记录 reject→accept，只改顶层 decision 为 reject（history 不动），同时调 getProvenance 与 verifyReview：
    若两者给出同一 decision、或 verifyReview 报 invalid，本条被推翻。
  mission_principle: >-
    EVIDENCE-MODEL:33-40 要求“记录时的事实/现在的推断”可区分；复核结论是整条证据链的闸门，
    闸门不能有一半是用未验字段搭的。

- id: ALG-04
  dimension: algorithm
  claim: >-
    .science 的大小上限只在导出侧、且逐条目 2 MiB：`buildTar` 拒绝 data.length > 0o7777777（=2,097,151 B；
    tar 12 字节八进制字段其实能放到 8 GiB），而 recordArtifact 对 content 无上限、对 source 受 64 MiB 读限
    （research-host/lib/io.js:10,45）。结果是 **≥2 MiB 的普通 PDF/数据集能被记录、能被 list，却永远导不出**：exportScience 直接抛
    ScienceError("tar entry is too large")，没有跳过/分卷/preflight 选项，replayPlan 随后报 no .science export。
    实测 2,097,151 B 成功（archive 3,459 B），2,097,152 B 抛错，artifact 仍在 listArtifacts 里。
    导入侧相反：没有单条/总量/条目数上限，gunzipSync(raw) 先整包解压再解析（:610），压缩炸弹可以撑到 buffer 上限
    （NOT VERIFIED：未实跑 OOM）。另外“声明了才校验”对 payload/ 是闭合的（未声明 payload 被拒，:645-650），
    但非 payload/ 条目被静默忽略（:632-633）；清单自身无校验和/无签名（:568-574），所以 import 证明的是
    “档案与它自己的清单一致”，不是“档案未被改写”。
  evidence:
    - 'store.js:495-506 buildTar；:499 if (data.length > 0o7777777) throw new ScienceError("tar entry is too large")'
    - 'store.js:566-605 exportScience 无 try/catch、无跳过、无 preflight；:535 add() 读全文件；research-host/lib/io.js:10,45 MAX_BYTES=64MiB 只限 source 读'
    - 'OBSERVED：content 长 2,097,151 → export ok（bytes 3,459）；2,097,152 → ScienceError；随后 listArtifacts 仍返回 2 条，bytes=[2097152,2097151]'
    - 'store.js:607-610 importScience 用无 maxOutputLength 的 gunzipSync；:631-663 循环无 size/count 上限；:617-621 清单 files[].bytes 从不与 payload 实际长度比对'
    - 'store.js:645-650 未声明 payload → 拒；:632-633 非 payload 条目 → continue（静默忽略）；:568-574 清单不含任何自校验字段'
    - 'NOT VERIFIED：解压炸弹的实际 OOM 阈值（依赖 Node maxOutputLength 默认值与本机内存），未实跑'
  severity: high
  recommendation: >-
    C1：导出改“可导则导、不可导则记账”——把 per-entry 上限提到 tar 字段上限（8 GiB）；仍超限时在 manifest 记
    omitted:[{path,bytes,reason}] 并让 export 成功，或至少先做项目级 preflight（算最大 payload 再决定拒绝）。
    导入加三重闸：zlib.gunzipSync(raw,{maxOutputLength:256MiB})、条目数上限、总字节上限；并校验 manifest.bytes 与实际长度一致。
  cost: >-
    半天：导出 omitted/preflight 约 40 行；导入 3 个上限约 15 行；2 个边界测试（2 MiB±1）。
  falsifier: >-
    记录一个 2,097,152 B 的 artifact 再 export：若成功（或返回 omitted 列表而不是抛错），本条被推翻。
    再导入一个压缩后 <1 MiB、解压后 >1 GiB 的 tar：若在解压前被拒并给出明确错误，第二半被推翻。
  mission_principle: >-
    证据包的价值是“能交给不信任你的人”。一个会因为 2 MiB 附件就整体拒绝导出的档案格式，把证据完整性与可交付性对立起来；
    正确做法是诚实记账，不是静默失败。

- id: ALG-05
  dimension: algorithm
  claim: >-
    导入把“通过校验的条目数”当成“写出的文件数”，但两者的映射不是单射：rel 只排除 ..、前导分隔符和 :，
    不拒绝 . 与重复分隔符；join(target,"payload",rel) 会规范化。于是 payload/a/b 与 payload/a//b 是两条独立声明、
    各自哈希正确、都进入 payload[]，payload.length === declared.size（2=2）也成立，却写到同一路径，后者覆盖前者。
    实测：verifiedFiles=2、declared=2，磁盘上只有 payload/a/b（16 B，内容为第二条）。同一类碰撞在 Windows 上还有
    大小写/尾点（payload/A vs payload/a）——assertInside 是大小写敏感的字符串检查，文件系统不是。
    导入因此可以“报告 2 个已校验文件而实际只有 1 个”，被覆盖的那份内容不再可恢复。
  evidence:
    - 'store.js:639-643 只拒 segments 含 ..、前导 / 或 \\、含 :'
    - 'store.js:645-662 每条独立 declared.get + sha256 校验；:657 assertInside(target, join(target,"payload",rel)) 不做规范化'
    - 'store.js:677-679 if (payload.length !== declared.size) throw；:682-688 逐条 writeBytes（同目标后写覆盖）；:726 verifiedFiles: payload.length'
    - 'OBSERVED：manifest 声明 a/b 与 a//b 两条（哈希各自正确），importScience → verifiedFiles:2，payload 目录唯一文件 a/b，16 B，内容为第二条 "BBB-second-write"'
  severity: medium
  recommendation: >-
    C1：路径规范化后再入账。rel = path.posix.normalize(entry.name.slice(8))，规范形与原串不一致就拒（或记 non-canonical）；
    以规范化目标路径集合判重与计数（destSeen），最终断言 destSeen.size === declared.size === written.length；
    manifest 的 files[].path 用同一规范化函数。Windows 上再按 toLowerCase() 判重。
  cost: >-
    0.5 小时：约 15 行 + 2 条测试（双斜杠碰撞、大小写碰撞）。
  falsifier: >-
    用上面这个双斜杠 tar 跑 importScience：若返回的 verifiedFiles 与磁盘文件数相等，或第二条被拒并报冲突，本条被推翻。
  mission_principle: >-
    verifiedFiles 是给人看的安全数字。数字必须数“落地了什么”，不是“循环了几次”。

- id: ALG-06
  dimension: algorithm
  claim: >-
    replayPlan 的 gaps 不是可复现性缺口，而是“四个字段是否存在”。实测一个项目在（a）review decision=revise、
    （b）exports/empty.science 为 0 字节、（c）artifact payload 已被删除 的情况下，gaps: []，且 steps[] 仍带着
    sidecar 里的 checksum——它能对一串已经无法重放的字节说“没有缺口”。四个判定太松：no .science export 只看
    exports.length === 0（不解析清单、不要求非空、不区分文件/目录）；no review 只看 reviews.some(artifactId)
    （reject/revise 同样满足，签名是假也算）；payload 是否存在、是否仍等于 sidecar 的 sha256 完全不查
    （steps[].checksum 是抄来的，不是算的）；environment 轴已由 ARCHC-05 证明为死判定。
    工具描述说“does not claim a successful reproduction”没错，但它宣称产出 gaps，而 gaps 对最常见的失败形态
    （字节丢了、导出是空的、复核是拒绝）全不报。
  evidence:
    - 'research-phase2-replay/lib/plan.js:43-50 四个 gaps；:44 if (exports.length === 0)；:49 if (!reviews.some(r => r.artifactId === artifact.id))'
    - 'plan.js:56-64 steps[].checksum = artifact.checksum?.value ?? artifact.id（不重算）；:66 replayBoundary 只声明不执行'
    - 'OBSERVED（%TEMP%/w03-store-*）：record 后 rm 掉 artifacts/<sha256>、写 0 字节 exports/empty.science、review=revise → replayPlan.gaps = []，stepReview="revise"，stepChecksum 仍为 492d5ea49605…'
    - 'research-phase2-replay/index.js:15 描述“artifacts, checksums, ... exports and gaps”；gap-ux.md:294 建议把它做成按钮'
    - 'environment 轴：ARCHC-05 已证不可达（唯一可达 unavailable 的输入是 environment:""；本轮另测 environment:null 仍被 ?? 吞成记录者环境），本条只补另三轴'
  severity: medium
  recommendation: >-
    C1：每个 artifact 先做三项硬检查——payload 存在且 sha256(readBytes) === artifact.id；导出清单（解析 .science 里的
    science-manifest.json）确实包含该 id；复核用 verifyReview 的 head 且 decision === "accept"。任一不满足就进 gaps，
    steps 里给 checksum: {recorded, recomputed}。环境轴按 ARCHC-05 的 origin 修复。这样 gaps 才能当“还缺什么”的清单用。
  cost: >-
    0.5–1 人日：plan.js 约 40 行 + 复用 store 的 sha256/parseTar + 3 个夹具测试。
  falsifier: >-
    按上面三步构造（删 payload / 0 字节导出 / revise 复核），若 replayPlan 的 gaps 仍为空，本条成立；若任一项进入 gaps，则被推翻。
  mission_principle: >-
    缺口清单是让人知道下一步该做什么的工具（EVIDENCE-MODEL:85-88）。一个永远说“没缺口”的清单比没有清单更危险，
    因为它把“未检查”伪装成“已通过”。

- id: ALG-07
  dimension: algorithm
  claim: >-
    notebook 检查的 gaps 是写死的三条字符串（inspect.js:43-47），不是从 notebook 推出来的，所以任何 notebook 得到同一份“缺口”。
    唯一的依赖信号 importsOf 是对每行做 ^\s*(from|import) 正则（:4-11）：代码字符串里的一行 import sklearn 会被当成真依赖（假阳性），
    而 %run helper.ipynb、!pip install statsmodels、importlib.import_module(...) 完全不进列表（假阴性）。
    执行计数只逐格回显，没有任何连续性/重复判定：夹具里 1,2,2,7,8（重复 2、缺 3–6）以及一个 execution_count:null
    却带 output 的格子，gaps 与空 notebook 完全相同。也就是说，工具描述里的“reproducibility gaps”
    （notebook/index.js:15）目前没有任何一条是算出来的。
  evidence:
    - 'research-phase2-notebook/lib/inspect.js:4-11 importsOf 行正则；:39 executableCount；:43-47 gaps 为常量数组'
    - 'research-phase2-notebook/index.js:15 描述“cell order, execution counts, outputs, imports and reproducibility gaps”'
    - 'OBSERVED（%TEMP%/w03-notebook-* 的 7 格夹具：6 个 code + 1 个 markdown）：executableCount=5，code 格 executionCount=[1,2,2,7,null,8]（null 那格带 output），imports=["numpy","pandas","sklearn"]——sklearn 只出现在三引号字符串里，statsmodels 与 helper.ipynb 丢失；gaps 恒为 3 条固定文案'
  severity: medium
  recommendation: >-
    C1：把 gaps 变成算出来的：重复 execution_count、count 不连续（缺号）、output 与 null count 并存、
    cell 顺序与 count 顺序不一致，各给一条带 index 的 gap。importsOf 至少做字符串/注释剥离（跳过三引号与 #），
    并单列 foreignExec: ["%run helper.ipynb","!pip install statsmodels"]；返回里把 imports 标注为 naive line scan，
    避免被当成依赖清单引用。
  cost: >-
    0.5–1 人日：gap 规则约 30 行 + tokenizer 剥离约 30 行 + 3 个夹具测试。
  falsifier: >-
    用夹具（重复 count / 缺号 / 三引号内 import / %run）跑 inspect：若 gaps 仍恒为同样的三条、imports 仍含 sklearn
    且缺 statsmodels，则本条被推翻。
  mission_principle: >-
    “只读检查”不是“什么都不检查”。工具自报的 gaps 必须是它真看过的东西的函数，否则它就是一张印好的免责声明。
