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

---

# 独立 QA · 第二轮（追加；不改前文）

**审阅快照：** 开始时 `HEAD=d2e3bd0`（四条主张的提交状态）；复核期间树已前进到 `2a2861e`
（`f7c2b51` 修 containment、`1401547` 修 review 验签、`cc9788d` 修 CI 空转、`2a2861e` 文档）。
下面每条都先按 `d2e3bd0` 判定，再在当前 HEAD 复跑关键向量。未改仓库源码；所有临时工作区在
`%TEMP%`，真实 `.research` 未触碰。

**与第一轮的关系：** 独立重做，不是复述。C1/C2 与第一轮部分重合（junction、换键伪造），但新增
四条第一轮没有记录的：C2 大小写改名绕过导出守卫、C3 直接换掉源 PDF、C4 契约检查空转、C4 探针
「任何异常 = 拒绝」的假阴性。

## 判定汇总

| 主张 | 判定（按提交状态） | 一句话 |
|---|---|---|
| **C1** projectId 路径穿越已修 | `PARTIALLY_UPHELD` | `.`/`..` 与全部词法变体确实被拒；但 junction 仍可作项目根/写目标，`litdb` 至今未修 |
| **C2** 载荷校验已修 | `PARTIALLY_UPHELD` | 原地追加能抓；导出守卫按**文件名形状**判断，大小写改名即绕过；列表路径仍盲信 sidecar |
| **C3** 阅读闭环已被可复现地验证 | `REFUTED` | 脚本只证明「引文是随脚本一起提交的 fixture 的子串」；把源 PDF 换成不含引文的文本，仍 12/12 PASS |
| **C4** CI 覆盖了它声称的东西 | `PARTIALLY_UPHELD` | 五条都能无宿主跑、失败会非零；但「skill 契约/mirror」和「containment」实际覆盖远小于名字 |

**当前 HEAD（`2a2861e`）状态：** C1 的 inspect/plan junction 与 canonical id 已修，**litdb 未修**；
C2/C3/C4 的上述绕过在当前 HEAD 复现（npm 空转与 run-tests 静默跳过已修）。

---

## C1 — PARTIALLY_UPHELD

**改对的：** 在 `d2e3bd0` 上逐个试，词法向量全被拒（`inspectNotebook`，临时 workspace，
真实模块）：

| 输入 | 结果 |
|---|---|
| `.` / `..` / `.. ` / `../victim` / `a/b` / `a\b` / `''` | `invalid projectId` |
| `...` / `....` / `victim.` / `victim..` | `ENOENT`（在这个 Node/Windows 上 trailing dot **不**做 Win32 折叠，见下） |
| `․.`(U+2024) / `．．`(U+FF0E) | `invalid projectId`（字符类拒绝；零宽格式符同理，未单独构造） |
| 绝对路径 `C:\...\victim\analysis.ipynb` / `\\?\C:\...` | `notebook path is outside the project` |
| 项目内的 `link\secret.ipynb`（link 是 junction） | `notebook path is outside the project` |

`...`/`victim.` 不折叠这一点很关键：在同一台机器上 `fs.realpath('projects\\...')` 返回 `ENOENT`，
`fs.mkdir('...')` 创建的是**字面上**名为 `...` 的目录（`readdir` 可见），所以它们没有变成
`..`/父目录。Windows 8.3 短名同理：项目 id 里的 `~` 被字符类拒绝，`notebookPath` 的短名由
`realpath` 解析后再比较，未发现绕过（本卷是否启用 8.3 未单独确认）。大小写 `VICTIM` 在
`d2e3bd0` 上会解析到 `victim`（同一项目，不是越界），但这给了一个项目两个身份；当前 HEAD 用
`basename(root) !== id` 把它变成 `non-canonical projectId`。

**仍然能读到/写到项目外的：** 一个 lexically 合法的 `projectId`，加上
`.research/projects/` 下已存在的一个 junction。当前 HEAD `2a2861e` 复跑：

```text
REFUSED | inspect junction root  | project path is outside the workspace research root
REFUSED | inspect canonical case | non-canonical projectId: VICTIM (directory is victim)
REFUSED | replay junction root   | project path is outside the workspace research root
LITDB tool ALLOWED cachePath= ...\.research\projects\evil\.litdb\index.json
writes landed in outside dir: [ 'index.json' ]
```

