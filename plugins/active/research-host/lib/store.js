// Project-level Research store for @local/research-core.
//
// Layout (inside the session working directory):
//   .research/projects/<project-id>/project.json
//   .research/projects/<project-id>/artifacts/<sha256>
//   .research/projects/<project-id>/artifacts/<sha256>.json
//   .research/projects/<project-id>/exports/<name>.science
//   .research/imports/<name>/
//
// No database, no DSH session mutation. All writes stay under `.research`.
import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createNodeIO } from './io.js'

const nodeIO = createNodeIO()

const FORMAT = 'science/1'
const CREDENTIAL_PATTERNS = [
  /(^|[/\\])\.env(\.|$)/i,
  /(^|[/\\])credentials?([/\\]|$)/i,
  /\.(pem|key|p12|pfx|keystore)$/i,
  /(^|[/\\])id_(rsa|ed25519)(\.|$)/i,
]

const FACE_KEYS = [
  'code', 'execution', 'environment', 'messages',
  'reproducibility', 'review', 'literature',
]

export class ScienceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ScienceError'
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function slugify(name) {
  const base = String(name ?? '')
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base || `project-${Date.now()}`
}

export function researchRoot(workspace) {
  return join(resolve(workspace), '.research')
}

export function projectPath(workspace, id) {
  const root = researchRoot(workspace)
  const safe = String(id ?? '').replace(/[^\p{Letter}\p{Number}._-]/gu, '')
  if (!safe) throw new ScienceError('project id is required')
  const path = resolve(root, 'projects', safe)
  if (path !== resolve(root, 'projects', safe) || !path.startsWith(resolve(root, 'projects') + sep)) {
    throw new ScienceError('project id escapes .research/projects')
  }
  return path
}

async function readJson(path, fallback = undefined, io = nodeIO) {
  try {
    return JSON.parse(await io.readText(path))
  } catch (error) {
    const missing = error?.code === 'ENOENT'
      || error?.code === 'FS_NOT_FOUND'
      || /not found/i.test(String(error?.message ?? ''))
    if (fallback !== undefined && missing) return fallback
    throw error
  }
}

async function writeJson(path, value, io = nodeIO) {
  await io.mkdir(dirname(path))
  await io.writeText(path, `${JSON.stringify(value, null, 2)}\n`)
}

export async function createProject(workspace, { name, template = 'literature-review' }, io = nodeIO) {
  const label = String(name ?? '').trim()
  if (!label) throw new ScienceError('project name is required')
  const root = researchRoot(workspace)
  await io.mkdir(join(root, 'projects'))
  let id = slugify(label)
  let attempt = 1
  while (await pathExists(projectPath(workspace, id), io)) {
    id = `${slugify(label)}-${attempt++}`
  }
  const dir = projectPath(workspace, id)
  await io.mkdir(join(dir, 'artifacts'))
  await io.mkdir(join(dir, 'exports'))
  const project = {
    id,
    name: label,
    template,
    createdAt: new Date().toISOString(),
    status: 'active',
  }
  await writeJson(join(dir, 'project.json'), project, io)
  return { project, path: relative(workspace, dir) }
}

