import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveLitdbPath, searchLitdb, litdbSnapshot } from './lib/query.js'

let workingDirectoryGetter

async function workspaceRoot(exec) {
  const service = typeof workingDirectoryGetter === 'function' ? workingDirectoryGetter() : undefined
  if (!service || !exec?.agent) return undefined
  const cwd = await service.ensure(exec.agent, exec.signal)
  const match = String(cwd).match(/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/)
  return match ? match[1] : cwd
}

async function writeProjectJson(exec, projectId, filename, value) {
  if (!/^[\p{Letter}\p{Number}._-]+$/u.test(projectId)) throw new Error('invalid projectId for litdb cache')
  const root = await workspaceRoot(exec)
  if (!root) return undefined
  const dir = join(root, '.research', 'projects', projectId, '.litdb')
  await mkdir(dir, { recursive: true })
  const path = join(dir, filename)
  await writeFile(path, `${JSON.stringify({ ...value, cachedAt: new Date().toISOString() })}\n`, 'utf8')
  return path
}

async function writeCache(exec, projectId, result) {
  if (!projectId) return undefined
  return writeProjectJson(exec, projectId, 'last-search.json', result)
}

const TOOL = {
  name: 'research_litdb_search',
  description: 'Read-only search over the user-provided local litdb social-science sample (1,560 records, three journals, 2018-2026). Returns uid/title/authors/year/journal/abstract/research_theme/relationship_chain/source_url, backend (fts|like) and the database SHA256. With projectId, also writes a last-search cache for the litdb right tab. Never writes the database, migrates, rebuilds, uploads or redistributes it; not a full-journal corpus.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Topic or phrase. Chinese 2-character queries fall back to LIKE; 3+ uses FTS5 trigram.' },
      topK: { type: 'integer', description: '1-20 results; default 5.' },
      projectId: { type: 'string', description: 'Optional project id; writes .litdb/last-search.json for the litdb right tab.' },
      dbPath: { type: 'string', description: 'Optional explicit local literature.db path; defaults to $RESEARCH_LITDB_PATH or ~/.dsh/research/knowledge/litdb/literature.db.' },
    },
    required: ['query'],
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  },
  isConcurrencySafe: () => true,
  async execute(args, exec) {
    const result = searchLitdb(resolveLitdbPath(process.env, args.dbPath), args.query, args.topK)
    if (args.projectId) result.cachePath = await writeCache(exec, args.projectId, result)
    return JSON.stringify(result, null, 2)
  },
}

const SNAPSHOT_TOOL = {
  name: 'research_litdb_snapshot',
  description: 'Write a read-only local litdb index snapshot (all rows, nine fields) to .research/projects/<id>/.litdb/index.json for interactive UI search. Does not modify the database, upload or redistribute it.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectId: { type: 'string', description: 'Project id.' },
      dbPath: { type: 'string', description: 'Optional explicit local literature.db path.' },
    },
    required: ['projectId'],
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  },
  isConcurrencySafe: () => true,
  async execute(args, exec) {
    const snapshot = litdbSnapshot(resolveLitdbPath(process.env, args.dbPath))
    const cachePath = await writeProjectJson(exec, args.projectId, 'index.json', snapshot)
    return JSON.stringify({
      generatedAt: snapshot.generatedAt,
      dbPath: snapshot.dbPath,
      dbSha256: snapshot.dbSha256,
      count: snapshot.count,
      note: snapshot.note,
      cachePath,
    }, null, 2)
  },
}

export const inject = ['tools', 'workingDirectory']

export function apply(ctx) {
  workingDirectoryGetter = () => (ctx.get ? ctx.get('workingDirectory') : undefined)
  ctx.effect(() => ctx.tools.register(TOOL), 'research-phase2-litdb:tool')
  ctx.effect(() => ctx.tools.register(SNAPSHOT_TOOL), 'research-phase2-litdb:snapshot')
}
