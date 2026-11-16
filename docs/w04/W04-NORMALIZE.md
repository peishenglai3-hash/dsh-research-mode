# W04 · 基线归一回执（阶段 A）

**日期：** 2026-11-16
**目标：** 本机只留**一套** research mode；旧基线冻结后移出，不再出现"多套并行 / 版本不确定 / 迭代幻觉"。

---

## 1. 归一前（实测）

| profile | research 依赖 | 来源 | 问题 |
|---|---|---|---|
| **desktop** | 13 | 10 × `@local/research-*` → 私有仓；1 × `@peisheng_lai/dsh-research-hub@0.1.0`；2 × `porting-research*` | 含 **`research-phase2-exec`**（会执行代码）；node_modules 另有 3 个孤儿 junction |
| phase1-closure | 5 | 旧 `dsh-plugins`（已删） | 5 个悬空链接 |
| phase2 | 10 | 私有仓 | 与 desktop 重复 |
| researchtest | 3 | 旧 `dsh-plugins`（已删） | 3 个悬空链接 |
| w01-alpha | 9 | 私有仓 | 冻结基线残留 |
| w02-alpha | 9 | 公共仓 link | 开发副本 |
| w02-npmtest | 9 | npm `latest` | 版本漂移样本 |

**根因**：产品代码在三个位置（私有仓 / 公共仓 / 旧 dsh-plugins）并存，profile 各指一套；`latest` 与 `link:` 混用。

---

## 2. 做了什么

### 2.1 快照（删除之前）

`<archives>\w04-normalize\`：

```text
profiles/<name>/package.json · pnpm-lock.yaml · cordis.patch.yml · plugin-list.txt   7 个 profile
desktop-node_modules-@local.txt                                                     31 条 junction
moved-profiles/<name>/                                                              6 个整目录
```

### 2.2 desktop：换成 9 个固定版本 npm 包

| 变更 | 前 | 后 |
|---|---|---|
| research 来源 | 10 × `@local/research-*`（私有仓 link） | 9 × `@peisheng_lai/dsh-research-*`（精确版本） |
| hub 版本 | `0.1.0`（旧） | `0.1.1` |
| `research-phase2-exec` | **存在** | **不存在**（未发布，也不该进生产） |
| 孤儿 junction | 3 个（指向已删目录） | 0 |

固定版本：`host 0.2.1`；`hub / phase2-litdb / phase2-notebook / phase2-replay 0.1.1`；`workspace / preset 0.2.0`；`connectors / preset-cn-social 0.1.0`。

**保留**：`@local/porting-docling`（PDF 解析，不属于 research mode）、`porting-research*`（旧 L1 移植件，不在本轮范围）。

### 2.3 其余 6 个 profile：移出而不是删除

`phase1-closure`、`researchtest`、`phase2`、`w01-alpha`、`w02-alpha`、`w02-npmtest` → `_archives/w04-normalize/moved-profiles/`。
其中前三个含悬空 junction，`Move-Item` 会失败，先 `rmdir` 掉悬空链接再移动（共 11 个）。

### 2.4 顺手修了一个既有损坏

`@local/porting-docling` 的目录被清空（无 `package.json`），导致 `dsh plugin --profile desktop install` 在 reconcile 阶段报
`cannot resolve profile bundle "@local/porting-docling"`。已从 `Documents\dsh-system-backup\dsh-plugins\porting-docling`
恢复 `package.json` + `cordis.patch.yml`（2 个文件），随后 install 通过（exit 0）。

---

## 3. 归一后（实测）

```text
$ dsh plugin --profile desktop list | grep research
@peisheng_lai/dsh-research-connectors@0.1.0
@peisheng_lai/dsh-research-host@0.2.1
@peisheng_lai/dsh-research-hub@0.1.1
@peisheng_lai/dsh-research-phase2-litdb@0.1.1
@peisheng_lai/dsh-research-phase2-notebook@0.1.1
@peisheng_lai/dsh-research-phase2-replay@0.1.1
@peisheng_lai/dsh-research-preset@0.2.0
@peisheng_lai/dsh-research-preset-cn-social@0.1.0
@peisheng_lai/dsh-research-workspace@0.2.0
```

| 检查 | 结果 |
|---|---|
| `@local/research-*` junction 数 | **0** |
| `@peisheng_lai/dsh-research-*` 目录数 | **9** |
| `research-phase2-exec` 出现次数 | **0** |
| 剩余 profile | `bili-duty` `desktop` `headless` `plugincheck` `web` |
| `dsh plugin --profile desktop install` | exit **0**（"Already up to date"） |

---

## 4. 尚未完成（必须说清）

- **GUI 未重启验证**：当前会话就跑在 desktop 应用里，重启会中断会话。归一后的插件集合要等**下次重启应用**才生效；重启后需确认科研入口与 Hub 仍可用（这是 A 阶段唯一的未验项）。
- 应用重启后若发现异常，回滚见 §5。

---

## 5. 回滚

```powershell
# 1. 恢复 desktop 依赖
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\package.json.w04-backup" `
          "$env:USERPROFILE\.dsh\profiles\desktop\package.json" -Force
