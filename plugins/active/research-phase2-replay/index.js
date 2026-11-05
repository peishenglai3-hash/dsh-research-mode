import { replayPlan } from './lib/plan.js'

let workingDirectoryGetter

async function workspaceRoot(exec) {
  const service = typeof workingDirectoryGetter === 'function' ? workingDirectoryGetter() : undefined
  if (!service || !exec?.agent) throw new Error('research_replay_plan requires a session agent')
  const cwd = await service.ensure(exec.agent, exec.signal)
  const match = String(cwd).match(/^(.*)[/\\]\.research[/\\]projects[/\\][^/\\]+$/)
  return match ? match[1] : cwd
}

const TOOL = {
  name: 'research_replay_plan',
  description: 'Build a read-only replay plan for a Research project: artifacts, checksums, recorded code/execution/environment, reviews, exports and gaps. It does not execute commands, modify files or claim a successful reproduction.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: { projectId: { type: 'string', description: 'Project id.' } },
    required: ['projectId'],
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  },
  isConcurrencySafe: () => true,
  async execute(args, exec) {
    return JSON.stringify(await replayPlan(await workspaceRoot(exec), args.projectId), null, 2)
  },
}

export const inject = ['tools', 'workingDirectory']

export function apply(ctx) {
  workingDirectoryGetter = () => (ctx.get ? ctx.get('workingDirectory') : undefined)
  ctx.effect(() => ctx.tools.register(TOOL), 'research-phase2-replay:tool')
}
