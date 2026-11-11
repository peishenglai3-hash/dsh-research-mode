# S1 · 主控亲自复核（不是子代理结论的转述）

**日期：** 2026-11-10
**环境：** `dsh-research-mode-public@w03-reading`（基线 `b5f6c16`），宿主内嵌 CLI `0.2.2-rc.1`，Node `v24.15.0`
**证据等级：** 全部 `OBSERVED`（本节每条都是我自己跑出来的；不是引用子代理）

> 这一节存在的理由：子代理可以写得很像，但**主控必须有一手证据**。下面 6 条我逐条复跑过。

---

## P-01 · 载荷被篡改，三条读路径都发现不了

**做法：** 直接 import `research-host/lib/store.js`，在临时 workspace 里建项目、记一个 artifact、往 payload 追加字节，再读回。

```text
artifactId                : 3c737b12…5a5073（= sha256 of 原始 bytes）
recordArtifact.bytes      : 56
追加 "TAMPERED EXTRA BYTES" 后实际字节数 : 78
实际 sha256               : f68d413c…58905c01  ≠ artifactId
getProvenance().checksum.value === 原 id : true
getProvenance().faces.reproducibility    : {"status":"available","value":{"checksum":"3c737b1…","bytes":56,…}}
listArtifacts() 报 bytes                 : 56（实际 78）
getProvenance() 顶层键                   : artifactId,title,checksum,faces,reviewSource,reviewSnapshot
```

**结论：** `getProvenance` 与 `listArtifacts` 全程只 `readJson`，**从不重算 sha256**；`readBytes` 只在记录（`:173`）与导出（`:535`）时出现。因此：

- 一个被改过的 payload，`provenance_get` 仍然报告**原始** checksum 与 bytes；
- 导出时 manifest 用**当时读到的字节**重算（`:535-536`），所以篡改后的 payload 能导出一份"完全自洽"的 `.science`；
- 导入侧反而会校验（`:652`）——**校验发生在进口，不发生在读口**。

这与 B1 不是同一件事：B1 是"这面恒 available"，P-01 是"available 的那个 checksum 可以与被描述的字节无关"。

**最小修法（未实施）：** 在 `getProvenance` 里重读 payload 并比对 id，返回 `payloadVerified: true|false`。加字段、无迁移、可测试。

---

## P-02 · Docling MCP 在默认超时下确实超时（产品内读不了 PDF）

**做法：** 在**当前会话**直接调用 `mcp__docling__convert_document_into_docling_document`，输入是 S1 留下的合成两页 PDF（1,486 B）。

```text
返回：Error: Request timed out
```

**结论：** 与 W02-S1 的记录一致。MCP client 的 `toolCallTimeoutMs` **默认 60000**（schema 见 §P-06 附），而转换在冷启动时超过 60 s。

---

## P-03 · 「模型已缓存、零下载」这个 S1 结论，在我这次配置下不成立

**做法：** 用 `docling.exe --to json` 转同一个 PDF，计时并看日志。

```text
INFO  Fetching model docling-project/docling-models (revision: v2.3.0)...
INFO  Downloaded model ... in 7.98 sec
INFO  Finished converting document synthetic-2page.pdf in 25.58 sec
ELAPSED_MS = 46726
```

**结论：** 这一次**发生了 HuggingFace 拉取**（7.98 s）。S1 曾记录"`already cached`、零下载"，那是**另一种调用配置**下的观察，不能外推为"Docling 永远不出网"。

**含义（对 T1 很重要）：** 即使把超时调大，"受控实例不得出网"这条要求也需要**离线预热**作为前置，否则首次转换会静默联网。这不是超时问题，是数据边界问题。

---

## P-04 · `~/.dsh/profiles/node_modules/@deepseek-ai` 下 195 个 junction **全部悬空**

```text
total=195  danglingJunctions=195  resolvable=0

dsh-mcp-client → Junction → C:\Users\<user>\AppData\Local\Programs\DSH Desktop\resources\app\node_modules\...
                              （实际安装目录是 "DeepSeek Harness"，该路径不存在）
```

**结论：** OI-04 不是"一个悬空 junction"，是**整目录 195 个**。宿主自己能跑（它从 app.asar 解析），但任何"去 profiles/node_modules 读插件源码"的验证都会失败。

**连带：** 我原本想读 `dsh-mcp-client` 的 Config schema，走文件系统失败；改走 `cordis_inspect_query(Config)` 才拿到（见 P-06）。

---

## P-05 · 第 4 条验证命令在无宿主环境不可复现

```text
node tools/release/profile-composition.mjs
→ failed to run "dsh --dump-config --profile w02-alpha": spawnSync dsh ENOENT
→ EXIT=2
```

