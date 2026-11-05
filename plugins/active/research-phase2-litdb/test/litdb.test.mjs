import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, test } from 'node:test'

import { litdbSnapshot, resolveLitdbPath, searchLitdb, sha256File } from '../lib/query.js'

const FIELDS = ['uid', 'title', 'authors', 'year', 'journal', 'abstract', 'research_theme', 'relationship_chain', 'source_url']
const SNAPSHOT_FIELDS = FIELDS.filter((field) => field !== 'abstract')

// Synthetic fixture only. These six records, with their authors, journals,
// abstracts, identifiers and example.invalid URLs, are invented here so the
// tests never depend on the user's private literature.db. No real literature
// metadata is reproduced and no identifier uses the private SHXJ- prefix.
const SYNTHETIC_ROWS = [
  {
    uid: 'SYNTH-2024-0001',
    title: '平台用工中的算法调度与劳动过程研究',
    authors: '示例作者甲;示例作者乙',
    year: '2024',
    journal: '合成社会学期刊',
    abstract: '本文讨论算法调度如何重塑劳动过程中的自主性与控制边界。',
    research_theme: '劳动过程',
    relationship_chain: '算法调度 -> 劳动过程 -> 自主性',
    source_url: 'https://example.invalid/synthetic/0001',
  },
  {
    uid: 'SYNTH-2023-0002',
    title: '零工经济中的职业流动与社会保障衔接',
    authors: '示例作者丙',
    year: '2023',
    journal: '合成劳动研究',
    abstract: '以零工经济从业者为对象，考察职业流动与社会保障之间的衔接缺口。',
    research_theme: '职业流动',
    relationship_chain: '零工经济 -> 职业流动 -> 保障缺口',
    source_url: 'https://example.invalid/synthetic/0002',
  },
  {
    uid: 'SYNTH-2022-0003',
    title: '数字平台治理中的劳动权益保护机制',
    authors: '示例作者丁',
    year: '2022',
    journal: '合成平台观察',
    abstract: '讨论数字平台治理与劳动权益保护之间的制度张力。',
    research_theme: '平台治理',
    relationship_chain: '数字平台 -> 平台治理 -> 权益保护',
    source_url: 'https://example.invalid/synthetic/0003',
  },
  {
    uid: 'SYNTH-2024-0004',
    title: '城市青年就业心态与社会支持网络',
    authors: '示例作者戊',
    year: '2024',
    journal: '合成青年研究',
    abstract: '城市青年就业心态与社会支持网络之间的互动关系。',
    research_theme: '就业心态',
    relationship_chain: '城市青年 -> 就业心态 -> 社会支持',
    source_url: 'https://example.invalid/synthetic/0004',
  },
  {
    uid: 'SYNTH-2021-0005',
    title: '算法管理对服务业劳动者自主性的影响',
    authors: '示例作者己',
    year: '2021',
    journal: '合成管理评论',
    abstract: '算法管理如何影响服务业劳动者的自主性，是本文的核心问题。',
    research_theme: '算法管理',
    relationship_chain: '算法管理 -> 服务业 -> 自主性',
    source_url: 'https://example.invalid/synthetic/0005',
  },
  {
    uid: 'SYNTH-2020-0006',
    title: '县域制造业转型中的技能形成与劳动关系',
    authors: '示例作者庚',
    year: '2020',
    journal: '合成产业研究',
    abstract: '县域制造业转型过程中的技能形成与劳动关系变化。',
    research_theme: '技能形成',
    relationship_chain: '县域制造 -> 技能形成 -> 劳动关系',
    source_url: 'https://example.invalid/synthetic/0006',
  },
]

let tempRoot
let DB

