# Change: add MQA metrics guidance for score explanations

## Why
Users ask why an MQA score is not the maximum. The tool already exposes a metrics endpoint, but the response does not guide users to use it for the detailed reasons.

## What Changes
- Add guidance in the MQA quality tool output that the metrics endpoint can explain score deductions.
- When asked to explain a non-max score, use the metrics endpoint to identify failing measurements (e.g., `knownLicence = false`).

## Impact
- Affected specs: ckan-insights
- Affected code: src/tools/quality.ts
