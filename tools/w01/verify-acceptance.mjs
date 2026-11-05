// W01 Gate-A acceptance — runnable, zero third-party dependencies.
//
// Proves the W01 acceptance samples from the handoff document (§6) against a
// throwaway workspace in os.tmpdir(). It never reads or writes the user's real
// .research tree and never opens the real literature.db.
//
//   node tools/w01/verify-acceptance.mjs
//
// Exit code 0 = every check passed. 1 = at least one check failed.
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

const results = []
async function check(id, name, fn) {
  try {
    const detail = await fn()
    results.push({ id, name, ok: true })
    console.log(`[PASS] ${id} ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    results.push({ id, name, ok: false })
    console.log(`[FAIL] ${id} ${name} — ${error?.message ?? error}`)
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// A minimal synthetic litdb: same schema and tokenizer as the production sample.
function createSyntheticLitdb(path) {
  const db = new DatabaseSync(path)
  try {
    db.exec(`
      CREATE TABLE literature (
        uid TEXT PRIMARY KEY, title TEXT NOT NULL, authors TEXT NOT NULL, year TEXT NOT NULL,
        journal TEXT NOT NULL, abstract TEXT NOT NULL, research_theme TEXT NOT NULL,
        relationship_chain TEXT NOT NULL, source_url TEXT NOT NULL);
      CREATE VIRTUAL TABLE literature_fts USING fts5(
        uid UNINDEXED, title, abstract, research_theme, relationship_chain, tokenize = 'trigram');
    `)
    const row = ['ACC-2024-0001', '算法调度与劳动过程', '示例作者', '2024', '合成期刊',
      '讨论算法调度对劳动过程的影响。', '劳动过程', '算法调度 -> 劳动过程', 'https://example.invalid/acc/1']
    db.prepare('INSERT INTO literature VALUES (?,?,?,?,?,?,?,?,?)').run(...row)
    db.prepare('INSERT INTO literature_fts (uid,title,abstract,research_theme,relationship_chain) VALUES (?,?,?,?,?)')
      .run(row[0], row[1], row[5], row[6], row[7])
  } finally {
    db.close()
  }
}

const workspace = await mkdtemp(join(tmpdir(), 'w01-gate-a-'))
const litdbPath = join(workspace, 'synthetic-literature.db')
let currentCwd = workspace

try {
  createSyntheticLitdb(litdbPath)

  // Register the real host and litdb tools through their real apply().
  const tools = {}
  const ctx = {
    get(name) {
      if (name === 'workingDirectory') return { ensure: async () => currentCwd }
      return undefined
    },
    effect(fn) { return fn() },
    tools: { register(definition) { tools[definition.name] = definition; return () => {} } },
    logger: { warn() {} },
  }
  const host = await import(pathToFileURL(join(repoRoot, 'plugins/active/research-host/index.js')).href)
  host.apply(ctx)
  const litdb = await import(pathToFileURL(join(repoRoot, 'plugins/active/research-phase2-litdb/index.js')).href)
  litdb.apply(ctx)

  globalThis.window = { __ModuleLoader__: { load(value) { globalThis.__hubDef = value } } }
  await import(pathToFileURL(join(repoRoot, 'plugins/active/research-hub/client.js')).href)
  const hub = globalThis.__hubDef.factory(() => ({ createElement() { return null } }))._internals

  const exec = { agent: {}, signal: AbortSignal.timeout(30_000) }
  const run = async (name, args) => JSON.parse(await tools[name].execute(args, exec))

  // ============================ Path A: open reading ============================
  await check('A1', 'free exploration works with no project', async () => {
    const listed = await run('research_project_list', {})
    assert(Array.isArray(listed.projects), 'project list must be an array')
    assert(listed.projects.length === 0, `expected no projects, got ${listed.projects.length}`)
    return 'project list is empty and readable'
  })

  await check('A2', 'listing projects does not create .research', async () => {
    await run('research_project_list', {})
    const entries = await readdir(workspace)
    assert(!entries.includes('.research'), '.research must not be created by a read-only listing')
    return 'workspace untouched'
  })

  await check('A3', 'litdb reading works with no project at all', async () => {
    const found = await run('research_litdb_search', { query: '劳动过程', topK: 5, dbPath: litdbPath })
    assert(found.backend === 'fts', `expected fts backend, got ${found.backend}`)
    assert(found.count > 0, 'expected at least one synthetic hit')
    return `backend=${found.backend} count=${found.count}`
  })

  await check('A4', 'litdb search without projectId writes nothing', async () => {
    await run('research_litdb_search', { query: '劳动过程', dbPath: litdbPath })
    const entries = await readdir(workspace)
    assert(!entries.includes('.research'), 'a project-less search must not create .research')
    return 'no cache directory created'
  })

  // ========================= Path B: strict paper task =========================
  let projectId = null
  let artifactId = null

  await check('B1', 'project + artifact expose seven provenance faces', async () => {
    currentCwd = workspace
    const created = await run('research_project_create', { name: '验收项目', template: 'literature-review' })
    projectId = created.project.id
    currentCwd = join(workspace, '.research', 'projects', projectId)
    const recorded = await run('research_artifact_record', {
      projectId, title: '检索日志', kind: 'search-log', content: 'evidence body\n', code: 'litdb search',
    })
    artifactId = recorded.artifact.id
    const provenance = await run('research_provenance_get', { projectId, artifactId })
    assert(Object.keys(provenance.faces).length === 7, 'provenance must expose seven faces')
    return `project=${projectId} faces=7`
  })

  await check('B2', 'three review rounds all verify', async () => {
    for (const decision of ['accept', 'revise', 'accept']) {
      await run('research_review_record', {
        projectId, artifactId, decision, notes: `${decision} round`, reviewer: 'auditor', authority: 'auditor', template: 'evidence',
      })
    }
    const verified = await run('research_review_verify', { projectId, artifactId })
    assert(verified.roundCount === 3, `expected 3 rounds, got ${verified.roundCount}`)
    assert(verified.validRounds === 3, `expected 3 valid rounds, got ${verified.validRounds}`)
    assert(verified.valid === true, 'overall verification must pass')
    return `${verified.validRounds}/${verified.roundCount} rounds valid`
  })

  await check('B3', 'three rounds survive a .science roundtrip', async () => {
    const exported = await run('research_science_export', { projectId, name: 'gate-a' })
    const imported = await run('research_science_import', { archive: exported.path, name: 'gate-a' })
    const restored = JSON.parse(await readFile(join(workspace, imported.path, 'payload', 'reviews', `${artifactId}.json`), 'utf8'))
    assert(restored.history.length === 3, `expected 3 restored rounds, got ${restored.history.length}`)
    assert(imported.manifest.files.some((file) => file.path === `reviews/${artifactId}.json`), 'manifest must declare the review file')
    for (const round of restored.history) {
      assert(/^[0-9a-f]{64}$/.test(round.signature), 'every restored round must keep its signature')
    }
    return `3 rounds restored, ${imported.verifiedFiles} files checksum-verified`
  })

  await check('B4', 'tampering the earliest round is detected', async () => {
    const livePath = join(workspace, '.research', 'projects', projectId, 'reviews', `${artifactId}.json`)
    const pristine = await readFile(livePath, 'utf8')
    try {
      const stored = JSON.parse(pristine)
      stored.history[0].decision = 'reject'
      await writeFile(livePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')
      const verified = await run('research_review_verify', { projectId, artifactId })
      assert(verified.valid === false, 'overall verification must fail')
      assert(verified.rounds[0].status === 'invalid', `expected round 1 invalid, got ${verified.rounds[0].status}`)
      assert(verified.rounds[1].status === 'valid' && verified.rounds[2].status === 'valid', 'later rounds must stay valid')
      return 'round 1 invalid, rounds 2-3 still valid'
    } finally {
      // Restore the pristine record: the acceptance run must not leave tampered data.
      await writeFile(livePath, pristine, 'utf8')
    }
  })

  await check('B5', 'the derived review face does not rewrite the artifact', async () => {
    const provenance = await run('research_provenance_get', { projectId, artifactId })
    assert(provenance.reviewSource === 'derived-from-reviews', `expected derived review face, got ${provenance.reviewSource}`)
    assert(provenance.faces.review.status === 'available', 'review face must be available after a review')
    assert(provenance.reviewSnapshot.status === 'unavailable', 'the recorded snapshot must stay as recorded')
    return 'derived at read time; sidecar snapshot unchanged'
  })

  // ============================ A -> B -> A ============================
  await check('C1', 'returning to the workspace keeps the record readable', async () => {
    currentCwd = workspace
    const listed = await run('research_project_list', {})
    assert(listed.projects.length === 1, `expected 1 project, got ${listed.projects.length}`)
    const artifacts = await run('research_artifact_list', { projectId })
    assert(artifacts.artifacts.length === 1, `expected 1 artifact, got ${artifacts.artifacts.length}`)
    return 'project still readable from the workspace root'
  })

  await check('C2', 'two projects never silently cross over', async () => {
    currentCwd = workspace
    const scope = hub.resolveProjectScope(workspace, [
      { name: 'it-looks-complete', createdAt: '2026-10-20T10:14:43.012Z' },
      { name: 'phase1-acceptance-one', createdAt: '2026-10-20T05:13:02.860Z' },
    ])
    assert(scope.status === 'ambiguous', `expected ambiguous, got ${scope.status}`)
    assert(scope.projectId === null, 'an ambiguous scope must not select a project')
    const explicit = hub.resolveProjectScope(join(workspace, '.research', 'projects', projectId), scope.projects)
    assert(explicit.status === 'explicit' && explicit.projectId === projectId, 'a project cwd must stay explicit')
    return 'ambiguous fails closed; explicit cwd wins'
  })

  // ======================= execution bundle isolation =======================
  await check('D1', 'the W01 profile cannot register the exec bundle', async () => {
    const profilePath = join(homedir(), '.dsh', 'profiles', 'w01-alpha', 'package.json')
    const profile = JSON.parse(await readFile(profilePath, 'utf8'))
    const deps = Object.keys(profile.dependencies ?? {})
    const bundles = profile.dsh?.profile?.bundles ?? []
    assert(!deps.includes('@local/research-phase2-exec'), 'exec must not be a dependency')
    assert(!bundles.includes('@local/research-phase2-exec'), 'exec must not be a bundle')
    return `${bundles.length} bundles, exec absent from deps and bundles`
  })

  await check('D2', 'research presets declare the reading guardrails', async () => {
    for (const name of ['research-preset', 'research-preset-cn-social']) {
      const text = await readFile(join(repoRoot, 'plugins/active', name, 'cordis.patch.yml'), 'utf8')
      assert(text.includes('Never present an abstract as the full text'), `${name} is missing the abstract-only rule`)
      assert(text.includes('Open reading needs no project'), `${name} is missing the open-reading rule`)
      assert(text.includes('Leaving a project and returning to open discussion'), `${name} is missing the return rule`)
    }
    return 'both presets carry the three reading rules'
  })
} finally {
  await rm(workspace, { recursive: true, force: true })
}

const passed = results.filter((result) => result.ok).length
const failed = results.length - passed
console.log('')
console.log(`W01 GATE-A ACCEPTANCE: ${failed === 0 ? 'PASS' : 'FAIL'}`)
console.log(`checks ${results.length} · pass ${passed} · fail ${failed}`)
if (failed > 0) {
  console.log('failed ids: ' + results.filter((result) => !result.ok).map((result) => result.id).join(', '))
  process.exitCode = 1
}
