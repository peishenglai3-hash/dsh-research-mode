import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const MAX_OUTPUT = 200_000

export async function runConfined(sandbox, argv, options = {}) {
  if (!sandbox || typeof sandbox.confine !== 'function') throw new Error('DSH sandbox service is unavailable')
  const cwd = options.cwd ?? await mkdtemp(join(tmpdir(), 'dsh-research-exec-'))
  const cleanup = options.cwd ? false : true
  try {
    const confined = await sandbox.confine(argv, { mode: 'workspace-write', workspaceRoot: cwd }, options.signal)
    const result = await new Promise((resolve) => {
      const child = spawn(confined.argv[0], confined.argv.slice(1), {
        cwd,
        env: {
          PYTHONIOENCODING: 'utf-8',
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let stdout = ''
      let stderr = ''
      let settled = false
      const finish = (value) => { if (!settled) { settled = true; resolve(value) } }
      const timer = setTimeout(() => {
        child.kill()
        finish({ exitCode: null, signal: 'TIMEOUT', stdout: stdout.slice(0, MAX_OUTPUT), stderr: stderr.slice(0, MAX_OUTPUT) })
      }, options.timeoutMs ?? 15_000)
      child.stdout.on('data', (chunk) => { if (stdout.length < MAX_OUTPUT) stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { if (stderr.length < MAX_OUTPUT) stderr += chunk.toString() })
      child.on('error', (error) => { clearTimeout(timer); finish({ exitCode: null, signal: 'SPAWN_ERROR', stdout, stderr: String(error?.message ?? error) }) })
      child.on('close', (exitCode, signal) => {
        clearTimeout(timer)
        finish({ exitCode, signal, stdout: stdout.slice(0, MAX_OUTPUT), stderr: stderr.slice(0, MAX_OUTPUT) })
      })
    })
    return { ...result, cwd, runner: confined.argv[0], enforcedBy: 'dsh-sandbox', networkIsolated: false, note: 'file-effect sandbox only; network is not isolated' }
  } finally {
    if (cleanup) await rm(cwd, { recursive: true, force: true }).catch(() => {})
  }
}