# 2. 恢复 6 个 profile
Move-Item "<archives>\w04-normalize\moved-profiles\*" `
          "$env:USERPROFILE\.dsh\profiles\" -Force
# 3. 重装
dsh plugin --profile desktop install
```

快照目录里每个 profile 都有 `package.json` 与 `plugin-list.txt`，可逐项比对。

---

## 6. 结论

**A 阶段的目标达成**：本机只剩一套 research mode，来源是已发布、可版本化的 npm 包；私有仓退回为证据档案，不再被任何 profile 引用；6 个旧 profile 冻结在归档里可还原。

**唯一未验项**：GUI 重启后的可用性（待 Owner 重启）。

---

## 7. 事故记录：跨盘移动 profile 时误删了两个仓库的插件树

**这是本轮我自己造成的一次破坏，必须写下来。**

### 发生了什么

执行 §2.3 的"移出 profile"时，我用 `Move-Item` 把 6 个 profile 从 `C:\Users\<user>\.dsh\profiles\` 移到 `<archives>\w04-normalize\moved-profiles\`。

- `w01-alpha`、`w02-alpha`、`w02-npmtest`、`phase2` 的 `node_modules` 里含 **junction**，指向两个仓库的 `plugins/active/*`。
- 跨盘移动 = 先复制、后删除源目录。删除阶段**跟随了 reparse point**，把 junction 指向的**目标内容**一并删除。

结果：

```text
public  repo  plugins/active  61 个文件被删（git status 全部 " D"）
private repo  plugins/active  65 个文件被删
```

### 怎么发现的

子代理 V2 在只读审计时报告"工作树有 61 个 `plugins/` 文件被删除，我未参与"。我立即核查，确认是真的，不是误报。

### 怎么修的

两个仓库的 git 对象完好（删除只发生在工作树），直接按索引恢复：

```powershell
git -C <repo-public> checkout -- plugins
git -C <repo-private>        checkout -- plugins
```

恢复后：两仓 `git status` 的删除条目归零；公共仓 **83/83 测试通过**；`?? docs/w04/` 是本次新增文档。

### 教训（写进后续操作规范）

1. **永远不要对含 junction 的目录做跨盘 `Move-Item` / 递归删除。** 先枚举 reparse point，用 `cmd /c rmdir` 逐个删链接（只删链接，不动目标），再移动目录。
2. 迁移 profile 前先跑一次"链接体检"：列出所有 `LinkType -eq 'Junction'` 及其目标，确认目标不在活跃仓库内。
3. 归档目录不应保留任何指向活跃仓库的链接（本次已复查：归档内指向仓库的 junction = **0**）。
4. 破坏性操作前后各跑一次 `git status`，用删除条数作为护栏。

### 影响面

- 仓库内容：**无永久损失**（全部从 git 恢复，测试全绿）。
- 归档的 6 个 profile：其 `node_modules` 链接在移动中被破坏；将来若要还原，需 `dsh plugin install` 重建，不能指望直接可用。
- 时间成本：一次恢复 + 一次全量测试。
