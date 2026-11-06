import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerPackageTools } from "../../src/tools/package.js";
import { __resetSchemaCacheForTests } from "../../src/utils/scheming.js";

vi.mock("axios");

const SCHEMA = {
  dataset_fields: [
    { field_name: "title_translated", label: "Title" },
    { field_name: "keywords", label: { en: "Keywords", fr: "Mots-clés" } },
    { field_name: "author_email", label: "Author email" },
    { field_name: "access_rights", label: "Access rights" },
    { field_name: "temporal_coverage", label: "Temporal coverage" },
    { field_name: "internal_note", label: "Internal note", display_snippet: null }
  ]
};

const PKG = {
  id: "p1", name: "p1", title: "Air", type: "showcase", state: "active",
  author_email: "a@example.org", access_rights: "public",
  keywords: { en: ["air"], fr: ["air"] },
  temporal_coverage: [{ temporal_start: "2020-01-01", temporal_end: "2020-12-31" }],
  internal_note: "hidden",
  resources: [], tags: [], groups: []
};

let calls: string[];

function portal(opts: { schema?: unknown; schemaStatus?: number; pkg?: object }) {
  calls = [];
  vi.mocked(axios.get).mockImplementation(async (url: string, config?: any) => {
    const where = `${url} ${JSON.stringify(config?.params ?? {})}`;
    calls.push(where);
    if (where.includes("scheming_dataset_schema_show")) {
      if (opts.schema) return { data: { success: true, result: opts.schema } };
      throw Object.assign(new Error("fail"), { isAxiosError: true, response: { status: opts.schemaStatus ?? 400, data: { success: false, error: { message: "Action name not known" } } } });
    }
    return { data: { success: true, result: opts.pkg ?? PKG } };
  });
}

async function show(server: string, format: "json" | "markdown") {
  const mcp = new McpServer({ name: "test", version: "0.0.0" });
  registerPackageTools(mcp);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([mcp.connect(b), client.connect(a)]);
  const res: any = await client.callTool({ name: "ckan_package_show", arguments: { server_url: server, id: "p1", response_format: format } });
  return res.content[0].text as string;
}

describe("ckan_package_show with a scheming portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSchemaCacheForTests();
  });

  it("asks for the schema of the dataset's own type", async () => {
    portal({ schema: SCHEMA });
    await show("https://scheming-type.example.org", "json");
    expect(calls.find((c) => c.includes("scheming_dataset_schema_show"))).toContain("showcase");
  });

  it("adds `fields` to JSON, with what JSON does not carry and without what it does", async () => {
    portal({ schema: SCHEMA });
    const out = JSON.parse(await show("https://scheming-json.example.org", "json"));
    const names = out.fields.map((f: { field: string }) => f.field);
    // JSON has no author_email or access_rights; it does carry a temporal_coverage period
    expect(names).toEqual(["keywords", "author_email", "access_rights"]);
    expect(out.fields[0]).toEqual({ field: "keywords", label: "Keywords", value: { en: ["air"], fr: ["air"] } });
    expect(out.temporal_coverage).toHaveLength(1);
  });

  it("adds a section to Markdown, without what Markdown already shows", async () => {
    portal({ schema: SCHEMA });
    const md = await show("https://scheming-md.example.org", "markdown");
    const section = md.slice(md.indexOf("## Fields (from the portal's metadata schema)"));
    expect(section).toContain("**Keywords** (`keywords`)");
    // Markdown shows author_email and access_rights in Basic Information already
    expect(section).not.toContain("author_email");
    expect(section).not.toContain("access_rights");
    expect(md.match(/Access Rights/g)).toHaveLength(1);
  });

  it("does not hide a schema field the output cannot show (a period it cannot parse)", async () => {
    portal({ schema: SCHEMA, pkg: { ...PKG, temporal_coverage: [{ start: "2020-01-01", end: "2020-12-31" }] } });
    const out = JSON.parse(await show("https://scheming-period.example.org", "json"));
    expect(out.temporal_coverage).toEqual([]);
    expect(out.fields.map((f: { field: string }) => f.field)).toContain("temporal_coverage");
  });

  it("does not hide a structured access_rights that Markdown cannot show", async () => {
    portal({ schema: SCHEMA, pkg: { ...PKG, access_rights: { en: "Restricted", fr: "Restreint" } } });
    const md = await show("https://scheming-rights.example.org", "markdown");
    const section = md.slice(md.indexOf("## Fields (from the portal's metadata schema)"));
    expect(section).toContain("Restricted");
  });

  it.each([400, 404])("leaves the output as it was on a portal that answers %i, with no error", async (status) => {
    portal({ schemaStatus: status });
    const text = await show(`https://no-scheming-${status}.example.org`, "json");
    const out = JSON.parse(text);
    expect(out.id).toBe("p1");
    expect(out).not.toHaveProperty("fields");
  });

  it("survives a schema with a malformed entry", async () => {
    portal({ schema: { dataset_fields: [null, 5, { field_name: "keywords", label: "Keywords" }] } });
    const out = JSON.parse(await show("https://scheming-bad.example.org", "json"));
    expect(out.fields.map((f: { field: string }) => f.field)).toEqual(["keywords"]);
  });
});
