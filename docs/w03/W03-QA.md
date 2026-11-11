# W03 · QA 记录

**状态：** `PARTIAL` —— 主控对抗性自审**已完成**；**独立 QA 未返回**（两个实例，均在窗口内未产出文件）。
**因此：G4 未通过，本轮不合并 `main`、不打 release tag。**

> 记录这一点比补一个"通过"更重要：写这些修复的人和审这些修复的人是同一个，结论天生有偏。下面的每一条都给了可复跑的命令，便于第二个人推翻。

---

## 1. 主控自审（有利益冲突，已声明）

### C1「projectId 路径穿越已修」→ `UPHELD`（在我试过的输入上）

改前（`b5f6c16`）：`inspectNotebook(ws,'..','projects/victim/analysis.ipynb')` 返回受害项目的
`SECRET_VICTIM_CELL`。改后逐条试绕过：

| 输入 | 结果 |
|---|---|
| `pid='..'` | `invalid projectId` |
| `pid='...'` | `ENOENT`（无穿越目录存在） |
| `pid='.. '` / `' ..'` | `invalid projectId`（字符类不含空格） |
| `pid='atk'` + 绝对 `notebookPath` 指向受害文件 | `notebook path is outside the project` |
| `pid='atk'` + `../../victim/analysis.ipynb` | `ENOENT`（realpath 拒绝） |
| `pid='atk'` + `..\..\victim\analysis.ipynb` | `ENOENT` |
| junction 指到 workspace 外 | 仍可读（**未修**：realpath 会解析 junction），但前提是攻击者已能写 `.research/projects/` —— SEC-05 已记 |

**残留：** hardlink 未验证（SEC-05，`NOT VERIFIED`）。

### C2「载荷校验已修」→ `UPHELD`（读路径 + 导出），`PARTIALLY`（列表路径）

| 场景 | 结果 |
|---|---|
| 原样 payload | `payloadVerified: true`，`payloadBytes` 如实 |
| 追加字节 | `payloadVerified: false`，checksum 仍是记录值（两者分开） |
| 删除 payload | `payloadVerified: false`，不抛异常 |
| 篡改后导出 | `ScienceError: artifact bytes no longer match their id` |
| **同时**改 payload 与 sidecar | sidecar 里的 checksum 可被改成任意值，但 payload **文件名**仍是旧 id → 读时重算 `sha256(bytes) !== id` → `payloadVerified:false`。**除非攻击者连文件名一起改**，那已不是"篡改"而是"换一个 artifact" |
| `listArtifacts` | **仍盲信 sidecar**（未改）：它返回记录的 checksum/bytes，不验证。这是已知缺口，记在 `W03-ITERATION-PLAN.md` N1 的相邻项 |

### C3「阅读闭环已被可复现地验证」→ `PARTIALLY_UPHELD`

- **证明的**：引用必须是解析输出里逐字存在的子串；伪造引用会被同一条检查拒绝（负例控制）；笔记落成 artifact 后 id == sha256；读回验字节。
- **没证明的**：解析器这次跑得对不对；锚点页码可信；这条引用是否支持那个论断；产品内是否跑过一次完整会话（**没有**）。
- **风险**：fixture 与 quote 由同一人写，所以它证明的是**检查器有效**，不是**解析正确**。这一点已写进 `W03-READING-CLOSED-LOOP.md` §3 与 §1。

### C4「CI 覆盖了它声称的东西」→ `UPHELD`

五条命令均在无宿主环境可跑；每条的成功判据是退出码（不是输出文本）：

```text
node tools/w03/run-tests.mjs                 → 77 pass / 0 fail    EXIT 0
node tools/w01/probe-containment.mjs         → PASS (12 vectors)   EXIT 0
node tools/w01/s1-check-skill-contracts.mjs  → PASS (0 failures)   EXIT 0
node tools/release/npm-preflight.mjs         → PASS (100/100)      EXIT 0
node tools/w03/verify-reading-loop.mjs       → PASS (12 checks)    EXIT 0
```

GitHub Actions：`43005157360`、`43009022641`、`43009412755` 三次 **success**。

**已知薄弱处**：`probe-containment.mjs` 的 12 个向量只覆盖**未发布**的 exec bundle；已发布的三个 bug 是靠本轮新加的单元测试抓到的（`project-id.test.mjs`）。这是一条真实的覆盖缺口，已记入下一轮。

---

## 2. 我没能验证的

- GUI 内行为（本轮**没有开 GUI**）。
- Node 22.19 分支、mac/Linux。
- Docling 在小 PDF 之外的耗时（只有 1,486 B 的两页样本：115 s / 317 s）。
- 独立第三方复核：**未完成**。

## 3. 结论与处置

| 门 | 结论 |
|---|---|
| G3 施工（有测试、负例有效） | **PASS** |
| G4 独立 QA | **PARTIAL**（主控自审完成，独立复核缺失） |
| G5 发布 | **HELD** —— 不 tag、不 publish、不 merge |
| `main` | **未合并**（仍在 `b5f6c16`） |

**给下一个人的一句话：** 先独立复核 C2 的"同时改 payload 与 sidecar"与 C3 的"fixture 自证"两处；这两处是本轮**最可能被高估**的地方。
