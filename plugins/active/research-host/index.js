// @local/research-core — Host half.
//
// Read/write project data under the session working directory's `.research/`.
// No DSH imports, no profile writes, no database. Client half is ./client.js.
import {
  createProject, exportScience, getProvenance, importScience,
  listArtifacts, listProjects, recordArtifact, listReviews, recordReview, verifyReview,
} from './lib/store.js'
import { reviewAuthMode, verifyReviewerToken } from './lib/auth.js'
import { createHostIO } from './lib/io.js'

const MAX_TEXT = 200_000

function asText(value) {
  const text = JSON.stringify(value, null, 2)
  if (text.length <= MAX_TEXT) return text
  return JSON.stringify({
    truncated: true,
    chars: text.length,
    note: `output truncated at ${MAX_TEXT} chars`,
    preview: text.slice(0, MAX_TEXT),
  }, null, 2)
}

function tool(name, description, properties, required, execute, concurrencySafe = false) {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => concurrencySafe,
    execute,
  }
}

function faceInput(description) {
  return { type: 'string', description }
}

const TOOLS = [
  tool(
    'research_project_create',
    'Create a Research Mode project under the session workspace: .research/projects/<id>/ with project.json, artifacts/ and exports/. Read/write only that project root. Returns the project id, template and relative path.',
    {
      name: { type: 'string', description: 'Human-readable project name.' },
      template: {
        type: 'string',
        description: 'One of literature-review, data-analysis, figure-report, paper-reproduction. Default literature-review.',
      },
    },
    ['name'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await createProject(workspace, args, await workspaceIO(workspace, exec)))
    },
  ),
  tool(
    'research_project_list',
    'List Research Mode projects under .research/projects, newest first. Read-only.',
    {},
    [],
    async (_args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText({ projects: await listProjects(workspace, await workspaceIO(workspace, exec)) })
    },
    true,
  ),
  tool(
    'research_artifact_record',
    'Record an immutable artifact under .research/projects/<project>/artifacts/<sha256>, with a sidecar containing checksum and provenance faces. Provide source (workspace-relative file) or content. Re-recording identical bytes returns the existing artifact. Credential-like files are refused.',
    {
      projectId: { type: 'string', description: 'Project id from research_project_create.' },
      title: { type: 'string', description: 'Artifact title.' },
      kind: { type: 'string', description: 'Artifact kind, e.g. search-log, dataset, figure, manuscript. Default deliverable.' },
      source: { type: 'string', description: 'Optional workspace-relative source file path.' },
      content: { type: 'string', description: 'Optional inline content when source is absent.' },
      code: faceInput('Optional producer code or command.'),
      log: faceInput('Optional execution log.'),
      environment: faceInput('Optional environment inventory as text.'),
      messages: faceInput('Optional session/message anchor.'),
      review: faceInput('Optional review state.'),
      literature: faceInput('Optional literature anchors, e.g. DOIs.'),
    },
    ['projectId', 'title'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await recordArtifact(workspace, args.projectId, args, await workspaceIO(workspace, exec)))
    },
  ),
  tool(
    'research_artifact_list',
    'List recorded artifacts for one Research Mode project. Read-only.',
    {
      projectId: { type: 'string', description: 'Project id.' },
    },
    ['projectId'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText({ artifacts: await listArtifacts(workspace, args.projectId, await workspaceIO(workspace, exec)) })
    },
    true,
  ),
  tool(
    'research_provenance_get',
    'Read the seven provenance faces for one artifact: code, execution, environment, messages, reproducibility, review, literature. Missing faces are returned as status=unavailable. Read-only.',
    {
      projectId: { type: 'string', description: 'Project id.' },
      artifactId: { type: 'string', description: 'Artifact checksum id.' },
    },
    ['projectId', 'artifactId'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await getProvenance(workspace, args.projectId, args.artifactId, await workspaceIO(workspace, exec)))
    },
    true,
  ),
  tool(
    'research_review_record',
    'Record a reviewer decision for an artifact: accept, revise or reject, with notes and reviewer. When RESEARCH_REVIEW_AUTH is virtual or oidc, accept requires a verified reviewerToken. Writes .research/projects/<id>/reviews/<artifactId>.json; does not change the artifact bytes.',
    {
      projectId: { type: 'string', description: 'Project id.' },
      artifactId: { type: 'string', description: 'Artifact checksum id.' },
      decision: { type: 'string', description: 'accept | revise | reject.' },
      notes: { type: 'string', description: 'Optional reviewer notes.' },
      reviewer: { type: 'string', description: 'Optional reviewer name; ignored when a verified token supplies sub.' },
      template: { type: 'string', description: 'general | evidence | reproducibility; default general.' },
      authority: { type: 'string', description: 'author | reviewer | auditor; default reviewer. A declared role.' },
      reviewToken: { type: 'string', description: 'Verified reviewer token when RESEARCH_REVIEW_AUTH is virtual or oidc; required for accept in those modes.' },
    },
    ['projectId', 'artifactId', 'decision'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      const mode = reviewAuthMode(process.env)
      let identity = null
      if (mode !== 'off') {
        if (args.decision === 'accept' && !args.reviewToken) throw new Error('accept requires a verified reviewer token')
        if (args.reviewToken) identity = await verifyReviewerToken(args.reviewToken)
      }
      return asText(await recordReview(workspace, args.projectId, args.artifactId, {
        decision: args.decision,
        notes: args.notes,
        reviewer: args.reviewer,
        template: args.template,
        authority: args.authority,
        identity,
      }, await workspaceIO(workspace, exec)))
    },
  ),
  tool(
    'research_review_verify',
    'Verify the content signature of a review sidecar. This checks review content integrity, not reviewer identity.',
    {
      projectId: { type: 'string', description: 'Project id.' },
      artifactId: { type: 'string', description: 'Artifact checksum id.' },
    },
    ['projectId', 'artifactId'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await verifyReview(workspace, args.projectId, args.artifactId, await workspaceIO(workspace, exec)))
    },
    true,
  ),
  tool(
    'research_review_list',
    'List reviewer decisions recorded for one project, newest first. Read-only.',
    {
      projectId: { type: 'string', description: 'Project id.' },
    },
    ['projectId'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText({ reviews: await listReviews(workspace, args.projectId, await workspaceIO(workspace, exec)) })
    },
    true,
  ),
  tool(
    'research_science_export',
    'Export a project as a .science archive under .research/projects/<project>/exports: gzip tar with science-manifest.json, project.json and artifact payloads/sidecars. Credential-like paths are excluded. Read-only for the project, writes the archive.',
    {
      projectId: { type: 'string', description: 'Project id.' },
      name: { type: 'string', description: 'Optional archive name (without extension).' },
    },
    ['projectId'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await exportScience(workspace, args.projectId, { name: args.name }, await workspaceIO(workspace, exec)))
    },
  ),
  tool(
    'research_science_import',
    'Import a .science archive into .research/imports/<id>, read-only, without executing anything. The manifest must be science/1; credential-like paths are skipped. Returns the imported path and manifest.',
    {
      archive: { type: 'string', description: 'Workspace-relative .science archive path.' },
      name: { type: 'string', description: 'Optional imported project name.' },
    },
    ['archive'],
    async (args, exec) => {
      const workspace = await workspaceRoot(exec)
      return asText(await importScience(workspace, args.archive, { name: args.name }, await workspaceIO(workspace, exec)))
    },
  ),
]

