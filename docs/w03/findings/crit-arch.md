# W03 · 破坏性架构批判（只读轮）

# 基线：分支 w03-reading，HEAD b5f6c16（w03-base 冻结树）。未改动任何 plugins/skills/.research 真实数据。
# 本文件把 W03-BASELINE §6 的 B1/B2/B3 当靶子：不复述，只推翻或深化。标 NOT VERIFIED 的是我无法在本仓内证实的环节。
# 行号以本 commit 为准；store.js 行号取 read 工具编号（含空行）。

- id: ARCHC-01
  dimension: architecture
  claim: >-
    先纠正 B3：两处的面数其实都是 7，不是“面数不同”。真正的差别是 review 面的内容与可得出性。
    “不可变 artifact”只锁住字节（payload 与 sidecar 都写一次），review 面却在读时从 reviews/<id>.json
    投影，而且投影换了信封：sidecar 里是 {status, value|reason}，投影是 {status, source, decision, round,
    reviewer, authority, template, signature, createdAt, note}，没有 value。于是同一 artifact 有三种 review 面：
    （a）listArtifacts 直接返回 sidecar 快照；（b）getProvenance 返回派生面；（c）reviews 文件解析失败时静默回落到快照，
    此时 faces.review.reason 仍写着“review has not run”——文件明明存在。并且“记录时的事实 / 现在的推断”这个区分
    没有写进 face 自己，只写在 faces 之外的 reviewSource 里；而 EVIDENCE-MODEL.md:31 声称七面统一信封，实际有 3 面不是。
  evidence:
    - "store.js:249-266 派生 review 面，9 个字段，无 value"
    - "store.js:268-271 解析失败 → reviewFace 保持 snapshot，reviewSource='reviews-unreadable'，faces.review.reason 仍是 'review has not run'（假阴性）"
    - "store.js:239-287 与 store.js:218-237：同一 id，getProvenance 给派生面 + reviewSource + reviewSnapshot，listArtifacts 只给 sidecar 快照且无任何来源标记"
    - "store.js:189-194,207 environment 的 value 是 object；而同字段在 caller 传文本时是 string → 信封之外的类型也不稳"
    - "store.js:209 reproducibility 的 value 是 {checksum,bytes,source}，与 face() 生成的其余面同形；派生 review 面不同形"
    - "reviews.test.mjs:156-178 把这个“两次读不同”固化为意图，说明它是设计，不是疏漏"
    - "docs/EVIDENCE-MODEL.md:31（统一信封）与 :28（review 读时派生）在 3 行内自相矛盾"
    - "research-hub/client.js:272-279 只数 sidecar 的 provenance，reviews/ 里的记录永远进不了这个 N/7 —— 代码确定；浏览器显示 NOT VERIFIED"
  severity: high
  recommendation: >-
    C1：给 review 面做二分，而不是派生进同一个键。faces.review 永远只放记录时的快照（现状 store.js:210 的东西），
    派生结果移到顶层 derived.review = {status, decision, round, signature, verified, source}。这样七面信封重新成立、
    两个读者不再同名不同义；顺带把“签名是否有效”从 research_review_verify 的一个独立工具变成派生面自带字段
    （现在 Hub 把未验证的 signature 直接打印成 “Signature: ...”，见 research-hub/client.js:255-257）。
    若不想动结构，最小改动是把 reviewSource 复制进 face 内部（face.origin = 'snapshot' | 'derived' | 'unreadable'），
    并把 catch 分支的 reason 从 'review has not run' 改成 'review state unknown'。
  cost: >-
    0.5–1 人日：store.js 约 20 行（派生面搬家 + origin），EVIDENCE-MODEL.md:28-31 一段，reviews.test.mjs 两处断言反转，
    hub 面板改读派生字段。无 schema 破坏性变更（只加键）。
  falsifier: >-
    在真实项目的 reviews/<id>.json 写入非法 JSON，再调 research_provenance_get：预期 reviewSource='reviews-unreadable'
    且 faces.review.reason 仍是 'review has not run'。再对同一 artifact 先 research_artifact_list 后 research_provenance_get：
    两次 review 面互不相同，且面内没有任何字段说明哪一个来自记录、哪一个是现算。任一不成立，本条即被推翻。
  mission_principle: >-
    EVIDENCE-MODEL「Why this shape」：读者必须知道每个字段是什么意思。记录时的事实与现在的推断不得共用同一个键名和同一种信封，
    否则“知道字段含义”这件事在 review 面就先失效了。

