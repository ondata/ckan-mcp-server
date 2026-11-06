import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerDatastoreTools } from "../../src/tools/datastore.js";
import { CkanApiError, formatCkanError, makeCkanRequest } from "../../src/utils/http.js";

vi.mock("axios");

const SERVER = "https://dati.comune.messina.it";
const OK = { success: true, result: { records: [{ n: 1 }], fields: [{ id: "n", type: "int8" }] } };

function httpFailure(status: number, body: unknown) {
  return { response: { status, statusText: "", data: Buffer.from(JSON.stringify(body)), headers: {} } };
}

// Real bodies, 2026-11-06: open.canada.ca (400) and donnees.montreal.ca (409 on GET, 200 on POST).
const NO_SQL_ENDPOINT = "Bad request - Action name not known: datastore_search_sql";
const SQL_PARAM_LOST = { success: false, error: { sql: ["Valeur manquante"], __type: "Validation Error" } };

async function runSql(sql: string): Promise<{ text: string; isError: boolean }> {
  const mcp = new McpServer({ name: "test", version: "0.0.0" });
  registerDatastoreTools(mcp);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([mcp.connect(b), client.connect(a)]);
  const res: any = await client.callTool({ name: "ckan_datastore_search_sql", arguments: { server_url: SERVER, sql, response_format: "json" } });
  return { text: res.content[0].text, isError: Boolean(res.isError) };
}

describe("ckan_datastore_search_sql errors seen in telemetry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("trailing semicolon", () => {
    it("is removed, because CKAN wraps the query in a subquery", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: OK });
      await runSql('SELECT 1 FROM "semi-1";  \n');
      expect(vi.mocked(axios.get).mock.calls[0][1]?.params.sql).toBe('SELECT 1 FROM "semi-1"');
    });

    it("stays when it is inside the query", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: OK });
      await runSql(`SELECT 1 FROM "semi-2" WHERE a = 'x;'`);
      expect(vi.mocked(axios.get).mock.calls[0][1]?.params.sql).toBe(`SELECT 1 FROM "semi-2" WHERE a = 'x;'`);
    });
  });

  describe("portal without the SQL endpoint", () => {
    it("says the endpoint is missing, not that the SQL is wrong", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(400, NO_SQL_ENDPOINT));
      const { text, isError } = await runSql('SELECT 1 FROM "nosql-1"');
      expect(isError).toBe(true);
      expect(text).toContain("does not expose the SQL endpoint");
      expect(text).not.toContain("Invalid SQL syntax");
    });

    it("keeps the SQL hint on a 400 that is about the SQL", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(400, { success: false, error: { message: "bad" } }));
      const { text } = await runSql('SELECT 1 FROM "nosql-2"');
      expect(text).toContain("Invalid SQL syntax");
    });

    it("does not reflect any other plain-string body (GHSA-6f9w)", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(400, "internal detail, Action name not known: secret"));
      const error = await makeCkanRequest(SERVER, "datastore_search_sql", { sql: "SELECT 1" }).catch((e) => e);
      expect(error.message).not.toContain("internal detail");
      expect(error.message).not.toContain("secret");
    });
  });

  it("says a portal has no DataStore when datastore_search is the unknown action", () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    const error = new CkanApiError("CKAN API error (400): Action name not known: datastore_search", 400, "datastore_search", SERVER, "Action name not known: datastore_search");
    const text = formatCkanError(error, "ckan_datastore_search");
    expect(text).toContain("no DataStore");
    expect(text).not.toContain("invalid field name");
  });

  describe("portal that loses the sql parameter on GET", () => {
    it("retries with POST", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(409, SQL_PARAM_LOST));
      vi.mocked(axios.post).mockResolvedValue({ data: OK });
      const { text, isError } = await runSql('SELECT 1 FROM "post-1"');
      expect(isError).toBe(false);
      expect(text).toContain('"n": 1');
      expect(vi.mocked(axios.post).mock.calls[0][0]).toContain("/datastore_search_sql");
      expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ sql: 'SELECT 1 FROM "post-1"' });
    });

    it("reports the failure when POST fails too", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(409, SQL_PARAM_LOST));
      vi.mocked(axios.post).mockRejectedValue(httpFailure(409, SQL_PARAM_LOST));
      const { text, isError } = await runSql('SELECT 1 FROM "post-2"');
      expect(isError).toBe(true);
      expect(text).toContain("Valeur manquante");
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    describe("on Workers, where the fetch branch has no axios", () => {
      const lost = () => new Response(JSON.stringify(SQL_PARAM_LOST), { status: 409 });

      function stubFetch(...responses: Response[]) {
        const fetchMock = vi.fn();
        for (const response of responses) fetchMock.mockResolvedValueOnce(response);
        vi.stubGlobal("fetch", fetchMock);
        // makeCkanRequest takes the fetch branch when process.versions.node is absent.
        vi.stubGlobal("process", { ...process, env: process.env, versions: {} });
        return fetchMock;
      }

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it("sends the SQL in a JSON POST body", async () => {
        const fetchMock = stubFetch(lost(), new Response(JSON.stringify(OK), { status: 200 }));
        const { text, isError } = await runSql('SELECT 1 FROM "post-4"');
        expect(isError).toBe(false);
        expect(text).toContain('"n": 1');
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const [getUrl, get] = fetchMock.mock.calls[0];
        expect(get.method).toBe("GET");
        expect(get.body).toBeUndefined();
        expect(new URL(getUrl).searchParams.get("sql")).toBe('SELECT 1 FROM "post-4"');

        const [postUrl, post] = fetchMock.mock.calls[1];
        expect(post.method).toBe("POST");
        expect(new Headers(post.headers).get("Content-Type")).toBe("application/json");
        expect(JSON.parse(post.body)).toEqual({ sql: 'SELECT 1 FROM "post-4"' });
        expect(new URL(postUrl).search).toBe("");
      });

      it("stops after a failed POST", async () => {
        const fetchMock = stubFetch(lost(), lost());
        const { text, isError } = await runSql('SELECT 1 FROM "post-5"');
        expect(isError).toBe(true);
        expect(text).toContain("Valeur manquante");
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    it("does not retry on an SQL error", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      vi.mocked(axios.get).mockRejectedValue(httpFailure(409, { success: false, error: { query: ["syntax error"], __type: "Validation Error" } }));
      const { isError } = await runSql('SELECT 1 FROM "post-3"');
      expect(isError).toBe(true);
      expect(axios.post).not.toHaveBeenCalled();
    });
  });
});