`inspect.js:24-39` 与 `plan.js:38-46` 已在 `f7c2b51` 把锚点移到
`<workspace>/.research/projects` 的 realpath，并检查 `basename`。**`research-phase2-litdb/index.js`
没修**：`index.js:20` 只拒绝 `.`/`..`，`:23-26` 直接
`join(root,'.research','projects',projectId,'.litdb')` + `mkdir` + `writeFile`；把
`.research/projects/evil` 做成指向 workspace 外的 junction，`research_litdb_snapshot` 的
`index.json` 真写到了外面（published bundle，不是 exec）。这是当前 HEAD 仍开的一条写逃逸。

**前提要说清：** 这些 junction 向量都要求先能写 `.research/projects/`（本地写权限）；能写的人
本来就能读目标文件，所以它是 defense-in-depth 缺口，不是无特权越权。但 C1 的问题就是「路径包含
是否真的被锚定」，而 litdb 的答案仍是「没有」。

---

## C2 — PARTIALLY_UPHELD

**改对的（复跑）：**

```text
intact:        payloadVerified=true,  checksum.value=id, reproducibility=available
篡改 payload:  payloadVerified=false, payloadBytes=实际字节数, checksum 仍回显记录值
删除 payload:  payloadVerified=false, 不抛异常
篡改后导出:    ScienceError: artifact bytes no longer match their id
```

**绕过 1（新，且直接推翻 5ec6298 的字面主张）：大小写改名。** 导出守卫在
`store.js:577-585` 用 `archiveName.match(/^artifacts\/([0-9a-f]{64})$/)` 决定是否校验；匹配不到就
不校验。在 Windows 上把 payload 从 `<id>` 改名为 `<ID 大写>`（同一个文件，case-insensitive），
再追加字节：

```text
C2 export lowercase:            REFUSED
C2 export UPPERCASE tampered:   ALLOWED {"path":"artifacts/9660B330...","sha256":"650e5f5b...","bytes":23}
C2 import of that archive:      OK verifiedFiles=3
```

导出的 manifest 自己一致，import 也接受——正是 `5ec6298` 说「export 不能成为较软的一条路」所要
防的「self-consistent archive of altered content」。`getProvenance(小写 id)` 仍会报 false（读路径
能抓），但 `listArtifacts`/hub/export-import 不会。修法应是按 sidecar 的 `artifact.id` 或
case-insensitive 比较，而不是拿文件名当身份。

**绕过 2：`listArtifacts` 仍盲信 sidecar。** `store.js:218-237` 只读 `artifacts/<sha>.json`，
不读 payload、不加 `payloadVerified`。篡改后：

```text
C2 listArtifacts after tamper: {"bytes":9,"repro":"available","hasVerified":false}
```

hub 面板走的是同一条路：`client.js:148/160` 直接读 sidecar 目录，`:286-295` 显示记录 checksum 和
`N/7 面有记录`，从不显示 `payloadVerified`（全仓 `payloadVerified` 只出现在 `store.js`、`payload-integrity.test.mjs` 和 reading-loop 脚本里）。所以 `8263d23` 的新字段没有到达任何用户界面。

**绕过 3：请求的 id 与返回的身份不绑定。** `getProvenance` 读 `artifacts/<请求id>.json`，却返回
sidecar 里的 `artifact.id` / `artifact.checksum`（`store.js:311-318`），不检查它们是否等于请求
id。把原 sidecar 复制成另一个 64-hex 名字、并放一份 hash 与那个名字相符的 payload：

```text
{"requested":"d88f6cc9","returned":"9660b330","checksum":"9660b330","verified":true}
```

调用者问「d88f 这个 artifact 是否可信」，拿到的是「9660 的 identity + true」。如果只看
`payloadVerified` 和 `checksum`，就会把一个未验证的 payload 当成另一个 artifact 的已验证结果。

**绕过 4：sidecar 元数据本身不验。** 不动 payload，只改 sidecar 的 title/code 面，
`payloadVerified` 仍是 true，伪造的 code 面照样以 `available` 返回。这与第一轮记的「换键伪造」
不同：这里原 payload 和原 id 都还在，只是 provenance 的描述被改了。当前文档
（`EVIDENCE-MODEL.md`）已写明 content addressing 不证明"未被替换"，但 `getProvenance` 的返回
没有一个字段告诉读者「这 6 个面是未验签的记录」。