- id: ARCHC-02
  dimension: architecture
  claim: >-
    B1 说 reproducibility 面恒为 available；这只说对了一半——它还是不可为假的：{checksum, bytes, source} 里
    checksum 与 bytes 都由同一份 bytes 生成，checksum.value 恒等于 artifact.id，source 只是 basename（内容型记录时为 null）。
    于是这个面实际上是“artifact 存在”的同义反复。更值得打的是去重：store.js:181-187 按 sha256 判重后直接 return existing，
    第二个调用方带来的 title/kind/source/environment/code/log/messages/literature/review 全部被丢弃，且返回 created:false
    让调用方看不出自己的元数据被拒。所以丢的不是“谁先产生它”（先者的 basename 留着），而是“还有谁、在什么环境下、
    用什么代码产生过同一字节”。内容身份成立，派生身份（同一内容的多重产者）为零。
  evidence:
    - "store.js:181-187 命中即 return existing，早于任何 sidecar 写入；被丢弃的字段清单即 recordArtifact 的整个输入面"
    - "store.js:174,203 source = basename(source)，内容型记录为 null → 先者的身份只是一段文件名"
    - "store.js:200 createdAt 只在创建时写，去重命中不追加任何时间戳 → 第二次产出在时间轴上不存在"
    - "store.test.mjs:33-39 只断言 created=false 与“仍只有 1 个 artifact”，没有断言第二次的 title/环境去了哪里 → 丢弃未被测试"
    - "store.js:209 reproducibility 的三个字段里两个由同一 buffer 派生 → 该面不可为假"
    - "去重范围是项目内（artifacts/ 在一个 project 下），跨项目同字节是两个 artifact → artifact.id 不是全局唯一"
    - "NOT VERIFIED：两个会话并发 record 同一新字节时，谁写 sidecar 由时序决定（工具层 isConcurrencySafe=false 只覆盖同会话并发）"
  severity: medium
  recommendation: >-
    C1，而且不要加 checksum（digest 已经绑死字节，第三个 hash 只会让同义反复更厚）。在去重命中时追加一条
    独立、append-only 的 encounters 记录：artifacts/<digest>.encounters.jsonl，每行 {recordedAt, title, kind, source,
    environment, code, messages}，不碰 sidecar、不改 id、不改 .science 格式（导出的 payload 里自然带上）。
    返回值加 encounter: 'appended' | 'recorded'。若要更省，先只加返回字段 deduped:{fields:['title','environment',...]}
    让调用方看到被拒的输入；但这仍然不留痕，只解决“知情”，不解决“可追溯”。
  cost: >-
    0.5–1 人日：store.js 约 25 行 + 一个 jsonl 追加函数 + 1 个新测试（同字节两个 title 都要留痕）；
    EVIDENCE-MODEL.md:15 一句改写。import/export 不需改（collectProjectFiles 已按目录收文件）。
  falsifier: >-
    用同一份字节、两个不同 title 与两个不同 environment 各调一次 research_artifact_record，然后 dump 整个 projects/<id>：
    第二个 title 与第二个 environment 在任何文件里都不存在（现在预期如此）。反之若某处已留痕，本条被推翻。
  mission_principle: >-
    EVIDENCE-MODEL:15“记录同一字节两次不创建第二个 artifact”——这条对可追溯性成立的前提是第二个产者也留下痕迹。
    否则去重不是“去重复”，是“删证据”。

