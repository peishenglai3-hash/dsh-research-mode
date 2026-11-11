# W03 · 施工回执（S3）

**分支：** `w03-reading`（从 `main@b5f6c16` 切出，冻结 tag `w03-base`）
**基线：** `b5f6c16` · **施工后：** 见 `git log b5f6c16..HEAD`
**等级：** 全部 C0/C1 + 一项 C2-a（配置，已预授权）

---

## 1. 改了哪些代码（四个 bundle + CI + 工具）

| 文件 | 改动 | 等级 | 测试 |
|---|---|---|---|
| `plugins/active/research-phase2-notebook/lib/inspect.js` | projectId 拒绝 `.` `..` | C1 | `test/project-id.test.mjs`（4） |
| `plugins/active/research-phase2-replay/lib/plan.js` | 同上；错误从"unknown project"变成"invalid projectId" | C1 | 同上 |
| `plugins/active/research-phase2-litdb/index.js` | 同上（缓存写入路径） | C1 | 同上 |
| `plugins/active/research-host/lib/store.js` | `getProvenance` 重读 payload → `payloadVerified` / `payloadBytes` | C1 | `test/payload-integrity.test.mjs`（4） |
| 同上 | `collectProjectFiles` 拒绝字节与 id 不符的 payload（导出） | C1 | 同上 |
| `plugins/active/research-hub/client.js` | 抽出 `faceSummary`，读时派生 review 面；文案改为"有记录（available ≠ 已验证）" | C1 | `test/client.test.mjs`（+3） |
| `.github/workflows/verify.yml` | 新建；5 条命令 | C0 | run `43005157360` |
| `tools/w03/run-tests.mjs` | 跨平台测试入口（自己枚举文件） | C0 | 实跑 77 |
| `tools/w03/verify-reading-loop.mjs` + fixtures | 阅读证据闭环验证器 | C1 | 12 项 PASS |
| `.gitattributes` | `*.pdf binary` | C0 | blob 哈希复核 |
| `README.md` | npm 安装路径；相对 `link:` 的解析基准；验证命令；更正我写错的 PARTIAL 说法 | C0 | — |

**没有改：** 任何工具名、参数、schema、字段语义、权限、profile 组成（除 C2-a 一行）、`.research` 数据。

## 2. 验证命令与结果（本轮实跑）

```text
node tools/w03/run-tests.mjs                     → 77 pass / 0 fail           EXIT 0
node tools/w01/probe-containment.mjs             → PASS (12 vectors)          EXIT 0
node tools/w01/s1-check-skill-contracts.mjs      → PASS (0 failures)          EXIT 0
node tools/release/npm-preflight.mjs             → PASS (100/100)             EXIT 0
node tools/w03/verify-reading-loop.mjs           → PASS (12 checks)           EXIT 0
```

GitHub Actions：run **43005157360**（commit `30cda91`）→ `conclusion: success`。
后续提交会再触发一次，结果以 Actions 为准。

## 3. 每个修复的"改前失败 / 改后通过"

| 修复 | 改前（我实跑看到的） | 改后 |
|---|---|---|
| projectId 守卫 | `inspectNotebook(ws,'..','projects/victim/analysis.ipynb')` → **读到 `SECRET_VICTIM_CELL`** | `invalid projectId`；4 个测试点名 |
| 读时验字节 | 追加字节后 `checksum.value === 原 id`、`bytes=56`（实际 78） | `payloadVerified:false`、`payloadBytes` 如实 |
| 导出 | 篡改 payload 仍能导出 | `ScienceError: artifact bytes no longer match their id` |
| Hub 面数 | Hub 只数 sidecar；同一 artifact 与工具侧不同 | `faceSummary` 派生，两处同源 |
| CI | 无 `.github/`，66 测试无人跑 | 5 条命令，push 触发 |

## 4. 回退

```bash
git revert <sha>          # 每个修复一个提交，可单独回退
git checkout main         # 整个分支丢弃；main 未动
```

- C2-a：删 `C:\Users\<user>\.dsh\profiles\w02-alpha\cordis.patch.yml` 里 `toolCallTimeoutMs: 600000` 一行，再 `dsh plugin --profile w02-alpha install`。
- 备份在同目录 `cordis.patch.yml.w03-backup`。

## 5. 明确没做

- 没有产品内 GUI 会话轨迹（见 `W03-READING-CLOSED-LOOP.md` §1）。
- 没有发 npm / 没有 merge `main` / 没有动 `desktop` profile。
- 没有新增任何公开工具（`NEW_TOOL_ADDED: NO`）。
- 没有改 `.science` 格式、字段语义、review 签名算法。

## 6. 施工中发现并已更正的我自己写错的两处

1. `W03-BASELINE.md` B3 原写"两处面数不同"——实际总数恒为 7，差的是**可用面数**（`crit-arch` 指出，已改并标注）。
2. `README.md` 我新写的"verify-acceptance 在干净机上报 PARTIAL"——该脚本只有 PASS/FAIL，缺 profile 文件即 FAIL（`crit-prod` 指出，已改为准确说法）。
