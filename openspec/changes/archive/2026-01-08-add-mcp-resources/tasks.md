# Tasks: Add MCP Resource Templates

## 1. Setup

- [x] 1.1 Create `src/resources/` directory
- [x] 1.2 Create `src/resources/index.ts` with `registerAllResources()` export

## 2. URI Utilities

- [x] 2.1 Create URI parsing function for `ckan://` scheme
- [x] 2.2 Add validation for malformed URIs
- [x] 2.3 Handle edge cases (www prefix, trailing slashes)

## 3. Dataset Resource

- [x] 3.1 Create `src/resources/dataset.ts`
- [x] 3.2 Register template `ckan://{server}/dataset/{id}`
- [x] 3.3 Implement handler using `makeCkanRequest('package_show')`
- [x] 3.4 Return JSON response with dataset metadata

## 4. Resource Resource

- [x] 4.1 Create `src/resources/resource.ts`
- [x] 4.2 Register template `ckan://{server}/resource/{id}`
- [x] 4.3 Implement handler using `makeCkanRequest('resource_show')`
- [x] 4.4 Include download URL in response

## 5. Organization Resource

- [x] 5.1 Create `src/resources/organization.ts`
- [x] 5.2 Register template `ckan://{server}/organization/{name}`
- [x] 5.3 Implement handler using `makeCkanRequest('organization_show')`
- [x] 5.4 Return JSON response with organization metadata

## 6. Integration

- [x] 6.1 Import `registerAllResources` in `src/index.ts`
- [x] 6.2 Call `registerAllResources(server)` after tool registration
- [x] 6.3 Build and verify no compilation errors

## 7. Testing

- [x] 7.1 Create `tests/integration/resources.test.ts`
- [x] 7.2 Add tests for dataset resource template
- [x] 7.3 Add tests for resource resource template
- [x] 7.4 Add tests for organization resource template
- [x] 7.5 Add tests for URI parsing edge cases
- [x] 7.6 Add tests for error handling (invalid URI, server errors)
- [x] 7.7 Run full test suite, ensure 100% pass

## 8. Documentation

- [x] 8.1 Update README.md with resource templates section
- [x] 8.2 Update CLAUDE.md architecture section
- [x] 8.3 Add examples to EXAMPLES.md (deferred - basic examples in README)
- [x] 8.4 Update LOG.md with changes
