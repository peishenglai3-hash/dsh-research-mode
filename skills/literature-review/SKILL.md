---
name: literature-review
description: Build a traceable literature review with retrieval logs, inclusion/exclusion decisions, an evidence table and verifiable citations. Use for literature reviews, research-status summaries, theoretical lineages, or evidence chains; never fabricate DOIs or treat the local litdb sample as full journal coverage.
---

# literature-review — 可追溯文献综述

## 何时使用

用户需要“文献综述 / 研究现状 / 理论脉络 / 变量与机制梳理”，或要求把一组文献整理成可引用证据链时。

## 工作语境（三种，互不强制）

- **Explore · 开放阅读**：只是想知道某个概念或争论。**不需要建项目，也不需要落盘**。本 skill 可以只用于阅读与讨论；此时 `persistent_output: none` 是合法结果。
- **Project · 按需记录**：需要一个可交接的证据链时，才建立项目，并把证据落为不可变 Artifact。
- **Review · 需要复核**：要对外交付或交接时，另行按 `research-review` 走复核，**不要**在本 skill 里假装已完成复核。

## 实际可用的检索工具（以当前注册的研究工具为准）

| 工具 | 能查什么 | 性质 |
|---|---|---|
| `research_openalex_search` | OpenAlex works，跨学科 | 联网只读 |
| `research_crossref_search` | Crossref DOI 元数据 | 联网只读 |
| `research_datacite_search` | DataCite 数据集/软件 DOI | 联网只读 |
| `research_socarxiv_search` | OSF / SocArXiv 预印本 | 联网只读 |
| `research_pku_dataverse_search` | 北大开放研究数据（含 CFPS **元数据**） | 联网只读；不含微观数据 |
| `research_litdb_search` | 本机中文社科样本库（约 1,560 条，三刊，2018–2026） | 本地只读；**摘要级**；**不是三刊全量** |
| `research_litdb_snapshot` | 把本地样本库索引写入项目 `.litdb/index.json` | 只读源库，供 UI 检索 |

**当前没有对应工具的来源**：AI4Scholar、PubMed、Semantic Scholar、arXiv。
需要这些来源时，明确说明“当前没有对应工具”，**不要假装调用**。
若该会话启用了通用网页工具，可用 `web_search` / `web_fetch` 作为补充，并注明这是**通用网页检索**，不是专用学术连接器。

## 流程

1. **问题分解**：把问题拆成 2–4 个可检索概念；列出同义词与英文对应词。
2. **检索记录（文本，不是自动落盘）**：你自己写下每个源的 query、日期、筛选条件、命中数与纳入数。
   注意：**没有任何工具会把 connectors 的检索结果自动记成检索日志**。
   唯一会被工具持久化的检索痕迹，是 `research_litdb_search` 在传入 `projectId` 时写入的
   `.litdb/last-search.json`（仅该工具的查询，且只是缓存）。
3. **纳入/排除**：先按标题/摘要，再按全文；记录排除理由。不得用“相关性”替代因果表述。
4. **证据表**：每条含作者/年份/期刊/DOI 或稳定链接/研究设计/样本/主要发现/局限。
5. **综合**：按机制/争论/方法分组，不按“作者 A 说、作者 B 说”逐条堆叠；明确共识、分歧与空白。
6. **引用核验**：DOI/链接必须来自检索结果；找不到就写“未找到可核验来源”，不编造。

## 硬约束

- 不伪造 DOI、作者、期刊、年份或摘要。
- `litdb` 只读；不得写库、不得把摘要上传外部服务。
- 不把本地样本库称为“三刊全部文献”。
- **只有摘要或元数据时，必须明说这是摘要，不得声称读过全文。**
- 结论区分“观察到 / 推断 / 未知”；缺失证据标 `unavailable`。

## 交付与落点（区分“文本”与“工具持久化”）

- **文本产物**：`literature-review.md`。这是你用文件工具写在工作区的**普通文件**，不是研究数据面。
- `reports/` 只是**你自己创建工作区文件夹**的约定：`research_project_create` 只创建 `artifacts/`
  与 `exports/`，**没有任何研究工具会写 `reports/`**。不要把“我可以写”说成“工具会自动落盘”。
- **持久化产物**：需要不可变、可校验、可交接时，调用 `research_artifact_record`：
  - `projectId`：项目 id
  - `title`、`kind`（建议 `kind=literature-review`）
  - `source`：工作区相对路径（例如上面那个 md）
  - `literature`：**自由文本**，用来写 DOI、页码、锚点等定位信息
  - 落点：`.research/projects/<id>/artifacts/<sha256>` 与其 `.json` sidecar
- **读回核对**：`research_provenance_get` 可读回七面。注意 `literature` 面是**自由文本**；
  它的 `available` 只表示“有录入”，**不表示引用已被验证过**。
- **`persistent_output: none` 合法**：开放阅读场景下不落盘，是正确的选择，不是失败。
