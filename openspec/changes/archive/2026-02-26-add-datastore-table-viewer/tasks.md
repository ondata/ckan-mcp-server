## 1. UI Asset

- [x] 1.1 Create `src/ui/datastore-table.html` — self-contained HTML+CSS+JS, no external deps
- [x] 1.2 Implement table rendering from JSON payload (fields + records)
- [x] 1.3 Implement column sorting (ascending/descending, type-aware: numeric, date, string)
- [x] 1.4 Implement client-side text filter (substring match across all columns)
- [x] 1.5 Implement pagination (client-side for ≤500 records, notice for >500 with offset hint)
- [x] 1.6 Implement page-size selector (10 / 25 / 50 / 100)

## 2. MCP Resource Registration

- [x] 2.1 Register `ckan-ui://datastore-table` as a static MCP Resource in `src/resources/datastore-table-ui.ts`
- [x] 2.2 Serve HTML content when resource is read (inlined in TypeScript for both Node.js and Workers)

## 3. Tool Integration

- [x] 3.1 Add `_meta.ui.resourceUri: "ckan-ui://datastore-table"` to markdown response in `src/tools/datastore.ts`
- [x] 3.2 Add `_meta.ui.data` with `{ server_url, resource_id, total, fields, records }`
- [x] 3.3 Text/markdown output always present; JSON format response unchanged

## 4. Workers Compatibility

- [x] 4.1 HTML inlined in `src/resources/datastore-table-ui.ts` — works in Workers without fs module

## 5. Tests

- [x] 5.1 Test file `tests/integration/datastore-table-ui.test.ts` created (7 tests, all passing)
- [x] 5.2 Verified `_meta.ui.data` structure contains expected fields
- [x] 5.3 Verified HTML source contains required UI elements (filter, pagination, sort, message listener)

## Notes

- Server-side pagination (JSON-RPC call back for >500 records) deferred: MCP Apps SDK (`@modelcontextprotocol/ext-apps`) not yet publicly available. Implemented client-side with notice showing total server records and offset hint.
- The `_meta` field is included for all markdown responses; non-MCP-Apps clients ignore it (text content always present).
