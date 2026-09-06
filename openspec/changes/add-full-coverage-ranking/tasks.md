## 1. Implementation
- [x] 1.1 `stemTerm`, tokenised matcher, elided stopwords
- [x] 1.2 `coverage` weight and breakdown field; `scoreDatasetRelevance(…, fullCoverage)`
- [x] 1.3 Strict pass with `mm=100%`, fill from the default pass, `all_terms_results`

## 2. Verification
- [x] 2.1 Unit tests: stem pairs, whole-word boundary kept, elided articles, coverage bonus
- [x] 2.2 Gate: Lecce first with margin ≥ 2 and exact terms; Milano air-quality reports first
- [x] 2.3 Native API vs MCP on three queries, recorded in LOG.md
