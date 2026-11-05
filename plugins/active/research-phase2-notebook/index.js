import { inspectNotebook } from './lib/inspect.js'

let workingDirectoryGetter

async function workspaceRoot(exec) {
  const service = typeof workingDirectoryGetter === 'function' ? workingDirectoryGetter() : undefined
  if (!service || !exec?.agent) throw new Error('research_notebook_inspect requires a session agent')
  const cwd = await service.ensure(exec.agent, exec.signal)
  const match = String(cwd).match(/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/)
  return match ? match[1] : cwd
}

const TOOL = {
  name: 'research_notebook_inspect',
  description: 'Read-only inspection of a Jupyter .ipynb under the project: cell order, execution counts, outputs, imports and reproducibility gaps. It does not execute cells, mutate the notebook, install dependencies or clear outputs. Execution requires separate explicit approval.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectId: { type: 'string', description: 'Project id.' },
      notebookPath: { type: 'string', description: 'Notebook path relative to the project root, e.g. analysis.ipynb.' },
    },
    required: ['projectId', 'notebookPath'],
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  },
  isConcurrencySafe: () => true,
  async execute(args, exec) {
    const workspace = await workspaceRoot(exec)
    return JSON.stringify(await inspectNotebook(workspace, args.projectId, args.notebookPath), null, 2)
  },
}

export const inject = ['tools', 'workingDirectory']

export function apply(ctx) {
  workingDirectoryGetter = () => (ctx.get ? ctx.get('workingDirectory') : undefined)
  ctx.effect(() => ctx.tools.register(TOOL), 'research-phase2-notebook:tool')
}
