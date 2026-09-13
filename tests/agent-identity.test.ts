import assert from "node:assert/strict";
import test from "node:test";

import type { EmberState } from "../src/core/model.ts";
import type { ProviderRequest } from "../src/providers/contract.ts";

import {
    agentActor,
    initialState,
    normalizeLegacyIdentityRepresentation,
    validateState,
} from "../src/core/model.ts";
import { rememberInference, supersede, userEvidence } from "../src/core/semantics.ts";
import { buildCodexPrompt } from "../src/providers/codex.ts";
import { buildCursorPrompt } from "../src/providers/cursor.ts";

const PRINCIPAL = "user-1";
const SCOPE = "relationship:user-1";

test("fresh lineage has stable identity without a bootstrap personal name", () => {
    const state = initialState(PRINCIPAL, "2026-09-13T12:00:00Z");

    validateState(state);

    assert.equal("displayName" in state.lineage, false);
    assert.match(state.lineage.lineageId, /^lineage-/);
    assert.equal(agentActor(state.lineage.lineageId), `agent:${state.lineage.lineageId}`);
});

test("preferred-name change preserves lineage and stable agent actor", () => {
    const state = initialState(PRINCIPAL, "2026-09-13T12:00:00Z");
    const lineageId = state.lineage.lineageId;
    const actor = agentActor(lineageId);
    const suggestion = userEvidence(state, PRINCIPAL, SCOPE, "Use Luna as your preferred name");
    const luna = rememberInference(
        state,
        PRINCIPAL,
        "preferred-name",
        SCOPE,
        "Luna",
        [suggestion.evidenceId],
    );

    const chloe = supersede(state, PRINCIPAL, luna, "Chloe", "Preferred self-name changed");
    const oldName = state.meanings.find((meaning) => meaning.meaningId === luna)!;
    const currentName = state.meanings.find((meaning) => meaning.meaningId === chloe)!;

    assert.equal(state.lineage.lineageId, lineageId);
    assert.equal(agentActor(state.lineage.lineageId), actor);
    assert.deepEqual(
        [oldName.owner, oldName.currentness, currentName.owner, currentName.currentness, currentName.content],
        [actor, "superseded", actor, "current", "Chloe"],
    );
});

test("legacy bootstrap display name normalizes without becoming self-memory", () => {
    const current = initialState(PRINCIPAL, "2026-09-13T12:00:00Z");
    const legacy = structuredClone(current) as EmberState & {
        lineage: EmberState["lineage"] & { displayName: string };
    };
    legacy.lineage.displayName = "Ember";
    legacy.lineage.constitutiveBoundaries[0]!.text =
        "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.";

    const normalized = normalizeLegacyIdentityRepresentation(legacy) as EmberState;

    validateState(normalized);
    assert.equal("displayName" in normalized.lineage, false);
    assert.equal(normalized.lineage.lineageId, current.lineage.lineageId);
    assert.equal(normalized.meanings.length, 0);
    assert.equal(legacy.lineage.displayName, "Ember");
});

test("provider prompts are agent-semantic while Ember remains only a protocol namespace", () => {
    const request = {
        contractVersion: 1,
        cognitionId: "cognition-identity-test",
        projection: { selection: { meaning_ids: [] } },
        input: { text: "hello" },
    } as unknown as ProviderRequest;

    for (const prompt of [buildCodexPrompt(request), buildCursorPrompt(request)]) {
        assert.match(prompt, /bounded cognition provider for the continuing agent/);
        assert.match(prompt, /<ember_provider_request>/);
        assert.doesNotMatch(prompt, /provider for Ember|Ember cognition request|own Ember continuity/);
    }
});