async function pathExists(path, io = nodeIO) {
  try {
    const info = await io.stat(path)
    return info !== undefined
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

export async function listProjects(workspace, io = nodeIO) {
  const dir = join(researchRoot(workspace), 'projects')
  let entries = []
  try {
    entries = await io.readdir(dir)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const projects = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      projects.push(await readJson(join(dir, entry.name, 'project.json'), undefined, io))
    } catch {
      // A partial project directory is visible as a gap, not fatal.
    }
  }
  return projects.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

function unavailable(reason) {
  return { status: 'unavailable', reason }
}

function face(value, reason) {
  return value === undefined || value === null || value === ''
    ? unavailable(reason)
    : { status: 'available', value }
}

function isCredential(path) {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(path))
}

function assertInside(base, candidate) {
  const root = resolve(base)
  const path = resolve(candidate)
  if (path !== root && !path.startsWith(root + sep)) {
    throw new ScienceError(`path escapes ${root}`)
  }
  return path
}

export async function recordArtifact(workspace, projectId, input = {}, io = nodeIO) {
  const dir = projectPath(workspace, projectId)
  const project = await readJson(join(dir, 'project.json'), null, io)
  if (!project) throw new ScienceError(`unknown project: ${projectId}`)
  const title = String(input.title ?? '').trim()
  if (!title) throw new ScienceError('artifact title is required')
  let bytes
  let originalName = null
  if (typeof input.source === 'string' && input.source.trim()) {
    const source = assertInside(workspace, resolve(workspace, input.source))
    if (isCredential(source)) throw new ScienceError('refusing to record a credential-like file')
    bytes = await io.readBytes(source)
    originalName = basename(source)
  } else if (typeof input.content === 'string') {
    bytes = Buffer.from(input.content, 'utf8')
  } else {
    throw new ScienceError('artifact source or content is required')
  }
  const digest = sha256(bytes)
  const artifactPath = join(dir, 'artifacts', digest)
  if (!(await pathExists(artifactPath, io))) {
    await io.writeBytes(artifactPath, bytes)
  }
  const sidecarPath = join(dir, 'artifacts', `${digest}.json`)
  const existing = await readJson(sidecarPath, null, io)
  if (existing) return { artifact: existing, path: relative(workspace, artifactPath), created: false }

  const environment = input.environment ?? {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    python: process.env.PYTHON_VERSION ?? null,
  }
  const artifact = {
    id: digest,
    title,
    kind: String(input.kind ?? 'deliverable'),
    projectId,
    createdAt: new Date().toISOString(),
    bytes: bytes.byteLength,
    checksum: { algorithm: 'sha256', value: digest },
    source: originalName,
    provenance: {
      code: face(input.code, 'producer code was not recorded'),
      execution: face(input.log, 'execution log was not recorded'),
      environment: face(environment, 'environment inventory was not recorded'),
      messages: face(input.messages, 'session message anchor was not recorded'),
      reproducibility: face({ checksum: digest, bytes: bytes.byteLength, source: originalName }, 'reproducibility face unavailable'),
      review: face(input.review, 'review has not run'),
      literature: face(input.literature, 'literature anchors were not recorded'),
    },
  }
  await writeJson(sidecarPath, artifact, io)
  return { artifact, path: relative(workspace, artifactPath), created: true }
}

export async function listArtifacts(workspace, projectId, io = nodeIO) {
  const dir = join(projectPath(workspace, projectId), 'artifacts')
  let entries = []
  try {
    entries = await io.readdir(dir)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const artifacts = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      artifacts.push(await readJson(join(dir, entry.name), undefined, io))
    } catch {
      // A sidecar with an interrupted write is skipped; the payload remains.
    }
  }
  return artifacts.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

export async function getProvenance(workspace, projectId, artifactId, io = nodeIO) {
  const id = String(artifactId)
  if (!/^[0-9a-f]{64}$/.test(id)) throw new ScienceError(`invalid artifact id: ${artifactId}`)
  const dir = projectPath(workspace, projectId)
  const artifact = await readJson(join(dir, 'artifacts', `${id}.json`), null, io)
  if (!artifact) throw new ScienceError(`unknown artifact: ${artifactId}`)
  const snapshot = artifact.provenance?.review ?? unavailable('face was not recorded')
  // A review recorded after the artifact does not rewrite the immutable sidecar, so the
  // recorded review face is a creation-time snapshot. Derive the live face from
  // reviews/<id>.json at read time instead, and never write back to the artifact.
  let reviewFace = snapshot
  let reviewSource = 'artifact-sidecar-snapshot'
  try {
    const review = await readJson(join(dir, 'reviews', `${id}.json`), null, io)
    if (review) {
      reviewSource = 'derived-from-reviews'
      reviewFace = {
        status: 'available',
        source: 'reviews',
        decision: review.decision ?? null,
        round: Array.isArray(review.history) ? review.history.length : (review.round ?? 1),
        reviewer: review.reviewer ?? '',
        authority: review.authority ?? null,
        template: review.template ?? null,
        signature: review.signature ?? null,
        createdAt: review.createdAt ?? null,
        note: 'derived at read time from .research/projects/<id>/reviews; the immutable artifact sidecar is not rewritten',
      }
    }
  } catch {
    // A corrupt review file must not make provenance unreadable; it is reported instead.
    reviewSource = 'reviews-unreadable'
  }
  const faces = {}
  for (const key of FACE_KEYS) {
    faces[key] = key === 'review'
      ? reviewFace
      : (artifact.provenance?.[key] ?? unavailable('face was not recorded'))
  }
  return {
    artifactId: artifact.id,
    title: artifact.title,
    checksum: artifact.checksum,
    faces,
    reviewSource,
    // Keep the recorded snapshot visible so recorded state is distinguishable from derived state.
    reviewSnapshot: snapshot,
  }
}

const REVIEW_DECISIONS = new Set(['accept', 'revise', 'reject'])
const REVIEW_TEMPLATES = new Set(['general', 'evidence', 'reproducibility'])
const REVIEW_AUTHORITIES = new Set(['author', 'reviewer', 'auditor'])

function signReview(review) {
  return sha256(JSON.stringify({
    artifactId: review.artifactId,
    decision: review.decision,
    notes: review.notes,
    reviewer: review.reviewer,
    authority: review.authority,
    template: review.template,
    auth: review.auth,
    createdAt: review.createdAt,
  }))
}

export async function recordReview(workspace, projectId, artifactId, input = {}, io = nodeIO) {
  const id = String(artifactId)
  if (!/^[0-9a-f]{64}$/.test(id)) throw new ScienceError(`invalid artifact id: ${artifactId}`)
  const artifact = await readJson(join(projectPath(workspace, projectId), 'artifacts', `${id}.json`), null, io)
  if (!artifact) throw new ScienceError(`unknown artifact: ${artifactId}`)
  const decision = String(input.decision ?? '').trim()
  if (!REVIEW_DECISIONS.has(decision)) throw new ScienceError('review decision must be accept, revise or reject')
  const template = String(input.template ?? 'general').trim()
  if (!REVIEW_TEMPLATES.has(template)) throw new ScienceError('review template must be general, evidence or reproducibility')
  const authority = String(input.authority ?? 'reviewer').trim()
  if (!REVIEW_AUTHORITIES.has(authority)) throw new ScienceError('review authority must be author, reviewer or auditor')
  const path = join(projectPath(workspace, projectId), 'reviews', `${id}.json`)
  const existing = await readJson(path, null, io)
  // A legacy single-record review has no `history`. Keep every field it did carry
  // (including its signature) so the oldest round stays checkable instead of being
  // rebuilt into an unsigned stub.
  const prior = Array.isArray(existing?.history)
    ? existing.history
    : existing
      ? [{
        artifactId: existing.artifactId ?? id,
        decision: existing.decision,
        notes: existing.notes,
        reviewer: existing.reviewer,
        authority: existing.authority,
        template: existing.template,
        auth: existing.auth,
        signature: existing.signature,
        createdAt: existing.createdAt,
      }]
      : []
  const entry = {
    artifactId: id,
    decision,
    notes: String(input.notes ?? ''),
    reviewer: String(input.identity?.sub ?? input.reviewer ?? ''),
    authority,
    template,
    auth: input.identity ? { sub: input.identity.sub, mode: input.identity.mode, verified: input.identity.verified === true } : undefined,
    createdAt: new Date().toISOString(),
  }
  entry.signature = signReview(entry)
  const history = [...prior, entry]
  const review = {
    artifactId: id,
    title: artifact.title,
    decision: entry.decision,
    notes: entry.notes,
    reviewer: entry.reviewer,
    authority: entry.authority,
    template: entry.template,
    auth: entry.auth,
    signature: entry.signature,
    artifactChecksum: artifact.checksum,
    createdAt: entry.createdAt,
    round: history.length,
    history,
  }
  await writeJson(path, review, io)
  return { review, path: relative(workspace, path) }
}

function malformedRound(index, reason) {
  return {
    round: index + 1,
    decision: null,
    authority: null,
    template: null,
    createdAt: null,
    signature: null,
    expected: null,
    status: 'invalid',
    reason,
  }
}

function buildRound(entry, index) {
  // A malformed round must be reported, never crash the verification tool.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return malformedRound(index, 'round entry is not an object')
  }
  const expected = signReview(entry)
  const legacy = typeof entry.signature !== 'string' || entry.signature === ''
  const valid = !legacy && entry.signature === expected
  return {
    round: index + 1,
    decision: entry.decision ?? null,
    authority: entry.authority ?? null,
    template: entry.template ?? null,
    createdAt: entry.createdAt ?? null,
    signature: entry.signature ?? null,
    expected,
    status: legacy ? 'unverifiable-legacy' : valid ? 'valid' : 'invalid',
  }
}