结论：`payloadVerified` / 导出拒绝在默认路径上是真的（C2 不是全假），但声称的「载荷校验」仍只覆盖
「文件名恰好是小写 hex、且你恰好从 getProvenance 读」这一条路。

---

## C3 — REFUTED

**可复现：** `node tools/w03/verify-reading-loop.mjs` → 12/12 PASS，exit 0；改 fixture 一个字母
会恰有一条 FAIL、exit 1（第一轮已证；本轮未重跑这一项）。检查器本身不是空的。

**但「引用逐字来自解析输出」没有被验证。** 把 `tools/w03/fixtures/synthetic-2page.pdf` 换成一
行 ASCII 文本（不含任何引文），脚本仍然：

```text
[PASS] source PDF has a stable sha256 — 5232ca2761e2eab2
[PASS] quote is present verbatim at #/texts/0
[PASS] quote is present verbatim at #/texts/1
...
READING LOOP: PASS
```

原因在 `verify-reading-loop.mjs:31-51`：PDF 只被 `sha256`（`:36-37`，断言仅
`/^[0-9a-f]{64}$/`），引文检查是 `anchor.text.includes(item.quote)`（`:48`），anchor 来自
`fixtures/reading-parse.json`。fixture、claims 和脚本在 `d2e3bd0` 同一提交里；仓库里没有
Docling 的结构化输出（`fixtures/` 只有 `reading-parse.json` 和 PDF，没有文档所说的
`synthetic-2page.json`），也没有 parse 结果的摘要/`document_key` 绑定。所以脚本能区分「fixture
被改坏」，不能区分「fixture 是手写的、PDF 是随手换的」。这正是「引用必须逐字来自解析输出」这句
话没被证明的地方。

**产品路径没有闭环。** `recordArtifact` 接受任意 `literature` 字符串；不存在的引文：

```text
{"literature":"available","payloadVerified":true,"recordedQuote":"Finding Z: intermediate organisations ca"}
```

plugins/skills 里没有找到任何 quote 校验实现。脚本的「read-back」（`:88-89`）只验
`payloadVerified` 和 recorded checksum，不会把落盘的笔记重新读出来再逐字对 anchor。所以它不是
闭环，是「构造 → 断言一次」的单向脚本。

**对照 P-07：** 脚本明确不跑解析器，这没错；P-07 记录的 115–317 s、只给锚点、页号只在 CLI
`prov[].page_no`，这些在 `W03-READING-CLOSED-LOOP.md` §2 和 `lead-probes.md` 里是诚实的。但同
文档 `:14` 写「引用是不是真的来自那篇文献？用逐字子串校验，可证明」、`:81` 写「解析输出里逐字
存在」、`:96` 写「引用逐字校验」——这三句都把「fixture 子串」说成了「源文献保真」。文档 `:4` 的
`PARTIAL` 状态是对的；**主张比文档大**。判定：REFUTED（针对「已可复现地验证引用来自解析输出」），
但「子串检查器有效」这一小部分是 UPHELD。

---

## C4 — PARTIALLY_UPHELD

**无宿主可跑：** 从当前 HEAD `git archive` 出一份干净 checkout（无 `.agents`、无
`node_modules`、无宿主 profile），五条全部 exit 0；当前树 80/80 tests。命令本身没有
`continue-on-error`、没有管道、失败会非零（`run-tests.mjs:55-65`、`probe:73`、
`s1:112`、`npm-preflight.mjs:98-106`、`verify-reading-loop.mjs:98`）。这部分成立。

**漏洞 1：`s1-check-skill-contracts` 的「skill ↔ tool contract + mirror drift」名不副实。**
`.agents/skills` 不在仓库（`git ls-files` 0 条），干净 checkout 里：
`s1:79-81` 打印 `[PASS] mirror-identical — SKIPPED`；`registry-matches-sources`
（`:94-110`）在 `else` 分支里，**永远不会跑**。真正执行的只有把 SKILL.md 里的名字和硬编码
`REGISTERED`（`:20-28`）比对。实测把 `research_review_verify` 工具在
`research-host/index.js` 里改名（等于删掉这个工具），检查仍：

