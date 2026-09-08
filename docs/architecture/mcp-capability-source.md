---
summary: "Issue #190 boundary for importing MCP tool mechanics through Vercel AI SDK while preserving Ember-owned capability identity, authority, effect truth, and canonical state."
read_when:
  - "Adding or changing an MCP capability source, transport, server configuration, or MCP tool mapping"
  - "Reasoning about MCP discovery, trust, authority, retries, cancellation, disconnects, or tool-result evidence"
  - "Replacing @ai-sdk/mcp while preserving Ember capability semantics"
role: design
discovery_status: current
---

# MCP Capability Source Boundary

## Proven boundary

Issue [#190](https://github.com/arhor/ember/issues/190) adds MCP as a capability
source beneath the execution firewall introduced by issue #189. The resulting path
is deliberately asymmetric:

```text
trusted local stdio configuration
    -> @ai-sdk/mcp client + stdio transport
    -> MCP connection / initialization / tools/list
    -> operational McpDiscoveredTool descriptions
    -> explicit Ember mapping policy
         source tool name -> Ember CapabilityBinding name + description
         Ember authority decision
         Ember semantic input policy
    -> selected CapabilityBinding values
    -> existing Ember capability execution firewall
    -> @ai-sdk/mcp callTool
    -> bounded Ember capability evidence
    -> existing AI SDK cognition loop
```

MCP supplies protocol mechanics and a discoverable technical surface. It does not
supply Ember identity, capability authority, approval semantics, memory, continuity,
or canonical state.

## Package and runtime decision

The first implementation pins `@ai-sdk/mcp` at `2.0.45` beside the already pinned
`ai@7.0.93`. The package declares Node.js 22 or newer; Ember continues to run and
validate on its Node.js 26.8.1 / TypeScript 7.0.2 baseline.

`openAiSdkMcpStdioCapabilitySource` uses the package's `createMCPClient` and
`Experimental_StdioMCPTransport`. Tool-call retries are explicitly configured as
`maxRetries: 0` even though that is also the package default. Initialization,
discovery/tool requests, and close observation all have finite bounds.

No remote HTTP/SSE, OAuth, hosted MCP registry, or generic plugin marketplace is
introduced by this slice.

## Configuration and trust boundary

The production adapter accepts an explicit local stdio command, argument vector,
working directory, environment map, and human-readable operational label. Whoever
constructs this configuration is responsible for trusting the executable being
launched. MCP server instructions, server names, session identifiers, and advertised
tool descriptions are not treated as authority or canonical Ember facts.

Discovery returns `McpDiscoveredTool`, an operational description containing only the
source tool name, source description, and JSON input schema. A source tool is not
model-visible merely because discovery found it. The caller must map a particular
source tool into an Ember-owned `McpCapabilityPolicy` with a separate Ember capability
name, model-visible description, authority function, and optional semantic argument
validator. Only the resulting `CapabilityBinding` values explicitly selected for a
cognition can reach the model.

This also prevents the MCP server's own description text from silently becoming the
trusted Ember capability descriptor. The server advertises mechanics; Ember decides
what that reachable mechanism means in the current context.

## Failure and effect truth

The adapter keeps protocol/lifecycle failure distinct from effect evidence:

| Observation                                              | Ember-facing interpretation                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| connection or initialization failure                     | `McpCapabilitySourceError` before a capability exists                    |
| `tools/list` discovery failure                           | `McpCapabilitySourceError` with `phase = discovery`; no tool attempt     |
| authority denial / approval requirement                  | firewall evidence; MCP `tools/call` is never invoked                     |
| semantic input rejection                                 | firewall evidence; MCP `tools/call` is never invoked                     |
| source already closed before submission                  | attempted executor entry, `failed`, retry `safe`, no remote effect began |
| MCP result with `isError = true`                         | observed `failed` capability attempt, retry `unsafe`                     |
| timeout or disconnect after `callTool` submission begins | `outcome_unknown`, retry `unsafe`                                        |
| valid successful MCP result                              | normalized JSON/text and then the existing 8 KiB capability-output bound |

The conservative post-submission rule is intentional. A transport timeout or closed
stdio pipe proves that Ember lacks a trustworthy terminal result; it does not prove
that the server failed to perform the requested effect. The adapter therefore raises
an Ember-owned `CapabilityExecutionFailure` with `effectState = unknown`, which the
#189 firewall turns into uncertainty evidence rather than false failure certainty.

Conversely, when the source is known closed before request submission, the adapter can
truthfully say no remote effect began. That distinct `effectState = not_started`
allows safe-retry evidence while the per-cognition occurrence policy still prevents
silent duplicate execution inside the same cognition.

## Result and state boundary

Raw MCP `CallToolResult`, JSON-RPC request IDs, server/session metadata, AI SDK MCP
tool objects, and transport objects never cross the adapter as Ember domain types.
Successful results are normalized into Ember's existing `CapabilityJsonValue` shape:
structured JSON when available plus text content when present. Opaque MCP metadata and
media payloads are not promoted by this minimal adapter.

The normalized value still passes through the #189 output bound and becomes only
operational cognition evidence. It is not automatically canonical meaning or proof of
external truth. The final provider result remains subject to Ember's existing
`validateProviderResult` provenance checks.

The deterministic acceptance path verifies that MCP source tool names, MCP/AI SDK
call identifiers, provider identifiers, and `CapabilityExecutionEvidence` do not enter
canonical state.

## Lifecycle and deterministic fixture

`tests/fixtures/mcp-server.ts` is a tiny repository-owned stdio JSON-RPC fixture. It is
not another MCP framework dependency. It supports only the protocol messages needed
to exercise initialization, tool discovery, invocation, explicit tool failure,
timeout, disconnect, and shutdown.

The stdio transport is wrapped only to observe process closure. `close()` does not
claim cleanup merely because an abort signal was sent; it waits for the transport's
close event within a finite bound. Tests assert the fixture's shutdown marker is
written before the source close promise resolves.

## Replacement path

`@ai-sdk/mcp` remains replaceable because no public Ember capability contract depends
on its `MCPClient`, `Tool`, JSON-RPC, transport, session, or result types. A replacement
adapter needs only to:

1. discover a mechanical source description;
2. let Ember explicitly map/select it into `CapabilityBinding` values;
3. invoke the remote mechanism inside the existing firewall executor;
4. classify pre-effect failure, observed failure, and post-submission uncertainty
   truthfully; and
5. return bounded `CapabilityJsonValue` output while keeping protocol state
   operational.

MCP resources, prompts, sampling, elicitation, remote auth, durable session reuse,
generic capability registries, and provider migration are intentionally outside this
slice.
