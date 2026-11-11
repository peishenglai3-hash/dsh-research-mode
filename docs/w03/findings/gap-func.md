# W03 · 功能诊断：24 个工具与科研活动的对齐

**基线：** `w03-reading` @ `b5f6c16`（冻结 `w03-base`）　**类型：** 只读诊断　**日期：** 2026-11-10
**证据等级：** `OBSERVED`（本轮读码/实跑）/ `DOC`（文档记载）/ `NOT VERIFIED`

**方法：** 逐 bundle 读 `plugins/active/*/index.js` 与其 `lib/`，按"检索 → 读全文 → 定位 → 研究笔记 → 落成 Artifact → 证据读回 → 复核 → 导出/交换"八步对表。**未改动任何 plugins/skills/profile/.research 数据。**

**C 级定义（本文自用，避免歧义）：**

| 标 | 含义 |
|---|---|
| C0 | 只改口径/计数，不写代码 |
| C1 | 契约级：改 skill / tool description / preset 文本，让边界可机检 |
| C2 | 单工具级：新增或改造一个工具、一个 provenance 面 |
| C3 | 新能力级：跨 bundle、需要新依赖或新数据模型 |

> **范围限制（必须一起读）：** 本轮只读源码，**24 个工具是否在真实 profile 里全部注册成功 = `NOT VERIFIED`** —— `tools/release/profile-composition.mjs` 在本机 `spawnSync dsh ENOENT` 退 2（`W03-BASELINE.md:43`），没有做运行时 dump。另：仓外 `@local/porting-docling` 的返回形态（是否给页码级 locator、超时是否复现）**不可从本仓核验**，见 FUNC-01。

---

## 1. 工具面：24 个工具的真实签名与副作用

10 个 bundle 里只有 6 个注册工具（`research-hub` / `research-workspace` / 两个 preset 是 UI 或 patch，`index.js` 仅 52–54 字节）。

| # | 工具 | 必填参数 | 副作用 |
|---|---|---|---|
| 1 | `research_project_create` | `name` | 写 `.research/projects/<id>/{project.json,artifacts/,exports/}`（`store.js:95-96`） |
| 2 | `research_project_list` | — | 读 |
| 3 | `research_artifact_record` | `projectId`,`title` | 写 `artifacts/<sha256>` + sidecar（`store.js:181-214`） |
| 4 | `research_artifact_list` | `projectId` | 读 |
| 5 | `research_provenance_get` | `projectId`,`artifactId` | 读 |
| 6 | `research_review_record` | `projectId`,`artifactId`,`decision` | 写 `reviews/<artifactId>.json` |
| 7 | `research_review_verify` | `projectId`,`artifactId` | 读 |
| 8 | `research_review_list` | `projectId` | 读 |
| 9 | `research_science_export` | `projectId` | 读项目 + 写 `exports/<name>.science` |
| 10 | `research_science_import` | `archive` | 读 archive（校验 manifest sha256）+ 写 `.research/imports/<id>` |
| 11 | `research_openalex_search` | `query` | **出网** |
| 12 | `research_crossref_search` | `query` | **出网** |
| 13 | `research_datacite_search` | `query` | **出网** |
| 14 | `research_socarxiv_search` | `query` | **出网** |
| 15 | `research_pku_dataverse_search` | `query` | **出网** |
| 16 | `research_worldbank_indicator` | `country`,`indicator` | **出网** |
| 17 | `research_ilostat_data` | `dataflow`,`key` | **出网** |
| 18 | `research_nbs_snapshot` | `path` | 本地读（限 `$RESEARCH_NBS_DIR`，`connectors.js:225-227`） |
| 19 | `research_litdb_search` | `query` | 本地只读库；给 `projectId` 时写 `.litdb/last-search.json` |
| 20 | `research_litdb_snapshot` | `projectId` | 写 `.litdb/index.json` |
| 21 | `research_notebook_inspect` | `projectId`,`notebookPath` | 读 |
| 22 | `research_notebook_execute` | `projectId`,`notebookPath`,`confirm` | **执行** `python cell.py`（临时 cwd，15s），不落盘 |
| 23 | `research_replay_plan` | `projectId` | 读 |
| 24 | `research_replay_execute` | `argv`,`confirm` | **执行**任意 argv（临时 cwd，15s），不落盘 |

**8 个 connector 的返回形态（问题 4）：**