```text
[PASS] mirror-identical — SKIPPED: no .agents/skills in this checkout (single-copy layout is valid)
SKILL CONTRACT CHECK: PASS (0 failure(s))
```

**漏洞 2：`probe-containment` 只测未发布的 exec，且 oracle 是「任何异常 = 拒绝」。**
`:7` 只 import `research-phase2-exec` 的 `readNotebookCell`；`npm-preflight` 把该 bundle 标为
`NOT_PUBLISHED`。把 exec 的 containment 临时去掉后：

```text
[BAD ] ../escape.ipynb              ALLOWED
[BAD ] sub/../../escape.ipynb       ALLOWED
[BAD ] backslash ..\                ALLOWED
[OK  ] ../../escape.ipynb           REFUSED — ENOENT
[OK  ] absolute C:\Windows\win.ini  REFUSED — Unexpected token ';', "; for 16-b"... is not valid JSON
[OK  ] absolute POSIX /etc/passwd   REFUSED — ENOENT
PROBE RESULT: FAIL (12 vectors, 3 unexpected)
```

`win.ini` 是**真的被打开**了，只是 JSON.parse 失败，仍记 `[OK] REFUSED`；9 个逃生向量里有 6 个
在守卫去掉后仍打印 OK（其中 `win.ini` 真读到了文件，3 个 ENOENT，2 个由别的守卫拒绝）。也就是
说：如果将来 containment 回归成「读到了但解析失败」，或目标文件不存在，这个探针会把它们记成拒绝。
（exec 的 `security.test.mjs` 断言了错误消息，能兜住这部分；但探针自己的 12 vectors 计数不可信。）

**漏洞 3：已发布工具没有 containment 探针。** `probe-containment` 不 import
`notebook/lib/inspect.js`。把当前 `inspect.js:37-39` 的
`if (absolute !== root && !absolute.startsWith(root + sep))` 改成 `if (false)`，跑
`notebook.test.mjs + project-id.test.mjs`：**8/8 全绿**，包括新加的 junction/canonical 测试
（它们测的是项目根锚定，不是 notebookPath）。`notebook.test.mjs:37` 的
`/outside the project|ENOENT/` 接受 ENOENT，所以 `../outside.ipynb` 不存在时，删掉包含检查也测
不出来。replay/litdb 更没有 containment 测试。

**已修（本轮复核确认）：** `npm-preflight` 空树现在 `exit 3`（实测）；`run-tests` 只对 ENOENT
跳过、其他错误 exit 3（`cc9788d`）。这两条第一轮的意见已落实。

**CI 本身未能验证：** 没出网，无法核对第一轮引用的 GitHub Actions run id；只验证了命令在干净
checkout 里的行为。

---

## 有没有测试被削弱

`git diff b5f6c16..HEAD -- '*.test.mjs'`：**没有删除/放宽既有断言**（`^-` 行数为 0），只有新增
（`payload-integrity.test.mjs`、`project-id.test.mjs`）和 `client.test.mjs` 的追加。全仓测试里
唯一的 `skip` 是 `project-id.test.mjs:100` 的 `t.skip`（junction 创建失败时），本机实际执行了，
不是 skip。

但有两处**新测试比名字弱**：

1. `project-id.test.mjs:100` 的 junction 测试在 `symlink` 失败时 `t.skip`；`node --test` 对 skip
   仍报绿，所以在一台不能创建 junction 的 runner 上，这条新覆盖会静默消失（本机实际执行了）。
2. 上面 C4 漏洞 3：删除 `inspect.js` 的 notebookPath 包含检查，8 条测试全绿——这条检查没有
   任何有效负例。

---

## 如果我是下一个开发者，我最不放心的一条

**绿的东西是按「名字形状」验的，不是按「身份」验的。** 导出守卫看文件名是不是小写 hex
（`store.js:577`），reading-loop 看引文是不是随脚本提交的 fixture 的子串
（`verify-reading-loop.mjs:48`），skill-contract 看名字在不在硬编码表里
（`s1:20-28`），containment 探针把「任何 throw」当拒绝（`probe:36`）。四个绿勾都成立，四个名字
所指向的性质都没有被真正钉住。最具体的一条：**大小写改名后，被篡改的 payload 仍能导出、仍能
import，并带着原 sidecar 继续被 list/hub 显示为 `reproducibility: available`**——这是 5ec6298
刚说要堵的那条路。