原因：本机 `dsh` 是 `AppData\Roaming\npm\dsh.ps1`，Node 24 不允许直接 spawn `.ps1`；CI runner 上则根本没有宿主。脚本支持 `--from dump.txt`，但仓库里没有受控 dump。

**结论：** 仓库宣称的"四条验证"里有一条**只能在装了宿主的机器上手工跑**。CI 已按此设计为三条 + 测试（见 `.github/workflows/verify.yml`）。

---

## P-06 · 页号在结构化输出里可得；MCP 面只给锚点（P-07 实测）

**做法：** 解析 P-03 生成的 `synthetic-2page.json`。

```text
texts: 2   pages: 2
texts[0] page=1  label=text  "W02-S1 SYNTHETIC FIXTURE (NOT REAL RESEARCH DATA) Finding A: …"
texts[1] page=2  label=text  "W02-S1 SYNTHETIC FIXTURE - PAGE TWO Finding B: …"
page keys: 1,2
```

**结论：** `prov[0].page_no` 可靠存在，所以"锚点 → 页"在**结构化输出**里成立。MCP 面暴露的是 anchor + 文本（`get_text_of_document_item_at_anchor`）与 `get_page_thumbnail(page_no)`，是否把 `page_no` 映射到具体 anchor 仍需 C2-a 之后实测。

**附：C2-a 的确切参数（来自 `cordis_inspect_query` 的 Config schema，不是猜的）**

```json
"toolCallTimeoutMs": { "default": 60000, "type": ["number","null"] }
```

→ 在受控 profile 的 `porting-mcp-docling` 行加 `toolCallTimeoutMs: 600000`（**不是** 300000，见 P-07）；回退 = 删这一行 + `dsh plugin install`。

---

## P-07 · 直接对 Docling MCP 说协议：转换成功，但耗时 115–317 s，且**没有页号**

**做法：** 用 Node 直接 spawn `docling-mcp-server.exe --transport stdio`（env 带 `DOCLING_MCP_CONVERSION_MODE=local`），按 MCP JSON-RPC 调 `initialize` → `convert_document_into_docling_document` → `get_overview_of_document_anchors` → `get_text_of_document_item_at_anchor`。

```text
run 1: initialize 15.2 s · convert 115.2 s · isError=false · document_key=1230dfb9… · from_cache=false
run 2: initialize 15.9 s · convert 316.6 s · isError=false · document_key=1230dfb9… · from_cache=false

overview  6 ms   {"structure": "    [anchor:#/texts/0] text\n    [anchor:#/texts/1] text"}
overview mentions page: false
anchor #/texts/0  4 ms  {"text": "W02-S1 SYNTHETIC FIXTURE (NOT REAL RESEARCH DATA) Finding A: …
                        ANCHOR-P1-UNIQUE-7F3A"}
```

**三条结论，都会改变施工方案：**

1. **超时是唯一阻断，但不是 300 s 够。** 实测 115 s 与 317 s 两次，方差极大（每次新进程都重新加载模型）。`toolCallTimeoutMs` 必须给到 **600000**；给 300000 会在第二次那种情况下**照样失败**。
2. **MCP 面不给页码。** `get_overview_of_document_anchors` 只回 `anchor:#/texts/N` + label；`get_text_of_document_item_at_anchor` 回精确原文。页号只在 **CLI 的结构化 JSON**（`prov[].page_no`）里。
3. **因此"页级引用"和"产品内可读"目前是两条路，不能同时成立**：要么接受锚点级（产品内、慢），要么走 CLI 预处理（有页号、但要 shell + 会联网拉模型）。

> 这正是"让实际科研活动决定工程构型"的一个具体后果：不该为了页号去新增工具，而该先决定"阅读笔记的证据粒度是页还是锚点"。


---

## 汇总

| ID | 一句话 | 严重度 | 等级 |
|---|---|---|---|
| P-01 | 载荷篡改在读取与导出两侧都不可见 | P1 | C1 |
| P-02 | 产品内 PDF 转换在默认 60s 超时下失败 | P1 | C2-a |
| P-03 | Docling 首次转换会联网拉模型，"零下载"不可外推 | P1 | C2-a 前置 |
| P-04 | 195 个插件 junction 全部悬空 | P2 | 环境 |
| P-05 | 组合矩阵命令不可在 CI 复现 | P2 | C0 |
| P-06 | `prov[].page_no` 在 CLI 结构化输出里可得 | — | 事实 |
| P-07 | MCP 转换成功但需 115–317 s，且只给锚点不给页号 → C2-a 必须 600000 | P1 | C2-a |
