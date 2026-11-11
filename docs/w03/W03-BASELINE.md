# W03 · 基线冻结（S0）

**日期：** 2026-11-10
**分支：** `w03-reading`（从 `main@b5f6c16` 切出）
**冻结 tag：** `w03-base` → `b5f6c1676cc5de33d676eb112461a67547e5977b`
**tree：** `75b19037c8f8d8b83ed30a95d2923741ff70ae7a`（98 个跟踪文件）
**证据等级：** `OBSERVED`（本轮实跑）/ `DOC`（文档记载）/ `NOT VERIFIED`

> 本文件只记录**冻结那一刻**的事实。之后任何变化都必须另开回执，不得回填本文。

---

## 1. 仓库与代码

| 项 | 值 |
|---|---|
| 产品真源 | `D:\DSH-Projects\dsh-research-mode-public`（`main` @ `b5f6c16`，工作树 clean，与 `origin/main` 同步） |
| 私有仓 | `D:\DSH-Projects\dsh-research-mode` @ `a083c18`，按 `W02-CANONICAL-REPO.md` **只作证据档案** |
| bundle | `plugins/active/` 10 个（`research-phase2-exec` 保持 `private:true`，不发布） |
| 工具面 | **24 个** `research_*` 工具 |
| 测试文件 | 13 个 |

### 1.1 关键文件哈希（SHA256 前 16 位）

| 文件 | 字节 | SHA256/16 |
|---|---|---|
| `plugins/active/research-host/lib/store.js` | 28,143 | `5b4b024abd8db5ea` |
| `plugins/active/research-host/index.js` | 10,647 | `cfd9b9289550a0c7` |
| `plugins/active/research-hub/client.js` | 17,265 | `b9b28270c703d7c5` |
| `plugins/active/research-workspace/client.js` | 23,080 | `419500bff416662c` |
| `plugins/active/research-connectors/index.js` | 6,052 | `e0fde16d93b062db` |
| `README.md` | 6,707 | `2f678c622a8e7d78` |
| `docs/EVIDENCE-MODEL.md` | 3,709 | `ad5a9e639bca9794` |
| `LICENSE` | 1,081 | `9415948d9d66d4a6` |

## 2. 四条验证命令的**真实**结果（本轮实跑）

| 命令 | 结果 | exit |
|---|---|---|
| `node --test plugins/active/*/test/*.test.mjs` | **66 pass / 0 fail** | 0 |
| `node tools/w01/probe-containment.mjs` | **PASS（12 vectors, 0 unexpected）** | 0 |
| `node tools/w01/s1-check-skill-contracts.mjs` | **PASS（0 failure）**；mirror 检查 `SKIPPED: no .agents/skills in this checkout` | 0 |
| `node tools/release/profile-composition.mjs` | **FAIL — `spawnSync dsh ENOENT`** | 2 |

**第 4 条是本轮第一个新事实（`OBSERVED`）：**

> 组合矩阵脚本通过 `spawnSync('dsh', ...)` 调用宿主二进制。在本机当前 shell 中 `dsh` 是 `AppData\Roaming\npm\dsh.ps1`（Node 24 不允许直接 spawn `.ps1`/`.cmd`），因此**脚本在干净环境里跑不起来**。
>
> 后果：仓库宣称的"四条验证"中，**有一条不可在 CI 上复现**。这不是脚本 bug，是"验证命令依赖宿主"这个设计选择造成的可移植性缺口。

## 3. 宿主与运行时

| 项 | 值 |
|---|---|
| 内嵌 CLI | **0.2.2-rc.1**（`resources\runtime\cli\bin\dsh.cmd`） |
| PATH `dsh` | **0.1.7-rc.2**（陈旧；不得用于验证宿主行为） |
| `engines.dsh`（9 个已发布包） | `>=0.2.1-rc.2 <0.3.0` → 覆盖 rc.1 |
| Node | v24.15.0（宿主内嵌 v24.21.0） |

## 4. 开源与发布状态（只读核验，`OBSERVED`）

