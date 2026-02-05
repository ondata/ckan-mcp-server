# Set up the CKAN MCP Server in ChatGPT (Web)

This guide uses the public demo server, which has a limit of 100,000 calls per day shared quota across all users of this endpoint. For reliable usage, it is recommended to install the CKAN MCP Server on your own machine.

This guide walks you through enabling Developer mode, creating the CKAN MCP Server app, and using it inside a chat.

## 1) Open Settings

Open the profile menu and click **Settings**.

![Open Settings](images/chatgpt_web_01.png)

## 2) Go to Apps → Advanced settings

In Settings, select **Apps**, then click **Advanced settings**.

![Apps → Advanced settings](images/chatgpt_web_02.png)

## 3) Enable Developer mode

Turn on **Developer mode**.

![Enable Developer mode](images/chatgpt_web_03.png)

## 4) Create a new app

Click **Create app** in the top-right.

![Create app](images/chatgpt_web_04.png)

## 5) Fill in the MCP server details

Complete the form:

- **Name:** CKAN MCP Server
- **Description:** To search data in CKAN open data portals
- **MCP Server URL:** `https://ckan-mcp-server.andy-pr.workers.dev/mcp`
- **Authentication:** No Auth
- Check the confirmation box, then click **Create**.

![New app details](images/chatgpt_web_05.png)

## 6) Start a chat and enable the app

In a new chat, click **+**, then **More**, and select **CKAN MCP Server**.

![Enable the app in chat](images/chatgpt_web_06.png)

## 7) Ask a CKAN question

Type your question. You will see the CKAN MCP Server badge under the input.

![Ask a question](images/chatgpt_web_07.png)

## 8) View the tool output

ChatGPT will call the tool and return a response, often including a source link to the CKAN API.

![Tool output](images/chatgpt_web_08.png)
