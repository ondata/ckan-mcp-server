# Change: Support the data.europa.eu MQA methodology v2

## Why
data.europa.eu replaced the MQA methodology (https://data.europa.eu/mqa/methodology). The dataset cache endpoint now serves only v2 metrics (0-7.5 scale, weighted DCAT-AP 3 metrics, four FAIR dimensions) and answers `404 No v2 metrics found` for datasets not yet re-evaluated. Both MQA tools break: re-evaluated datasets are rendered on the old 405 scale, the others fail with a misleading "identifier not aligned" error. Issue #548.

## What Changes
- **BREAKING** (output shape): parse the v2 cache payload directly; headline score is `datasetFinal` on a 0-7.5 scale with the official band (Sufficient / Good / Excellent), plus dataset, distribution-average and data-service-average scores.
- Failing metrics (`result: 0`) are grouped by FAIR dimension, aggregated across distributions ("N of M distributions"), and ordered by their exact potential gain on the final score.
- Datasets without v2 metrics fall back to the metrics endpoint and are labelled as scored with the previous methodology (405 scale).
- The two 404 cases (`DQV of dataset not found` vs `No v2 metrics found`) produce distinct errors.
- **BREAKING** (JSON): compact object with `methodology: "v2" | "v1"`, `metricsVersion`, `maxScore`; the raw MQA payload is no longer returned (it exceeded the 50k limit).

## Impact
- Affected specs: `ckan-quality`, `mqa-quality`
- Affected code: `src/tools/quality.ts`, `tests/integration/quality.test.ts`, fixtures, README, skill, LOG
