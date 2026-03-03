# Change: Add DXT one-click install packaging

## Why
Installing the CKAN MCP Server requires manual JSON editing of Claude Desktop's config file. The DXT format (Desktop Extensions) enables one-click installation, dramatically lowering the barrier for non-technical users.

## What Changes
- Add `manifest.json` for the DXT/MCPB specification
- Add `npm run pack:dxt` script that builds and packages the `.dxt` file
- Add `.dxt` file as artifact in GitHub release workflow
- Document one-click install in README

## Impact
- Affected specs: `dxt-packaging` (new capability)
- Affected code: `package.json` (new script), new `manifest.json` at repo root, `README.md`
- No breaking changes — existing stdio/HTTP transport unaffected
