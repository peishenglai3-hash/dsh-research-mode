window.__ModuleLoader__.load({
  id: '@local/research-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const TAB_ID = 'research.hub'

    const C = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      panel: 'var(--dsw-alias-bg-layer-1)',
      hover: 'var(--dsw-alias-bg-layer-2)',
      accent: 'var(--dsw-alias-brand-primary)',
    }

    const MODES = [
      ['artifacts', '产物'],
      ['provenance', '证据链'],
      ['reviewer', '复核'],
      ['litdb', '文献库'],
    ]

    // A research session started for one project carries that project in its cwd.
    function stripTrailingSeparators(value) {
      const text = String(value ?? '')
      // Keep a bare drive root ("C:\") or "/" intact.
      return text.length > 3 ? text.replace(/[\\/]+$/, '') : text
    }

    function projectIdFromCwd(cwd) {
      // Windows paths are case-insensitive, so the marker is matched case-insensitively.
      // The captured workspace root and project id keep their original casing.
      const match = stripTrailingSeparators(cwd).match(/^(.*)[\\/]\.research[\\/]projects[\\/]([^\\/]+)$/i)
      if (!match) return null
      const projectId = match[2]
      // "." and ".." are not project ids; treating them as one would walk out of projects/.
      // Trailing spaces/dots are trimmed for this check only — the id keeps its casing.
      if (projectId.trim().replace(/\.+$/, '') === '') return null
      return { workspaceRoot: match[1], projectId }
    }

    // Resolve which project the Hub may show. Ambiguity fails closed: with more than
    // one project and no explicit choice, nothing is picked for the user. The old
    // behaviour silently preferred the newest project (preferring any project that
    // happened to have a .litdb index), which could display the wrong subject.
    function resolveProjectScope(cwd, entries) {
      const inside = projectIdFromCwd(cwd)
      const workspaceRoot = inside ? inside.workspaceRoot : stripTrailingSeparators(cwd)
      const projects = [...(entries ?? [])]
        .filter((entry) => entry && typeof entry.name === 'string')
        .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
        .map((entry) => ({ id: entry.name, createdAt: entry.createdAt ?? null }))
      if (inside) {
        // An explicit project session is not a guess.
        return { status: 'explicit', workspaceRoot, projectId: inside.projectId, projects }
      }
      if (projects.length === 0) return { status: 'none', workspaceRoot, projectId: null, projects }
      if (projects.length === 1) return { status: 'selected', workspaceRoot, projectId: projects[0].id, projects }
      return { status: 'ambiguous', workspaceRoot, projectId: null, projects }
    }

    function scopeAfterChoice(scope, projectId) {
      if (!scope || !projectId) return scope
      if (!scope.projects.some((project) => project.id === projectId)) return scope
      return { ...scope, status: 'selected', projectId }
    }

    function HubBody({ useTabInfo, sessionId }) {
      const [mode, setMode] = React.useState('artifacts')
      const [artifacts, setArtifacts] = React.useState([])
      const [reviews, setReviews] = React.useState([])
      const [litdb, setLitdb] = React.useState(null)
      const [litdbIndex, setLitdbIndex] = React.useState(null)
      const [litdbQuery, setLitdbQuery] = React.useState('')
      const [error, setError] = React.useState('')
      const [scope, setScope] = React.useState(null)
      const [chosen, setChosen] = React.useState(null)
      const [refreshNonce, setRefreshNonce] = React.useState(0)
      let tab = null
      try { tab = useTabInfo().tab } catch {}

      React.useEffect(() => {
        let live = true
        const ctx = window.__researchHubContext
        const session = ctx?.sessions?.list?.getSnapshot?.()?.byId?.[sessionId]
        const files = ctx?.remote?.workspaceFiles
        setError('')
        setArtifacts([])
        setReviews([])
        setLitdb(null)
        setLitdbIndex(null)
        if (!session?.cwd || !files) {
          setScope(null)
          return () => { live = false }
        }
        const signal = new AbortController().signal
        const load = async () => {
          const cwd = String(session.cwd)
          const inside = projectIdFromCwd(cwd)
          const workspaceRoot = inside ? inside.workspaceRoot : cwd.replace(/[/\\]+$/, '')
          const entries = []
          const listed = await files.list(sessionId, `${workspaceRoot}/.research/projects`, signal)
          if (listed.ok) {
            for (const entry of listed.value.entries ?? []) {
              if ((entry.kind ?? entry.type) !== 'directory') continue
              const read = await files.read(sessionId, `${workspaceRoot}/.research/projects/${entry.name}/project.json`, { offset: 1 }, signal)
              if (!read.ok) continue
              try {
                entries.push({ name: entry.name, createdAt: JSON.parse(read.value.text).createdAt })
              } catch {}
            }
          }
          if (!live) return
          const next = resolveProjectScope(cwd, entries)
          setScope(next)
          const chosenAllowed = next.projects.some((project) => project.id === chosen)
          const projectId = next.projectId ?? (chosenAllowed ? chosen : null)
          if (!projectId) return
          const projectRoot = `${workspaceRoot}/.research/projects/${projectId}`
          const loadProjectJsonDir = async (name) => {
            const dir = await files.list(sessionId, `${projectRoot}/${name}`, signal)
            if (!dir.ok) return []
            const rows = []
            for (const entry of dir.value.entries ?? []) {
              if ((entry.kind ?? entry.type) !== 'file' || !entry.name.endsWith('.json')) continue
              const read = await files.read(sessionId, `${projectRoot}/${name}/${entry.name}`, { offset: 1 }, signal)
              if (!read.ok) continue
              try { rows.push(JSON.parse(read.value.text)) } catch {}
            }
            return rows
          }
          const [artifactRows, reviewRows] = await Promise.all([loadProjectJsonDir('artifacts'), loadProjectJsonDir('reviews')])
          let cache = null
          let index = null
          try {
            const read = await files.read(sessionId, `${projectRoot}/.litdb/last-search.json`, { offset: 1 }, signal)
            if (read.ok) cache = JSON.parse(read.value.text)
          } catch {}
          try {
            const read = await files.read(sessionId, `${projectRoot}/.litdb/index.json`, { offset: 1 }, signal)
            if (read.ok) index = JSON.parse(read.value.text)
          } catch {}
          if (!live) return
          setArtifacts(artifactRows)
          setReviews(reviewRows)
          setLitdb(cache)
          setLitdbIndex(index)
        }
        load().catch((cause) => { if (live) setError(String(cause?.message ?? cause)) })
        return () => { live = false }
      }, [sessionId, refreshNonce, chosen])

      const litdbRows = litdbIndex
        ? litdbIndex.rows.filter((row) => {
            const q = litdbQuery.trim().toLowerCase()
            if (!q) return true
            return [row.title, row.abstract, row.research_theme, row.relationship_chain, row.uid]
              .some((value) => String(value ?? '').toLowerCase().includes(q))
          }).slice(0, 50)
        : (litdb?.rows ?? [])
      const rows = mode === 'reviewer' ? reviews : mode === 'litdb' ? litdbRows : artifacts
      const empty = mode === 'artifacts'
        ? '还没有本地产物。'
        : mode === 'provenance'
          ? '还没有证据链。'
          : mode === 'reviewer'
            ? '还没有复核记录。'
          : mode === 'litdb'
            ? litdbIndex ? '本地索引中没有匹配记录。' : '还没有 litdb 查询缓存或索引。'
            : '还没有 litdb 查询缓存。'
      const effective = scope ? scopeAfterChoice(scope, chosen) : null
      const resolved = effective && (effective.status === 'explicit' || effective.status === 'selected')
      const scopeLabel = !effective
        ? '未连接会话'
        : effective.status === 'explicit'
          ? `项目：${effective.projectId}（来自当前会话路径）`
          : effective.status === 'selected'
            ? `项目：${effective.projectId}`
            : effective.status === 'none'
              ? '还没有研究项目'
              : `有 ${effective.projects.length} 个项目，尚未选择`
      const emptyText = resolved
        ? empty
        : effective?.status === 'none'
          ? '还没有研究项目：在会话里让 Agent 创建项目后，这里会出现。'
          : effective?.status === 'ambiguous'
            ? '有多个项目，请先在上方选择一个；这里不会自动猜测你要看哪个项目。'
            : empty
      return h(
        'div',
        { style: { boxSizing: 'border-box', padding: '16px', minHeight: '100%', color: C.text, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' } },
          h('h2', { style: { margin: 0, fontSize: '15px' } }, '科研 / Research'),
          h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
            h('button', {
              type: 'button',
              onClick: () => setRefreshNonce((value) => value + 1),
              'aria-label': 'refresh research hub',
              style: { padding: '3px 9px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10.5px', color: C.text, background: 'transparent', border: `1px solid ${C.border}` },
            }, '刷新'),
            h('span', { style: { fontSize: '10.5px', color: C.accent, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '3px 8px' } }, 'Phase 2'))),
        h('p', { style: { margin: 0, fontSize: '11.5px', color: C.muted, lineHeight: 1.5 } },
          '单一科研入口：产物、证据链、复核与本地 litdb 都在这里；不再分散到多个右栏条目。'),
        h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px', color: C.muted } },
          h('span', { style: { padding: '2px 8px', borderRadius: '999px', border: `1px solid ${C.border}` } }, scopeLabel),
          effective?.status === 'ambiguous'
            ? effective.projects.map((project) => h('button', {
              key: project.id, type: 'button', onClick: () => setChosen(project.id),
              style: { padding: '2px 8px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', color: C.text, background: C.hover, border: `1px solid ${C.accent}` },
            }, project.id))
            : null),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          MODES.map(([id, label]) => h('button', {
            key: id, type: 'button', onClick: () => setMode(id),
            style: {
              padding: '5px 10px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px',
              color: mode === id ? C.text : C.muted,
              background: mode === id ? C.hover : 'transparent',
              border: `1px solid ${mode === id ? C.accent : C.border}`,
            },
          }, label))),
        error ? h('p', { style: { margin: 0, fontSize: '12px', color: C.accent } }, `读取失败: ${error}`) : null,
        mode === 'provenance'
          ? h('p', { style: { margin: 0, fontSize: '11.5px', color: C.muted } },
              `证据链：${artifacts.length} 个 artifact；7 面中 review 面按 reviews/ 读取时派生，其余 6 面来自不可变 sidecar。`)
          : null,
        mode === 'litdb' && litdbIndex
          ? h('div', { style: { fontSize: '11.5px', color: C.muted } },
              `本地索引：${litdbIndex.count} 条 · db sha256: ${litdbIndex.dbSha256}`,
              h('div', { style: { marginTop: '6px' } },
                h('input', {
                  value: litdbQuery,
                  onChange: (event) => setLitdbQuery(event.target.value),
                  placeholder: '在本地 litdb 索引中搜索标题/主题/关系链/UID',
                  'aria-label': 'litdb search',
                  style: { boxSizing: 'border-box', width: '100%', padding: '7px 9px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.panel, color: C.text, fontFamily: 'inherit', fontSize: '12px' },
                })))
          : mode === 'litdb' && litdb
            ? h('div', { style: { fontSize: '11.5px', color: C.muted } },
                `query: ${litdb.query} · backend: ${litdb.backend} · count: ${litdb.count}`,
                h('div', { style: { wordBreak: 'break-all', marginTop: '4px' } }, `db sha256: ${litdb.dbSha256}`))
            : null,
        rows.length === 0
          ? h('p', { style: { margin: 0, fontSize: '12px', color: C.muted } }, emptyText)
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              rows.map((row) => {
                if (mode === 'reviewer') {
                  return h('section', { key: row.artifactId, style: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px', fontSize: '11.5px' } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
                      h('strong', { style: { fontSize: '12.5px' } }, row.title ?? row.artifactId),
                      h('code', { style: { color: C.accent } }, row.decision ?? 'unknown')),
                    h('div', { style: { color: C.muted, marginTop: '4px' } },
                      `Round: ${row.round ?? 1} · Reviewer: ${row.reviewer || '—'} · Template: ${row.template || 'general'} · Authority: ${row.authority || 'reviewer'}`),
                    row.signature
                      ? h('div', { style: { color: C.muted, marginTop: '4px', wordBreak: 'break-all' } }, `Signature: ${row.signature}`)
                      : null,
                    row.notes ? h('div', { style: { color: C.muted, marginTop: '4px' } }, row.notes) : null,
                    Array.isArray(row.history) && row.history.length > 0
                      ? h('div', { style: { color: C.muted, marginTop: '4px' } },
                          `History: ${row.history.map((entry) => entry.decision).join(' → ')}`)
                      : null,
                  )
                }
                if (mode === 'litdb') {
                  return h('section', { key: row.uid, style: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px', fontSize: '11.5px' } },
                    h('strong', { style: { fontSize: '12.5px' } }, row.title),
                    h('div', { style: { color: C.muted, marginTop: '4px' } }, `${row.year} · ${row.journal}`),
                    h('div', { style: { color: C.muted, marginTop: '4px' } }, `${row.uid} · ${row.research_theme}`))
                }
                const checksum = typeof row.checksum === 'string' ? row.checksum : row.checksum?.value ?? row.id
                const faces = Object.entries(row.provenance ?? {})
                const available = faces.filter(([, face]) => face?.status === 'available').length
                return h('section', { key: row.id, style: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px', fontSize: '11.5px' } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
                    h('strong', { style: { fontSize: '12.5px' } }, row.title),
                    h('code', { style: { color: C.muted } }, String(checksum).slice(0, 16))),
                  mode === 'provenance'
                    ? h('div', { style: { color: C.muted, marginTop: '4px' } }, `${available}/${faces.length} faces available`)
                    : h('div', { style: { color: C.muted, marginTop: '4px' } }, `checksum: ${checksum}`))
              })),
        tab ? h('p', { style: { margin: 0, fontSize: '10.5px', color: C.muted } }, `${tab.kind} · ${tab.title}`) : null,
      )
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs', 'remote', 'remote.workspaceFiles', 'sessions'],
      _internals: { projectIdFromCwd, resolveProjectScope, scopeAfterChoice },
      apply(ctx) {
        window.__researchHubContext = ctx
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: 'research-hub',
          title: () => '科研 / Research',
          guide: [{ id: TAB_ID, order: 5, title: () => '科研 / Research', description: () => '产物、证据链、复核与本地 litdb 的统一入口' }],
        }), 'research-hub:type')
        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, HubBody))
      },
    }
  },
})
