# Change: Make MQA quality output more readable and actionable

## Why
Users need a clearer explanation of what lowers the MQA score and direct links to the authoritative metrics source.

## What Changes
- Enrich `ckan_get_mqa_quality` output with dimension scores and the non-max dimension(s)
- Include a direct metrics endpoint link used for the scoring breakdown
- Return structured JSON that includes the derived breakdown (in addition to raw MQA response)

## Impact
- Affected specs: ckan-quality
- Affected code: MQA quality tool handler + formatting utilities
