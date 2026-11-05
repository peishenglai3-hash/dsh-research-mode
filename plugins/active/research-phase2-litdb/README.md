# research-phase2-litdb

Phase 2 initial slice. Read-only `research_litdb_search` over the user's local
`literature.db`; no UI yet, no database writes, no redistribution.

- DB path: `$RESEARCH_LITDB_PATH` or `~/.dsh/research/knowledge/litdb/literature.db`.
- 3+ character Chinese query uses FTS5 trigram; shorter query falls back to LIKE.
- Returns `backend`, database SHA256, and nine fields per row.
- Not a full-journal corpus; results must be described as the local sample.

Rollback: remove the `@local/research-phase2-litdb` bundle; no data is migrated.
