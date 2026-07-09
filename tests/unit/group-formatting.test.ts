import { describe, it, expect } from "vitest";
import groupShowFixture from "../fixtures/responses/group-show-success.json";
import { formatGroupShowMarkdown } from "../../src/tools/group";

const SERVER = "https://www.dati.gov.it/opendata";

describe("formatGroupShowMarkdown", () => {
  const result = groupShowFixture.result;

  it("includes group title as heading", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain("# Group: Environment");
  });

  it("includes server URL and link", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain(`**Server**: ${SERVER}`);
    expect(md).toContain("/group/environment");
  });

  it("renders ## Details with ID, name, datasets", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain("## Details");
    expect(md).toContain("**ID**: `group-1`");
    expect(md).toContain("**Name**: `environment`");
    expect(md).toContain("**Datasets**: 12");
  });

  it("renders ## Description when present", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain("## Description");
    expect(md).toContain("Environmental datasets");
  });

  it("wraps description as untrusted content (GHSA-c499)", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain("untrusted content from the data portal");
    expect(md).toContain("```text");
  });

  it("renders ## Datasets list with count clarity", () => {
    const md = formatGroupShowMarkdown(result, SERVER);
    expect(md).toContain("showing 2 of 2 returned");
    expect(md).toContain("12 total");
    expect(md).toContain("Example Dataset");
    expect(md).toContain("Another Dataset");
  });

  it("uses group name as title when title is absent", () => {
    const noTitle = { ...result, title: undefined };
    const md = formatGroupShowMarkdown(noTitle, SERVER);
    expect(md).toContain("# Group: environment");
  });
});
