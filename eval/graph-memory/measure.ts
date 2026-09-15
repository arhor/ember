import { performance } from "node:perf_hooks";

import { populatedState, PRINCIPAL, RELATIONSHIP_SCOPE } from "../../tests/support.ts";
import { buildGraphMemoryPrototype, graphMemoryPrototypeStats } from "./prototype.ts";
import { buildSemanticMemoryExport } from "./semantic-export.ts";

const { state, ids } = populatedState();
const semanticExport = buildSemanticMemoryExport(state, {
    principal: PRINCIPAL,
    activeScope: RELATIONSHIP_SCOPE,
    explainIds: [ids.episode],
});
const fixture = [
    {
        meaningId: ids.episode,
        contextualSummary: "A compact contextual view.",
    },
];
const graph = buildGraphMemoryPrototype(semanticExport, fixture);
const stats = graphMemoryPrototypeStats(graph);

const iterations = 1_000;
const rssBefore = process.memoryUsage().rss;
const startedAt = performance.now();
for (let index = 0; index < iterations; index++) buildGraphMemoryPrototype(semanticExport, fixture);
const elapsedMs = performance.now() - startedAt;
const rssAfter = process.memoryUsage().rss;

console.log(
    JSON.stringify(
        {
            ...stats,
            iterations,
            meanBuildMs: elapsedMs / iterations,
            rssDeltaBytes: rssAfter - rssBefore,
            note: "Latency and RSS delta are directional process measurements; rerun on the target Pi before adoption.",
        },
        null,
        2,
    ),
);
