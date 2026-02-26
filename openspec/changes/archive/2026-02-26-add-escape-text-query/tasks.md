## 1. Implementation
- [x] Add a Solr/Lucene escaping helper for text-field queries.
- [x] Apply escaping when `resolveSearchQuery` forces `text:(...)`.
- [x] Ensure behavior is unchanged when not forcing the text parser.

## 2. Tests
- [x] Add unit tests for escaping behavior (quotes, parentheses, backslashes, colons).
- [x] Add tests to cover `resolveSearchQuery` effectiveQuery output with forced text parser.
