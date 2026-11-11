# W03 QA 鈥?鐙珛澶嶆牳锛堝彧璇伙紝鏈弬涓庢敼鍔級

Branch: `w03-reading` @ working tree clean. Date: 2026-11-11.
Scope: the five items assigned. No source file was modified; all adversarial probes ran against
copies in `%TEMP%` (a `tools/w03` copy with a directory junction to `plugins/`, plus throwaway
workspaces). Only this file was written inside the repo.

---

## 1. `node tools/w03/run-tests.mjs` 鈥?UPHELD

```
鈩?tests 77   鈩?pass 77   鈩?fail 0   ...   EXIT=0
```
15 test files enumerated, all pass, exit 0. `run-tests.mjs` propagates the child status
(`process.exit(result.status ?? 1)`) and refuses to report success when it finds nothing
(`exit 3`). No evidence of a silently-green path.

## 2. `node tools/w03/verify-reading-loop.mjs` 鈥?UPHELD (fidelity check is real)

Baseline: exit 0, 12/12 checks PASS (`READING LOOP: PASS`).

**Attempted fake pass.** The fixture path is hard-coded in the script
(`join(here, 'fixtures', 'reading-parse.json')`) with no env/argv override, so the repo file had to
stay untouched. I mirrored `tools/w03` into `%TEMP%\w03qa-fixtest-e99203e4`, junctioned `plugins`
back to the real repo, and ran the copy:

- control (unmodified copy): exit **0** 鈥?the harness itself does not cause failure.
- one-character tamper in the copy, `intermediate-organisation` 鈫?`intermediate-organization`
  in `#/texts/0`: exactly one line fails, `[FAIL] quote is present verbatim at #/texts/0`, all
  other 11 checks still PASS, `READING LOOP: FAIL (1)`, exit **1**.

So the "quote must exist verbatim" check is a real check, not an echo of the fixture.

Caveat worth recording: my first tamper was written by PowerShell `Set-Content -Encoding utf8`,
which added a BOM; the script died with a raw `SyntaxError: Unexpected token '锘?` at
`JSON.parse` (exit 1). Fail-closed, but for the wrong reason 鈥?a fixture that is unparsable is
reported as a crash, not as a named check failure. Corrected with a BOM-free writer.

Also structural: the quotes are hard-coded in the *verifier*, and only the anchors come from the
fixture. Editing an anchor's text breaks the run (proven above); deleting an anchor breaks it too
(`anchorById.get()` 鈫?undefined 鈫?FAIL). Good.

## 3. `projectId` guards (`inspect.js`, `plan.js`) 鈥?PARTIALLY_UPHELD

Every string-level vector I tried **failed to bypass** (probe file, temp workspace, real modules):

| input | inspectNotebook | replayPlan |
|---|---|---|
| `...` | REJECT (ENOENT at realpath) | REJECT `unknown project` |
| `p1.` / `p1...` | REJECT (ENOENT) | REJECT `unknown project` |
| `p1 `, `.. `, `..`, `.` | REJECT `invalid projectId` | same |
| `C:\Windows`, `/etc`, `%2e%2e` | REJECT `invalid projectId` | same |
| `p1\u200B`, `p1锛巂(U+FF0E), `鈥も€(U+2024) | REJECT `invalid projectId` | same |
| `p1\..\..`, `p1/../..` | REJECT `invalid projectId` | same |
| `锝愶紤` (fullwidth) | REJECT (ENOENT) | REJECT `unknown project` |

Notably `...` and `p1.` do **not** collapse to `..`/`p1` through Win32 normalization 鈥?they fail
closed at `realpath`. No traversal found via the id string.

Two real gaps, both requiring pre-existing write access in `.research/projects` (not reachable
from a projectId string):

1. **Non-canonical id.** `P1` passes the regex and resolves to the real `p1` (NTFS is
   case-insensitive), returning `path: ...\projects\p1\nb.ipynb`. The guard admits an id that is
   not the project's actual name; anything downstream that keys on the id string can be confused
   (`p1` and `P1` are two identities for one project).