export async function verifyReview(workspace, projectId, artifactId, io = nodeIO) {
  const id = String(artifactId)
  if (!/^[0-9a-f]{64}$/.test(id)) throw new ScienceError(`invalid artifact id: ${artifactId}`)
  let review
  try {
    review = await readJson(join(projectPath(workspace, projectId), 'reviews', `${id}.json`), null, io)
  } catch (error) {
    // A wholly unparsable review file is a reporting problem, not a crash: surface it as a
    // ScienceError with context so callers see an explainable failure instead of a SyntaxError.
    throw new ScienceError(`review file is not parsable JSON: ${artifactId} (${error?.message ?? error})`)
  }
  if (!review) throw new ScienceError(`unknown review: ${artifactId}`)
  // Three shapes must not be conflated:
  //   - history is a non-empty array            -> verify every recorded round
  //   - history exists but is empty/not an array -> structurally corrupt, report it
  //   - no history key at all                   -> legacy single record, itself round 1
  // Folding the corrupt shape into the legacy branch would report a damaged file as valid.
  const history = review?.history
  let rounds
  if (Array.isArray(history) && history.length > 0) {
    rounds = history.map(buildRound)
  } else if (history !== undefined) {
    rounds = [malformedRound(0, Array.isArray(history) ? 'history array is empty' : 'history is not an array')]
  } else {
    rounds = [buildRound(review, 0)]
  }
  const head = rounds[rounds.length - 1] ?? {}
  return {
    artifactId: id,
    decision: head.decision ?? null,
    authority: head.authority ?? null,
    template: head.template ?? null,
    signature: head.signature ?? null,
    expected: head.expected,
    valid: rounds.length > 0 && rounds.every((round) => round.status === 'valid'),
    rounds,
    roundCount: rounds.length,
    validRounds: rounds.filter((round) => round.status === 'valid').length,
    note: 'content signature, not identity authentication',
    limitations: [
      'each recorded round is checked against its own signature',
      'the round file is not a Merkle log, so deleting the earliest rounds cannot be detected from the file alone',
      'a round without a signature is reported as unverifiable-legacy and never as valid',
    ],
  }
}

