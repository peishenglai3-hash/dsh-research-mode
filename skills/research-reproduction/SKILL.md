---
name: research-reproduction
description: "Make a research result reproducible: pin inputs, environment, commands, seeds and expected outputs; record the gaps that prevent a clean rerun. Use when handing off code/data or exporting a project."
---

# Research reproduction

## Required record

1. Inputs: files/datasets with checksum or immutable locator.
2. Environment: OS, runtime/library versions, seeds.
3. Commands: exact entry points and working directory.
4. Outputs: expected files and checksums.
5. Gaps: missing data, credentials, licenses, manual steps.

## Rules

- A run that cannot be repeated is reported as not reproducible, not as a successful reproduction.
- Do not bundle credentials, private microdata or third-party full texts.
- If a step is manual, say who performs it and what evidence they must leave.
