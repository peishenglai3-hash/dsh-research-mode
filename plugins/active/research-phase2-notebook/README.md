# research-phase2-notebook

Phase 2 Notebook-lite, initial read-only slice.

`research_notebook_inspect(projectId, notebookPath)` parses a project `.ipynb`
and reports cell order, execution counts, output counts, imports and gaps.

It does **not** execute cells, mutate the notebook, install dependencies or clear
outputs. Execution requires explicit user approval and a kernel outside this tool.

Rollback: remove the `@peishenglai3-hash/dsh-research-phase2-notebook` bundle; no notebook is
modified by this tool.