export async function listReviews(workspace, projectId, io = nodeIO) {
  const dir = join(projectPath(workspace, projectId), 'reviews')
  let entries = []
  try {
    entries = await io.readdir(dir)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const reviews = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      reviews.push(await readJson(join(dir, entry.name), undefined, io))
    } catch {
      // A partial review is a gap, not fatal.
    }
  }
  return reviews.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
}

function tarHeader(name, size, mode = 0o644) {
  const header = Buffer.alloc(512, 0)
  const write = (value, offset, length) => {
    const text = Buffer.from(value, 'utf8')
    text.copy(header, offset, 0, Math.min(text.length, length))
  }
  const octal = (value, length) => `${Number(value).toString(8).padStart(length - 1, '0')}\0`
  write(name, 0, 100)
  write(octal(mode, 8), 100, 8)
  write(octal(0, 8), 108, 8)
  write(octal(0, 8), 116, 8)
  write(octal(size, 12), 124, 12)
  write(octal(Math.floor(Date.now() / 1000), 12), 136, 12)
  write('        ', 148, 8)
  write('0', 156, 1)
  write('ustar\0', 257, 6)
  write('00', 263, 2)
  write('root', 265, 32)
  write('root', 297, 32)
  let checksum = 0
  for (const byte of header) checksum += byte
  write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8)
  return header
}

export function buildTar(entries) {
  const chunks = []
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    if (data.length > 0o7777777) throw new ScienceError('tar entry is too large')
    chunks.push(tarHeader(entry.name, data.length), data)
    const padding = (512 - (data.length % 512)) % 512
    if (padding) chunks.push(Buffer.alloc(padding, 0))
  }
  chunks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(chunks)
}

