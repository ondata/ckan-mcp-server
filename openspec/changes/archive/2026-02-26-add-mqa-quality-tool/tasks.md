# Implementation Tasks

## 1. Core Implementation
- [x] 1.1 Create `src/tools/quality.ts` with `ckan_get_mqa_quality` tool handler
- [x] 1.2 Implement server URL validation (dati.gov.it only)
- [x] 1.3 Add CKAN package_show call to extract identifier field
- [x] 1.4 Add MQA API client (https://data.europa.eu/api/mqa/cache/datasets/{id})
- [x] 1.5 Implement markdown and JSON formatters for quality metrics
- [x] 1.6 Register tool in `src/server.ts`

## 2. Testing
- [x] 2.1 Create mock fixtures for CKAN package_show response
- [x] 2.2 Create mock fixtures for MQA API response
- [x] 2.3 Write integration tests for successful quality retrieval
- [x] 2.4 Write tests for error scenarios (invalid server, dataset not found, MQA API unavailable)
- [x] 2.5 Write tests for fallback from identifier to name field
- [x] 2.6 Verify test coverage matches project standards

## 3. Documentation
- [x] 3.1 Add tool description to README.md
- [x] 3.2 Add usage examples to EXAMPLES.md
- [x] 3.3 Document server restriction (dati.gov.it only)
- [x] 3.4 Document quality metrics structure (score, accessibility, reusability, interoperability, findability)

## 4. Validation
- [x] 4.1 Run full test suite (npm test) - 212 tests passing
- [x] 4.2 Test manually with real dati.gov.it dataset
- [x] 4.3 Verify error handling for non-dati.gov.it servers
- [x] 4.4 Build project successfully (npm run build)
