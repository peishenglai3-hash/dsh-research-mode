# W03 · 阅读证据闭环回执

**日期：** 2026-11-11
**结论：** `PARTIAL`（证据层 `PASS_SCOPED` · 解析器 `MEASURED` · 产品内会话轨迹 `NOT VERIFIED`）
**材料：** 合成两页 PDF（`tools/w03/fixtures/synthetic-2page.pdf`，1,486 B，sha256 `8916a0ba…a4e648`）——**不含任何真实研究数据**

---

## 1. 三个必须分开的问题

| 问题 | 答案 | 等级 |
|---|---|---|
| 解析器**能不能**在产品里跑起来？ | 能，但要 600 s 超时；且只给锚点 | `OBSERVED` |
| 笔记里的引用**是不是真的来自**那篇文献？ | 用逐字子串校验，可证明 | `OBSERVED` |
| 产品里**有没有**跑过一次完整会话？ | 没有 | `NOT VERIFIED` |

把这三个混成一个"PASS"就是自欺。下面逐条给证据。

---

## 2. 解析器：可到达，但代价被如实记录

### 2.1 默认配置下必然失败

```text
mcp__docling__convert_document_into_docling_document(synthetic-2page.pdf)
→ Error: Request timed out          # MCP toolCallTimeoutMs 默认 60000
```

### 2.2 直接说 MCP 协议（Node spawn `docling-mcp-server --transport stdio`）

```text
env: DOCLING_MCP_CONVERSION_MODE=local

run 1  initialize 15.2 s · convert 115.2 s · isError=false · from_cache=false
run 2  initialize 15.9 s · convert 316.6 s · isError=false · from_cache=false
       document_key = 1230dfb99df8e9b2ee9fb768c7a7e979

get_overview_of_document_anchors      6 ms   {"structure": "[anchor:#/texts/0] text\n[anchor:#/texts/1] text"}
get_text_of_document_item_at_anchor   4 ms   {"text": "… Finding A: … ANCHOR-P1-UNIQUE-7F3A"}
```

**三条事实：**

1. **超时是唯一阻断**，但 300 s 不够——第二次跑用了 316.6 s。受控 profile 已设为 **600000**。
2. **MCP 不给页号**：`overview` 只有 `anchor:#/texts/N`，`/page/i` 不命中。页号只在 CLI 结构化 JSON 的 `prov[].page_no` 里（`#/texts/0 → page 1`，`#/texts/1 → page 2`）。
3. **首次转换会联网**：CLI 那次日志明确 `Fetching model docling-project/docling-models … Downloaded … in 7.98 sec`。所以"离线受控"必须**先预热**，否则第一次转换就是一次未声明的出网。

### 2.3 因此："页级引用"与"产品内可读"目前不能同时成立

| 路径 | 有页号 | 在产品内 | 代价 |
|---|---|---|---|
| Docling **MCP** | ❌ | ✅ | 115–317 s/篇，需 600 s 超时 |
| Docling **CLI** | ✅（`prov[].page_no`） | ❌（要 shell 预处理） | 46.7 s，首次联网 |

这不是 bug，是一个**必须在产品上做出的选择**。本轮的选择是：**证据单位定在锚点级**，页号作为可选的 CLI 预处理产物记录在笔记里（见 §3 的 `page` 字段）。

---

## 3. 证据层：闭环可跑，且不是空话

`node tools/w03/verify-reading-loop.mjs` → **12/12 PASS**

```text
[PASS] source PDF has a stable sha256 — 8916a0ba98d909ef
[PASS] quote is present verbatim at #/texts/0
[PASS] quote is present verbatim at #/texts/1
[PASS] a fabricated quote is rejected by the same check (negative control)
[PASS] artifact id is the sha256 of the note bytes
[PASS] artifact is immutable by construction (same bytes dedupe)
[PASS] note size stays inside an operational limit — 450 B
[PASS] literature face is available
[PASS] literature face carries the source hash
[PASS] literature face carries both anchors
[PASS] read-back reports the payload matches its id
[PASS] read-back reports the recorded checksum
```

它证明的是**保真**，不是**为真**：

- 引用必须是解析输出里**逐字存在**的子串（所以"编一条引文"会失败）；
- `literature` 面带着源哈希 + 锚点 + 引用，能被 `provenance_get` 原样读回；
- 读回时重算字节，`payloadVerified === true`；
- 篡改载荷 → `payloadVerified === false`（由 `payload-integrity.test.mjs` 覆盖）。

它**不证明**：解析器这次跑得对不对、锚点页码是否可信、这条引用是否支持那个论断——最后一条是研究者的判断，不是工具的。

---

## 4. 与目标构型的差距

| 目标 | 现状 | 差什么 |
|---|---|---|
| 读完一篇文献后，能留下"读过什么、依据哪一处、得出了什么" | ✅ 锚点级已可留 | 没有产品内一键路径；没有页号 |
| 解析器不是黑箱 | ✅ 延迟/粒度/联网全部量化 | 缺离线预热脚本 |
| 阅读痕迹可复核 | ✅ 引用逐字校验 + 读回验字节 | 尚无 UI 呈现 |

---

## 5. 复现步骤

```bash
# 证据层（不需要解析器，CI 里也跑这一条）
node tools/w03/verify-reading-loop.mjs

# 解析器（需要本机装 docling；会联网拉模型，除非已预热）
#   受控 profile 需 toolCallTimeoutMs >= 600000
#   然后用 MCP convert_document_into_docling_document + get_text_of_document_item_at_anchor
```

## 6. 回退

- profile：删掉 `toolCallTimeoutMs: 600000` 一行，`dsh plugin --profile w02-alpha install`。
- 仓库：`git revert` 本轮任一提交；`tools/w03/` 与 fixtures 可整目录删除，不影响插件。