| 源 | 返回字段 | 全文？ | 摘要？ |
|---|---|---|---|
| openalex | id/doi/title/year/citedBy/venue/authors/url（`connectors.js:69-78`） | 否 | **否** |
| crossref | doi/title/year/venue/authors/url（`:93-101`） | 否 | **否**（且无 page） |
| datacite | doi/title/publisher/year/url/type（`:115-122`） | 否 | **否** |
| socarxiv | id/title/date/description/url（`:178-184`） | 否 | 有 description |
| pku-dataverse | name/doi/url（`:201-205`） | 否 | 否 |
| worldbank / ilostat / nbs | 指标行 / CSV 文本 / CSV 行 | — | — （是数据序列，不是文献） |

结论：**5 个文献类源里 0 个回全文，4 个连摘要都没有**；"检索"到"读全文"之间没有可承接的字段。

## 2. 八步覆盖度

| 步 | 承接者 | 判定 |
|---|---|---|
| 检索 | 8 connector + litdb（#11-20） | **有**，但只到元数据 |
| 读全文 | —— | **无**（FUNC-01） |
| 定位（页/锚点） | 仅 `literature` 自由文本（#3 的一个 string 面） | **无工具**（FUNC-02） |
| 形成研究笔记 | 仅 `artifact_record`，且须先自备文件 | **无承接者**（FUNC-05） |
| 落成 Artifact | #3 | **有** |
| 证据读回 | #4/#5，只读 sidecar | **半**：不校验字节（FUNC-03） |
| 复核 | #6/#7/#8 + #22/#24 | **半**：执行不进证据链（FUNC-04） |
| 导出/交换 | #9/#10（import 侧校验 sha256） | **有**，但导出侧重算（FUNC-03） |

**只能靠"模型自己遵守文本"的两处：** 定位（`literature` 自由文本）、执行闸（`confirm=true` 是工具参数，`README.md:95-96` 自认"不是人类同意"）。

---

