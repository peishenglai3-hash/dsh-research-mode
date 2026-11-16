import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = { __ModuleLoader__: { load(value) { globalThis.__hub = value } } }
await import(new URL('../client.js', import.meta.url).href)

const plugin = globalThis.__hub.factory(() => ({ createElement() { return null } }))

test('research hub registers one consolidated right-pane entry', () => {
  const registered = []
  const injected = []
  const React = { createElement() { return null } }
  const definition = globalThis.__hub.factory(() => React)
  definition.apply({
    effect(fn) { return fn() },
    sidebarRightTabs: { register(value) { registered.push(value); return () => {} } },
    slots: { inject(name, fn) { injected.push(name); return fn() }, register() { return () => {} } },
  })
  assert.equal(registered.length, 1)
  assert.equal(registered[0].id, 'research.hub')
  assert.equal(registered[0].kind, 'research-hub')
  assert.deepEqual(injected, ['sidebar.right.pane.tab'])
})

test('a project cwd is explicit and is never replaced by a newer project', () => {
  const { resolveProjectScope, projectIdFromCwd } = plugin._internals
  const cwd = 'D:\\work\\.research\\projects\\alpha'
  assert.deepEqual(projectIdFromCwd(cwd), { workspaceRoot: 'D:\\work', projectId: 'alpha' })
  const scope = resolveProjectScope(cwd, [
    { name: 'alpha', createdAt: '2026-01-01T00:00:00.000Z' },
    { name: 'newer', createdAt: '2026-10-01T00:00:00.000Z' },
  ])
  assert.equal(scope.status, 'explicit')
  assert.equal(scope.projectId, 'alpha')
  assert.equal(scope.workspaceRoot, 'D:\\work')
})

test('a single project is selected, and no project resolves to none', () => {
  const { resolveProjectScope } = plugin._internals
  const one = resolveProjectScope('D:\\work', [{ name: 'only', createdAt: '2026-01-01T00:00:00.000Z' }])
  assert.equal(one.status, 'selected')
  assert.equal(one.projectId, 'only')

  const none = resolveProjectScope('D:\\work', [])
  assert.equal(none.status, 'none')
  assert.equal(none.projectId, null)
  assert.deepEqual(none.projects, [])
})

test('two projects fail closed instead of silently guessing one', () => {
  const { resolveProjectScope } = plugin._internals
  const scope = resolveProjectScope('D:\\work', [
    { name: 'phase1-acceptance-one', createdAt: '2026-10-20T05:13:02.860Z' },
    { name: 'it-looks-complete', createdAt: '2026-10-20T10:14:43.012Z' },
    { name: 'phase1-run', createdAt: '2026-10-19T13:43:07.509Z' },
  ])
  assert.equal(scope.status, 'ambiguous')
  assert.equal(scope.projectId, null, 'an ambiguous scope must not pick a project')
  assert.equal(scope.projects.length, 3)
  // Newest first for display only; display order is not a selection.
  assert.deepEqual(scope.projects.map((project) => project.id), ['it-looks-complete', 'phase1-acceptance-one', 'phase1-run'])
})

test('explicit choice resolves an ambiguous scope and ignores unknown ids', () => {
  const { resolveProjectScope, scopeAfterChoice } = plugin._internals
  const scope = resolveProjectScope('D:\\work', [
    { name: 'a', createdAt: '2026-10-02T00:00:00.000Z' },
    { name: 'b', createdAt: '2026-10-01T00:00:00.000Z' },
  ])
  assert.equal(scopeAfterChoice(scope, null), scope)
  assert.equal(scopeAfterChoice(scope, 'missing').status, 'ambiguous')
  const picked = scopeAfterChoice(scope, 'b')
  assert.equal(picked.status, 'selected')
  assert.equal(picked.projectId, 'b')
})

// --- regressions found by the independent QA pass ---

test('a project cwd with a trailing separator stays explicit', () => {
  const { projectIdFromCwd } = plugin._internals
  assert.deepEqual(projectIdFromCwd('D:\\work\\.research\\projects\\alpha\\'), { workspaceRoot: 'D:\\work', projectId: 'alpha' })
  assert.deepEqual(projectIdFromCwd('/home/u/work/.research/projects/alpha/'), { workspaceRoot: '/home/u/work', projectId: 'alpha' })
  // A bare drive root must survive trailing-separator stripping.
  assert.equal(projectIdFromCwd('C:\\'), null)
})

test('the .research/projects marker is matched case-insensitively but ids keep their case', () => {
  const { projectIdFromCwd } = plugin._internals
  assert.deepEqual(
    projectIdFromCwd('D:\\Work\\.RESEARCH\\PROJECTS\\AlphaProj'),
    { workspaceRoot: 'D:\\Work', projectId: 'AlphaProj' },
  )
})

test('dot segments are never accepted as a project id', () => {
  const { projectIdFromCwd } = plugin._internals
  assert.equal(projectIdFromCwd('D:\\work\\.research\\projects\\..'), null)
  assert.equal(projectIdFromCwd('D:\\work\\.research\\projects\\ .'), null)
  assert.equal(projectIdFromCwd('D:\\.research\\projects\\..'), null)
})

