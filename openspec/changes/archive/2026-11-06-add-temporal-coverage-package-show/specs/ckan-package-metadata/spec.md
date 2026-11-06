## ADDED Requirements
### Requirement: Temporal coverage in package_show
The `ckan_package_show` tool SHALL expose every `dct:temporal` period a CKAN portal attaches to a dataset, whether serialized as root `temporal_coverage` (JSON string or array of `{temporal_start, temporal_end}`) or as extras `temporal_coverage` / `temporal_start` / `temporal_end`.

#### Scenario: Period with start and end
- **GIVEN** a dataset whose `temporal_coverage` holds one period with start `2026-04-28` and end `2027-04-28`
- **WHEN** the user calls `ckan_package_show`
- **THEN** markdown SHALL contain `**Temporal Coverage (dct:temporal)**: 2026-04-28 → 2027-04-28`
- **AND** JSON SHALL contain `temporal_coverage: [{ start: "2026-04-28", end: "2027-04-28", start_equals_issued: false }]`

#### Scenario: Several periods
- **GIVEN** a dataset whose `temporal_coverage` lists two periods
- **WHEN** the user calls `ckan_package_show`
- **THEN** both periods SHALL appear, joined with `; ` in markdown and as two array items in JSON

#### Scenario: Start equals issued with no end
- **GIVEN** a dataset with extras `temporal_start` equal to its `issued` date and no `temporal_end`
- **WHEN** the user calls `ckan_package_show`
- **THEN** markdown SHALL render the period as `start → open (start equals issued, no end)`
- **AND** JSON SHALL set `start_equals_issued: true` on that period
- **AND** the tool SHALL NOT drop or rewrite the value

#### Scenario: No temporal coverage
- **GIVEN** a dataset with no temporal fields, or a malformed `temporal_coverage` string
- **WHEN** the user calls `ckan_package_show`
- **THEN** markdown SHALL contain no Temporal Coverage line
- **AND** JSON `temporal_coverage` SHALL be an empty array
