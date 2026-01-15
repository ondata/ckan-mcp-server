import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerFormatDatasetsResource,
  registerGroupDatasetsResource,
  registerOrganizationDatasetsResource,
  registerTagDatasetsResource
} from "../../src/resources/dataset-filters.js";
import { makeCkanRequest } from "../../src/utils/http.js";

vi.mock("../../src/utils/http.js", () => ({
  makeCkanRequest: vi.fn()
}));

type ResourceHandler = (
  uri: URL,
  variables: Record<string, string>
) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

const getHandler = (registerFn: (server: any) => void): ResourceHandler => {
  let handler: ResourceHandler | undefined;
  const server = {
    registerResource: vi.fn((_name: string, _template: unknown, _meta: unknown, fn: ResourceHandler) => {
      handler = fn;
    })
  };

  registerFn(server);

  if (!handler) {
    throw new Error("Resource handler was not registered");
  }

  return handler;
};

describe("dataset filter resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases = [
    {
      label: "group",
      register: registerGroupDatasetsResource,
      uri: "ckan://demo.ckan.org/group/ambiente/datasets",
      variables: { name: "ambiente" },
      expectedFq: 'groups:"ambiente"'
    },
    {
      label: "organization",
      register: registerOrganizationDatasetsResource,
      uri: "ckan://demo.ckan.org/organization/regione-toscana/datasets",
      variables: { name: "regione-toscana" },
      expectedFq: 'organization:"regione-toscana"'
    },
    {
      label: "tag",
      register: registerTagDatasetsResource,
      uri: "ckan://demo.ckan.org/tag/turismo/datasets",
      variables: { name: "turismo" },
      expectedFq: 'tags:"turismo"'
    },
    {
      label: "format",
      register: registerFormatDatasetsResource,
      uri: "ckan://demo.ckan.org/format/csv/datasets",
      variables: { format: "csv" },
      expectedFq: '(res_format:"csv" OR res_format:"CSV" OR distribution_format:"csv" OR distribution_format:"CSV")'
    }
  ];

  it.each(cases)("builds package_search fq for $label", async ({ register, uri, variables, expectedFq }) => {
    vi.mocked(makeCkanRequest).mockResolvedValueOnce({ count: 1, results: [] });
    const handler = getHandler(register);

    const response = await handler(new URL(uri), variables);

    expect(makeCkanRequest).toHaveBeenCalledWith("https://demo.ckan.org", "package_search", {
      q: "*:*",
      fq: expectedFq
    });
    expect(response.contents[0].mimeType).toBe("application/json");
    expect(JSON.parse(response.contents[0].text)).toEqual({ count: 1, results: [] });
  });

  it("escapes quotes in filter values", async () => {
    vi.mocked(makeCkanRequest).mockResolvedValueOnce({ count: 0, results: [] });
    const handler = getHandler(registerTagDatasetsResource);

    await handler(new URL("ckan://demo.ckan.org/tag/data\"set/datasets"), { name: "data\"set" });

    expect(makeCkanRequest).toHaveBeenCalledWith("https://demo.ckan.org", "package_search", {
      q: "*:*",
      fq: 'tags:"data\\"set"'
    });
  });

  it("returns text error on failure", async () => {
    vi.mocked(makeCkanRequest).mockRejectedValueOnce(new Error("boom"));
    const handler = getHandler(registerGroupDatasetsResource);

    const response = await handler(new URL("ckan://demo.ckan.org/group/test/datasets"), { name: "test" });

    expect(response.contents[0].mimeType).toBe("text/plain");
    expect(response.contents[0].text).toContain("Error fetching datasets: boom");
  });
});
