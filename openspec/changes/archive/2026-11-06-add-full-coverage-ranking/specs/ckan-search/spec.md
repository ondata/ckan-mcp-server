## MODIFIED Requirements

### Requirement: Relevance ranking

`ckan_find_relevant_datasets` ranks locally over candidates fetched from `package_search`.
The tool SHALL fetch candidates first with every query term required (`mm=100%`) whenever
the query is neither fielded nor wrapped, SHALL fill from a default pass when those are
fewer than the requested limit, and SHALL award datasets from the strict pass a `coverage`
bonus visible in the score breakdown. It SHALL score a field by the share of query terms it
carries, SHALL treat a term and a word as matching when they are equal or share a stem
(final vowel stripped from words of five letters or more), SHALL match on Unicode word
boundaries, and SHALL score at least 50 candidates whatever the requested limit.

#### Scenario: Every term present in the catalog
- **WHEN** the portal returns datasets for the query with every term required
- **THEN** those datasets carry the `coverage` bonus and lead the ranking, with the strict
  count reported as `all_terms_results`

#### Scenario: Strict pass comes up short
- **WHEN** fewer datasets than the limit carry every term, or none do
- **THEN** the default pass fills the remaining places, without the bonus

#### Scenario: Fielded or boolean query
- **WHEN** the query carries a colon, or was wrapped for a portal that ignores booleans
- **THEN** no strict pass is made and `all_terms_results` is `null`

#### Scenario: Field scoring
- **WHEN** a field contains some of the query's terms
- **THEN** it scores in proportion to the share it carries, never the full weight for a
  single term

#### Scenario: Singular and plural
- **WHEN** a query term and a word in a field differ only by a final vowel
- **THEN** they match; `immobilità` and `mobilità` do not

#### Scenario: Non-English text
- **WHEN** a query term ends in an accented letter, is a stopword of the catalog's
  language, or is an elided article such as `dell'`
- **THEN** term matching respects Unicode word boundaries, and the stopword does not
  contribute to any field's score
