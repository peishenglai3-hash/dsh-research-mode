// W02-S1-01: rc.5 controlled GUI retest — strict same-session A1 -> B1 -> A2.
//
// Differences from the W01/D2 trial (deliberate, per RM-W02-DEC-002 §二):
//   - prompts explicitly forbid litdb, network and shell, because this retest must not
//     touch the real literature.db or reach the internet;
//   - after the run, the session log is decoded and the tool trace is checked: any
//     litdb / connector / web / shell call is a FINDING, not a silent pass;
//   - the synthetic project is removed in `finally` and the absence is asserted.
//
//   node tools/w01/s1-aba-trial.mjs <url> <outDir> <workspaceRoot>
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { withPage, evaluate, screenshot, sleep, waitFor, clickText, clickLabelled } from './cdp.mjs'

const url = process.argv[2]
const outDir = process.argv[3]
const workspace = process.argv[4] ?? '<workspace>'
const researchRoot = join(workspace, '.research')
mkdirSync(outDir, { recursive: true })

const record = {
  runId: `s1-aba-${Date.now()}`,
  // QA R3: the artifact must evidence WHICH instance produced it.
  instance: {
    url,
    hostVersion: process.env.S1_HOST_VERSION ?? null,
    profile: process.env.S1_PROFILE ?? null,
    port: process.env.S1_PORT ?? null,
    workspace,
    startedAt: new Date().toISOString(),
  },
  steps: [],
  assertions: [],
}
const A = (id, ok, detail) => {
  record.assertions.push({ id, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`)
}

if (existsSync(researchRoot)) {
  console.error(`refusing to run: ${researchRoot} already exists`)
  process.exit(2)
}

async function dismiss(send) {
  for (let i = 0; i < 5; i++) {
    if (await evaluate(send, `document.body.innerText.indexOf('预览版说明') === -1`)) return
    await clickText(send, '继续')
    await sleep(500)
  }
}

const SNAP = `(() => {
  const s = globalThis.__researchHubContext.sessions.list.getSnapshot();
  const turns = {};
  for (const id of s.ids) { const b = s.byId[id]; turns[id] = b && b.projectionValues && b.projectionValues.sessionStats ? (b.projectionValues.sessionStats.turns || 0) : 0; }
  return { ids: s.ids.slice(), turns, phase: s.phase };
})()`

async function storeState(send) {
  const raw = await evaluate(send, SNAP)
  return { ...raw, setHash: [...raw.ids].sort().join('|').length + ':' + raw.ids.length }
}

async function sendMessage(send, text) {
  const ready = await evaluate(send, `(() => {
    const el = [...document.querySelectorAll('div[role="textbox"][contenteditable="true"], [contenteditable="true"]')].find((n) => n.getClientRects().length > 0);
    if (!el) return 'no-composer'; el.focus(); el.click(); return 'ok';
  })()`)
  if (ready !== 'ok') throw new Error('composer not found')
  await sleep(300)
  await send('Input.insertText', { text })
  await sleep(500)
  const typed = await evaluate(send, `(() => { const el = [...document.querySelectorAll('div[role="textbox"][contenteditable="true"], [contenteditable="true"]')].find((n) => n.getClientRects().length > 0); return el ? (el.innerText || '').trim().length : -1 })()`)
  if (!typed || typed < 8) throw new Error(`composer did not receive text (len=${typed})`)
  await evaluate(send, `document.querySelector('[aria-label="发送消息"]').click()`)
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const left = await evaluate(send, `(() => { const el = [...document.querySelectorAll('div[role="textbox"][contenteditable="true"], [contenteditable="true"]')].find((n) => n.getClientRects().length > 0); return el ? (el.innerText || '').trim().length : 0 })()`)
    if (left === 0) return
    await sleep(500)
  }
  throw new Error('composer did not clear after send')
}

async function waitForNewSession(send, baselineIds, outDir, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await storeState(send)
    const fresh = state.ids.filter((id) => !baselineIds.includes(id))
    if (fresh.length >= 1) return { state, sessionId: fresh[0], fresh }
    await sleep(1500)
  }
  const body = await evaluate(send, 'document.body.innerText').catch(() => '')
  await screenshot(send, join(outDir, 's1-aba-FAIL-no-new-session.png')).catch(() => {})
  throw new Error(`no new session id appeared; bodyTail=${body.slice(-600).replace(/\n+/g, ' | ')}`)
}

async function waitSettled(send, sessionId, previousTurns, label, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs
  let stableSince = null
  let lastLen = -1
  while (Date.now() < deadline) {
    const probe = await evaluate(send, `(() => {
      const s = globalThis.__researchHubContext.sessions.list.getSnapshot();
      const b = s.byId[${JSON.stringify(sessionId)}];
      const st = b && b.projectionValues && b.projectionValues.sessionStats ? b.projectionValues.sessionStats : {};
      return { running: !!(b && b.running), turns: st.turns || 0, textLen: document.body.innerText.length };
    })()`)
    if (probe.turns > previousTurns && !probe.running) {
      if (probe.textLen === lastLen) {
        if (!stableSince) stableSince = Date.now()
        if (Date.now() - stableSince > 6000) return probe
      } else { stableSince = null; lastLen = probe.textLen }
    }
    await sleep(1500)
  }
  throw new Error(`timed out waiting for ${label}`)
}

function fsSnapshot() {
  if (!existsSync(researchRoot)) return { exists: false, projects: [], detail: {} }
  const pd = join(researchRoot, 'projects')
  const projects = existsSync(pd) ? readdirSync(pd, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []
  const detail = {}
  for (const p of projects) {
    const list = (sub) => { const dir = join(pd, p, sub); return existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [] }
    detail[p] = { artifacts: list('artifacts'), reviews: list('reviews'), exports: list('exports') }
  }
  return { exists: true, projects, detail }
}

// ---- decode the session log and classify every tool call ----
function toolTrace(sessionId) {
  const wsKeys = readdirSync(join(homedir(), '.dsh', 'sessions'))
  let file = null
  for (const key of wsKeys) {
    const candidate = join(homedir(), '.dsh', 'sessions', key, sessionId, 'session.v4.jsonl.zstd')
    if (existsSync(candidate)) { file = candidate; break }
  }
  if (!file) return { error: 'session log not found' }
  const buffer = readFileSync(file)
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  for (let i = 0; i + 4 <= buffer.length; i++) {
    if (buffer[i] === MAGIC[0] && buffer[i + 1] === MAGIC[1] && buffer[i + 2] === MAGIC[2] && buffer[i + 3] === MAGIC[3]) starts.push(i)
  }
  const parts = []
  let decoded = 0
  for (let f = 0; f < starts.length; f++) {
    const from = starts[f]
    const to = f + 1 < starts.length ? starts[f + 1] : buffer.length
    try { parts.push(zstdDecompressSync(buffer.subarray(from, to))); decoded += 1 } catch { /* not a frame boundary */ }
  }
  const entries = Buffer.concat(parts).toString('utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const calls = entries.filter((e) => e.type === 'tool/call').map((e) => ({ turn: e.data?.turn, name: e.data?.name }))
  const forbidden = calls.filter((c) => /litdb|web_search|web_fetch|crossref|openalex|datacite|ilostat|worldbank|socarxiv|pku_dataverse|nbs_snapshot|pwsh|terminal|notebook_execute|replay_execute/.test(c.name ?? ''))
  const perTurn = {}
  for (const c of calls) { perTurn[c.turn] = perTurn[c.turn] ?? []; perTurn[c.turn].push(c.name) }
  return { frames: starts.length, decoded, entries: entries.length, calls: calls.length, perTurn, forbidden }
}

try {
  await withPage(url, { userDataDir: join(outDir, 'profile'), port: 9370 }, async ({ send }) => {
    await waitFor(send, 'document.body.innerText.trim().length > 40', 45000, 'app shell')
    await sleep(1800)
    await dismiss(send)

    const baseline = await storeState(send)
    record.baseline = { count: baseline.ids.length, researchExists: existsSync(researchRoot) }
    A('A1-0-clean-workspace', !existsSync(researchRoot), `.research exists=${existsSync(researchRoot)}`)

    const newClicked = await clickLabelled(send, /新建会话/)
    A('A1-1a-new-session-click', newClicked, `clickLabelled(/新建会话/) -> ${newClicked}`)
    await sleep(2500)
    await dismiss(send)
    await sendMessage(send, '用两三句话说明「社会原子化」这个概念在中文社会学里大致指什么，依据用你自己的知识即可。禁止检索本地文献库、禁止联网、禁止运行任何命令。不要创建任何项目或文件。')
    const { sessionId } = await waitForNewSession(send, baseline.ids, outDir)
    A('A1-1-session-identified', true, `sessionId=${sessionId}`)
    const a1 = await waitSettled(send, sessionId, 0, 'A1')
    await screenshot(send, join(outDir, 's1-aba-1-a1.png'))
    const fsA1 = fsSnapshot()
    record.steps.push({ phase: 'A1', turns: a1.turns, fs: fsA1 })
    A('A1-2-no-project-created', !fsA1.exists, `.research exists=${fsA1.exists}`)

    await sendMessage(send, '现在在临时测试工作区里做一件有明确产出的事：为「S1 合成验收」建立一个 literature-review 项目，把我下面这段我自己写的合成笔记记为 artifact，标题用 Synthetic S1 Note，然后给它做一次 accept 复核。只用我给的内容；禁止检索文献库、禁止联网、禁止运行任何命令。笔记正文：这是为工作流验收编写的合成测试文本，不含任何真实文献数据或引文。')
    const b1 = await waitSettled(send, sessionId, a1.turns, 'B1')
    await screenshot(send, join(outDir, 's1-aba-2-b1.png'))
    const fsB1 = fsSnapshot()
    record.steps.push({ phase: 'B1', turns: b1.turns, fs: fsB1 })
    A('B1-1-same-session', b1.turns > a1.turns, `turns ${a1.turns} -> ${b1.turns} on ${sessionId}`)
    A('B1-2-one-project', fsB1.projects.length === 1, `projects=${JSON.stringify(fsB1.projects)}`)
    const proj = fsB1.projects[0]
    const arts = proj ? fsB1.detail[proj].artifacts : []
    const revs = proj ? fsB1.detail[proj].reviews : []
    A('B1-3-artifact', arts.some((f) => /^[0-9a-f]{64}$/.test(f)), `artifacts=${arts.length}`)
    A('B1-4-review', revs.length === 1, `reviews=${revs.length}`)
    let decision = null
    if (revs.length === 1) {
      try { decision = JSON.parse(readFileSync(join(researchRoot, 'projects', proj, 'reviews', revs[0]), 'utf8')).decision } catch {}
    }
    A('B1-5-review-accept', decision === 'accept', `decision=${decision}`)

    await sendMessage(send, '好，先离开项目。回到开放讨论：不用项目上下文，只用一句话说明为什么研究社会原子化需要人口流动数据。禁止检索文献库、禁止联网、禁止运行命令；不要创建或修改任何文件。')
    const a2 = await waitSettled(send, sessionId, b1.turns, 'A2')
    await screenshot(send, join(outDir, 's1-aba-3-a2.png'))
    const fsA2 = fsSnapshot()
    record.steps.push({ phase: 'A2', turns: a2.turns, fs: fsA2 })
    A('A2-1-same-session', a2.turns > b1.turns, `turns ${b1.turns} -> ${a2.turns}`)
    A('A2-2-project-preserved', fsA2.projects.length === 1, `projects=${JSON.stringify(fsA2.projects)}`)
    const arts2 = proj && fsA2.detail[proj] ? fsA2.detail[proj].artifacts : []
    A('A2-3-no-new-writes', JSON.stringify(arts2) === JSON.stringify(arts), `artifacts ${arts.length}->${arts2.length}`)

    const trace = toolTrace(sessionId)
    record.trace = trace
    if (trace.error) {
      A('TRACE-1-decoded', false, trace.error)
    } else {
      A('TRACE-1-decoded', true, `frames=${trace.frames} decoded=${trace.decoded} entries=${trace.entries} calls=${trace.calls}`)
      A('TRACE-2-no-forbidden-tools', trace.forbidden.length === 0,
        trace.forbidden.length === 0 ? 'no litdb / network / shell calls observed' : `FORBIDDEN: ${JSON.stringify(trace.forbidden)}`)
      A('TRACE-3-a2-zero-calls', (trace.perTurn[3] ?? []).length === 0, `turn3 calls=${JSON.stringify(trace.perTurn[3] ?? [])}`)
    }
  })
} finally {
  let removed = false
  if (existsSync(researchRoot)) { rmSync(researchRoot, { recursive: true, force: true }); removed = true }
  record.cleanup = { removed, existsAfter: existsSync(researchRoot) }
  writeFileSync(join(outDir, 's1-aba-result.json'), JSON.stringify(record, null, 2), 'utf8')
  const failed = record.assertions.filter((x) => !x.ok).length
  console.log(`\nS1 ABA RESULT: ${failed === 0 ? 'PASS' : 'FAIL'} (${record.assertions.length - failed}/${record.assertions.length})`)
  console.log(`cleanup: removed=${removed} existsAfter=${existsSync(researchRoot)}`)
  if (failed > 0) process.exitCode = 1
}
