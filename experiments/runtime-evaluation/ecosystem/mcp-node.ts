import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert/strict";

const server = new Server({ name: "ember-runtime-evaluation", version: "0.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{ name: "probe", description: "Ember evaluation boundary", inputSchema: { type: "object" } }],
}));
const client = new Client({ name: "ember-runtime-evaluation-client", version: "0.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);
const result = await client.listTools();
assert.equal(result.tools.length, 1);
assert.equal(result.tools[0]?.name, "probe");
await client.close();
await server.close();
console.log(
    JSON.stringify({
        package: "@modelcontextprotocol/sdk",
        version: "1.30.0",
        mechanism: "npm dependency + bare ESM imports",
        tool_count: result.tools.length,
    }),
);
