---
name: litdb
description: Read-only queries over a local Chinese social-science literature sample (three journals, 2018–2026, 1,560 records, nine fields). Use for topic/year/journal search, UID lookup, full relation-chain scans, and traceable evidence notes. Read-only; never write, migrate, redistribute or upload the database.
---

# litdb — 本地中文社科文献样本库（只读）

## 用途

查询用户自备的 `literature.db`：1,560 条《社会学研究》《探索与争鸣》《中国社会科学》2018–2026 的等额抽样记录，九字段（`uid/title/authors/year/journal/abstract/research_theme/relationship_chain/source_url`）。数据库包含摘要，不含全文、DOI 或关键词字段。

**它不是三刊全量**：三刊各 520 条是按刊按年配额抽样（约 58 条/刊/年），2026 年只有 155 条。引用时必须写“本地样本库”，不能写“三刊全部文献”。

## 硬约束（不可协商）

1. **只读**：数据库必须以 `mode=ro` 打开，并设置 `PRAGMA query_only=ON`；不得执行 `INSERT/UPDATE/DELETE/CREATE/DROP/ALTER`。
2. **不内置数据**：数据库不随技能/插件分发；由用户放在 `$RESEARCH_LITDB_PATH` 或默认 `~/.dsh/research/knowledge/litdb/literature.db`。
3. **不写库、不迁移、不重建**：本技能没有 `init` 命令；不要运行上游 `literature_store.py init`。
4. **不训练、不批量上云**：摘要受第三方版权保护；不得作为训练数据、不得上传外部服务、不得再分发。
5. **不接受任意 SQL**：只使用下面四个固定子命令；查询值由脚本参数绑定。
6. **来源保留**：每条结果保留 `uid` 与 `source_url`；摘要只在入选记录中读取，不把整库塞进一次 prompt。
7. **不动技能目录**：研究产物写到 `{projectDir}`，不写 `{baseDir}`。

## 命令

```bash
# 计数/期刊/年份/字段/数据库 SHA256
python "{baseDir}/scripts/litdb.py" stats --db "<DB>"

# 全量关系链分页（正式流程：16 页 × 100 条）
python "{baseDir}/scripts/litdb.py" relations --db "<DB>" --page 1 --page-size 100

# FTS5 候选检索（诊断/快速定位；正式流程仍用 relations 全量扫描）
python "{baseDir}/scripts/litdb.py" search --db "<DB>" --query "劳动控制" --top-k 5

# 按 UID 回查完整九字段（保持传入顺序）
python "{baseDir}/scripts/litdb.py" lookup --db "<DB>" --uids SHXJ-2018-0299831416AE
```

`--db` 省略时依次读 `$RESEARCH_LITDB_PATH`、`~/.dsh/research/knowledge/litdb/literature.db`。

## 数据质量与检索注意

- **FTS5 使用 trigram 分词**：3 字及以上查询可靠；2 字中文（如“社会”）会走 `LIKE` 回退，结果可能较宽。必须如实标注 `backend: like`。
- **3 组 7 行重复摘要**、`authors` 保留 CNKI 机构/上标数字；按作者检索前需清洗，不能把作者串当规范名。
- `source_url` 是 CNKI 详情页 token 链接，可能过期；**未验证可逐条解析**。
- 数据库指纹：`533ACECB6EA8D647DA856AD210A48F65664E0071BC6B7603BA78E0B80C7912A8`；全量关系链指纹：`294273E5F409C797AB67B01BCDF3B37F1B8E0A035320B21A975B7EA12AAA2202`。换库后必须重算并在报告中记录。
- 上游 README 的 39/39、51/51、35/35 测试在仓库内无测试文件，**不可复现**；不要转述为“已验证”。

## 与其它工具的关系

- 外部发现/引用：`paper-search-mcp`、`dsh-ai4scholar`、Zotero。
- 全文解析：Docling（仅在合法获得全文时）。
- 本库：**本地样本库/回归测试集**，不是 open-science Literature Library 的替代；不写入 DSH memory、不写入 WeKnora/RAG、不同步云端。

## 来源与许可

脚本契约改编自 `Skadi2333215/hypothesis-generator-openclaw-skill`（MIT）。数据库中的第三方摘要与链接权利归原权利人；本技能只做本地只读访问，不再分发数据。