## 我没能验证的

- GitHub Actions 的真实运行状态（无网络；只用 `git archive` 在本地复现了五条命令）。
- GUI/hub 内的实际渲染（只读了 `client.js` 的代码路径）。
- macOS/Linux：大小写改名绕过的可利用性不同（case-sensitive FS 上它是另一个文件名，但仍不被
  导出守卫检查）；本报告所有运行都是 Windows + Node 24.15。
- Docling 解析器本身：P-07 的 115/317 s、锚点/页号结论直接引用文档，没有重跑。
- hardlink：没有测；路径包含检查会放过指向项目外的 hardlink 内容。
- Windows 8.3 短名和 NTFS Unicode 归一化：只做了字符类/`realpath` 层面的推理，没有单独构造样本。
- 真实 `.research` 数据（按要求未触碰）。

---

## 附录 C：主控对独立 QA 第二轮的处置（2026-11-11 追加）

第二轮复核比第一轮更狠：它推翻了「阅读闭环」的证明力，并找到导出守卫的大小写绕过。**全部接受，能修的已修。**

| 第二轮条目 | 判定 | 处置 |
|---|---|---|
| C1：litdb 写路径仍会被 junction 带出 workspace（用 live `research_litdb_snapshot` 复现） | 接受 | **已修**：`writeProjectJson` 与读路径同规格——锚到 `.research/projects` 的 realpath、要求目录真名等于 id |
| C2：导出守卫按文件名形状判断，**大小写改名即绕过**；篡改 payload 仍 export/import 成功 | 接受 | **已修**：匹配改大小写不敏感，且与 sha256 比较而不是相信文件名；新增「大写改名」与「有 payload 无 sidecar」两条测试 |
| C3：**REFUTED**——把 PDF 换成一行 ASCII，验证器仍 12/12 PASS（PDF 只被 hash，引文只对 parse 检查） | 接受 | **已修**：parse fixture 声明 `sourceSha256` 并与 PDF 实测哈希比对；每个锚点的 `ANCHOR-*` 标记必须在 PDF 字节里出现（该 fixture 的流未压缩）；笔记另记 `parseSha256`。现为 15 项检查 |
| C4：`registry-matches-sources` 在 `else` 分支永不执行 | 接受 | **已修**：挪出分支，公开仓每次都会跑（现输出 `all 24 names appear`） |
| C4：删掉 `inspect.js` 的 notebookPath 包含检查，8 条测试仍全绿 | 接受 | **已修**：新增「逃逸路径必须因 containment 被拒、而不是因 ENOENT」的测试 |
| C4：`probe-containment` 只测未发布 exec，且「任何异常=拒绝」 | 接受，**未修** | 它会因 `JSON.parse` 失败而记 [OK]；重写需要按错误类别判定。记为已知薄弱点，不再宣称它是通用护栏 |
| C4：rename 一个已注册工具而旧名残留在报错字符串里 → 检查仍 PASS | 接受，**部分修** | 已让检查真正执行（原来根本不跑）；但精确到「注册」而非「提及」需要宿主导出挂载工具表。**已在脚本注释里写明这条局限**，不假装它更强 |
| 「无测试被削弱」 | 接受 | 独立确认 `b5f6c16..HEAD` 没有删除或放宽断言 |

**判定变化：** C3 由 `PASS_SCOPED` 降为 **`PARTIAL`**——验证器现在真的把 parse 绑到了源文件，但它证明的仍是"引用与解析输出一致、解析与源文件一致"，**不证明解析器本身正确**（这从来不是它能证明的）。

**测试：** 80 → **83**。`main` 上再加一个 v0.1.2 里程碑承载这些修复。

**仍未解决（明写）：** 整体换键伪造需要外部锚点（C2/C3）；`listArtifacts` 仍盲信 sidecar；hardlink 未测；probe-containment 的判定方式薄弱；probe 仍只覆盖 exec。
