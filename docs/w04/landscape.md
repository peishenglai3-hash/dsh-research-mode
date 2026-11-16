# W04 · 开源生态对照（主控亲自调研）

**日期：** 2026-11-16　**方法：** web 检索 + 公开 README/文档；**未安装、未运行**任何第三方系统。
**证据等级：** `READ`（读到了公开材料）/ `DOC`（官方自述）/ `NOT VERIFIED`（未能核实）。
**标尺：** 不是"功能多少"，而是用户的愿景——**保护人对知识的追求 / 普惠 / 开放 / 自由探索 / 人与 AI 共创 / 找到适合自己的方式**。

---

## 1. 对照表

| 系统 | 形态 | 开放性 | 架构 | 个性化 | 集成 | 赋能点 | 主要问题（按愿景标尺） |
|---|---|---|---|---|---|---|---|
| **PaperQA2**（Future-House/paper-qa） | 库 + CLI | 开源；**许可证未核实**（`NOT VERIFIED`） | 本地 PDF/文本语料 + agentic RAG；支持 LiteLLM / llama.cpp / ollama | 中：可换模型、可配 `evidence_k` | 弱：库级，无编辑器/会话集成 | **读**：本地全文检索 + 带内文引用的回答 | 为"回答"优化，不产出可复核的证据对象；小模型效果差（官方自述） |
| **OpenScholar** | 代码 + 模型 + 基准 | 代码开源；模型 `Llama-3.1_OpenScholar-8B` **Apache-2.0** | 检索增强 LM + ScholarQABench + 专家评估 | 中：领域可换语料 | 弱：研究原型 | **读/写**：文献综述级合成，含引用 | 面向 AI/CS 语料与英文；社科与中文覆盖未证 |
| **STORM / Co-STORM**（stanford-oval） | 系统 + 报告 | **MIT** | 多视角提问 → 大纲 → 长文；Co-STORM 有 moderator + 人类可插话 + mind map | 中 | 弱：独立应用 | **写**：从零生成有引用的长文 | 优化"生成一篇 Wikipedia 式长文"，不是"留下可追溯的研究过程" |
| **GPT-Researcher** | 服务/库 | 开源（许可证未核实） | planner + execution agents + publisher；支持 MCP client | 中高：可定制 agent | 中：MCP、导出 PDF/Word | **读/写**：并行检索 + 报告 | "报告"是终点，不是证据；引用质量取决于抓取 |
| **AI Scientist**（SakanaAI） | 研究自动化 | **Apache-2.0**（据第三方许可审计，`DOC`） | 全流程自动化：想法→实验→写论文→评审；**会执行 LLM 写的代码** | 低 | 弱 | **全流程**：端到端科研自动化 | 官方自警"必须容器化、限制网络"；把"生成论文"当目标，与"保护人对知识的追求"直接冲突 |
| **Elicit** | SaaS | **闭源**；$49/月起，API/MCP 在 Pro 档 | 云；系统综述流程 | 低 | 中：API/MCP（付费档） | **评/读**：结构化综述与数据抽取 | 语料与流程在厂商侧；批量导出受合同限制（第三方评测称） |
| **Consensus** | SaaS | 闭源 | 220M 论文库 + 语义/关键词检索 + 排序 | 低 | 低 | **读**：以论文为依据的回答 | 只能"找到并总结"，不能留下自己的证据链 |
| **Undermind** | SaaS + MCP | 闭源；$16/月起 | 深度检索 agent，追引用与作者，直到"不再有新结果" | 中 | **强**：MCP server 可接 Claude/ChatGPT/Cursor/VS Code | **读**：深度文献发现 | 深度检索的"停止条件"由厂商定义，不可审计 |
| **SciSpace** | SaaS 工作台 | 闭源；$12/月起 | 多 agent + 阅读器 + 数据抽取 | 中 | 中 | **读/评**：全流程工作台 | 工作台黏性来自数据托管，迁移成本高 |
| **HuggingFace Papers** | 社区 + API | 开放 | arXiv 策展 + 每日榜单 + 结构化 metadata API | 低 | 中：API/skill | **发现**：AI 领域最新论文 | 只覆盖 AI/CS；点赞机制≠质量 |
| **zotero-mcp-server** | MCP | 开源（许可证未核实） | 本地 Zotero 库 → 语义检索（可全文本）→ MCP | 高：自己的库 | **强**：Claude/ChatGPT 等 | **读**：个人文献库接入对话 | 依赖 Zotero 生态；嵌入需 OpenAI Batch 或本地模型 |

