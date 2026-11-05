// Independent security regression tests for the research-phase2-exec bundle.
//
// Attack surface under test: research_notebook_execute reads one code cell from
// a notebook path supplied by the model. Before the fix, readNotebookCell()
// joined that path onto the project root without any containment check, so a
// path such as '../escape.ipynb' could read a notebook outside
// .research/projects/<id>; the execute branch then wrote the cell source to
// cell.py and ran it as Python.
//
// Everything here is created under os.tmpdir() in a mkdtemp directory: no real
// user data is read, no network access is used, and no Python process is
// spawned for the notebook-read cases.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import test, { after, before } from 'node:test'

import { apply, readNotebookCell } from '../index.js'
import { runConfined } from '../lib/run.js'

const PROJECT_ID = 'sec-probe'
const SENTINEL = 'SECRET_ESCAPE_SENTINEL_7f3c'
const EXEC = { agent: { name: 'security-test-agent' }, signal: undefined }

let workspace
let projectDir
let tools

function notebook(source) {
  return JSON.stringify({
    cells: [
      { cell_type: 'markdown', source: ['# probe'] },
      { cell_type: 'code', source: [source], metadata: {}, outputs: [], execution_count: null },
    ],
    metadata: {},
    nbformat: 4,
    nbformat_minor: 5,
  })
}

function captureTools(ctxGet) {
  const registered = new Map()
  apply({
    effect(fn) { return fn() },
    tools: { register(tool) { registered.set(tool.name, tool) } },
    get: ctxGet,
  })
  return registered
}

function assertContainedTarget(target, root) {
  const base = resolve(root)
  const value = resolve(target)
  const isWindows = process.platform === 'win32'
  const key = isWindows ? value.toLowerCase() : value
  const baseKey = isWindows ? base.toLowerCase() : base
  assert.ok(
    key === baseKey || key.startsWith(baseKey + sep),
    `${value} must stay inside ${base}`,
  )
}

before(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'dsh-sec-exec-'))
  projectDir = join(workspace, '.research', 'projects', PROJECT_ID)
  await mkdir(projectDir, { recursive: true })

  // Positive controls: notebooks that legitimately live inside the project root.
  await writeFile(join(projectDir, 'normal.ipynb'), notebook('print("inside-project")\n'), 'utf8')
  await mkdir(join(projectDir, 'sub'), { recursive: true })
  await writeFile(join(projectDir, 'sub', 'nested.ipynb'), notebook('print("nested-inside")\n'), 'utf8')

  // Escaping notebooks: valid cells outside the project root, carrying a sentinel
  // so a leak is unambiguous if the read ever happens.
  await writeFile(join(workspace, '.research', 'projects', 'escape.ipynb'), notebook(`print("${SENTINEL}-dotdot")`), 'utf8')
  await writeFile(join(workspace, '.research', 'escape.ipynb'), notebook(`print("${SENTINEL}-dotdot2")`), 'utf8')
  await writeFile(join(workspace, 'outside.ipynb'), notebook(`print("${SENTINEL}-absolute")`), 'utf8')

  // Prefix sibling: .research/projects/sec-probe vs .research/projects/sec-probe-evil.
  // A bare startsWith(root) comparison would wrongly accept this directory.
  const sibling = join(workspace, '.research', 'projects', `${PROJECT_ID}-evil`)
  await mkdir(sibling, { recursive: true })
  await writeFile(join(sibling, 'evil.ipynb'), notebook(`print("${SENTINEL}-sibling")`), 'utf8')

  // Wire the plugin's workingDirectory service to the temporary workspace.
  tools = captureTools((name) => (
    name === 'workingDirectory' ? { ensure: async () => workspace } : undefined
  ))
})

after(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true })
})

test('rejects relative notebook paths that escape the project root', async () => {
  for (const notebookPath of ['../escape.ipynb', '../../escape.ipynb']) {
    await assert.rejects(
      () => readNotebookCell(PROJECT_ID, notebookPath, 0, EXEC),
      (error) => {
        assert.match(error.message, /notebook path escapes project root/)
        assert.ok(!error.message.includes(SENTINEL), 'rejection must not expose outside content')
        return true
      },
      `${notebookPath} must be rejected`,
    )
  }
})

