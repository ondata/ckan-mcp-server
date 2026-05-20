## ADDED Requirements

### Requirement: Contribution Guide Document
The project SHALL provide a `CONTRIBUTING.md` at the repo root that covers language policy, commit conventions, project structure, and PR checklist.

#### Scenario: Language policy
- **WHEN** a contributor opens the file
- **THEN** they see that all code, comments, docs, and commit messages must be in English

#### Scenario: Commit conventions
- **WHEN** a contributor reads the commit section
- **THEN** they see the format: `<type>: <short description>` with allowed types (feat, fix, docs, chore, refactor, test)

#### Scenario: Project structure
- **WHEN** a contributor reads the structure section
- **THEN** they understand where files belong: src/ for code, docs/ for docs, examples/ for community integrations, docker/ for Docker core files

#### Scenario: PR checklist
- **WHEN** a contributor reads the PR section
- **THEN** they see: branch from main, no unrelated diffs, no local-only files (e.g. portals.json changes), tests pass
