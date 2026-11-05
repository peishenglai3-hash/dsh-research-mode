// @peisheng_lai/dsh-research-workspace — browser half (Phase 1, Host-only read model).
//
// Two native seats:
//   sidebar.panellist : one "科研 / Research" entry
//   main              : the cross-session Research Workspace page
//
// Phase 1 truth lives in <workspace>/.research and is written only by the Host
// tools (research_project_create / research_artifact_record / ...). This page
// reads projects, starts a research session bound to a project cwd, and copies
// Agent instructions for creation/export. It owns NO localStorage project or
// artifact index.

window.__ModuleLoader__.load({
  id: '@peisheng_lai/dsh-research-workspace',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL_ID = 'research'
    const NS = 'research'

    const DICT = {
      zh: {
        entry: '科研',
        eyebrow: 'RESEARCH MODE',
        title: '科研工作台',
        subtitle: 'Host `.research` 是唯一真源；本页只读并启动会话。',
        phase: 'Phase 1 · Host-only',
        back: '返回会话',
        templates: '研究模板',
        t1: '文献综述',
        d1: '从问题到可追溯的文献证据链，保留来源与检索记录。',
        t2: '数据分析',
        d2: 'Python/终端执行，结果落为不可变 Artifact，并记录运行环境。',
        t3: '图表报告',
        d3: '图表、表格与报告同源；缺失证据显示 unavailable，不推断。',
        t4: '论文复现',
        d4: '输入、代码、执行记录与产物版本绑定，便于交接与复核。',
        copyTemplate: '复制创建指令',
        copied: '指令已复制；在 research 会话中发送给 Agent。',
        copyFailed: '复制失败；请检查系统剪贴板权限。',
        hostOnly: 'Host-only 创建',
        hostHint: '项目/产物只由 Host 工具写入 .research；本页不保存第二套索引。',
        projectName: '项目名称',
        projectPlaceholder: '例如：社会原子化的经验检验',
        createPrompt: '请用 research_project_create 创建项目「{name}」，模板 {template}；然后在该项目 cwd 启动 research 会话。',
        hostProjects: 'Host 项目（.research）',
        noHostProjects: 'Host 还没有项目；发送上面的创建指令给 Agent。',
        startHost: '用此项目启动',
        copyExport: '复制导出指令',
        exportPrompt: '请调用 research_science_export，projectId="{id}"，name="{name}"，并把导出的 .science 路径与 manifest 摘要报告给我。',
        startEmpty: '启动空研究会话',
        emptyHint: '先在会话中调用 research_project_create。',
        litdb: '本地文献库',
        litdbDesc: '1,560 条中文社科样本库（只读）：三刊 2018–2026，九字段。',
        litdbMeta: '只读 · 本地 · 可整目录删除',
        sessions: '最近会话',
        sessionsHint: '会话由 DSH 原生会话列表管理；项目/产物真源在 `.research`。',
        exportHint: '导出请让 Agent 调用 research_science_export；本页不生成第二套包。',
        refresh: '刷新 Host 项目',
      },
      en: {
        entry: 'Research',
        eyebrow: 'RESEARCH MODE',
        title: 'Research Workspace',
        subtitle: 'Host `.research` is the only source of truth; this page reads and starts sessions.',
        phase: 'Phase 1 · Host-only',
        back: 'Back to conversation',
        templates: 'Research templates',
        t1: 'Literature review',
        d1: 'From question to a traceable evidence chain, with sources and retrieval records kept.',
        t2: 'Data analysis',
        d2: 'Python/terminal execution recorded as immutable artifacts with their environment.',
        t3: 'Figures & report',
        d3: 'Figures, tables and report share one source; missing evidence is marked unavailable.',
        t4: 'Paper reproduction',
        d4: 'Inputs, code, execution records and artifact versions bound for handoff and review.',
        copyTemplate: 'Copy creation prompt',
        copied: 'Prompt copied; send it to the Agent in a research session.',
        copyFailed: 'Copy failed; check clipboard permission.',
        hostOnly: 'Host-only creation',
        hostHint: 'Projects and artifacts are written only by Host tools under .research; this page keeps no second index.',
        projectName: 'Project name',
        projectPlaceholder: 'e.g. An empirical test of social atomization',
        createPrompt: 'Create a research project using research_project_create with name "{name}" and template {template}; then start a research session bound to its cwd.',
        hostProjects: 'Host projects (.research)',
        noHostProjects: 'No Host projects yet; send the creation prompt to the Agent.',
        startHost: 'Start from this project',
        copyExport: 'Copy export prompt',
        exportPrompt: 'Call research_science_export with projectId="{id}" and name="{name}", then report the .science path and manifest summary.',
        startEmpty: 'Start empty research session',
        emptyHint: 'Call research_project_create in the session first.',
        litdb: 'Local literature library',
        litdbDesc: 'A read-only 1,560-record Chinese social-science sample (three journals, 2018–2026, nine fields).',
        litdbMeta: 'Read-only · local · removable',
        sessions: 'Recent sessions',
        sessionsHint: 'Sessions stay in the native DSH list; projects/artifacts live under .research.',
        exportHint: 'Ask the Agent to call research_science_export; this page does not build a second package.',
        refresh: 'Refresh Host projects',
      },
    }

    const C = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      panel: 'var(--dsw-alias-bg-layer-1)',
      hover: 'var(--dsw-alias-bg-layer-2)',
      accent: 'var(--dsw-alias-brand-primary)',
      radius: '12px',
    }

    const TEMPLATES = [
      { id: 'literature-review', title: 't1', desc: 'd1' },
      { id: 'data-analysis', title: 't2', desc: 'd2' },
      { id: 'figure-report', title: 't3', desc: 'd3' },
      { id: 'paper-reproduction', title: 't4', desc: 'd4' },
    ]

    function normalizePath(value) {
      return String(value ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    }

    function chooseWorkspaceSession(workspaceRoot, sessions) {
      if (!workspaceRoot) return null
      const root = normalizePath(workspaceRoot)
      return sessions.find((row) => normalizePath(row.cwd) === root)
        ?? sessions.find((row) => normalizePath(row.cwd).startsWith(`${root}/`))
        ?? null
    }

    function ResearchIcon({ size = 18, active = false }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
          stroke: 'currentColor', strokeWidth: active ? 2 : 1.8,
          strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
          style: { display: 'block', opacity: active ? 1 : 0.82 },
        },
        h('path', { d: 'M9 3h6' }),
        h('path', { d: 'M10 3v5.2L4.8 18a2.2 2.2 0 0 0 2 3.2h10.4a2.2 2.2 0 0 0 2-3.2L14 8.2V3' }),
        h('path', { d: 'M7.5 15h9' }),
        h('path', { d: 'M9.7 18.5h.01M12 18.5h.01M14.3 18.5h.01' }),
      )
    }

    function Header({ tr, onBack }) {
      return h(
        'div',
        { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' } },
        h(
          'div',
          null,
          h('div', { style: { fontSize: '11px', letterSpacing: '0.14em', color: C.muted, fontWeight: 600 } }, tr('eyebrow', '')),
          h('h1', { style: { margin: '6px 0 4px', fontSize: '24px', lineHeight: 1.2, color: C.text } }, tr('title', '')),
          h('p', { style: { margin: 0, fontSize: '13px', color: C.muted, maxWidth: '680px' } }, tr('subtitle', '')),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 } },
          h('span', {
            style: {
              fontSize: '11px', color: C.accent, border: `1px solid ${C.border}`,
              borderRadius: '999px', padding: '4px 9px', whiteSpace: 'nowrap',
            },
          }, tr('phase', '')),
          h('button', {
            type: 'button', onClick: onBack,
            style: {
              fontSize: '12px', color: C.text, background: C.panel,
              border: `1px solid ${C.border}`, borderRadius: '8px',
              padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit',
            },
          }, tr('back', '')),
        ),
      )
    }

    const inputStyle = {
      boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: '8px',
      border: `1px solid ${C.border}`, background: C.panel, color: C.text,
      fontFamily: 'inherit', fontSize: '12.5px',
    }

    function ResearchPage({ t, onBack, onStartSession, onLoadHostProjects, onOpenSession }) {
      const tr = (key, fallback) => {
        try {
          const value = typeof t === 'function' ? t(key) : undefined
          return value === undefined || value === null || value === '' || value === key ? fallback : value
        } catch {
          return fallback
        }
      }
      const [hostProjects, setHostProjects] = React.useState([])
      const [projectName, setProjectName] = React.useState('')
      const [notice, setNotice] = React.useState('')

      React.useEffect(() => {
        try {
          window.localStorage.removeItem('dsh.research.ui.v1')
        } catch {
          // A blocked storage API must not break the Host-backed page.
        }
      }, [])

      React.useEffect(() => {
        let live = true
        let attempts = 0
        let timer
        const load = () => {
          if (typeof onLoadHostProjects !== 'function') return
          Promise.resolve(onLoadHostProjects()).then((rows) => {
            if (!live) return
            const list = Array.isArray(rows) ? rows : []
            setHostProjects(list)
            if (list.length === 0 && attempts < 30) {
              attempts += 1
              timer = setTimeout(load, 1000)
            }
          }).catch(() => {})
        }
        load()
        return () => { live = false; if (timer) clearTimeout(timer) }
      }, [onLoadHostProjects])

      const copyPrompt = async (template) => {
        const name = projectName.trim() || tr('projectPlaceholder', '')
        const prompt = tr('createPrompt', 'Create project {name} with template {template}.')
          .replace('{name}', name)
          .replace('{template}', template)
        try {
          await navigator.clipboard.writeText(prompt)
          setNotice(tr('copied', 'Copied'))
        } catch {
          setNotice(tr('copyFailed', 'Copy failed'))
        }
      }

      const startHostSession = async (host) => {
        if (!host?.cwd || typeof onStartSession !== 'function') return
        try {
          const sessionId = await onStartSession(host.cwd)
          if (typeof onOpenSession === 'function') onOpenSession(sessionId)
          if (typeof window !== 'undefined') window.__researchLastSession = sessionId
          setNotice(`${tr('startHost', 'Started')} · ${sessionId}`)
        } catch (error) {
          setNotice(`${tr('copyFailed', 'Failed')}: ${String(error?.message ?? error)}`)
        }
      }

      const copyExport = async (host) => {
        const prompt = tr('exportPrompt', 'Export {id}').replace('{id}', host.id).replace('{name}', host.name)
        try {
          await navigator.clipboard.writeText(prompt)
          setNotice(tr('copied', 'Copied'))
        } catch {
          setNotice(tr('copyFailed', 'Copy failed'))
        }
      }

      const refresh = () => {
        Promise.resolve(onLoadHostProjects?.()).then((rows) => setHostProjects(Array.isArray(rows) ? rows : [])).catch(() => {})
      }

      return h(
        'div',
        {
          style: {
            boxSizing: 'border-box', width: '100%', height: '100%', minHeight: '100%',
            overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
            padding: '26px 28px 32px',
            color: C.text, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '18px',
          },
        },
        h(Header, { tr, onBack }),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' } },
          TEMPLATES.map((template) => h(
            'section',
            {
              key: template.id,
              style: {
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius,
                padding: '16px', minHeight: '124px', display: 'flex', flexDirection: 'column', gap: '8px',
              },
            },
            h('h2', { style: { margin: 0, fontSize: '15px', lineHeight: 1.3, color: C.text } }, tr(template.title, '')),
            h('p', { style: { margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: C.muted } }, tr(template.desc, '')),
            h('button', {
              type: 'button', onClick: () => copyPrompt(template.id),
              style: {
                marginTop: 'auto', alignSelf: 'flex-start', fontSize: '11px',
                color: C.accent, background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: '999px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
              },
            }, tr('copyTemplate', '')),
          )),
        ),
        h(
          'section',
          {
            style: {
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius,
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
            },
          },
          h('h2', { style: { margin: 0, fontSize: '15px' } }, tr('hostOnly', '')),
          h('p', { style: { margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: C.muted } }, tr('hostHint', '')),
          h('input', {
            value: projectName,
            onChange: (event) => setProjectName(event.target.value),
            placeholder: tr('projectPlaceholder', ''),
            'aria-label': tr('projectName', ''),
            style: inputStyle,
          }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
            h('button', {
              type: 'button', onClick: () => copyPrompt('literature-review'),
              style: {
                padding: '8px 14px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: C.hover, color: C.text, cursor: 'pointer', fontFamily: 'inherit',
              },
            }, tr('copyTemplate', '')),
          ),
          notice ? h('p', { style: { margin: 0, fontSize: '12px', color: C.accent } }, notice) : null,
        ),
        h(
          'section',
          {
            style: {
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius,
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
            },
          },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
            h('h2', { style: { margin: 0, fontSize: '15px' } }, tr('hostProjects', '')),
            h('button', {
              type: 'button', onClick: refresh,
              style: {
                padding: '5px 10px', borderRadius: '999px', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px',
              },
            }, tr('refresh', '')),
          ),
          hostProjects.length === 0
            ? h('p', { style: { margin: 0, fontSize: '12px', color: C.muted } }, tr('noHostProjects', ''))
            : hostProjects.map((host) => h(
                'div',
                {
                  key: host.id,
                  style: {
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: '10px', borderTop: `1px solid ${C.border}`, paddingTop: '8px',
                    fontSize: '12px', flexWrap: 'wrap',
                  },
                },
                h('span', { style: { color: C.text } }, `${host.name} · ${host.template}`),
                h('code', { style: { color: C.muted, fontSize: '10.5px' } }, host.cwd),
                h('button', {
                  type: 'button', onClick: () => startHostSession(host),
                  style: {
                    padding: '5px 10px', borderRadius: '999px', border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.text, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '11px',
                  },
                }, tr('startHost', '')),
                h('button', {
                  type: 'button', onClick: () => copyExport(host),
                  style: {
                    padding: '5px 10px', borderRadius: '999px', border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.text, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '11px',
                  },
                }, tr('copyExport', '')),
              )),
        ),
        h(
          'section',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' } },
          h('div', { style: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '16px' } },
            h('h2', { style: { margin: 0, fontSize: '15px' } }, tr('litdb', '')),
            h('p', { style: { margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.55, color: C.muted } }, tr('litdbDesc', '')),
            h('p', { style: { margin: '6px 0 0', fontSize: '11px', color: C.muted } }, tr('litdbMeta', '')),
          ),
          h('div', { style: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '16px' } },
            h('h2', { style: { margin: 0, fontSize: '15px' } }, tr('sessions', '')),
            h('p', { style: { margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.55, color: C.muted } }, tr('sessionsHint', '')),
          ),
        ),
        h('p', { style: { margin: 0, fontSize: '11.5px', lineHeight: 1.6, color: C.muted } }, tr('exportHint', '')),
      )
    }

    return {
      _internals: { normalizePath, chooseWorkspaceSession },
      inject: ['slots', 'layout', 'locale', 'sessions', 'workspaces', 'remote', 'remote.workspaceFiles'],
      apply(ctx) {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.effect(() => ctx.locale.register(NS, DICT), 'research-core:locale')
          }
          const t = ctx.locale && typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : null
          const label = () => {
            try {
              const value = typeof t === 'function' ? t('entry') : undefined
              return value === undefined || value === null || value === '' ? '科研' : value
            } catch {
              return '科研'
            }
          }
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 30, label }, ResearchIcon),
          )

          const loadHostProjects = async () => {
            try {
              const workspacesService = ctx.get?.('workspaces') ?? ctx.workspaces
              for (let attempt = 0; attempt < 30; attempt += 1) {
                const wsPhase = workspacesService?.list?.getSnapshot?.()?.phase
                const sessionPhase = ctx.sessions.list.getSnapshot().phase
                if (wsPhase === 'ready' && sessionPhase === 'ready') break
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
              const workspaceRoots = (workspacesService?.list?.getSnapshot?.()?.items ?? [])
                .map((item) => item.path)
                .filter((path) => typeof path === 'string' && path.length > 0)
              const snapshot = ctx.sessions.list.getSnapshot()
              const sessions = [...(snapshot.ids ?? []), ...Object.keys(snapshot.byId ?? {})]
                .map((id) => snapshot.byId?.[id])
                .filter(Boolean)
              const signal = new AbortController().signal
              const projects = []
              const seen = new Set()
              for (const workspaceRoot of workspaceRoots) {
                const selected = chooseWorkspaceSession(workspaceRoot, sessions)
                if (!selected) continue
                const listed = await ctx.remote.workspaceFiles.list(selected.sessionId ?? selected.id, '.research/projects', signal)
                if (!listed.ok) continue
                for (const entry of listed.value.entries ?? []) {
                  if (entry.type !== 'directory') continue
                  const root = `${workspaceRoot.replace(/[/\\]+$/, '')}/.research/projects/${entry.name}`
                  if (seen.has(root)) continue
                  const read = await ctx.remote.workspaceFiles.read(
                    selected.sessionId ?? selected.id,
                    `${root}/project.json`,
                    { offset: 1 },
                    signal,
                  )
                  if (!read.ok) continue
                  try {
                    const project = { ...JSON.parse(read.value.text), cwd: root }
                    projects.push(project)
                    seen.add(root)
                  } catch {
                    // A partial project.json is skipped; the canonical file stays on disk.
                  }
                }
              }
              return projects
            } catch {
              return []
            }
          }

          const Page = (props) => h(ResearchPage, {
            ...props,
            t,
            onBack: () => {
              if (ctx.layout && typeof ctx.layout.selectPanel === 'function') ctx.layout.selectPanel('conversation')
            },
            onStartSession: (cwd) => ctx.sessions.create({
              agentPreset: 'research',
              ...(typeof cwd === 'string' && cwd.length > 0 ? { cwd } : {}),
            }),
            onLoadHostProjects: loadHostProjects,
            onOpenSession: (sessionId) => {
              const workspaceUi = ctx.get?.('uiWorkspace') ?? ctx.uiWorkspace
              if (workspaceUi && typeof workspaceUi.openSession === 'function') workspaceUi.openSession(sessionId)
            },
          })
          ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
        } catch (error) {
          ctx.logger?.warn?.(`research-core: apply failed: ${String(error)}`)
        }
      },
    }
  },
})

