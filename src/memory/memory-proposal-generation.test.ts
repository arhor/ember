import { APICallError } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProjectedConversationContext } from "../core/conversation-context.ts";
import type { MemoryProposalCandidate } from "../core/memory-proposal.ts";

import { ProviderError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
import { userEvidence } from "../core/semantics.ts";
import { MemoryProposalGenerationStore } from "../persistence/memory-proposal-generation-store.ts";
import { StateStore } from "../persistence/state-store.ts";
import { runCognition, startRuntime } from "../runtime/runtime.ts";
import { cloneState } from "../util.ts";
import {
    createAiSdkMemoryProposalGenerator,
    generateAndAdoptConversationMemories,
} from "./memory-proposal-generation.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";
const AT = "2026-09-11T10:00:00Z";

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-memory-generation-"));
    const store = new StateStore(join(directory, "ember.json"));
    const state = initialState("Ember", PRINCIPAL, "2026-09-11T09:00:00Z");
    userEvidence(state, PRINCIPAL, SCOPE, "I prefer concise answers", { timestamp: AT });
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const evidence = state.evidence[0]!;
    const conversation: ProjectedConversationContext = {
        context_version: 2,
        conversation_id: "conversation-test",
        turns: [
            {
                order: 0,
                role: "user",
                cognition_id: "cognition-test" as never,
                evidence_id: evidence.evidenceId,
                source_surface: "cli",
                occurred_at: AT,
                content: "I prefer concise answers",
                content_truncated: false,
                in_reply_to_evidence_id: null,
                delivery_status: null,
                user_awareness: null,
            },
        ],
        selection: {
            strategy: "recent_same_conversation_v2",
            membership: { action: "continued", basis: "ordinary_adjacency" },
            max_exchanges: 4,
            max_turn_bytes: 4096,
            selected_cognition_ids: ["cognition-test" as never],
            selected_evidence_ids: [evidence.evidenceId],
            excluded_older_exchange_count: 0,
            excluded_unavailable_exchange_count: 0,
            unavailable_expression_count: 0,
            truncated_turn_count: 0,
        },
    };
    return { directory, store, lease, state, evidence, conversation };
}

function proposal(evidenceId: string): MemoryProposalCandidate {
    return {
        proposal_version: 1,
        proposal_id: "memory-proposal-concise",
        proposed_at: AT,
        kind: "preference",
        owner: `user:${PRINCIPAL}`,
        slot: "response-verbosity",
        scope: SCOPE,
        content: "Prefers concise answers",
        source_evidence_ids: [evidenceId as never],
        epistemic_role: "user_testimony",
        applicable_from: AT,
        applicable_until: null,
        proposed_currentness: "current",
        confidence: { source: "high", proposition: "high", interpretation: "high" },
        uncertainty: null,
        supersedes_meaning_id: null,
    };
}

async function cleanup(f: Awaited<ReturnType<typeof fixture>>) {
    await f.store.releaseWriteLease(f.lease).catch(() => {});
    await rm(f.directory, { recursive: true, force: true });
}

test("ordinary conversation should generate, validate, adopt, and persist a grounded memory proposal", async () => {
    const f = await fixture();
    try {
        const result = await generateAndAdoptConversationMemories(f.store, f.state, f.conversation, {
            principal: PRINCIPAL,
            scope: SCOPE,
            timestamp: AT,
            providerLabel: "fixture",
            generator: async (request) => {
                assert.deepEqual(request.projection.selection.source_evidence_ids, [f.evidence.evidenceId]);
                assert.equal(request.projection.turns[0]?.content, "I prefer concise answers");
                return { contractVersion: 1, candidates: [proposal(f.evidence.evidenceId)] };
            },
        });

        assert.equal(result.outcomes[0]?.status, "adopted");
        assert.equal(result.state.meanings.length, 1);
        assert.deepEqual(result.state.meanings[0]?.sourceEvidenceIds, [f.evidence.evidenceId]);
        const ledger = await new MemoryProposalGenerationStore(f.store.path).load();
        assert.equal(ledger.generations[0]?.status, "completed");
        assert.equal(ledger.generations[0]?.outcomes[0]?.status, "adopted");
        assert.equal(JSON.stringify(ledger).includes("I prefer concise answers"), false);
    } finally {
        await cleanup(f);
    }
});

test("an empty structured result should persist as completion rather than provider failure", async () => {
    const f = await fixture();
    try {
        const result = await generateAndAdoptConversationMemories(f.store, f.state, f.conversation, {
            principal: PRINCIPAL,
            scope: SCOPE,
            timestamp: AT,
            generator: async () => ({ contractVersion: 1, candidates: [] }),
        });
        assert.deepEqual(result.outcomes, []);
        assert.equal(result.state.meanings.length, 0);
        const ledger = await new MemoryProposalGenerationStore(f.store.path).load();
        assert.deepEqual([ledger.generations[0]?.status, ledger.generations[0]?.outcomes.length], ["completed", 0]);
    } finally {
        await cleanup(f);
    }
});

