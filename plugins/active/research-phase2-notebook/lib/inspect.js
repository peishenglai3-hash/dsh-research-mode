import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, resolve, sep } from 'node:path'

function importsOf(source) {
  const names = new Set()
  for (const line of String(source).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:from\s+([A-Za-z_][\w.]*)|import\s+([A-Za-z_][\w.]*))/)
    if (match) names.add(match[1] ?? match[2])
  }
  return [...names]
}

export async function inspectNotebook(workspace, projectId, notebookPath) {
  // A projectId names one directory under <workspace>/.research/projects. Dot is a legal
  // character in a directory name, so the character-class test alone admits "." and "..",
  // and ".." roots the project at <workspace>/.research — from where a relative
  // notebookPath can reach a sibling project. Refuse the two navigational names explicitly.
  const id = String(projectId)
  if (!/^[\p{Letter}\p{Number}._-]+$/u.test(id) || id === '.' || id === '..') throw new Error('invalid projectId')
  const project = resolve(workspace, '.research', 'projects', projectId)
  const root = await realpath(project).catch(() => project)
  const requested = isAbsolute(notebookPath) ? notebookPath : join(project, notebookPath)
  const absolute = await realpath(requested)
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error('notebook path is outside the project')
  }
  const payload = JSON.parse(await readFile(absolute, 'utf8'))
  if (!payload || !Array.isArray(payload.cells)) throw new Error('not a nbformat notebook: cells missing')
  const codeCells = payload.cells.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell.cell_type === 'code')
  const cells = payload.cells.map((cell, index) => ({
    index,
    type: cell.cell_type,
    executionCount: cell.execution_count ?? null,
    outputCount: Array.isArray(cell.outputs) ? cell.outputs.length : 0,
    imports: cell.cell_type === 'code' ? importsOf(Array.isArray(cell.source) ? cell.source.join('') : cell.source ?? '') : [],
    preview: (Array.isArray(cell.source) ? cell.source.join('') : String(cell.source ?? '')).slice(0, 160),
  }))
  return {
    path: absolute,
    nbformat: payload.nbformat ?? null,
    nbformatMinor: payload.nbformat_minor ?? null,
    cellCount: payload.cells.length,
    codeCellCount: codeCells.length,
    executableCount: codeCells.filter(({ cell }) => cell.execution_count !== null && cell.execution_count !== undefined).length,
    imports: [...new Set(cells.flatMap((cell) => cell.imports))],
    cells,
    reviewBoundary: 'read-only inspection; no cell execution, no notebook mutation, no dependency installation',
    gaps: [
      'kernel state and environment are not inspected by this tool',
      'stale outputs are not compared against a fresh execution',
      'execution requires explicit approval and a kernel',
    ],
  }
}
