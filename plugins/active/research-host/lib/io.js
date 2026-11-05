// D5-A IO adapter for research-host.
//
// - JSON/text reads and writes go through ctx.fs, with sandboxPolicy on writes.
// - Directory creation and .science (gzip binary) remain node:fs, because the
//   public ctx.fs has no mkdir/writeBytes. Every such path is first resolved and
//   confined inside the workspace with ctx.fs.resolve/contains.
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

const MAX_BYTES = 64 * 1024 * 1024

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

export async function createHostIO(ctx, exec, workspace) {
  const fs = ctx?.fs
  const session = exec?.agent?.session
  const policy = ctx?.sandboxPolicy?.resolve?.({ ...(session === undefined ? {} : { session }) })
  const signal = exec?.signal
  if (!fs || typeof fs.resolve !== 'function') {
    throw new Error('research-host: ctx.fs is unavailable; D5-A requires the fs service')
  }

  const root = await fs.resolve(workspace, { signal })
  const resolveInside = async (path) => {
    const target = await fs.resolve(path, { cwd: workspace, signal })
    if (typeof fs.contains === 'function' && !fs.contains(root, target)) {
      throw new Error(`research-host: path escapes workspace: ${path}`)
    }
    const hostPath = typeof fs.processPath === 'function' ? fs.processPath(target) : target.targetKey
    if (typeof fs.lstat === 'function') {
      const info = await fs.lstat(hostPath, {}, signal).catch(() => undefined)
      if (info?.type === 'symlink') throw new Error(`research-host: symlink is not allowed: ${path}`)
    }
    return target
  }
  const hostPath = (target) => (typeof fs.processPath === 'function' ? fs.processPath(target) : target.targetKey)

  return {
    async readText(path) {
      return fs.readText(await resolveInside(path), signal)
    },
    async readBytes(path) {
      const bytes = await fs.readBytes(await resolveInside(path), signal, MAX_BYTES)
      return Buffer.from(bytes)
    },
    async writeText(path, content) {
      await fs.writeText(await resolveInside(path), content, undefined, signal, policy)
    },
    async writeBytes(path, bytes) {
      const target = await resolveInside(path)
      await mkdir(dirname(hostPath(target)), { recursive: true })
      await writeFile(hostPath(target), bytes)
    },
    async mkdir(path) {
      const target = await resolveInside(path)
      await mkdir(hostPath(target), { recursive: true })
    },
    async readdir(path) {
      const entries = await fs.listDir(await resolveInside(path), signal)
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
      }))
    },
    async stat(path) {
      return fs.stat(await resolveInside(path), signal)
    },
    async chmod(path, mode) {
      // Best effort; chmod is not a public ctx.fs operation and only marks imports read-only.
      const { chmod } = await import('node:fs/promises')
      await chmod(hostPath(await resolveInside(path)), mode)
    },
  }
}

export function createNodeIO() {
  return {
    readText: (path) => import('node:fs/promises').then(({ readFile }) => readFile(path, 'utf8')),
    readBytes: (path) => import('node:fs/promises').then(({ readFile }) => readFile(path)),
    writeText: (path, content) => import('node:fs/promises').then(({ writeFile }) => writeFile(path, content, 'utf8')),
    writeBytes: (path, bytes) => import('node:fs/promises').then(({ writeFile }) => writeFile(path, bytes)),
    mkdir: (path) => mkdir(path, { recursive: true }),
    readdir: (path) => readdir(path, { withFileTypes: true }),
    stat: (path) => stat(path),
    chmod: (path, mode) => import('node:fs/promises').then(({ chmod }) => chmod(path, mode)),
  }
}

export function errorText(error) {
  return messageOf(error)
}