2. **Root anchoring / junction.** `inspect.js` sets `root = realpath(project)` and checks the
   notebook only against *that root* 鈥?never against `<workspace>/.research`. With a junction at
   `.research/projects/p2` 鈫?an unrelated temp directory, `inspectNotebook(ws,'p2','SECRET.ipynb')`
   **succeeded** and read a notebook outside the workspace. `plan.js` does not `realpath` at all
   and read `project.json` from the junction target (reported `project name: OUTSIDE`). The
   containment model is "inside the project root", not "inside the workspace".

## 4. `getProvenance` + `collectProjectFiles` 鈥?REFUTED (as tamper-evidence)

Answers to the assigned question: **in-place tamper is caught; simultaneous re-keying is not.**

- **In place** (payload bytes edited, sidecar rewritten to keep `checksum.value = id`):
  `payloadVerified: false`, and `exportScience` throws `artifact bytes no longer match their id`
  (store.js:562). The old behaviour the code comments describe is genuinely fixed.
- **Re-keyed** (attacker writes new bytes under `sha256(newBytes)` and a matching
  `<newId>.json` sidecar, deletes the originals): `getProvenance` returns
  `payloadVerified: true`, `checksum.value === newId`, `review: available / accept`,
  `code: available`. Export succeeds, producing a manifest that contains only the forged pair
  (`project.json`, `artifacts/<newId>`, `artifacts/<newId>.json`), and `importScience` accepts it
  without error. The old id is simply gone (`unknown artifact`).

Why: content addressing proves *"these bytes hash to this filename"*, not *"these bytes are what
was recorded"*. Nothing in the store signs the artifact *set* 鈥?no project-level manifest or
signed index 鈥?so a self-consistent replacement is indistinguishable. `collectProjectFiles`
re-derives the manifest from whatever is on disk at export time; the only check is per-file
name-vs-hash, which re-keying satisfies by construction.

Additional reading (code, not run): the `review` face is **never signature-checked** by
`getProvenance` (store.js:249鈥?71) 鈥?it copies `decision`/`signature` out of
`reviews/<id>.json` and labels the face `available`. `verifyReview` would judge the same record
`valid: false`. So provenance can show `available / accept` for a review that the review verifier
rejects. And `signReview` is unkeyed `sha256` over the record (store.js:312鈥?23): anyone who can
write the file can recompute the "signature".

## 5. `.github/workflows/verify.yml` 鈥?UPHELD, one vacuous-pass risk

Commands, in order (all direct `node`, no `shell:` override, no pipes, no `|| true`, no
`continue-on-error`; Windows default shell fails the step on non-zero exit):

1. `node tools/w03/run-tests.mjs` 鈥?status propagated; exit 3 if zero tests.
2. `node tools/w01/probe-containment.mjs` 鈥?`if (bad !== 0) process.exitCode = 1` (line 73).
3. `node tools/w01/s1-check-skill-contracts.mjs` 鈥?`if (failures > 0) process.exitCode = 1` (line 112).
4. `node tools/release/npm-preflight.mjs` 鈥?`if (failed.length) process.exitCode = 1` (line 99).
5. `node tools/w03/verify-reading-loop.mjs` 鈥?`process.exit(failures === 0 ? 0 : 1)`.

No silent `catch` that converts failure to success in any of them. Two residual risks:

- **npm-preflight vacuous pass**: `results` is filled only by bundles that have a `package.json`
  *and* `dsh.bundle` (`continue` otherwise). If nothing matches, `failed.length === 0` 鈫?prints
  `NPM PREFLIGHT: PASS (0/0)` and exits 0. There is no `results.length > 0` guard.
- **run-tests silent skip**: `catch { continue }` around `statSync(testDir)` means an unreadable
  test directory is skipped without a word; only the *total*-zero case exits 3. A new test file
  outside `plugins/active/*/test/*.test.mjs` never runs at all.

