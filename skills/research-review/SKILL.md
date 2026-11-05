---
name: research-review
description: "Run a bounded reviewer pass over a research artifact: accept, revise or reject with reasons tied to evidence, scope and reproducibility. Use before exporting or handing off a deliverable."
---

# Research review

Review one artifact at a time; do not review the author's character or politics.

## 工作语境（三种）

- **Explore**：只是讨论判断，不需要写复核记录。
- **Project**：需要留痕时，用工具写进项目。
- **Review**：交接或对外交付之前，**必须**写，并做一次校验。

  > 若当前不属于任何项目，**不要**为了"必须写"而新建项目：在回复里说明"无项目，故无复核记录"即可。
  > `reviews/` 只存在于项目内；自由讨论里的判断不需要落盘。

## 实际可用的工具（以当前注册为准）

| 工具 | 作用 | 落点 |
|---|---|---|
| `research_review_record` | 写入或追加一轮复核（decision / notes / reviewer / authority / template） | `.research/projects/<id>/reviews/<artifactId>.json` |
| `research_review_verify` | 逐轮校验内容签名，返回 `valid` / `rounds` / `validRounds` / `limitations` | 只读 |
| `research_review_list` | 列出项目内所有复核记录 | 只读 |
| `research_artifact_list` | 找到 artifact id 与标题 | 只读 |
| `research_provenance_get` | 读回七面（`review` 面在读取时从 `reviews/` 派生） | 只读 |

## Decision

- `accept`：证据与范围支持该 artifact 用于既定用途。
- `revise`：存在可在当前项目内修好的具名缺口；把它列出来。
- `reject`：主张无支撑、证据越界，或该 artifact 无法按当前表述使用。

## Minimum record（由工具参数承载，不是自由文档）

- artifact id + checksum —— `research_review_record` 从 artifact sidecar 取
- decision —— 工具参数，取值 `accept` / `revise` / `reject`
- reasons tied to evidence/scope —— `notes`
- what was not checked —— 写进 `notes`
- reviewer —— `reviewer`；可选 `authority`（author / reviewer / auditor）、`template`（general / evidence / reproducibility）
- date —— 工具自动写入 `createdAt`

## 落点与验证边界（必须一起说清）

- 复核写入 `reviews/` sidecar，**不修改 artifact 字节**。
- `research_review_verify` 的 `valid` 含义是：**每一轮的内容签名与该轮记录一致**。它**不**证明：
  - **审查人身份**：签名是无密钥的内容哈希，不是身份认证；`RESEARCH_REVIEW_AUTH` 默认 off；
  - **历史轮次完整**：单文件无法证明旧轮未被整体删除或重排；
  - **结论在科学上正确**。
- 顶层字段（`decision` / `notes` / …）是**最后一轮的镜像**；逐轮记录在 `history[]`，校验以 `history[]` 为准。
- 旧记录可能没有 `signature` → 会报 `unverifiable-legacy`，**不得当作已核验**。

## 何时写

- 在交接、导出 `.science`、或声称“已复核”之前：先 `research_review_record`，再 `research_review_verify`，
  并把 `validRounds / roundCount` 一并说明；不要把 `valid=true` 说成“已认证”。
- 只是自己在讨论时，`persistent_output: none` 合法。