// Creates the same shape lib/query.js queries: a literature table joined to a
// literature_fts virtual table by uid, with FTS5 trigram tokenization so that
// quoted 3+ character Chinese phrases become substring matches (this is why the
// production code routes <3 characters to LIKE instead).
function createSyntheticLitdb(dbPath) {
  const db = new DatabaseSync(dbPath)
  try {
    db.exec(`
      CREATE TABLE literature (
        uid TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        authors TEXT NOT NULL,
        year TEXT NOT NULL,
        journal TEXT NOT NULL,
        abstract TEXT NOT NULL,
        research_theme TEXT NOT NULL,
        relationship_chain TEXT NOT NULL,
        source_url TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE literature_fts USING fts5(
        uid UNINDEXED,
        title,
        abstract,
        research_theme,
        relationship_chain,
        tokenize = 'trigram'
      );
    `)
    const insertRow = db.prepare(`
      INSERT INTO literature (${FIELDS.join(', ')})
      VALUES (${FIELDS.map(() => '?').join(', ')})
    `)
    const insertFts = db.prepare(`
      INSERT INTO literature_fts (uid, title, abstract, research_theme, relationship_chain)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const row of SYNTHETIC_ROWS) {
      insertRow.run(...FIELDS.map((field) => row[field]))
      insertFts.run(row.uid, row.title, row.abstract, row.research_theme, row.relationship_chain)
    }
  } finally {
    db.close()
  }
}

before(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'dsh-litdb-fixture-'))
  DB = join(tempRoot, 'literature.db')
  createSyntheticLitdb(DB)
})

after(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
})

test('litdb 3+ character query uses FTS and preserves the read-only database', () => {
  const before = sha256File(DB)
  const result = searchLitdb(DB, '劳动过程', 5)
  assert.equal(result.backend, 'fts')
  assert.ok(result.count > 0)
  assert.ok(result.count <= 5)
  assert.equal(result.dbPath, DB)
  assert.equal(result.query, '劳动过程')
  assert.equal(result.topK, 5)
  assert.equal(result.dbSha256, before)
  for (const row of result.rows) {
    assert.match(row.uid, /^SYNTH-\d{4}-\d{4}$/)
    assert.equal(row.uid.startsWith('SHXJ-'), false)
    const indexed = [row.title, row.abstract, row.research_theme, row.relationship_chain]
    assert.ok(indexed.some((value) => value.includes('劳动过程')))
  }
  for (const field of FIELDS) {
    assert.equal(typeof result.rows[0][field], 'string')
  }
  assert.equal(sha256File(DB), before)
})

test('litdb 2-character query falls back to LIKE', () => {
  const result = searchLitdb(DB, '平台', 3)
  assert.equal(result.backend, 'like')
  assert.ok(result.count > 0)
  assert.ok(result.count <= 3)
  for (const row of result.rows) {
    const searched = [row.title, row.abstract, row.research_theme, row.relationship_chain]
    assert.ok(searched.some((value) => value.includes('平台')))
  }
  // At least two synthetic rows match 平台, so a topK of 1 must truncate.
  const truncated = searchLitdb(DB, '平台', 1)
  assert.equal(truncated.backend, 'like')
  assert.equal(truncated.count, 1)
})

test('litdb path resolves from RESEARCH_LITDB_PATH', () => {
  assert.equal(resolveLitdbPath({ RESEARCH_LITDB_PATH: 'C:/tmp/lit.db' }), 'C:/tmp/lit.db')
  assert.equal(resolveLitdbPath({ RESEARCH_LITDB_PATH: '  C:/tmp/lit.db  ' }), 'C:/tmp/lit.db')
  assert.equal(resolveLitdbPath({ RESEARCH_LITDB_PATH: 'C:/env/lit.db' }, ' C:/explicit/lit.db '), 'C:/explicit/lit.db')
  assert.equal(resolveLitdbPath({ RESEARCH_LITDB_PATH: 'C:/env/lit.db' }, '   '), 'C:/env/lit.db')
  assert.equal(resolveLitdbPath({}), join(homedir(), '.dsh', 'research', 'knowledge', 'litdb', 'literature.db'))
})

test('litdb snapshot exports all synthetic rows read-only', () => {
  const before = sha256File(DB)
  const snapshot = litdbSnapshot(DB)
  assert.equal(snapshot.dbPath, DB)
  assert.equal(snapshot.count, SYNTHETIC_ROWS.length)
  assert.equal(snapshot.rows.length, SYNTHETIC_ROWS.length)
  assert.equal(snapshot.dbSha256, before)
  assert.match(snapshot.note, /read-only/)
  assert.deepEqual(
    snapshot.rows.map((row) => row.uid).sort(),
    SYNTHETIC_ROWS.map((row) => row.uid).sort(),
  )
  const first = snapshot.rows[0]
  assert.equal(typeof first.title, 'string')
  assert.equal(first.abstract, undefined)
  assert.deepEqual(Object.keys(first).sort(), [...SNAPSHOT_FIELDS].sort())
  const years = snapshot.rows.map((row) => row.year)
  assert.deepEqual(years, [...years].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0)))
  assert.equal(sha256File(DB), before)
})

test('tool registers read-only search and snapshot', async () => {
  const { apply } = await import('../index.js')
  const registered = []
  apply({ effect(fn) { return fn() }, tools: { register(tool) { registered.push(tool) } } })
  assert.deepEqual(registered.map((tool) => tool.name).sort(), ['research_litdb_search', 'research_litdb_snapshot'])
  assert.equal(registered.every((tool) => tool.isConcurrencySafe()), true)
})