async function workspaceRoot(exec) {
  const service = typeof workingDirectoryGetter === 'function' ? workingDirectoryGetter() : undefined
  if (!service || typeof service.ensure !== 'function') {
    throw new Error('research-core: the session working-directory provider is unavailable')
  }
  if (!exec?.agent) throw new Error('research-core: this tool requires a session agent')
  const cwd = await service.ensure(exec.agent, exec.signal)
  // A research session is deliberately started with cwd = <workspace>/.research/projects/<id>.
  // Host tools still operate on the workspace root so there is exactly one .research tree.
  const match = String(cwd).match(/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/)
  return match ? match[1] : cwd
}

let workingDirectoryGetter
let ioFactory

async function workspaceIO(workspace, exec) {
  return ioFactory ? ioFactory(workspace, exec) : undefined
}

export const inject = ['tools', 'fs', 'sandboxPolicy']

export function apply(ctx) {
  workingDirectoryGetter = () => (ctx.get ? ctx.get('workingDirectory') : undefined)
  ioFactory = ctx.fs && typeof ctx.fs.resolve === 'function'
    ? (workspace, exec) => createHostIO(ctx, exec, workspace)
    : undefined
  for (const definition of TOOLS) {
    try {
      ctx.effect(() => ctx.tools.register(definition), `research-core:tool:${definition.name}`)
    } catch (error) {
      ctx.logger?.warn?.(`research-core: failed to register ${definition.name}: ${String(error)}`)
    }
  }
}