Both are coverage gaps rather than "a failing assertion exits 0".

---

## 鏈€涓嶆斁蹇冪殑涓€鏉?
**The re-key forgery in 搂4.** Every other gap in this report needs something exotic or shows a
warning; this one is quiet. An attacker with write access to a project directory can replace an
artifact and its sidecar with a self-consistent pair, and the product then reports
`payloadVerified: true` with `review: accept` 鈥?export and re-import both pass. The in-place
guard is real, but it only protects the *identity* of bytes already on disk; it does not bind
the artifact set to any signed history, so "verified" here means "internally consistent", which
is exactly the claim a reader would misread as "unaltered". Second is the 搂3 junction/root
anchoring, the same shape of mistake: trust anchored to an attacker-selectable root.


---

## 附录 A：此文件被覆盖前的内容（主控自审记录，原文保留）

> 保留原因：该版本自己写着「独立 QA 未返回」，而本节报告正是那个缺失的独立复核。两版结论的
> 交叉点：自审 C2 已写到「除非攻击者连文件名一起改」——本报告 §4 把这一步当作可利用的伪造来实测，
> 结论与其一致（原地篡改被抓住），分歧只在定性：自审称之为「换一个 artifact」，我认为读端仍报
> payloadVerified: true，所以它对读者是不可区分的。

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
---

## 附录 B：主控对独立 QA 的处置（2026-11-11 追加）

独立 QA 报告到达后，逐条处置。**它推翻了我的一条主张，我接受并改了代码。**

| QA 条目 | 判定 | 主控处置 |
|---|---|---|
| §1 run-tests 77/77 | UPHELD | 无动作；现为 80/80（新增 3 条测试） |
| §2 阅读闭环检查是真的（改一个字母 → 恰 1 条 FAIL、exit 1） | UPHELD | 无动作；负例控制已由第三方证明有效 |
| §3 字符串向量全拒 | UPHELD | 无动作 |
| §3.1 非规范 id（`P1` → `p1`） | 接受 | **已修**：解析后要求 `basename(realpath(project)) === id`，否则 `non-canonical projectId`；新增测试 |
| §3.2 junction 根锚定逃逸 | 接受 | **已修**：`inspect.js` 与 `plan.js` 都把包含关系锚到 `<workspace>/.research/projects` 的 realpath，而不是项目目录；新增 junction 测试（实跑，非 skip） |
| §4 换键伪造（payload+sidecar 同时换） | **接受（作为防篡改主张被推翻）** | **不能在本轮修**：需要项目级签名清单或库外锚点（C2/C3）。已写进 `docs/EVIDENCE-MODEL.md`「What content addressing does not prove」与 README 限制清单，明确 `payloadVerified: true` = 内部自洽 ≠ 未被替换 |
| §4 review 面从不验签 | 接受 | **已修**：派生 review 面调用 `verifyReview`，新增 `signatureValid` / `signatureMeaning`；篡改一轮未重签 → `false`。新增测试 |
| §5 npm-preflight 0/0 空洞通过 | 接受 | **已修**：`results.length === 0` 时 `exit 3` 并报错 |
| §5 run-tests 静默跳过不可读测试目录 | 接受 | **已修**：只对 `ENOENT` 跳过，其他错误 `exit 3` |

**因此 G4 从 PARTIAL 改为：独立 QA 已完成且产出了可执行的推翻结论；推翻项中 5 条已修，1 条（换键伪造）如实降级为文档化限制。**

**仍然成立、不在本轮修的：**`listArtifacts` 仍盲信 sidecar；hardlink 未验证；`probe-containment` 仍只覆盖未发布的 exec bundle。

**状态：** G4 = `PASS_WITH_DISCLOSED_RESIDUAL`（定义：独立复核已发生、结论被逐条处置、不可修项已明文披露）。发布仍需 Owner 决定。