test("AI SDK provider failure should remain distinct from no proposal and avoid implicit retry", async () => {
    const f = await fixture();
    let calls = 0;
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            calls += 1;
            throw new APICallError({
                message: "secret provider detail",
                url: "https://provider.invalid",
                requestBodyValues: { secret: true },
                statusCode: 503,
                responseBody: "secret response",
                isRetryable: true,
            });
        },
    });
    try {
        await assert.rejects(
            generateAndAdoptConversationMemories(f.store, f.state, f.conversation, {
                principal: PRINCIPAL,
                scope: SCOPE,
                timestamp: AT,
                generator: createAiSdkMemoryProposalGenerator(model),
            }),
            (error) => error instanceof ProviderError && /HTTP 503/.test(error.message),
        );
        assert.equal(calls, 1);
        const ledger = await new MemoryProposalGenerationStore(f.store.path).load();
        assert.equal(ledger.generations[0]?.status, "failed");
        assert.equal(ledger.generations[0]?.failure?.includes("secret"), false);
    } finally {
        await cleanup(f);
    }
});

test("malformed SDK-independent candidates should persist as invalid instead of stranding generation", async () => {
    const f = await fixture();
    try {
        const result = await generateAndAdoptConversationMemories(f.store, f.state, f.conversation, {
            principal: PRINCIPAL,
            scope: SCOPE,
            timestamp: AT,
            generator: async () => ({ contractVersion: 1, candidates: [{ content: "missing fields" }] }),
        });
        assert.equal(result.outcomes[0]?.status, "invalid");
        const ledger = await new MemoryProposalGenerationStore(f.store.path).load();
        assert.deepEqual(
            [ledger.generations[0]?.status, ledger.generations[0]?.outcomes[0]?.status],
            ["completed", "invalid"],
        );
    } finally {
        await cleanup(f);
    }
});

test("post-generation stale revision should terminalize with established earlier adoption outcomes", async () => {
    const f = await fixture();
    const originalLoad = f.store.load.bind(f.store);
    let adoptionChecks = 0;
    f.store.load = async () => {
        const loaded = await originalLoad();
        adoptionChecks += 1;
        if (adoptionChecks === 3) {
            const stale = cloneState(loaded);
            stale.revision += 1;
            return stale;
        }
        return loaded;
    };
    const second = { ...proposal(f.evidence.evidenceId), slot: "response-format", content: "Prefers plain text" };
    try {
        await assert.rejects(
            generateAndAdoptConversationMemories(f.store, f.state, f.conversation, {
                principal: PRINCIPAL,
                scope: SCOPE,
                timestamp: AT,
                generator: async () => ({
                    contractVersion: 1,
                    candidates: [proposal(f.evidence.evidenceId), second],
                }),
            }),
            /canonical revision changed/,
        );
        const ledger = await new MemoryProposalGenerationStore(f.store.path).load();
        assert.equal(ledger.generations[0]?.status, "outcome_unknown");
        assert.equal(ledger.generations[0]?.outcomes[0]?.status, "adopted");
        assert.equal(ledger.generations[0]?.outcomes.length, 1);
        assert.equal((await originalLoad()).meanings.length, 1);
    } finally {
        await cleanup(f);
    }
});

test("ordinary runCognition should invoke configured reflection after persisting the exchange", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-memory-cognition-"));
    const store = new StateStore(join(directory, "ember.json"));
    let state = initialState("Ember", PRINCIPAL, "2026-09-11T09:00:00Z");
    await store.create(state);
    const lease = await store.acquireWriteLease();
    try {
        const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-11T09:30:00Z" });
        state = await store.commit(state.revision, started.state);
        const result = await runCognition(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "I prefer concise answers",
            providerLabel: "scripted-cognition",
            provider: async () => ({ contractVersion: 1, reply: "Understood.", usedMeaningIds: [] }),
            timeoutSeconds: 10,
            output: () => {},
            memoryProposalProviderLabel: "scripted-reflection",
            memoryProposalGenerator: async (request) => {
                const input = request.projection.turns.find((turn) => turn.role === "user")!;
                assert.equal(input.content, "I prefer concise answers");
                return { contractVersion: 1, candidates: [proposal(input.evidence_id)] };
            },
        });
        assert.equal(result.memoryProposalFailure, null);
        assert.equal(result.state.meanings[0]?.content, "Prefers concise answers");
        assert.equal(result.state.operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
    } finally {
        await store.releaseWriteLease(lease).catch(() => {});
        await rm(directory, { recursive: true, force: true });
    }
});