**共同缺口（对愿景而言）：** 没有一个把"**证据**"当成一等对象——它们优化的是**答案/报告/论文**。这正是 research-mode 已经押注、但还没做透的差异点。

---

## 2. 可移植的 5 个模式

1. **本地语料上的全文检索 + 引用定位**（PaperQA2）
   移植到 DSH 的最小形态：一个 `research_corpus_index` 工具，对 `.research/knowledge/` 下的 PDF/文本建本地索引（SQLite FTS5 + 文件哈希），返回 `{path, page?, quote}`。成本 M，C1。
   *理由：* 现在的阅读闭环只有"单篇解析"，没有"在语料里找"。

2. **Planner / Executor 分离**（GPT-Researcher）
   最小形态：把"研究计划"做成一份可编辑的 artifact（`plan.md` + 结构化 `questions[]`），执行阶段逐条登记证据。成本 S–M，C1。
   *理由：* 与现有 artifact 体系天然契合，且能解决"长会话失去方向感"。

3. **多视角提问**（STORM / Co-STORM）
   最小形态：一个 `research_perspectives` 技能（不是工具），按学科惯例生成 3–5 个互异视角的问题清单，落成 plan artifact。成本 S，C0。
   *理由：* 本轮的"八维批判"就是它的手工版；可产品化。

4. **MCP 作为对外集成面**（Undermind、zotero-mcp）
   最小形态：把 research-mode 的**只读**能力（project 列表、artifact 元数据、provenance）暴露为一个本地 MCP server，让别的 agent 能查。成本 M，C2。
   *理由：* 愿景里的"共创共享"在单机上最现实的形式是"可被别的 agent 读取"。

5. **执行即风险：容器化 + 限制网络**（AI Scientist 的官方警告）
   最小形态：保持 `research-phase2-exec` 不发布；若未来恢复，必须绑定沙箱与逐工具授权。成本 0（现状即正确），C0 文档化。

---

## 3. 需要警惕的 5 件事

1. **"自动生成论文"会反噬愿景。** AI Scientist 已能让 AI 写的论文过人审；这直接冲击"人对知识的追求"与信用分配。research-mode 不应提供"一键成文"，应提供"可复核的写作材料"。
2. **答案优先的产品会隐藏不确定性。** Elicit/Consensus 的输出看起来比它们能证明的更确定；这正是本项目 `available ≠ 已验证` 要防的。
3. **闭源工具持有语料。** 迁移成本是产品护城河，不是用户收益。
4. **MCP 扩散放大数据边界风险。** 每个 MCP server 都是一条出站路径；本机已装多个，需在文档里明确"哪些会出网"。
5. **基准 ≠ 真实科研。** ScholarQABench 这类基准测的是英文 AI 文献问答，不能外推到中文社科。

---

## 4. 对下一阶段的直接含义

- **不要**去做"更强的综述生成"——那是红海，且与愿景冲突。
- **要**把"证据对象"做透：本地语料检索 + 计划 artifact + 引用定位 + 可复核读回。
- 对外集成优先用 **MCP 只读面**，而不是再造一个云服务。

**NOT VERIFIED：** PaperQA2 / GPT-Researcher / zotero-mcp-server 的许可证；Elicit 合同限制的原文；各 SaaS 的实际数据训练政策。
