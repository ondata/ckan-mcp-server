import { describe, it, expect } from "vitest";
import packageShowFixture from "../fixtures/responses/package-show-success.json";
import { enrichPackageShowResult, formatPackageShowMarkdown } from "../../src/tools/package";

describe("ckan_package_show formatting", () => {
  it("enriches JSON with harvested and endpoint fields", () => {
    const result = packageShowFixture.result as any;
    const enriched = enrichPackageShowResult(result);

    expect(enriched.metadata_harvested_at).toBe(result.metadata_modified);

    const resource1 = enriched.resources.find((resource: any) => resource.id === "res-1");
    const resource2 = enriched.resources.find((resource: any) => resource.id === "res-2");

    expect(resource1.access_service_endpoints).toEqual(["https://api.example.com/data"]);
    expect(resource1.effective_download_url).toBe("http://example.com/resource.csv");
    expect(resource2.effective_download_url).toBe("http://example.com/data.json?download=1");
  });

  it("renders markdown with date labels and effective download URL", () => {
    const result = packageShowFixture.result as any;
    const markdown = formatPackageShowMarkdown(result, "http://demo.ckan.org");

    expect(markdown).toContain("**Issued**: 2023-12-20");
    expect(markdown).toContain("**Modified (Content)**: 2024-01-10");
    expect(markdown).toContain("**Metadata Modified (Record)**: 2024-01-15");
    expect(markdown).toContain("**Access Service Endpoints**: https://api.example.com/data");
    expect(markdown).toContain("**Effective Download URL**: http://example.com/resource.csv");
  });
});
