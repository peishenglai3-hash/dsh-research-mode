import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { runConfined } from './lib/run.js'

let workingDirectoryGetter
let sandboxGetter

async function projectRoot(exec, projectId) {
  if (!/^[\p{Letter}\p{Number}._-]+$/u.test(projectId) || projectId === '.' || projectId === '..') throw new Error('invalid projectId')
  const service = workingDirectoryGetter?.()
  if (!service || !exec?.agent) throw new Error('working directory service unavailable')
  const cwd = await service.ensure(exec.agent, exec.signal)
  const match = String(cwd).match(/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/)
  const workspace = match ? match[1] : cwd
  return join(workspace, '.research', 'projects', projectId)
}

// Resolve `candidate` under `root` and refuse anything that lands outside it.
// The separator is part of the prefix test so C:\a cannot match C:\ab; on
// Windows the comparison is case-insensitive, like the filesystem itself.
function assertInsideProjectRoot(root, candidate) {
  const isWindows = process.platform === 'win32'
  const base = resolve(root)
  const target = resolve(base, candidate)
  const key = isWindows ? target.toLowerCase() : target
  const baseKey = isWindows ? base.toLowerCase() : base
  if (key !== baseKey && !key.startsWith(baseKey + sep)) {
    throw new Error(`notebook path escapes project root: ${candidate}`)
  }
  return target
}

export async function readNotebookCell(projectId, notebookPath, cellIndex, exec) {
  if (typeof notebookPath !== 'string' || notebookPath.trim() === '') throw new Error('notebookPath is required')
  const root = await projectRoot(exec, projectId)
  const target = assertInsideProjectRoot(root, notebookPath)
  const raw = JSON.parse(await readFile(target, 'utf8'))
  const cells = Array.isArray(raw.cells) ? raw.cells : []
  const codeCells = cells.filter((cell) => cell.cell_type === 'code')
  const cell = codeCells[cellIndex]
  if (!cell) throw new Error(`code cell ${cellIndex} not found`)
  const source = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source ?? '')
  if (!source.trim()) throw new Error('selected cell is empty')
  return { root, target, source }
}

const TOOL = {
  name: 'research_notebook_execute',
  description: 'Execute one code cell from a project notebook in a DSH-sandboxed temporary directory. Requires confirm=true (a tool parameter, not human approval); notebookPath must resolve inside the project root. No dependency installation, no network isolation, no notebook mutation. Returns exit code and bounded stdout/stderr.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectId: { type: 'string', description: 'Project id.' },
      notebookPath: { type: 'string', description: 'Notebook path relative to project root.' },
      cellIndex: { type: 'integer', description: 'Code-cell index (0-based); default 0.' },
      confirm: { type: 'boolean', description: 'Must be true to execute.' },
    },
    required: ['projectId', 'notebookPath', 'confirm'],
  },
  output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
  isConcurrencySafe: () => false,
  async execute(args, exec) {
    if (args.confirm !== true) throw new Error('notebook execution requires confirm=true')
    const index = Number.isInteger(args.cellIndex) ? args.cellIndex : 0
    const { source } = await readNotebookCell(args.projectId, args.notebookPath, index, exec)
    const dir = await mkdtemp(join(tmpdir(), 'dsh-notebook-cell-'))
    try {
      await writeFile(join(dir, 'cell.py'), source, 'utf8')
      const sandbox = sandboxGetter?.()
      const result = await runConfined(sandbox, ['python', 'cell.py'], { cwd: dir, timeoutMs: 15_000 })
      return JSON.stringify({ projectId: args.projectId, notebookPath: args.notebookPath, cellIndex: index, sourceBytes: Buffer.byteLength(source), ...result }, null, 2)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}

const REPLAY_TOOL = {
  name: 'research_replay_execute',
  description: 'Replay one explicit argv command in a DSH-sandboxed temporary directory and compare its stdout. Requires confirm=true. Single command only; no project-wide replay; no network isolation.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectId: { type: 'string', description: 'Project id (for provenance only).' },
      argv: { type: 'array', items: { type: 'string' }, description: 'Exact argv; no shell.' },
      expectedStdout: { type: 'string', description: 'Optional expected stdout (trimmed).' },
      confirm: { type: 'boolean', description: 'Must be true to execute.' },
    },
    required: ['argv', 'confirm'],
  },
  output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
  isConcurrencySafe: () => false,
  async execute(args, exec) {
    if (args.confirm !== true) throw new Error('replay execution requires confirm=true')
    if (!Array.isArray(args.argv) || args.argv.length === 0) throw new Error('argv is required')
    const projectId = String(args.projectId ?? 'replay')
    const root = await projectRoot(exec, projectId).catch(() => undefined)
    const dir = await mkdtemp(join(tmpdir(), 'dsh-replay-'))
    try {
      const sandbox = sandboxGetter?.()
      const result = await runConfined(sandbox, args.argv.map(String), { cwd: dir, timeoutMs: 15_000 })
      const observed = String(result.stdout ?? '').trim()
      return JSON.stringify({
        projectId,
        argv: args.argv.map(String),
        expectedStdout: args.expectedStdout ?? null,
        observed,
        matches: typeof args.expectedStdout === 'string' ? observed === args.expectedStdout.trim() : null,
        ...result,
        projectRoot: root ?? null,
      }, null, 2)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}

export const inject = ['tools', 'workingDirectory', 'sandbox']

export function apply(ctx) {
  workingDirectoryGetter = () => (ctx.get ? ctx.get('workingDirectory') : undefined)
  sandboxGetter = () => (ctx.get ? ctx.get('sandbox') : undefined)
  ctx.effect(() => ctx.tools.register(TOOL), 'research-phase2-exec:notebook')
  ctx.effect(() => ctx.tools.register(REPLAY_TOOL), 'research-phase2-exec:replay')
}
