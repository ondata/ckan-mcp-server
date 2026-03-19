#!/usr/bin/env python3
"""
Eval: given a natural language query, which MCP tool does the model select?

Usage:
    uv run --with litellm eval_tool_selection.py "search datasets about air quality"
    uv run --with litellm eval_tool_selection.py "search datasets about air quality" --model claude-3-5-haiku-20241022
    uv run --with litellm eval_tool_selection.py "search datasets about air quality" --model groq/llama-3.3-70b-versatile --slim

Default model: gemini/gemini-2.5-flash
MCP server must be running on http://localhost:3001

--slim: strip parameter descriptions from tool schemas (~70% fewer tokens, useful for Groq free tier)
"""

import argparse
import json
import sys
import urllib.request


MCP_URL = "http://localhost:3001/mcp"
DEFAULT_MODEL = "gemini/gemini-2.5-flash"


def fetch_tools() -> list[dict]:
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/list",
        "params": {},
        "id": 1
    }).encode()
    req = urllib.request.Request(
        MCP_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data["result"]["tools"]


def slim_schema(schema: dict) -> dict:
    """Strip descriptions from parameter properties to reduce token count."""
    if not schema:
        return schema
    result = {k: v for k, v in schema.items() if k != "description"}
    if "properties" in schema:
        result["properties"] = {
            name: {k: v for k, v in prop.items() if k != "description"}
            for name, prop in schema["properties"].items()
        }
    return result


def to_litellm_tools(mcp_tools: list[dict], slim: bool = False) -> list[dict]:
    result = []
    for t in mcp_tools:
        schema = t.get("inputSchema", {})
        if slim:
            schema = slim_schema(schema)
        result.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": schema,
            },
        })
    return result


def run_eval(query: str, model: str, slim: bool = False) -> None:
    import litellm

    print(f"Model : {model}")
    print(f"Query : {query}")
    print(f"Slim  : {slim}")
    print()

    mcp_tools = fetch_tools()
    print(f"Tools available: {len(mcp_tools)}")
    print()

    tools = to_litellm_tools(mcp_tools, slim=slim)

    response = litellm.completion(
        model=model,
        messages=[{"role": "user", "content": query}],
        tools=tools,
        tool_choice="auto",
    )

    msg = response.choices[0].message

    if msg.tool_calls:
        for call in msg.tool_calls:
            fn = call.function
            args = json.loads(fn.arguments) if isinstance(fn.arguments, str) else fn.arguments
            print(f"Tool selected : {fn.name}")
            print(f"Arguments     :")
            print(json.dumps(args, indent=2, ensure_ascii=False))
    else:
        print("No tool selected. Model replied:")
        print(msg.content)


def main():
    parser = argparse.ArgumentParser(description="Eval MCP tool selection")
    parser.add_argument("query", help="Natural language query")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="LiteLLM model string")
    parser.add_argument("--slim", action="store_true", help="Strip parameter descriptions to reduce token count")
    args = parser.parse_args()

    try:
        run_eval(args.query, args.model, slim=args.slim)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
