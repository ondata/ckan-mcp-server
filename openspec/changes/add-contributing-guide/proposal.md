# Change: Add CONTRIBUTING.md

## Why

External contributors (e.g. PR #14) repeatedly hit the same friction points: wrong language, wrong file placement, local fork diffs leaking in. A single reference document would cut review round-trips.

## What Changes

- Add `CONTRIBUTING.md` at repo root with:
  - Language policy (English only)
  - Commit message conventions (written inline, not linked)
  - Project structure overview (where files belong)
  - PR checklist (clean branch, no unrelated diffs)
  - How to add examples (`examples/<name>/`)

## Impact

- Affected specs: contributor-guide (new)
- Affected code: none (docs only)
