# crit-sec — 破坏性安全批判（只读审计）

- 仓库：`dsh-research-mode-public`，分支 `w03-reading`。
- **基线漂移（必须知道）**：审计开始时 HEAD=`b5f6c16`，审计过程中仓库被并发提交推进到 `898bf75`（`068c181` 拒绝 `.`/`..` 作为 projectId；`8263d23` 读 provenance 时重算 payload；`57b6c78` review face；`898bf75` 只改 README）。题面给的“已知事实”前两条已被这些提交修复，故本文**不复述**，只保留修复后仍成立或修复未覆盖的部分。行号以审计结束时的 `898bf75` 为准（插件代码自 `57b6c78` 未变），除特别标注。
- 约束：全程只读仓库；唯一的临时 fixture 建在 `%TEMP%` 并已删除，未触碰任何真实 `.research`。
- 未验证项一律标 `NOT VERIFIED`（DSH 安装目录 `...\app.asar\dsh` 在本机不存在，无法核对 `ctx.fs.readBytes`/沙箱语义）。

```yaml
- id: SEC-01
  dimension: security
  claim: |
    内容寻址校验只加在“读”路径。8263d23 让 getProvenance 重算 payload 哈希，但
    research_science_export 仍按磁盘当前字节重算 manifest，从不与 artifact 的 id/sidecar
    比对：被追加字节的 artifact 能导出成一份“自洽”的 .science，research_science_import
    再以 verifiedFiles 全数接受。更糟的是 research_artifact_record 对“已存在但被篡改”的
    payload 不重写（只判断路径存在），所以“把原始字节重新记录一遍”不会修复，只会返回旧 sidecar。
    结果是：读路径会报 payloadVerified=false，而交付物（.science）和 UI 都不会。
    前提是攻击者已能写 .research（默认 research 会话就有）；受害方是收到 .science 的第三方。
  evidence: |
    - store.js:552-555  `add()` 对磁盘当前字节取 sha256，manifest 由此生成。
    - store.js:585-592  exportScience 的 files[] = 当前字节，不校验 artifacts/<id> 是否仍等于 id。
    - store.js:626-629 / 696  import 只按 manifest 校验；payload 文件名（=记录时的 id）从不复核。
    - store.js:182-187  recordArtifact 只在 artifacts/<id> 不存在时写入；被篡改的文件不会被覆盖。
    - payload-integrity.test.mjs 证明读路径已修（本次实测 payloadVerified=false，payloadBytes=23 vs 记录 14）。
    - 本次实测（%TEMP% fixture，已清理）：export 成功；manifest 中 artifacts/<id> 的
      sha256=64851647… 而文件 id=8f24e491…（不等）；import 返回 verifiedFiles=3；导入字节含 TAMPERED。
    - plugins/active/research-hub/client.js:74  Hub 直接读 sidecar 的 provenance faces，
      从不调用 getProvenance，因此 payloadVerified 这个新字段在 UI 上不存在。
  severity: P1
  recommendation: C1
  cost: S
  falsifier: |
    在 57b6c78 上对一个 artifact 的 payload 追加字节后调 research_science_export：
    若导出被拒绝，或 manifest 中该条目的 sha256 仍等于文件名，则此条为假。
  mission_principle: |
    内容寻址是这套系统的身份承诺。一份接收方无法复核身份的 .science 不是证据，只是包装；
    修复只做在“读”而不做在“交付”，等于把不诚实挪到了下游。

- id: SEC-02
  dimension: security
  claim: |
    .science 导入没有解压上限。gunzipSync(raw) 不传 maxOutputLength，parseTar 不限条目数、
    不限单条大小，解压结果整体驻留内存；实测 gzip 压缩比 1028:1，即使 readBytes 的 64 MiB
    压缩上限真的强制，也对应约 66 GiB 解压。类型不是 '0'/NUL 的 tar 条目（symlink / hardlink /
    dir）被静默丢弃：不报错、不计入 verifiedFiles、也不告诉调用方归档里还有别的东西。
    写入失败后的清理存在，但 rm 失败被 `.catch(()=>{})` 吞掉，调用方只看到原始错误，
    无法知道半成品是否真的被删掉。题面提到的 256 MiB / 8 MiB / 10,004 三个常数在本仓库
    中不存在（NOT VERIFIED，grep 无命中）。
  evidence: |
    - store.js:629   `parseTar(... gunzipSync(raw) ...)` 无 { maxOutputLength }。
    - store.js:527-545  parseTar 循环无条目数上限、无累计字节上限。
    - store.js:541   只有 type '0'/'\0' 入列；link/dir/device 条目被静默忽略。
    - store.js:696   payload.length 只与 manifest 声明数比，不限制总量。
    - store.js:712   `rm(target,{recursive,force}).catch(()=>{})` 吞掉清理失败。
    - io.js:10,45    MAX_BYTES=64 MiB 只作用于 ctx.fs.readBytes 的第三参；
      该参数是否为硬上限、DSH 侧是否真的截断：NOT VERIFIED（本机无 DSH checkout）。
    - 本次实测：16 MiB 零字节 gzip → 16328 B（1028:1），`gunzipSync(gz)` 无选项直接返回 16 MiB。
  severity: P2
  recommendation: C1
  cost: S
  falsifier: |
    构造约 1000:1 的 .science 并在受限内存下 import：若 Host 稳定抛 “too large” 且
    .research/imports 无任何残留，则此条为假。
  mission_principle: |
    只读导入不等于安全导入。对不可信输入，边界必须按字节声明，而不是按意图声明；
    “没有执行任何东西”并不能证明“没有做任何事”。

- id: SEC-03
  dimension: security
  claim: |
    凭据拦截是 4 条文件名正则，且只作用于 source 的绝对路径与导出归档名。实测放行：
    .git-credentials、.npmrc、.netrc、keys/id_ecdsa、config/prod.env、svc.token、credential.txt；
    content 分支完全不过滤；导出侧 `isCredential(archiveName)` 面对的永远是
    artifacts/<hex> 或 reviews/<hex>.json，永不命中，是死防御。而两个模型可见的
    工具描述写的是 “Credential-like files are refused / paths are excluded”。
  evidence: |
    - store.js:20-25  CREDENTIAL_PATTERNS 只有 4 条（.env / credentials? / 四种密钥后缀 / id_rsa|id_ed25519）。
    - store.js:149-151 / 172  只在 recordArtifact 的 source 分支调用。
    - store.js:175-177  content 分支无任何过滤。
    - store.js:553  导出时对固定归档名（project.json、artifacts/<hex>、reviews/<hex>.json）调用 isCredential。
    - index.js:78 “Credential-like files are refused.”；index.js:186 “Credential-like paths are excluded.”
    - 本次实测（复制上述正则逐条跑）：
      REFUSED  .env / .env.local / credentials/x.yaml
      ALLOWED  .git-credentials / config/prod.env / .npmrc / .netrc / keys/id_ecdsa / svc.token / credential.txt
  severity: P2
  recommendation: C2
  cost: S
  falsifier: |
    调 research_artifact_record(source="<workspace>/.npmrc")：若被拒绝，或随后导出的
    .science 中不含该文件字节，则此条为假。
  mission_principle: |
    一个“帮你把证据交出去”的工具，最贵的错误是把密钥一起交出去。名字过滤不是秘密扫描器；
    可以保留它，但不能把它写成承诺。

- id: SEC-04
  dimension: security
  claim: |
    litdb 的语料来源不可认证。dbPath 参数与 RESEARCH_LITDB_PATH 都被原样当 SQLite 文件打开，
    没有目录约束、没有大小上限；返回的 dbSha256 只是“当前这个文件的哈希”，从不与任何期望值
    比对，count 也不校验。把 dbPath 指向一份自造的 literature 表数据库，就能让“1,560 条、
    三刊、2018–2026”的工具输出任意内容，并附一个看起来像校验和的 sha256——工具描述与 Hub
    都把这枚哈希当成可信标识展示。
  evidence: |
    - lib/query.js:9-14   explicit 参数优先，其次 env，皆原样返回。
    - lib/query.js:23,54  DatabaseSync(dbPath,{readOnly:true})，路径不做任何归属检查。
    - lib/query.js:34-35,91,94  dbSha256 / count 只是陈述，不是校验。
    - index.js:45,69,79  dbPath 是模型可直接填的工具参数（两个工具都有）。
    - index.js:37  描述里“1,560 records, three journals, 2018-2026”没有任何运行时断言。
    - research-hub/client.js:245,257  UI 以 “db sha256: …” 展示，读者会读成“已验证”。
  severity: P2
  recommendation: C1
  cost: S
  falsifier: |
    用一份自造的三行 literature 表 DB 调 research_litdb_search(dbPath=…)：若工具拒绝，
    或返回里标注 unverified / count 与声明不符，则此条为假。
  mission_principle: |
    语料也是证据来源。说不出期望哈希的“本地样本库”，只是另一段可以被替换、被伪造的文本；
    把它和 sha256 并排展示，反而制造了它不配有的可信度。

- id: SEC-05
  dimension: security
  claim: |
    路径穿越的实际上界是 <workspace>/.research/**，但容纳模型是“路径级”而不是“沙箱级”。
    068c181 之后 projectId 只允许单段名，realpath+前缀把 `..` 折回 .research 的请求挡在外面；
    symlink/junction 因为 realpath 会被解析而同样被挡。然而 inspectNotebook 用裸 node:fs 读，
    bundle 只 inject tools/workingDirectory，完全不经 ctx.fs/sandboxPolicy；realpath 不解析
    硬链接（Windows 下 mklink /H 不需要管理员），若同卷外部文件被硬链接进项目，读取会跟随。
    因此“最远能读到哪”取决于谁能先放下一个链接——这一点 NOT VERIFIED（未验证 DSH 沙箱是否
    允许创建硬链接，也未验证 ACL 层面的读策略是否被绕过）。
  evidence: |
    - plugins/active/research-phase2-notebook/lib/inspect.js:19-25
      projectId 单段名 + realpath(requested) + 前缀比较，之后直接 readFile。
    - plugins/active/research-phase2-notebook/index.js:36  inject 只有 ['tools','workingDirectory']。
    - 对比 research-host/lib/io.js:32-35：走 ctx.fs 的那条路径才有 symlink lstat 检查。
    - plugins/active/research-phase2-exec/index.js:22-38  readNotebookCell 只用 lexical resolve，
      连 realpath 都没有（该 bundle 不发布、也不在参考 profile 里）。
    - CI 的 12 向量 probe（tools/w01/probe-containment.mjs:7-56）只导入 exec bundle；
      未发布的那一个被 12 条用例保护，已发布的那三个靠 068c181 新加的 unit test。
  severity: P3
  recommendation: C1
  cost: M
  falsifier: |
    在项目目录内 `mklink /H link.ipynb <workspace 外同卷文件>`，再调 research_notebook_inspect：
    若建链被沙箱拒绝，或读取被拒，则此条为假。
  mission_principle: |
    边界要按“谁能让这个字节被读到”定义，而不是按“字符串看起来在不在里面”。
    realpath 只解决符号链接那一类世界，而文件系统还有别的链接方式。

- id: SEC-06
  dimension: security
  claim: |
    9 个发布包本身是干净的（零依赖、零 lifecycle script），但“干净”不在 CI 的检查范围内。
    npm-preflight 只查元数据（name/license/version/engines/files/repository），从不检查
    “无 scripts / 无依赖”这两条 README 卖点；CI 也不跑 --pack，registry 里 tarball 的
    实际内容从未在 CI 被检查。发布脚本还建议使用“bypass 2fa”的 automation token，并把
    token 放在命令行 env 里；`npm publish` 不带 --provenance。
  evidence: |
    - 本次实测 10 个 package.json：scripts=[]、dependencies/devDependencies/peerDependencies=0；
      唯一 private 的是 research-phase2-exec。9 个 public 包与 README “9 bundles” 一致。
    - tools/release/npm-preflight.mjs:42-92  检查项里没有 scripts、没有 dependencies、没有 --pack。
    - .github/workflows/verify.yml:44-45   preflight 不带 --pack，因此 tarball 未验。
    - tools/release/publish-all.mjs:5,9   建议 “bypass 2fa” 的 token / 命令行传 authToken。
    - tools/release/publish-all.mjs:44     args = ['publish','--access','public']，无 --provenance。
  severity: P3
  recommendation: C1
  cost: S
  falsifier: |
    给任一发布包加 "postinstall": "node -e \"\"" 后运行 tools/release/npm-preflight.mjs：
    若它 FAIL，则此条为假。
  mission_principle: |
    供应链的诚实不是“我们现在没有依赖”，而是“CI 会在我加依赖的那天拦住我”。
    发布者的 2FA 是这套信任链唯一的上游，不能为了省一次 OTP 就建议关掉。
```
