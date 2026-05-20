#!/bin/bash
# Wrapper that filters non-JSON output from stdout to prevent WSL
# UTF-16 error messages from breaking the MCP stdio protocol.
# All non-JSON lines are redirected to stderr.

exec /home/aborruso/.nvm/versions/node/v22.12.0/bin/node \
  /home/aborruso/git/idee/ckan-mcp-server/dist/index.js \
  2>&2 \
  | while IFS= read -r line; do
    if [[ "$line" == \{* ]]; then
      printf '%s\n' "$line"
    else
      printf '%s\n' "$line" >&2
    fi
  done
