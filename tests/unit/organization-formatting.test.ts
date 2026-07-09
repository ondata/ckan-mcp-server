import { describe, it, expect } from "vitest";
import orgShowFixture from "../fixtures/responses/organization-show-success.json";
import { formatOrganizationShowMarkdown } from "../../src/tools/organization";

const SERVER = "https://www.dati.gov.it/opendata";

describe("formatOrganizationShowMarkdown", () => {
  const result = orgShowFixture.result;

  it("includes org title as heading", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain("# Organization: Example Organization");
  });

  it("includes server URL", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain(`**Server**: ${SERVER}`);
  });

  it("renders ## Details with ID, name, datasets", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain("## Details");
    expect(md).toContain("**ID**: `org-1`");
    expect(md).toContain("**Name**: `example-org`");
    expect(md).toContain("**Datasets**: 25");
  });

  it("renders ## Description when present", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain("## Description");
    expect(md).toContain("example organization");
  });

  it("wraps description as untrusted content (GHSA-c499)", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain("untrusted content from the data portal");
    expect(md).toContain("```text");
  });

  it("renders ## Users section", () => {
    const md = formatOrganizationShowMarkdown(result, SERVER);
    expect(md).toContain("## Users");
    expect(md).toContain("john_doe");
    expect(md).toContain("admin");
  });

  it("uses org name as title when title is absent", () => {
    const noTitle = { ...result, title: undefined };
    const md = formatOrganizationShowMarkdown(noTitle, SERVER);
    expect(md).toContain("# Organization: example-org");
  });

  it("renders datasets section with count clarity", () => {
    const withPackages = {
      ...result,
      package_count: 186,
      packages: Array.from({ length: 50 }, (_, i) => ({ name: `pkg-${i}`, title: `Package ${i}` }))
    };
    const md = formatOrganizationShowMarkdown(withPackages, SERVER);
    expect(md).toContain("showing 20 of 50 returned");
    expect(md).toContain("186 total");
  });
});