- id: ARCHC-03
  dimension: architecture
  claim: >-
    会。同一个会话 cwd 在三条解析路径下可以得出不同 workspace root，而且是静默的。
    三条路径：host（research-host/index.js:212-223，取自 workingDirectory，大小写敏感、不剥尾分隔符）、
    hub（research-hub/client.js:31-41，大小写不敏感、剥尾分隔符）、workspace 页（research-workspace/client.js:416-464，
    root 取自 workspaces 服务的项目列表，不是会话 cwd）。这不是“理论分歧”：Hub 的测试已经把大小写不敏感钉死
    （client.test.mjs:87-93），host 侧没有任何对应用例（tools.test.mjs:11 只覆盖小写精确形式），两套绿测试锁住了互相矛盾的契约。
    fail-closed 只在“服务缺失”这一轴成立（index.js:214-217 抛错）；在“cwd 不认识”这一轴是 fail-open——
    它不报错，而是把项目目录本身当成新的 workspace root，静默嵌套出第二个 .research。
  evidence:
    - "research-host/index.js:221 正则无 /i、要求 [^/\\\\]+$；research-hub/client.js:34 有 /i 且先 strip 尾分隔符"
    - "纯函数模拟（OBSERVED）：cwd = 'D:\\WS\\.RESEARCH\\projects\\p1' → hostRoot 仍是整段 'D:\\WS\\.RESEARCH\\projects\\p1'，hubRoot = 'D:\\WS'；带尾分隔符同形。之后 host 会在项目目录下再建 .research/projects，而 Hub 显示原来那个项目"
    - "research-host/index.js:214-217 只对 workingDirectory 服务缺失 fail-closed；222 对未识别 cwd 直接 return cwd，不抛错（fail-open）"
    - "research-workspace/client.js:438 传给 workspaceFiles.list 的是相对路径 '.research/projects'，444-452 又从 workspaceRoot 重建 cwd（webpack 式字符串拼接），而不是用选中会话的 cwd —— 因此对子目录里创建的项目会拼出错误 cwd（相对路径的解析基准 NOT VERIFIED：依赖 DSH remote.workspaceFiles 契约，不在本仓）"
    - "research-workspace/client.js:461-463 catch → return []，438-439 !listed.ok → continue：读不到与没有，UI 上是同一个答案"
    - "id 轴三分：store.js:56-64 静默改写（'a b'→'ab'，'a/b'→'ab'，'P1!'→'P1'，纯函数 OBSERVED）；phase2-exec/index.js:22 显式拒绝 '.'/'..'；phase2-litdb/index.js:16 放过 '..' → join(root,'.research','projects','..','.litdb') = root/.research/.litdb（路径推导 OBSERVED，未实跑）"
  severity: high
  recommendation: >-
    C2：把“cwd → 项目作用域”做成唯一实现并让所有人调用它（新模块约 60 行：resolveRoot(cwd) / parseProjectId(cwd) /
    assertProjectId(id)），五个调用点全部改用它；两条硬规则：（1）id 非法就拒绝，不允许静默剥字符；
    （2）cwd 落在 .research/projects 下但没有项目 id 段、或 id 段非法时，报错并停止，绝不新造 root。
    另外让 workspace 页从会话 cwd 推 root（或反过来让 host 也接受 workspaces 服务的 root），二者只留一条。
  cost: >-
    1–1.5 人日：新增 ~60 行共享模块 + 5 处调用点各改 3–10 行 + host 一个“未识别 cwd 必须报错”的测试 +
    workspace 页改用会话 cwd。风险点是要先定“子目录会话算不算同一个 workspace”这一产品语义，不能只改代码。
  falsifier: >-
    用 'D:\\WS\\.RESEARCH\\projects\\p1'（大写给法）或带尾分隔符的路径作为会话 cwd，调 research_project_create：
    预期在 p1 目录下生成嵌套 .research/projects；同一时刻 Hub 把同一 cwd 解析成 workspaceRoot='D:\\WS' 并显示原项目。
    两处对同一字符串给出不同 root，即成立。若 host 与 Hub 对这两个输入给出同一 root，本条被推翻。
  mission_principle: >-
    workspace 页副标题把“Host `.research` 是唯一真源”当承诺。唯一真源必须只有一个解析器；三个解析器各自为政时，
    “唯一”只剩目录名，真源会被一次路径写法悄悄分成两棵树。

