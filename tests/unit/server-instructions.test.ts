import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, HOSTED_ENDPOINT_INSTRUCTIONS } from "../../src/server.js";

async function instructionsOf(server: ReturnType<typeof createServer>) {
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client.getInstructions();
}

describe("server instructions", () => {
  it("default server (stdio, Node HTTP) sends none", async () => {
    expect(await instructionsOf(createServer())).toBeUndefined();
  });

  it("hosted endpoint sends the fair-use instructions", async () => {
    const text = await instructionsOf(createServer({ instructions: HOSTED_ENDPOINT_INSTRUCTIONS }));
    expect(text).toBe(HOSTED_ENDPOINT_INSTRUCTIONS);
    expect(text).toContain("Do not use it for bulk work");
  });
});
