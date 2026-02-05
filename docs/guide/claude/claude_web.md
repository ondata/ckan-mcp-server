# Set up the CKAN MCP Server in Claude (Web)

This guide uses the public demo server, which has a limit of 100,000 calls per day shared quota across all users of this endpoint. For reliable usage, it is recommended to install the CKAN MCP Server on your own machine.

This guide shows how to add the CKAN MCP Server as a custom connector in Claude and use it in a chat.

## 1) Open Settings

Open the profile menu and click **Settings**.

![Open Settings](images/claude_web_01.png)

## 2) Go to Connectors

In Settings, select **Connectors**.

![Connectors](images/claude_web_02.png)

## 3) Add a custom connector

Scroll down and click **Add custom connector**.

![Add custom connector](images/claude_web_03.png)

## 4) Fill in the connector details

Enter the connector name and MCP server URL, then click **Add**.

- **Name:** CKAN MCP server
- **MCP Server URL:** `https://ckan-mcp-server.andy-pr.workers.dev/mcp`

![Connector details](images/claude_web_04.png)

## 5) Enable the connector in chat

Open a new chat, click **+**, then **Connectors**, and turn on **CKAN MCP server**.

![Enable connector](images/claude_web_05.png)

## 6) Ask a CKAN question

Type your question and send it.

![Ask a question](images/claude_web_06.png)

## 7) Allow tool usage

When Claude asks to use the CKAN MCP Server tools, click **Always allow** (or **Allow once**).

![Allow tool usage](images/claude_web_07.png)

## 8) Approve additional tool calls

If Claude needs a follow-up tool call, approve it the same way.

![Approve follow-up](images/claude_web_08.png)

## 9) View the results

Claude will return the answer after running the tool(s).

![Result](images/claude_web_09.png)

---

## Guided prompts

Claude includes **Guided prompts** for the CKAN MCP Server, which provide ready-made examples to get started quickly.

Open the **+** menu, choose **Add from CKAN MCP server**, and pick a guided prompt from the list.

![Guided prompts list](images/claude_web_10.png)

Fill in the required fields (for example, the CKAN server URL and organization), then add the prompt.

![Guided prompt inputs](images/claude_web_11.png)
