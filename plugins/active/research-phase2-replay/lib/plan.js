import { readFile, readdir, realpath } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (fallback !== null || error?.code === 'ENOENT') return fallback
    throw error
  }
}

async function listJson(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const rows = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const value = await readJson(join(dir, entry.name))
      if (value) rows.push(value)
    }
    return rows
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function replayPlan(workspace, projectId) {
  // Same rule as inspectNotebook: a projectId is one directory name, and "." / ".." are
  // navigation, not names. Refusing them here keeps the error honest instead of reporting
  // "unknown project" for a path that was never a project.
  const id = String(projectId)
  if (!/^[\p{Letter}\p{Number}._-]+$/u.test(id) || id === '.' || id === '..') throw new Error('invalid projectId')
  // Anchor containment at the workspace research root. Without this, a junction at
  // .research/projects/<id> makes the plan describe a directory outside the workspace, and
  // every path in the plan is then attacker-selected (independent QA reproduced this).
  const projectsRoot = await realpath(resolve(workspace, '.research', 'projects'))
    .catch(() => resolve(workspace, '.research', 'projects'))
  const candidate = join(projectsRoot, id)
  const project = await realpath(candidate).catch(() => candidate)
  if (project !== projectsRoot && !project.startsWith(projectsRoot + sep)) {
    throw new Error('project path is outside the workspace research root')
  }
  const actualName = basename(project)
  if (actualName !== id) throw new Error(`non-canonical projectId: ${id} (directory is ${actualName})`)
  const meta = await readJson(join(project, 'project.json'))
  if (!meta) throw new Error(`unknown project: ${projectId}`)
  const artifacts = await listJson(join(project, 'artifacts'))
  const reviews = await listJson(join(project, 'reviews'))
  let exports = []
  try {
    exports = (await readdir(join(project, 'exports'))).filter((name) => name.endsWith('.science'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const gaps = []
  if (artifacts.length === 0) gaps.push('no artifact')
  if (exports.length === 0) gaps.push('no .science export')
  for (const artifact of artifacts) {
    if (artifact.provenance?.environment?.status !== 'available') gaps.push(`${artifact.id}: environment unavailable`)
    if (artifact.provenance?.code?.status !== 'available') gaps.push(`${artifact.id}: code unavailable`)
    if (artifact.provenance?.execution?.status !== 'available') gaps.push(`${artifact.id}: execution unavailable`)
    if (!reviews.some((review) => review.artifactId === artifact.id)) gaps.push(`${artifact.id}: no review`)
  }
  return {
    project: { id: meta.id, name: meta.name, template: meta.template },
    artifactCount: artifacts.length,
    reviewCount: reviews.length,
    exports,
    steps: artifacts.map((artifact) => ({
      artifactId: artifact.id,
      title: artifact.title,
      checksum: artifact.checksum?.value ?? artifact.id,
      code: artifact.provenance?.code?.value ?? null,
      execution: artifact.provenance?.execution?.value ?? null,
      environment: artifact.provenance?.environment?.value ?? null,
      review: reviews.find((review) => review.artifactId === artifact.id)?.decision ?? null,
    })),
    gaps,
    replayBoundary: 'read-only plan; no command is executed and no result is claimed reproduced',
  }
}
