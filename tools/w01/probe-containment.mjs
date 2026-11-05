// Independent adversarial probe of the fixed notebook containment.
// Verifies the fix rejects escape vectors and still allows in-root paths.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readNotebookCell } from '../../plugins/active/research-phase2-exec/index.js'

const workspace = await mkdtemp(join(tmpdir(), 'w01-probe-'))
const projectId = 'probe'
const projectRoot = join(workspace, '.research', 'projects', projectId)
const notebook = JSON.stringify({ cells: [{ cell_type: 'code', source: 'print(1)\n' }] })

// The escape target sits OUTSIDE the project root but inside the workspace.
const outsideFile = join(workspace, '.research', 'projects', 'outside.ipynb')

// The real contract: a research session's cwd is either the workspace root or
// <workspace>/.research/projects/<id>. projectRoot() derives the workspace from that.
const calls = []
const service = { ensure: async () => join(workspace, '.research', 'projects', projectId) }
globalThis.__probeWorkingDirectory = service
const ctx = {
  get(name) { return name === 'workingDirectory' ? service : undefined },
  effect(fn) { return fn() },
  tools: { register() { return () => {} } },
  sandbox: { confine: async () => ({ argv: ['node', '-e', ''] }) },
}
const mod = await import('../../plugins/active/research-phase2-exec/index.js')
mod.apply(ctx)

const exec = { agent: {}, signal: AbortSignal.timeout(10_000) }

function record(label, fn) {
  return fn().then(
    () => calls.push({ label, outcome: 'ALLOWED' }),
    (error) => calls.push({ label, outcome: 'REFUSED', message: String(error?.message ?? error) }),
  )
}

try {
  await mkdir(projectRoot, { recursive: true })
  await mkdir(join(projectRoot, 'sub'), { recursive: true })
  await writeFile(join(projectRoot, 'ok.ipynb'), notebook, 'utf8')
  await writeFile(join(projectRoot, 'sub', 'nested.ipynb'), notebook, 'utf8')
  await writeFile(outsideFile, notebook, 'utf8')

  // Escape vectors: every one must be REFUSED.
  await record('../escape.ipynb', () => readNotebookCell(projectId, '../outside.ipynb', 0, exec))
  await record('../../escape.ipynb', () => readNotebookCell(projectId, '../../outside.ipynb', 0, exec))
  await record('sub/../../escape.ipynb', () => readNotebookCell(projectId, 'sub/../../outside.ipynb', 0, exec))
  await record('backslash ..\\', () => readNotebookCell(projectId, '..\\outside.ipynb', 0, exec))
  await record('workspace-relative escape', () => readNotebookCell(projectId, '../../../../outside.ipynb', 0, exec))
  await record('absolute C:\\Windows\\win.ini', () => readNotebookCell(projectId, 'C:\\Windows\\win.ini', 0, exec))
  await record('absolute POSIX /etc/passwd', () => readNotebookCell(projectId, '/etc/passwd', 0, exec))
  await record('empty path', () => readNotebookCell(projectId, '', 0, exec))
  await record('dot-segment projectId', () => readNotebookCell('..', 'ok.ipynb', 0, exec))

  // Positive controls: these must be ALLOWED.
  await record('in-root ok.ipynb (positive)', () => readNotebookCell(projectId, 'ok.ipynb', 0, exec))
  await record('in-root sub/nested.ipynb (positive)', () => readNotebookCell(projectId, 'sub/nested.ipynb', 0, exec))
  await record('in-root with dot-dot that stays inside (positive)', () => readNotebookCell(projectId, 'sub/../ok.ipynb', 0, exec))

  console.log('')
  let bad = 0
  for (const call of calls) {
    const positive = call.label.includes('positive')
    const ok = positive ? call.outcome === 'ALLOWED' : call.outcome === 'REFUSED'
    if (!ok) bad += 1
    console.log(`${ok ? '[OK  ]' : '[BAD ]'} ${call.label.padEnd(48)} ${call.outcome}${call.message ? ` — ${call.message}` : ''}`)
  }
  console.log('')
  console.log(`PROBE RESULT: ${bad === 0 ? 'PASS' : 'FAIL'} (${calls.length} vectors, ${bad} unexpected)`)
  if (bad !== 0) process.exitCode = 1
} finally {
  await rm(workspace, { recursive: true, force: true })
}