```yaml
- id: FUNC-01
  dimension: functionality
  claim: >
    链路第 2 步「读全文」在 24 个工具里 0 承接：8 个 connector 全部只回元数据
    （5 个文献类源里 0 个回全文、4 个连摘要都没有），24 个工具没有任何一个接受
    文档路径/URL 并返回正文；唯一解析路径是仓外的 `@local/porting-docling`。
    因此「读没读全文」这个事实无法进入证据链——7 个面里没有「读自哪个文档」，
    只能靠 `literature` 自由文本自称。
  evidence:
    - "plugins/active/research-connectors/lib/connectors.js:69-78 (openalex: 无 abstract)"
    - "plugins/active/research-connectors/lib/connectors.js:93-101 (crossref: 无 abstract、无 page)"
    - "plugins/active/research-connectors/lib/connectors.js:115-122,201-205 (datacite / pku: 纯元数据)"
    - "Select-String plugins/active/*/index.js,plugins/active/*/lib/*.js -Pattern 'docling|pdf|pdfPath' → 0 命中"
    - "README.md:112 (「reading/parsing path depends on an external PDF parser (Docling)」)"
    - "docs/PROFILE-COMPOSITION.md:34,47 (porting-docling = external，clone 不可复现)"
    - "docs/EVIDENCE-MODEL.md:21-29 (七面清单里无 readSource/source-document 面)"
  severity: high
  recommendation: >
    C1：把「第 2 步不由本插件集提供」写进 skill 与 tool description 的显式边界，
    并在 artifact 面补一个 `readSource: unavailable` 的占位，让「没读全文」可被记录为未知
    而不是被默认。C3（备选）：内置解析并把 page/anchor 一起写入 locator。
    「Docling 是否给页码级 locator」= NOT VERIFIED（源码不在本仓）。
  cost: S（C1）/ L（C3）
  falsifier: >
    任一 research_* 工具的参数里出现 document/url/pdf 且返回正文；或 7 面里出现
    记录「读自哪份文档 + 页码范围」的结构化面。
  mission_principle: >
    「未知是一等状态……never inferred」（README.md:103）；「让实际科研活动决定工程构型」
    （W03-BASELINE.md:86）——阅读是科研活动的第一步，却是唯一没有工具承接的一步。

- id: FUNC-02
  dimension: functionality
  claim: >
    「定位（页/锚点）」没有工具承接：24 个工具的 schema 里没有任何 page/anchor/quote/span
    入参或出参；唯一的定位通道是 `research_artifact_record` 的 `literature` 面，
    其 schema 是 `{type:'string'}` 自由文本。于是「页码/锚点可逐条核验」完全依赖模型
    自觉遵守 skill 文本——而 skill 自己也承认 `literature.available` 只表示"有录入"。
  evidence:
    - "plugins/active/research-host/index.js:44-46 (faceInput → {type:'string'})"
    - "plugins/active/research-host/index.js:90 (literature 面 = 自由文本)"
    - "docs/EVIDENCE-MODEL.md:29 (literature | caller | citation locators (free text))"
    - "skills/literature-review/SKILL.md:63,65-66 (自由文本；available 不表示引用已验证)"
    - "grep 'anchor|pageNo|span|quote' plugins/active/*/index.js → 仅命中文档字符串，无参数"
  severity: high
  recommendation: >
    C2：把 `literature` 从 string 拆成结构化 locator 列表
    `[{docId, page, anchor, quoteSha256}]`，或新增 `research_locator_add`；
    在未实现前，C1 先把 skill 里任何"可核验"措辞降级为"自由文本，未核验"。
  cost: M
  falsifier: >
    出现带 page/anchor/quote 字段的工具参数或 provenance 面；或 `research_review_verify`
    能对某条 locator 给出"命中/未命中"的判定。
  mission_principle: >
    「artifact 是单位，不是答案」（README.md:102）——一个不能被指回原句的引用，
    只是一个更长的答案。

- id: FUNC-03
  dimension: functionality
  claim: >
    「证据读回」读到的是声明，不是字节：`research_provenance_get` 全程只用 readJson 读
    sidecar 与 reviews，**从不 readBytes payload、从不重算 sha256**；能出发 readBytes 的
    只有 recordArtifact / collectProjectFiles / importScience 三处。反过来，导出时
    manifest 里的 sha256 是当场从字节重算的——于是一个被改坏/替换过的 payload 能导出一份
    完全自洽的 `.science`，交接方按 manifest 校验也查不出来。这是"读回"与"导出/交换"
    两步共同的缺口，且与 B1（reproducibility 面恒 available，`store.js:209`）不是同一件事。
  evidence:
    - "plugins/active/research-host/lib/store.js:239-287 (getProvenance: 只有 readJson，无 readBytes)"
    - "Select-String store.js -Pattern 'readBytes' → 173, 535, 609 三处；均不在 getProvenance 内"
    - "plugins/active/research-host/lib/store.js:535-536 (导出时 sha256(data) 重算并写入 manifest)"
    - "plugins/active/research-host/lib/store.js:617-619 (import 侧只校验 manifest，不校验 sidecar)"
    - "grep 'verify' plugins/active/*/index.js → 只有 review_verify，无 artifact_verify"
  severity: high
  recommendation: >
    C2：新增 `research_artifact_verify`（readBytes(payload) → sha256 与 sidecar.checksum 比对，
    返回 match/mismatch/bytes），并让 `science_export` 在 payload 与 sidecar 不一致时拒收或标注。
    这是闭合"读回"最便宜的一刀。
  cost: S
  falsifier: >
    存在任一工具在读取 artifact 时重算 payload 的 sha256 并与 sidecar 比对；
    或 export 对 checksum 不匹配的 payload 报错而非静默打包。
  mission_principle: >
    「未知是一等状态」（README.md:103）；「因为科研产出要能交给一个不信你的人」
    （EVIDENCE-MODEL.md:85）——交给别人之前，至少先自己验一遍字节。

- id: FUNC-04
  dimension: functionality
  claim: >
    「复核」跑得动，但留不下证据，而且跑在空目录里：`research_notebook_execute` 只把单个
    cell 的源码写成 `tmp/cell.py` 并以 tmp 为 cwd 执行（项目数据与本地模块都不在 cwd）；
    `research_replay_execute` 同样 mkdtemp + cwd，且 `projectRoot` 解析失败被
    `.catch(()=>undefined)` 吞掉，projectId 沦为标注。两者的结果只作为工具返回值进入对话，
    **不写 artifact、不写 review**；而 provenance 的 code/execution/environment 三面是调用方
    自由文本。结论：可以"跑一次"，也可以"记一次我跑过"，但没有工具能记录"这次跑的结果"。
  evidence:
    - "plugins/active/research-phase2-exec/index.js:68-73 (只写 cell.py，cwd=临时目录)"
    - "plugins/active/research-phase2-exec/index.js:100,101-104 (catch 吞掉 projectRoot；mkdtemp + cwd)"
    - "plugins/active/research-phase2-exec/index.js:73,106-114 (结果只 return，无 io 写入)"
    - "plugins/active/research-host/index.js:85-87 (code/log/environment = Optional 自由文本)"
    - "docs/EVIDENCE-MODEL.md:27,46-48 (reproducibility = computed；「no replay in this release」)"
    - "README.md:94-96 (无 per-tool 授权闸；confirm=true 是工具参数，不是人类同意)"
  severity: high
  recommendation: >
    C2：exec 的返回落成一个 `kind=execution-log` 的 artifact，并自动填 execution/environment 面；
    replay 的 cwd 改为项目根的只读视图（否则"复现"连输入都看不见）。在实现前，C1 把
    EVIDENCE-MODEL.md:46-48「no replay」与 phase2-exec 的存在对齐，别让文档说没有、源码里有两个。
  cost: M
  falsifier: >
    执行类工具跑完后 artifacts/ 下出现新的 sidecar 且 execution 面为 available；
    或 replay 的 cwd 等于项目根。
  mission_principle: >
    「纪律活在文本里，不在工作流引擎里」（README.md:106）——那至少要保证文本与工程不互相打脸；
    「让实际科研活动决定工程构型」（W03-BASELINE.md:86）。

- id: FUNC-05
  dimension: functionality
  claim: >
    「形成研究笔记」没有承接者：`research_project_create` 只建 artifacts/ 与 exports/，
    全仓 0 处写 `reports/`，skills 里 0 处承诺 `notebooks/`；检索日志同样无持久化——
    literature-review 自己写明"没有任何工具会把 connectors 的检索结果自动记成检索日志"，
    唯一被工具持久化的检索痕迹是 litdb 的 last-search.json（且只是缓存）。
    笔记只能落到 `artifacts/<sha256>`（不可读名），且要求先自备 source 文件或整段 content。
  evidence:
    - "plugins/active/research-host/lib/store.js:95-96 (只 mkdir artifacts/ 与 exports/)"
    - "Select-String plugins/active/*/index.js,*/lib/*.js -Pattern \"'reports'|reports/|notebooks\" → 0"
    - "Select-String skills/*/SKILL.md -Pattern 'notebooks' → 0"
    - "skills/literature-review/SKILL.md:38 (没有工具记检索日志)"
    - "skills/literature-review/SKILL.md:57-58 (没有任何研究工具会写 reports/)"
    - "plugins/active/research-phase2-exec/index.js:50 (no notebook mutation)"
  severity: medium
  recommendation: >
    C0/C1：不新增工具，而是把口径收紧——在 skill 与 preset 里把 `reports/` 明确为"用户自建、
    非研究数据面"，并把"检索日志"推荐为 `kind=search-log` 的 artifact（一次 record 就够）；
    删除任何让人以为工具会自动落盘的措辞。
  cost: S
  falsifier: >
    出现写 `reports/` 或 `notebooks/` 的工具；或 connector 类工具在传入 projectId 时留下检索记录。
  mission_principle: >
    「纪律活在文本里」（README.md:106）——这句只有在下游不误解"我可以写"="工具会落盘"时才成立；
    「不要把'我可以写'说成'工具会自动落盘'」（literature-review SKILL.md:58）已经是原文。

- id: FUNC-06
  dimension: functionality
  claim: >
    "24 个工具"是源码计数，不是可用面：`research-phase2-exec` 为 `@local/...` 且
    `private:true`，不在 profile-composition.json 的 13 个 composed bundle 里（命中 0）；
    基线却把"10 bundle / 24 工具"与"phase2-exec private、不发布"写在同一段。结果是
    `research_notebook_execute` 与 `research_replay_execute` 这 2 个工具在文档化 profile 中
    不存在——恰好就是"执行/复核"那一步的两个工具。
  evidence:
    - "plugins/active/research-phase2-exec/package.json:4 (\"private\": true)"
    - "Select-String docs/profile-composition.json -Pattern 'research-phase2-exec' → 0 命中"
    - "docs/profile-composition.json: totals.inRepo=9, composedBundles=13, external=1"
    - "docs/w03/W03-BASELINE.md:19-20 (10 bundle/24 工具 与 private 并列)"
    - "docs/w03/W03-BASELINE.md:43 (profile-composition 脚本 spawnSync dsh ENOENT 退 2，未做运行时核验)"
  severity: medium
  recommendation: >
    C0：把口径分成"源码 24 / composed 22 / 运行时未核验"三行，写进 README 与基线；
    若要保留 24，就把 phase2-exec 纳入发布并把 private:false，而不是只改文档。
  cost: S
  falsifier: >
    profile-composition.json 出现 research-phase2-exec 行且 dump 里 24 个工具全部 mounted。
  mission_principle: >
    「这个软件不做什么」比做什么更重要（README.md:80-98）——计数也是一样：
    报 24 的那一刻，读者会以为 24 都能用。
```

---

## 3. 未证实与不做的事

- **`NOT VERIFIED`**：24 个工具在真实 profile 里是否全部注册成功（无运行时 dump，见 `W03-BASELINE.md:43`）。
- **`NOT VERIFIED`**：`@local/porting-docling` 是否返回页码级 locator、其超时是否在本机复现——源码不在本仓。
- **未做**：任何 `git` 写操作、profile 改动、安装、出网；未触碰 `.research` 真实数据。本轮仅新增本文件。
