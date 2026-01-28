# add-mcp-apps-hello-world

**Status**: Proposed
**Created**: 2026-01-27

## Quick Summary

Add CKAN portal dashboard tool with interactive UI showing statistics, charts, and top content. Production-ready feature demonstrating MCP Apps with real data.

## What's Included

- New tool: `ckan_portal_info_ui` with server_url parameter
- Dashboard UI: Statistics cards, bar charts (organizations), pie charts (formats), tag list
- Chart visualization: Chart.js integration for interactive data exploration
- UI resource: `ui://portal-info` with vanilla JavaScript + Chart.js
- Documentation: MCP Apps pattern explanation in CLAUDE.md
- Tests: Unit and integration tests for tool and UI rendering

## Key Benefits

- **Immediate user value**: Quick overview of any CKAN portal
- **Visual statistics**: Charts more intuitive than text tables
- **Production-ready**: Real CKAN integration, not just demo
- **Foundation**: Template for future interactive tools (dataset explorer, maps)
- **Cross-portal**: Works with dati.gov.it, data.gov, demo.ckan.org, etc.
- **All transport modes**: stdio/HTTP/Workers compatibility

## Files

- `proposal.md` - Full proposal with context and alternatives
- `tasks.md` - Implementation tasks checklist
- `design.md` - Architecture decisions and patterns
- `specs/mcp-apps-example/spec.md` - Formal requirements with scenarios

## Next Steps

1. Review proposal for approval
2. Implement according to tasks.md
3. Validate with `openspec validate add-mcp-apps-hello-world --strict`
4. Apply change with `openspec apply add-mcp-apps-hello-world`
