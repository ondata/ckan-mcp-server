import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import axios from "axios";
import { makeCkanRequest } from "../../src/utils/http.js";
import { __resetCacheForTests } from "../../src/utils/cache.js";
import searchResponse from "../fixtures/responses/package-search-success.json";
import echoingFailure from "../fixtures/errors/success-false-echo.json";

vi.mock("axios");

const SERVER = "https://www.dati.gov.it/opendata";
// Every parameter the audit line knows about; q, fq, sql and id carry what a user typed.
const PARAMS = {
  q: "private search text",
  fq: "organization:private-filter",
  sql: 'SELECT * FROM "private-table"',
  id: "private-dataset-id",
  rows: 5,
  limit: 10
};
const FULL_KEYS = ["ts", "server", "action", "cache_hit", "q", "fq", "sql", "id", "rows", "limit"];
const MINIMAL_KEYS = ["ts", "server", "action", "cache_hit", "rows", "limit"];

describe("CKAN_AUDIT_LOG", () => {
  const origAuditLog = process.env.CKAN_AUDIT_LOG;
  const origCache = process.env.CKAN_CACHE_ENABLED;
  let writeSpy: MockInstance<typeof process.stderr.write>;

  const writtenLines = (): string[] => writeSpy.mock.calls.map(call => String(call[0]));

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCacheForTests();
    delete process.env.CKAN_AUDIT_LOG;
    delete process.env.CKAN_CACHE_ENABLED;
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    if (origAuditLog === undefined) delete process.env.CKAN_AUDIT_LOG; else process.env.CKAN_AUDIT_LOG = origAuditLog;
    if (origCache === undefined) delete process.env.CKAN_CACHE_ENABLED; else process.env.CKAN_CACHE_ENABLED = origCache;
  });

  describe("audit line", () => {
    const auditLine = async (): Promise<Record<string, unknown>> => {
      vi.mocked(axios.get).mockResolvedValue({ data: searchResponse });
      await makeCkanRequest(SERVER, "package_search", PARAMS);
      expect(writeSpy).toHaveBeenCalledOnce();
      return JSON.parse(writtenLines()[0]) as Record<string, unknown>;
    };

    it("unset: writes every field, in the same order as before", async () => {
      // Arrange: CKAN_AUDIT_LOG is unset by beforeEach

      // Act
      const log = await auditLine();

      // Assert
      expect(Object.keys(log)).toEqual(FULL_KEYS);
      expect(log).toMatchObject({ server: SERVER, action: "package_search", cache_hit: false, ...PARAMS });
    });

    it("full: writes every field, in the same order as before", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "full";

      // Act
      const log = await auditLine();

      // Assert
      expect(Object.keys(log)).toEqual(FULL_KEYS);
      expect(log).toMatchObject({ server: SERVER, action: "package_search", cache_hit: false, ...PARAMS });
    });

    it("minimal: keeps ts, server, action, cache_hit, rows and limit; drops q, fq, sql and id", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "minimal";

      // Act
      const log = await auditLine();

      // Assert
      expect(Object.keys(log)).toEqual(MINIMAL_KEYS);
      expect(log).toMatchObject({ server: SERVER, action: "package_search", cache_hit: false, rows: 5, limit: 10 });
      expect(writtenLines()[0]).not.toContain("private");
    });

    it("off: writes no audit line", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "off";
      vi.mocked(axios.get).mockResolvedValue({ data: searchResponse });

      // Act
      await makeCkanRequest(SERVER, "package_search", PARAMS);

      // Assert
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("minimal and off apply to cache hits too", async () => {
      // Arrange: first call fills the cache
      process.env.CKAN_CACHE_ENABLED = "true";
      vi.mocked(axios.get).mockResolvedValue({ data: searchResponse });
      await makeCkanRequest(SERVER, "package_search", PARAMS);
      writeSpy.mockClear();

      // Act
      process.env.CKAN_AUDIT_LOG = "minimal";
      await makeCkanRequest(SERVER, "package_search", PARAMS);
      process.env.CKAN_AUDIT_LOG = "off";
      await makeCkanRequest(SERVER, "package_search", PARAMS);

      // Assert: one line, from the minimal call, with cache_hit=true
      expect(axios.get).toHaveBeenCalledOnce();
      expect(writeSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(writtenLines()[0]) as Record<string, unknown>;
      expect(Object.keys(log)).toEqual(MINIMAL_KEYS);
      expect(log.cache_hit).toBe(true);
    });

    it("an unknown value is treated as full", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "verbose";

      // Act
      const log = await auditLine();

      // Assert
      expect(Object.keys(log)).toEqual(FULL_KEYS);
    });
  });

  describe("success=false line", () => {
    const failingCall = async (): Promise<void> => {
      vi.mocked(axios.get).mockResolvedValue({ data: echoingFailure });
      await expect(makeCkanRequest(SERVER, "package_search", PARAMS))
        .rejects.toThrow('CKAN API returned success=false for action "package_search".');
    };
    const fullLine = `[ckan] success=false action=package_search: ${JSON.stringify(echoingFailure).slice(0, 500)}\n`;

    it("unset: writes the action and the portal's response, as before", async () => {
      // Arrange: CKAN_AUDIT_LOG is unset by beforeEach

      // Act
      await failingCall();

      // Assert
      expect(writtenLines()).toEqual([fullLine]);
      expect(fullLine).toContain("private search text");
    });

    it("full: writes the action and the portal's response, as before", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "full";

      // Act
      await failingCall();

      // Assert
      expect(writtenLines()).toEqual([fullLine]);
    });

    it("minimal: writes only the action", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "minimal";

      // Act
      await failingCall();

      // Assert
      expect(writtenLines()).toEqual(["[ckan] success=false action=package_search\n"]);
    });

    it("off: writes nothing", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "off";

      // Act
      await failingCall();

      // Assert
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe("server URL", () => {
    // Userinfo, a query and a fragment: each can carry what the user typed.
    const DIRTY_SERVER = "https://user:pass@www.dati.gov.it/opendata?q=segreto#x";

    it("minimal: every line logs the server as origin plus path only", async () => {
      // Arrange
      process.env.CKAN_AUDIT_LOG = "minimal";
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: searchResponse })
        .mockResolvedValueOnce({ data: echoingFailure });

      // Act: one call that succeeds (audit line), one that fails (success=false line)
      await makeCkanRequest(DIRTY_SERVER, "package_search", PARAMS);
      await expect(makeCkanRequest(DIRTY_SERVER, "package_search", PARAMS)).rejects.toThrow("success=false");

      // Assert
      const lines = writtenLines();
      expect(lines).toHaveLength(2);
      expect((JSON.parse(lines[0]) as Record<string, unknown>).server).toBe("https://www.dati.gov.it/opendata");
      expect(lines[1]).toBe("[ckan] success=false action=package_search\n");
      for (const line of lines) expect(line).not.toMatch(/user|pass|segreto|#x/);
    });

    it("full: logs the server URL as given, as before", async () => {
      // Arrange: CKAN_AUDIT_LOG is unset by beforeEach
      vi.mocked(axios.get).mockResolvedValue({ data: searchResponse });

      // Act
      await makeCkanRequest(DIRTY_SERVER, "package_search", PARAMS);

      // Assert
      const log = JSON.parse(writtenLines()[0]) as Record<string, unknown>;
      expect(Object.keys(log)).toEqual(FULL_KEYS);
      expect(log.server).toBe(DIRTY_SERVER);
    });
  });
});
