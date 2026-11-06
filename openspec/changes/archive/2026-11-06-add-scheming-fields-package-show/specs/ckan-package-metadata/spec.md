## ADDED Requirements
### Requirement: Scheming root fields in package_show
The `ckan_package_show` tool SHALL add the root fields declared by the portal's ckanext-scheming schema, for the dataset's own type, that have a value and that the output does not already show, each with the label the schema gives it and the value as stored.

#### Scenario: Portal with scheming
- **GIVEN** a portal whose schema declares `keywords` with the label `{ "en": "Keywords", "fr": "Mots-clés" }` and a dataset with `keywords` = `{ "en": ["Air quality"], "fr": ["Qualité de l'air"] }`
- **WHEN** the user calls `ckan_package_show`
- **THEN** JSON SHALL contain `fields: [{ field: "keywords", label: "Keywords", value: { en: ["Air quality"], fr: ["Qualité de l'air"] } }]`
- **AND** Markdown SHALL list the field under "Fields (from the portal's metadata schema)"

#### Scenario: Schema of the dataset's own type
- **GIVEN** a dataset whose `type` is `showcase`
- **WHEN** the user calls `ckan_package_show`
- **THEN** the schema SHALL be requested with `type=showcase`

#### Scenario: Portal without scheming
- **GIVEN** a portal that answers 404 or 400 ("Action name not known") for `scheming_dataset_schema_show`, or does not answer in time
- **WHEN** the user calls `ckan_package_show`
- **THEN** the output SHALL be what it was without this change, with no `fields` and no error
- **AND** the missing schema SHALL be remembered so the portal is not asked again on the next call

#### Scenario: Nothing is shown twice, nothing is lost
- **GIVEN** a schema that declares `title_translated`, `notes_translated`, a field the chosen output already renders, a field kept in `extras` (Markdown), a field with `display_snippet: null`, and a field with no value
- **WHEN** the user calls `ckan_package_show`
- **THEN** none of them SHALL appear in `fields`
- **AND** a field that output does not render (for example `author_email` in JSON, or a `temporal_coverage` the tool cannot parse) SHALL appear in `fields`

#### Scenario: Malformed schema
- **GIVEN** a schema whose `dataset_fields` contains entries that are not objects
- **WHEN** the user calls `ckan_package_show`
- **THEN** those entries SHALL be skipped and the rest of the answer SHALL be unaffected

#### Scenario: Long value
- **GIVEN** a field value of more than 2000 characters
- **WHEN** the user calls `ckan_package_show`
- **THEN** the value SHALL be cut, and the field SHALL say so (`truncated: true` in JSON, a note in Markdown)

#### Scenario: Output over the character limit
- **GIVEN** a schema and dataset whose `fields` do not fit in the character limit
- **WHEN** the user calls `ckan_package_show` with JSON output
- **THEN** the result SHALL be valid JSON, with `fields` shortened after `resources` and `tags`, and `_truncated` set