| 项 | 事实 |
|---|---|
| 仓库 | `peishenglai3-hash/dsh-research-mode`，**PUBLIC**，MIT，创建 2026-11-05，最近 push **2026-11-05T12:30:34Z** |
| 社交面 | 1 star / 0 fork / **0 open issue** |
| Release | `v0.1.0` 已发布（tag 存在） |
| npm | 9 个 `@peisheng_lai/dsh-research-*` 全部在线：`host/workspace/preset` = 0.2.0，其余 6 个 = 0.1.0 |
| 社区收录 | issue #221 **closed**；维护者 `lroolle` 在**已合并**的 PR #223 中按**九行**收录，`verifiedAgainst: dsh 0.2.2-rc.1`；hub 行因重名改为 `dsh-research-hub-peisheng` |
| CI | **`.github/` 不存在** —— 66 个测试没有任何自动化触发 |

**结论：开源链路（仓库 → npm → 索引）已闭合。** 当前短板不是"没发布"，而是"发布之后没有自动验证、没有新版本"。

## 5. 规划对话：范围边界与初心原文

`agent-reach` 的 web 后端（jina / exa）**双双 28s 超时**；`chatgpt.com` 本体可达（HTTP 200）。改为直取共享页 SSR 载荷 + turbo-stream 解析，完整还原：

- **66 个节点 / 88,432 字符**
- 起点：`回看项目research mode 的有关项目记忆 我们在这一对话中开启 第二周的更新与工程开发…`
- 终点：`RM-W02-DEC-002 · 正式决议与 S1 工程交付`

**边界（必须写清）：** 该链接是 **W02 的规划对话**（2026-11-02 起）。它**不包含 W01 之前的原始构想**——那部分只能取自本仓 `PROJECT-CHARTER.md` 与 `README.md`，标 `DOC`，**不计为 `OBSERVED`**。

对话中的初心原文（作为裁决基准）：

1. > 科研模式的工程纪律是为了保护自由探索，而不是让自由探索服从工程纪律本身。
2. > 让实际科研活动决定工程构型，而不是反过来让工程构型规定科研活动必须是什么样子。
3. > 不必把架构写得太死……现阶段应该有条件地放开 + 批准 + 优化基础 + 删繁就简，为后续第三第四周乃至 release 做好准备。

DEC-001 的四维审查：**科研能力 / 实现方式 / 用户体验 / 开放扩展**。
DEC-001 的三层差距：**G1 阅读能力 / G11·G17 技能与工具错位 / G3 证据语义误导**。

## 6. 冻结时已复核的硬缺陷（交给批判员当靶子）

| ID | 事实 | 位置 | 等级 |
|---|---|---|---|
| B1 | `reproducibility` 面**恒为 `available`**：由 `{checksum,bytes,source}` 直接算出，从未重放也显示可用 | `research-host/lib/store.js:209` | `OBSERVED` |
| B2 | `environment` 面**不传也 `available`**：缺省自动填 `{platform,arch,node,python}` | `store.js:189-194, 207` | `OBSERVED` |
| B3 | 同一 artifact 的**可用面数**两处可能不同（面总数恒为 7）：`provenance_get` 读时派生 review 面，Hub 只数 sidecar 快照 | `store.js:239-277` vs `research-hub/client.js:272-279` | `OBSERVED`（原文误写为"面数不同"，2026-11-10 据 `crit-arch` 更正） |
| B4 | `project.json.template` 无任何代码分支读取——模板卡是文案不是机制 | 全仓 grep | `OBSERVED` |
| B5 | `skills/` 与 `.agents/skills/` 是逐字节双份；litdb 有 Python/Node 两套；两个 preset 的 patch 只差 11 行 | 目录比对 | `OBSERVED` |
| B6 | `.science` 导入"只读"在 Windows 实测 `readOnlyEnforced=false` | W01 记录 | `REPORTED` |
| B7 | 第 4 条验证命令依赖宿主二进制，CI 上不可复现 | 本文件 §2 | `OBSERVED` |

## 7. 本轮冻结的操作

```text
tag      w03-base            → b5f6c16
branch   w03-reading         → 从 w03-base 切出
dirs     docs/w03/findings/  tools/w03/  .github/workflows/
未改动   任何 plugins/ 源码、任何 skill、任何 profile、任何 .research 数据
```

**回滚：** `git checkout main && git tag -d w03-base && git branch -D w03-reading`。
