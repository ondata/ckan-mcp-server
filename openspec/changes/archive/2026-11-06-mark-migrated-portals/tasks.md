## 1. Implementation

- [x] 1.1 `migrated` block on the `catalog-data-gov` entry, `getPortalMigration()` in
      `portal-config.ts`
- [x] 1.2 `CkanApiError.serverUrl`, set at every construction site in `makeCkanRequest`
- [x] 1.3 `formatCkanError` short-circuits to the migration notice
- [x] 1.4 `ckan_status_show` uses `formatCkanError`
- [x] 1.5 README, EXAMPLES, CLAUDE.md, src/README, SKILL.md, PRD, PRIVACY, project.md and
      the `ckan_organization_search` description no longer present it as CKAN

## 2. Verification

- [x] 2.1 Unit tests: migrated portal gets the notice on 404 and on 500; a non-migrated
      portal keeps the status hint; `getPortalMigration` on alias and unknown host
- [x] 2.2 Smoke case against the live portal: the answer carries the notice
- [x] 2.3 `grep catalog.data.gov` outside LOG/archive finds only the migration note and
      the portals entry