test('rejects absolute notebook paths outside the project root', async () => {
  const absolutePaths = [join(workspace, 'outside.ipynb')]
  absolutePaths.push(process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd')
  for (const notebookPath of absolutePaths) {
    await assert.rejects(
      () => readNotebookCell(PROJECT_ID, notebookPath, 0, EXEC),
      /notebook path escapes project root/,
      `${notebookPath} must be rejected`,
    )
  }
})

test('containment is separator- and case-aware (no prefix sibling, no casing false positive)', async () => {
  await assert.rejects(
    () => readNotebookCell(PROJECT_ID, `../${PROJECT_ID}-evil/evil.ipynb`, 0, EXEC),
    /notebook path escapes project root/,
  )
  if (process.platform === 'win32') {
    // Same file, different casing: must still be accepted inside the root.
    const upper = await readNotebookCell(PROJECT_ID, 'NORMAL.IPYNB', 0, EXEC)
    assert.equal(upper.source, 'print("inside-project")\n')
  }
})

test('rejects project ids that are dot segments', async () => {
  await assert.rejects(
    () => readNotebookCell('.', `${PROJECT_ID}/normal.ipynb`, 0, EXEC),
    /invalid projectId/,
  )
  await assert.rejects(
    () => readNotebookCell('..', `projects/${PROJECT_ID}/normal.ipynb`, 0, EXEC),
    /invalid projectId/,
  )
})

test('rejects an empty notebook path', async () => {
  await assert.rejects(
    () => readNotebookCell(PROJECT_ID, '   ', 0, EXEC),
    /notebookPath is required/,
  )
})

test('still reads code cells inside the project root (positive control)', async () => {
  const direct = await readNotebookCell(PROJECT_ID, 'normal.ipynb', 0, EXEC)
  assert.equal(resolve(direct.root), resolve(projectDir))
  assert.equal(direct.source, 'print("inside-project")\n')
  assertContainedTarget(direct.target, projectDir)

  const nested = await readNotebookCell(PROJECT_ID, 'sub/nested.ipynb', 0, EXEC)
  assert.equal(nested.source, 'print("nested-inside")\n')
  assertContainedTarget(nested.target, projectDir)
})

test('confirm=true gate is still enforced before any notebook read', async () => {
  const tool = tools.get('research_notebook_execute')
  assert.ok(tool, 'research_notebook_execute must be registered')
  const args = { projectId: PROJECT_ID, notebookPath: 'normal.ipynb', cellIndex: 0 }
  await assert.rejects(() => tool.execute(args, EXEC), /requires confirm=true/)
  await assert.rejects(() => tool.execute({ ...args, confirm: false }, EXEC), /requires confirm=true/)
  await assert.rejects(() => tool.execute({ ...args, confirm: 'true' }, EXEC), /requires confirm=true/)
})

test('the public tool rejects an escaping path before it can write or run a cell', async () => {
  const tool = tools.get('research_notebook_execute')
  // If containment were missing, this call would reach runConfined and fail with
  // 'DSH sandbox service is unavailable' instead of the containment error.
  await assert.rejects(
    () => tool.execute({ projectId: PROJECT_ID, notebookPath: '../escape.ipynb', cellIndex: 0, confirm: true }, EXEC),
    /notebook path escapes project root/,
  )
})

test('a valid path with confirm=true still reaches the sandbox boundary', async () => {
  const tool = tools.get('research_notebook_execute')
  // Containment must not reject a legitimate notebook; with no sandbox service
  // wired the failure has to come from the sandbox layer, not from this fix.
  await assert.rejects(
    () => tool.execute({ projectId: PROJECT_ID, notebookPath: 'normal.ipynb', cellIndex: 0, confirm: true }, EXEC),
    /DSH sandbox service is unavailable/,
  )
})

test('tool description keeps the confirm and no-network-isolation disclosures', async () => {
  const tool = tools.get('research_notebook_execute')
  const description = String(tool.description)
  assert.match(description, /confirm=true/)
  assert.match(description, /not human approval/i)
  assert.match(description, /no network isolation/i)
})

test('runConfined fails loudly when the sandbox service is unavailable', async () => {
  for (const sandbox of [undefined, null, {}, { confine: 'not-a-function' }]) {
    await assert.rejects(
      () => runConfined(sandbox, [process.execPath, '--version']),
      /DSH sandbox service is unavailable/,
    )
  }
})

test('runConfined result still declares sandbox enforcement without network isolation', async () => {
  const result = await runConfined({
    async confine(argv) { return { argv } },
  }, [process.execPath, '-e', 'process.stdout.write("ok")'], { timeoutMs: 10_000 })
  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, 'ok')
  assert.equal(result.enforcedBy, 'dsh-sandbox')
  assert.equal(result.networkIsolated, false)
  assert.match(String(result.note), /network is not isolated/i)
})
