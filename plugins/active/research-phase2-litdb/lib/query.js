import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const FIELDS = ['uid', 'title', 'authors', 'year', 'journal', 'abstract', 'research_theme', 'relationship_chain', 'source_url']

export function resolveLitdbPath(env = process.env, explicit = undefined) {
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit.trim()
  const configured = env.RESEARCH_LITDB_PATH?.trim()
  if (configured) return configured
  return join(homedir(), '.dsh', 'research', 'knowledge', 'litdb', 'literature.db')
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function litdbSnapshot(dbPath) {
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch (error) {
    throw new Error(`litdb open failed at ${dbPath}: ${error?.message ?? error}`)
  }
  try {
    db.exec('PRAGMA query_only=ON')
    const rows = db.prepare(`SELECT ${FIELDS.join(', ')} FROM literature ORDER BY year DESC, uid`).all()
    const indexFields = FIELDS.filter((field) => field !== 'abstract')
    return {
      generatedAt: new Date().toISOString(),
      dbPath,
      dbSha256: sha256File(dbPath),
      count: rows.length,
      rows: rows.map((row) => Object.fromEntries(indexFields.map((field) => [field, row[field]]))),
      note: 'local read-only sample index; abstracts omitted; not the full journals; do not redistribute',
    }
  } finally {
    db.close()
  }
}

function quoteFts(query) {
  return `"${String(query).replaceAll('"', '""')}"`
}

export function searchLitdb(dbPath, query, topK = 5) {
  const text = String(query ?? '').trim()
  if (!text) throw new Error('litdb query is required')
  const limit = Math.max(1, Math.min(20, Number.isFinite(topK) ? Math.trunc(topK) : 5))
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch (error) {
    throw new Error(`litdb open failed at ${dbPath}: ${error?.message ?? error}`)
  }
  try {
    db.exec('PRAGMA query_only=ON')
    let backend = text.length >= 3 ? 'fts' : 'like'
    let rows
    if (backend === 'fts') {
      try {
        rows = db.prepare(`
          SELECT l.uid, l.title, l.authors, l.year, l.journal, l.abstract,
                 l.research_theme, l.relationship_chain, l.source_url
          FROM literature l
          JOIN literature_fts f ON f.uid = l.uid
          WHERE literature_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(quoteFts(text), limit)
      } catch {
        backend = 'like'
      }
    }
    if (backend === 'like') {
      const like = `%${text}%`
      rows = db.prepare(`
        SELECT uid, title, authors, year, journal, abstract,
               research_theme, relationship_chain, source_url
        FROM literature
        WHERE title LIKE ? OR abstract LIKE ? OR research_theme LIKE ? OR relationship_chain LIKE ?
        ORDER BY year DESC
        LIMIT ?
      `).all(like, like, like, like, limit)
    }
    return {
      backend,
      dbPath,
      dbSha256: sha256File(dbPath),
      query: text,
      topK: limit,
      count: rows.length,
      rows: rows.map((row) => Object.fromEntries(FIELDS.map((field) => [field, row[field]]))),
    }
  } finally {
    db.close()
  }
}
