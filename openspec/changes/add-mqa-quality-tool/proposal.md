# Change: Add MQA Quality Score Tool for dati.gov.it

## Why
Datasets on dati.gov.it display quality scores (Eccellente, Buono, etc.) calculated by data.europa.eu's MQA (Metadata Quality Assurance) system. Currently there's no way to access these quality metrics through the MCP server, limiting users' ability to evaluate dataset quality programmatically.

## What Changes
- Add `ckan_get_mqa_quality` tool for retrieving quality metrics from data.europa.eu
- Tool works only with dati.gov.it server (validated at runtime)
- Fetches dataset identifier from CKAN, then queries MQA API
- Returns quality score and detailed metrics (accessibility, reusability, interoperability, findability)
- Supports both markdown and JSON output formats

## Impact
- Affected specs: New capability `ckan-quality`
- Affected code:
  - New file: `src/tools/quality.ts` (tool handler)
  - New file: `tests/integration/quality.test.ts` (tests with mocked responses)
  - New file: `tests/fixtures/responses/mqa-quality.json` (mock data)
  - Modified: `src/server.ts` (register new tool)
  - Modified: `README.md` (document new tool)
  - Modified: `EXAMPLES.md` (add usage examples)