function renderBody(preloaded) {
  // useState order: mode, artifacts, reviews, litdb, litdbIndex, litdbQuery,
  // error, scope, chosen, refreshNonce
  let index = 0
  const React = {
    createElement(type, props, ...children) { return { type, props, children } },
    useState(initial) {
      const value = index < preloaded.length ? preloaded[index] : initial
      index += 1
      return [value, () => {}]
    },
    useEffect() {},
  }
  const definition = globalThis.__hub.factory(() => React)
  let HubBody = null
  definition.apply({
    effect(fn) { return fn() },
    sidebarRightTabs: { register() { return () => {} } },
    slots: { inject(name, fn) { return fn() }, register(_options, component) { HubBody = component; return () => {} } },
  })
  return HubBody({ useTabInfo: () => ({ tab: null }), sessionId: 'session-1' })
}

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.children)
}

test('hub body renders the unconnected state without throwing', () => {
  const tree = renderBody([])
  assert.ok(tree, 'the hub body must return a tree')
  assert.match(textOf(tree), /未连接会话/)
})

test('hub body renders an ambiguity picker instead of guessing a project', () => {
  const scope = plugin._internals.resolveProjectScope('D:\\work', [
    { name: 'it-looks-complete', createdAt: '2026-10-20T10:14:43.012Z' },
    { name: 'phase1-acceptance-one', createdAt: '2026-10-20T05:13:02.860Z' },
  ])
  // index 7 is `scope`
  const tree = renderBody([undefined, [], [], null, null, '', '', scope])
  const text = textOf(tree)
  assert.match(text, /2 个项目，尚未选择/)
  assert.match(text, /it-looks-complete/)
  assert.match(text, /phase1-acceptance-one/)
  assert.match(text, /不会自动猜测/)
  assert.equal(plugin._internals.scopeAfterChoice(scope, null).projectId, null)
})

// The provenance card's number has to mean the same thing as research_host's getProvenance.
// The sidecar is a creation-time snapshot, so it still says "review has not run" after a review
// is recorded; the host derives that face at read time, and this panel must do the same or the
// two surfaces report different numbers for the same artifact.
function sidecar(overrides = {}) {
  const face = (status) => ({ status, value: status === 'available' ? 'recorded' : null })
  return {
    id: 'a'.repeat(64),
    provenance: {
      code: face('available'),
      execution: face('unavailable'),
      environment: face('available'),
      messages: face('unavailable'),
      reproducibility: face('available'),
      review: face('unavailable'),
      literature: face('available'),
      ...overrides,
    },
  }
}

test('evidence layers: recorded alone, with no locator or code, is not checkable', () => {
  const row = sidecar()
  // The shared fixture marks literature and code as recorded; strip both so this test is about
  // the case the layer is meant to catch — an artifact nobody else can check.
  row.provenance.literature = { status: 'unavailable', reason: 'not recorded' }
  row.provenance.code = { status: 'unavailable', reason: 'not recorded' }
  const layers = plugin._internals.evidenceLayers(row, [])
  assert.equal(layers.recorded, true)
  assert.equal(layers.locator, false)
  assert.equal(layers.checkable, false)
  assert.equal(layers.judged, false)
  // No score-shaped fields may survive: the whole point of E3 is that `/7` is gone.
  assert.equal('available' in layers, false)
  assert.equal('total' in layers, false)
})

test('evidence layers: a locator makes the artifact checkable', () => {
  const row = sidecar()
  row.provenance.literature = { status: 'available', value: 'anchor #/texts/0' }
  const layers = plugin._internals.evidenceLayers(row, [])
  assert.equal(layers.locator, true)
  assert.equal(layers.checkable, true)
})

test('evidence layers: producer code also makes it checkable', () => {
  const row = sidecar()
  row.provenance.code = { status: 'available', value: 'python analyze.py' }
  row.provenance.literature = { status: 'unavailable', reason: 'not recorded' }
  const layers = plugin._internals.evidenceLayers(row, [])
  assert.equal(layers.producerCode, true)
  assert.equal(layers.checkable, true)
})

test('evidence layers: a recorded review makes it judged, even if the sidecar snapshot says otherwise', () => {
  const row = sidecar()
  const layers = plugin._internals.evidenceLayers(row, [{ artifactId: row.id, decision: 'accept' }])
  assert.equal(layers.judged, true)
  assert.equal(layers.reviewDerived, true)
})

test('evidence layers: another artifact\'s review does not make this one judged', () => {
  const row = sidecar()
  const layers = plugin._internals.evidenceLayers(row, [{ artifactId: 'c'.repeat(64), decision: 'accept' }])
  assert.equal(layers.judged, false)
  assert.equal(layers.reviewDerived, false)
})

test('the hub never prints the bare phrase 已复核', async () => {
  // v6 M-02: "已复核" is a relational claim (another person AND a valid signature). This panel
  // cannot check either, so it must say "有复核记录". Guard the wording mechanically.
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(source.includes('已复核'), false)
})