- id: ARCHC-04
  dimension: architecture
  claim: >-
    这不该叫低耦合，该叫没有属主的隐性契约。六个 bundle 之间没有共享模块，靠的是硬编码同一套布局：
    root 正则 6 份（host、exec、litdb、notebook、replay 逐字节相同；hub 是带 /i 的变体）、project id 校验 3 套、
    目录损坏容忍 3 套（store.js 逐项 catch 跳过、replay/plan.js 任一坏 sidecar 直接抛、两个 client 各自 catch 成空）。
    布局变更的失败模式不对称：host 大声报 unknown project，两个 UI 静默退化成“没有项目”——用户看到的是“我没有项目”，
    不是“布局变了”。而仓库里没有任何跨 bundle 布局测试：hub 的 135 行与 workspace 的 52 行测试只测各自的纯函数与渲染。
  evidence:
    - "6 份 root 正则：research-host/index.js:221、phase2-exec/index.js:14、phase2-litdb/index.js:11、phase2-notebook/index.js:9、phase2-replay/index.js:9（5 份相同）+ research-hub/client.js:34（/i 变体）"
    - "布局常量另有 4 处硬编码：store.js:52-64、phase2-litdb/index.js:19、research-workspace/client.js:438,442、research-hub/client.js:103,107,120"
    - "退化路径：research-workspace/client.js:438-439(continue)、461-463(catch→[])、research-hub/client.js:103-104(只有 ok 才读)、store.js:127-135(坏 project.json 直接丢)"
    - "损坏语义不一致：store.js:230-234 跳过坏 sidecar、replay/lib/plan.js:13-27 会让整个 replay plan 抛错、store.js:407-412 的 verifyReview 对坏 review 抛 ScienceError，而 getProvenance 的同类情况静默回落"
    - "测试面：research-hub/test/client.test.mjs 与 research-workspace/test/client.test.mjs 全仓仅 client.test.mjs:21 一行触及对方名字（断言 tab kind），无任何跨 bundle 布局断言"
  severity: medium
  recommendation: >-
    C0 先行、C1 备选。C0：加一条契约测试（tools/ 下一个 mjs，约 50 行），用一个临时 .research 夹具让五个 bundle 的
    reader 各自解析同一棵树，断言 root/id/列表结果一致——成本极低，且它能立刻抓出 ARCHC-03 的大小写分歧。
    C1：抽 @local/research-layout（常量 + resolve + id 策略），把 6 份正则收成 1 份；代价是多一个 npm 包要发布与维护
    （当前 9 个已发布包，成本真实存在），所以在真正要改布局之前不该做。
  cost: >-
    C0 约半天（一个测试文件 + 一条 README 布局契约声明）；C1 1–2 人日 + 一个新增发布包 + 5 处依赖改造。
  falsifier: >-
    把 store.js 里 'projects' 常量改成 'proj'，跑 node --test plugins/active/*/test/*.test.mjs：
    预期只有 reviews.test.mjs 的 3 处硬编码路径（32-33 行）失败，其余全绿——host 的 tools.test.mjs:11 自己拼 cwd 字面量，
    两个 client 测试完全不碰磁盘布局。若改常量后大面积测试变红，说明契约其实是有的，本条被推翻。
  mission_principle: >-
    W03-BASELINE §5 初心 1：工程纪律是为了保护自由探索。布局契约写进测试，后来的人才敢改结构；
    没有属主的隐性契约，恰恰是让人不敢动、又不知道哪里会静默丢数据的那种纪律。

- id: ARCHC-05
  dimension: architecture
  claim: >-
    B2 说 environment 缺省自动填充；真正的伤害是它填的是**记录者进程**的环境（DSH 宿主：platform/arch/node/process.env.PYTHON_VERSION），
    却被当作“该 artifact 的产出环境”以 status available 露面，且没有任何 origin/derived 标记。宿主是长生命周期进程，
    产出字节的可能是一个 Python 脚本、一次远程抓取、甚至另一台机器——这些都不在这个面里。
    直接后果是一个下游判断变成死代码：research_replay_plan 宣称报缺口，但 environment 那一轴永远绿。
  evidence:
    - "store.js:189-194 缺省值取自 process.*，即宿主进程；store.js:207 用 face() 包成 available"
    - "research-phase2-replay/lib/plan.js:46 if (environment.status !== 'available') gaps.push(...)：不传 environment 的 artifact 永远不满足该条件 → 该 gap 不可达"
    - "唯一能让它 unavailable 的路径是显式传 environment: ''（face('') → unavailable），这是意外输入，不是“未记录”路径"
    - "plan.js:45-49 的另外两条 gap（code/execution）可达，因为 face(undefined) 会 unavailable → 三条检查里只有 environment 是死的，这更误导：工具看起来在工作"
    - "NOT VERIFIED：宿主 process.env 是否曾携带 PYTHON_VERSION（若曾携带，则环境面可能混入一个与本 artifact 无关的第三方版本号）"
  severity: medium
  recommendation: >-
    C0+C1：自动填充时写 origin:'recording-process' 并保留 status:'available'（不假装缺失，也不假装是产出环境），
    caller 显式提供时写 origin:'caller'。然后 plan.js:46 的判定从 status 改成 origin —— 只有 origin:'caller' 才算
    环境已记录，'recording-process' 计为 gap。这样工具恢复“能报缺口”的能力，而现有数据不被追溯改写。
  cost: >-
    半天：store.js 约 8 行（origin 字段），plan.js 1 行，EVIDENCE-MODEL.md:33-36 一段，2 个测试（缺省 → origin=recording-process 且被 plan 报 gap）。
  falsifier: >-
    记录一个不传 environment 的 artifact，再跑 research_replay_plan：预期 gaps 中永不出现 “environment unavailable”。
    同时 faces.environment.value.node 恒等于当前宿主 Node 版本，与被记录字节的产出方式无关。若 plan 能报出该缺口，本条被推翻。
  mission_principle: >-
    workspace 文案 d3“缺失证据显示 unavailable，不推断”。自动填充的环境不是证据，是记录者的自画像；
    把它自报为 origin，比把它藏起来更符合“不推断”。

- id: ARCHC-06
  dimension: architecture
  claim: >-
    两个 client 没有重复实现同一套渲染——重复的是读取，而且重复成了三种不同实现。字面重合很小：
    hub 301 行里有 25 行（8.3%）能在 workspace 里逐字节找到，最长连续块 7 行（就是那份 --dsw-alias 调色板）。
    但“cwd → 项目列表 → project.json → 渲染”这条职责被写了三遍：workspace 25 行、hub 35 行、host 12 行，
    三者的路径基准不同（相对路径 vs 绝对路径 vs 会话 cwd）、失败语义不同（静默 [] vs 空 scope vs throw）。
    重复行数不是重点，“同一职责三个实现且互不相等”才是。
  evidence:
    - "字面重合 25/301 行（OBSERVED，脚本比对：取 trim 后长度≥8 的行，hub→workspace 逐字节命中）"
    - "最长连续块：workspace 102-108 vs hub 8-14，7 行，即 CSS 变量调色板；另有 3 行模块加载模板"
    - "读取职责：research-workspace/client.js:435-459（相对 '.research/projects' + 用 workspaceRoot 重建 cwd）vs research-hub/client.js:99-133（绝对路径 + 从 cwd 推 root）vs research-host/index.js:212-223（把 cwd 剥回 root）"
    - "失败语义：workspace 461-463 catch→[]、hub 103-104 非 ok 即跳过 → scope 'none'、host 214-217 throw"
    - "hub 只读 artifacts/reviews/.litdb 且只数 sidecar；workspace 只读 project.json；两者连读的字段集都不同（前者不显示 project.json 内容，后者不显示任何 artifact）"
  severity: low
  recommendation: >-
    C0：不要为“去掉重复”去抽共享包（两个 client 分属两个已发布 npm 包，抽共享代码就要动发布拓扑，收益不抵）。
    改为承认这是两份实现，用一条 golden 测试把两者对同一夹具的解析结果钉在一起（与 ARCHC-04 的 C0 同一个测试文件）。
    渲染不重复，保持现状；读取逻辑若要合并，只合并到 host 侧提供一个 research_project_scope 工具，client 只调工具、不碰文件系统——
    这是 C2，等 ARCHC-03 有结论后再做，别现在做。
  cost: >-
    C0 半天（并入 ARCHC-04 的契约测试，不新增文件）；C2（client 改为只调 host 工具）2 人日以上，不建议本轮做。
  falsifier: >-
    用 diff/自动比对重跑：若字面重合显著高于 25 行（例如渲染块大量相同），或两处读取在相对/绝对路径上其实等价，本条被推翻。
  mission_principle: >-
    workspace 页 hostHint：“本页不保存第二套索引”。它确实没有第二套索引，但有了第二套读取器；
    “不保存第二套”要扩写成“同一职责不写第二个实现”，否则索引只有一份、解释它的代码有三份。
