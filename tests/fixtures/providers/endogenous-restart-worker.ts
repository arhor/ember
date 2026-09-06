#!/usr/bin/env node
import type { EndogenousRestartScenarioKind } from "../../../eval/endogenous-restart/harness.ts";
import type { CognitionOpportunityEvaluator } from "../../../src/agency/cognition-opportunity.ts";
import type { EmberState, MeaningId } from "../../../src/core/model.ts";

import { createCodexOpportunityEvaluator } from "../../../src/agency/codex-opportunity-evaluator.ts";
import { runCognitionOpportunity } from "../../../src/agency/cognition-opportunity.ts";
import { initialState } from "../../../src/core/model.ts";
import { inspectionView } from "../../../src/core/projection.ts";
import { rememberFact, supersede, transitionCommitment, undertake } from "../../../src/core/semantics.ts";
import { StateStore } from "../../../src/persistence/state-store.ts";
import { invokeCodexProvider } from "../../../src/providers/codex.ts";
import { startRuntime, stopRuntime } from "../../../src/runtime/runtime.ts";

const [
    phase,
    kindRaw,
    statePath,
    mode = "fixture",
    codexCommand = "codex",
    timeoutRaw = "120",
    codexArgumentsRaw = "[]",
] = process.argv.slice(2);
const kind = kindRaw as EndogenousRestartScenarioKind;
const codexArguments = parseStringList(codexArgumentsRaw, "Codex arguments");
const PRINCIPAL = "user-1";
const SCOPE = "project:ember/endogenous-restart";
const store = new StateStore(statePath);

const deterministicEvaluator: CognitionOpportunityEvaluator = async (request) => {
    const concern = request.projection.meanings.find(
        (item) => item.kind === "commitment" && item.prospectiveLifecycle === "live",
    );
    const consequence = request.projection.meanings.find(
        (item) => item.slot === "release-window" && item.content === "Release is imminent",
    );
    return concern && consequence
        ? {
              contractVersion: 1,
              decision: "cognition",
              selectedMeaningIds: [concern.meaningId, consequence.meaningId],
          }
        : { contractVersion: 1, decision: "no_cognition", selectedMeaningIds: [] };
};

if (phase === "prepare") {
    let state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    const aliases: Record<string, MeaningId> = {};
    if (kind !== "silence") {
        aliases.concern = undertake(
            state,
            PRINCIPAL,
            "release-preparation",
            SCOPE,
            "Prepare the release notes before release",
        );
        aliases["old-consequence"] = rememberFact(
            state,
            PRINCIPAL,
            `user:${PRINCIPAL}`,
            "release-window",
            SCOPE,
            "Release is imminent",
        );
    }
    if (kind === "resolved")
        transitionCommitment(state, PRINCIPAL, aliases.concern, "fulfilled", "Release notes are complete", {
            timestamp: "2026-09-03T00:01:00Z",
        });
    if (kind === "superseded")
        aliases["current-consequence"] = supersede(
            state,
            PRINCIPAL,
            aliases["old-consequence"],
            "Release is postponed",
        );
    await store.create(state);
    const lease = await store.acquireWriteLease();
    try {
        const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:02:00Z" });
        state = await store.commit(state.revision, started.state);
        state = await store.commit(
            state.revision,
            stopRuntime(state, started.runtimeId, {
                reason: "restart scenario boundary",
                timestamp: "2026-09-03T00:03:00Z",
            }),
        );
        process.stdout.write(
            JSON.stringify({
                lineageId: state.lineage.lineageId,
                runtimeId: started.runtimeId,
                provider_thread_observed: false,
            }),
        );
    } finally {
        await store.releaseWriteLease(lease);
    }
} else if (phase === "restart") {
    const lease = await store.acquireWriteLease();
    try {
        let state = await store.load();
        const aliases = aliasesFor(state);
        const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T00:00:00Z" });
        state = await store.commit(state.revision, started.state);
        let providerThreadObserved = false;
        const evaluator =
            mode === "live"
                ? createCodexOpportunityEvaluator({
                      command: codexCommand,
                      arguments_: codexArguments,
                      timeoutSeconds: Number(timeoutRaw),
                      provider: async (command, arguments_, request, options) => {
                          const providerResult = await invokeCodexProvider(command, arguments_, request, {
                              ...options,
                              thread: { mode: "ephemeral" },
                          });
                          providerThreadObserved = typeof providerResult.operational?.externalThreadId === "string";
                          return providerResult;
                      },
                  })
                : deterministicEvaluator;
        const result = await runCognitionOpportunity(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "runtime_start",
            evaluator,
            timestamp: "2026-09-04T00:00:01Z",
        });
        if (result.evaluatorFailure) throw new Error(result.evaluatorFailure);
        state = result.state;
        const occurrence = state.operations.cognitionOpportunities!.at(-1)!;
        const view = inspectionView(state);
        const oldConsequence = state.meanings.find(
            (item) => item.slot === "release-window" && item.content === "Release is imminent",
        );
        const currentConsequence = state.meanings.find(
            (item) => item.slot === "release-window" && item.content === "Release is postponed",
        );
        process.stdout.write(
            JSON.stringify({
                lineageId: state.lineage.lineageId,
                runtimeId: started.runtimeId,
                decision: occurrence.decision,
                selected_aliases: occurrence.selectedMeaningIds.map((id) => aliases.get(id) ?? "<unaliased>").sort(),
                current_aliases: view.currentMeanings
                    .map((item) => aliases.get(item.meaningId))
                    .filter(Boolean)
                    .sort(),
                historical_aliases: view.historical_meanings
                    .map((item) => aliases.get(item.meaningId))
                    .filter(Boolean)
                    .sort(),
                gapKind: state.operations.runtimeEpisodes.at(-1)!.recoveryAccount.gapKind,
                downtime_cognition:
                    state.operations.runtimeEpisodes.at(-1)!.recoveryAccount.emberCognitionDuringInterval,
                provider_thread_policy: mode === "live" ? "ephemeral" : "deterministic_no_session",
                provider_thread_observed: providerThreadObserved,
                supersession:
                    kind === "superseded" && oldConsequence && currentConsequence
                        ? {
                              old_currentness: oldConsequence.currentness,
                              current_currentness: currentConsequence.currentness,
                              old_superseded_by_alias: aliasFor(aliases, oldConsequence.supersededBy),
                              current_supersedes_alias: aliasFor(aliases, currentConsequence.supersedes),
                          }
                        : undefined,
            }),
        );
    } finally {
        await store.releaseWriteLease(lease);
    }
} else throw new Error("expected prepare or restart phase");

function aliasesFor(state: EmberState) {
    const aliases = new Map<string, string>();
    for (const meaning of state.meanings) {
        if (meaning.kind === "commitment") aliases.set(meaning.meaningId, "concern");
        else if (meaning.slot === "release-window" && meaning.content === "Release is imminent")
            aliases.set(meaning.meaningId, "old-consequence");
        else if (meaning.slot === "release-window") aliases.set(meaning.meaningId, "current-consequence");
    }
    return aliases;
}

function aliasFor(aliases: Map<string, string>, id: string | null) {
    return id === null ? null : (aliases.get(id) ?? "<unaliased>");
}

function parseStringList(raw: string, label: string) {
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch (error) {
        throw new Error(`${label} must be valid JSON`, { cause: error });
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
        throw new Error(`${label} must be a JSON string array`);
    return value;
}