export function parseTar(buffer) {
  const entries = []
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const sizeText = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeText || '0', 8)
    if (!Number.isFinite(size) || size < 0) throw new ScienceError('invalid tar size')
    const start = offset + 512
    const end = start + size
    if (end > buffer.length) throw new ScienceError('truncated tar entry')
    const type = String.fromCharCode(header[156] || 0x30)
    if (type === '0' || type === '\0') entries.push({ name, data: buffer.subarray(start, end) })
    offset = start + size + ((512 - (size % 512)) % 512)
  }
  return entries
}

async function collectProjectFiles(workspace, projectId, io = nodeIO) {
  const dir = projectPath(workspace, projectId)
  const project = await readJson(join(dir, 'project.json'), null, io)
  if (!project) throw new ScienceError(`unknown project: ${projectId}`)
  const files = []
  const add = async (absolute, archiveName) => {
    if (isCredential(archiveName)) return
    const data = await io.readBytes(absolute)
    files.push({ name: archiveName, data, sha256: sha256(data) })
  }
  await add(join(dir, 'project.json'), 'project.json')
  const artifactsDir = join(dir, 'artifacts')
  let entries = []
  try {
    entries = await io.readdir(artifactsDir)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    await add(join(artifactsDir, entry.name), `artifacts/${entry.name}`)
  }
  // reviews/ is the review-record source of truth. It must travel with the
  // archive, otherwise a `.science` roundtrip silently loses every review round.
  const reviewsDir = join(dir, 'reviews')
  let reviewEntries = []
  try {
    reviewEntries = await io.readdir(reviewsDir)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  for (const entry of reviewEntries) {
    if (!entry.isFile()) continue
    await add(join(reviewsDir, entry.name), `reviews/${entry.name}`)
  }
  return { project, files }
}

export async function exportScience(workspace, projectId, { name } = {}, io = nodeIO) {
  const { project, files } = await collectProjectFiles(workspace, projectId, io)
  const manifest = {
    format: FORMAT,
    project,
    createdAt: new Date().toISOString(),
    readOnly: true,
    files: files.map((file) => ({ path: file.name, sha256: file.sha256, bytes: file.data.length })),
  }
  const crates = {
    '@context': 'https://w3id.org/ro/crate/1.1/context',
    '@graph': [
      {
        '@id': 'ro-crate-metadata.json',
        '@type': 'CreativeWork',
        about: { '@id': './' },
        conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' },
      },
      {
        '@id': './',
        '@type': 'Dataset',
        name: project.name,
        description: `Research Mode project ${project.id} (${project.template})`,
        hasPart: files.map((file) => ({ '@id': `payload/${file.name}` })),
      },
    ],
  }
  const entries = [
    { name: 'science-manifest.json', data: `${JSON.stringify(manifest, null, 2)}\n` },
    { name: 'ro-crate-metadata.json', data: `${JSON.stringify(crates, null, 2)}\n` },
    ...files.map((file) => ({ name: `payload/${file.name}`, data: file.data })),
  ]
  const archive = gzipSync(buildTar(entries))
  const exportsDir = join(projectPath(workspace, projectId), 'exports')
  await io.mkdir(exportsDir)
  const safeName = String(name ?? `${project.id}`).replace(/[^a-zA-Z0-9._-]/g, '-')
  const file = join(exportsDir, `${safeName}.science`)
  await io.writeBytes(file, archive)
  return { path: relative(workspace, file), bytes: archive.length, manifest }
}

export async function importScience(workspace, archivePath, { name } = {}, io = nodeIO) {
  const source = assertInside(workspace, resolve(workspace, archivePath))
  const raw = await io.readBytes(source)
  const entries = parseTar(raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw)
  const manifestEntry = entries.find((entry) => entry.name === 'science-manifest.json')
  if (!manifestEntry) throw new ScienceError('missing science-manifest.json')
  const manifest = JSON.parse(manifestEntry.data.toString('utf8'))
  if (manifest.format !== FORMAT) throw new ScienceError(`unsupported science format: ${manifest.format}`)
  // Verify the payload against the manifest before writing anything. The manifest
  // has always carried per-file sha256; until now import never checked it.
  const declared = new Map(
    (Array.isArray(manifest.files) ? manifest.files : [])
      .filter((file) => file && typeof file.path === 'string')
      .map((file) => [`payload/${file.path}`, String(file.sha256 ?? '')]),
  )
  const id = `${slugify(name ?? manifest.project?.id ?? 'import')}-import-${Date.now()}`
  const target = join(researchRoot(workspace), 'imports', id)
  const payload = []
  const mismatched = []
  const undeclared = []
  const traversal = []
  const seen = new Set()
  // Validate the whole archive first; nothing is written until every entry passes,
  // so a bad archive cannot leave a half-written import directory behind.
  for (const entry of entries) {
    if (entry.name === 'science-manifest.json') continue
    if (!entry.name.startsWith('payload/')) continue
    const rel = entry.name.slice('payload/'.length)
    // Credential-like files are dropped by design, matching what export refuses to pack.
    if (isCredential(rel)) continue
    // Split on both separators: a backslash traversal must not slip past a
    // forward-slash-only filter. A traversal attempt is reported, not silently skipped.
    const segments = rel.split(/[\\/]+/)
    if (segments.includes('..') || rel.startsWith('/') || rel.startsWith('\\') || rel.includes(':')) {
      traversal.push(rel)
      continue
    }
    seen.add(entry.name)
    const expected = declared.get(entry.name)
    if (expected === undefined) {
      // The export always declares every payload entry it writes. An extra one means
      // the archive was modified, so import refuses it instead of writing it.
      undeclared.push(rel)
      continue
    }
    if (expected !== sha256(entry.data)) {
      mismatched.push(rel)
      continue
    }
    try {
      assertInside(target, join(target, 'payload', rel))
    } catch {
      traversal.push(rel)
      continue
    }
    payload.push({ rel, data: entry.data })
  }
  if (mismatched.length > 0) {
    throw new ScienceError(`science payload failed checksum verification: ${mismatched.join(', ')}`)
  }
  if (undeclared.length > 0) {
    throw new ScienceError(`science archive contains undeclared payload files: ${undeclared.join(', ')}`)
  }
  if (traversal.length > 0) {
    throw new ScienceError(`science payload path escapes the import target: ${traversal.join(', ')}`)
  }
  const missing = [...declared.keys()].filter((name) => !seen.has(name))
  if (missing.length > 0) {
    throw new ScienceError(`science archive is missing declared files: ${missing.map((name) => name.slice('payload/'.length)).join(', ')}`)
  }
  if (payload.length !== declared.size) {
    throw new ScienceError(`science archive declared ${declared.size} files but ${payload.length} passed verification`)
  }
  // The first mkdir belongs INSIDE the try: if it creates the directory and then
  // fails (quota, ACL, flaky volume), cleanup must still remove what it made.
  try {
    await io.mkdir(join(target, 'payload'))
    for (const entry of payload) {
      const destination = assertInside(target, join(target, 'payload', entry.rel))
      await io.mkdir(dirname(destination))
      await io.writeBytes(destination, entry.data)
    }
    await io.writeText(join(target, 'science-manifest.json'), `${JSON.stringify({ ...manifest, importedAt: new Date().toISOString(), readOnly: true }, null, 2)}\n`)
  } catch (error) {
    // A failure part-way through the write must not leave a half-imported project.
    // `target` is a real filesystem path, so cleanup does not depend on the io backend.
    await rm(target, { recursive: true, force: true }).catch(() => {})
    throw error
  }
  // "Read-only import" is an INTENT, not an enforced guarantee. chmod is best effort and
  // on Windows a 0o555 directory is still writable by the owner, so the returned
  // `readOnlyEnforced` reports what actually happened instead of asserting it.
  const { chmod } = await import('node:fs/promises')
  let readOnlyEnforced = false
  try {
    await chmod(target, 0o555)
    for (const entry of payload) {
      await chmod(join(target, 'payload', entry.rel), 0o444)
    }
    // Measure rather than assume: if we can still create a file, it is not enforced.
    const probe = join(target, 'payload', '.readonly-probe')
    try {
      await io.writeBytes(probe, Buffer.from('probe'))
      await rm(probe, { force: true })
      readOnlyEnforced = false
    } catch {
      readOnlyEnforced = true
    }
  } catch {
    readOnlyEnforced = false
  }
  return {
    path: relative(workspace, target),
    manifest,
    readOnly: true,
    readOnlyEnforced,
    readOnlyNote: readOnlyEnforced
      ? 'marker files were made read-only and the write probe failed'
      : 'read-only is advisory on this platform: the import directory is still writable',
    verifiedFiles: payload.length,
  }
}
