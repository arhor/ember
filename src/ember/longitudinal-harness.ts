import { readFile } from "node:fs/promises";
import { initialState, validateState, type EmberState, type RuntimeId } from "./model.ts";
import type { ProviderRequest, ProviderResult } from "./provider.ts";
import { inspectionView, type Projection } from "./projection.ts";
import { runCognition, startRuntime, stopRuntime } from "./runtime.ts";
import {
  attachDetail,
  rememberEpisode,
  rememberFact,
  rememberPreference,
  rememberRelationship,
  supersede,
  undertake,
  withholdDetail,
} from "./semantics.ts";
import { StateStore } from "./store.ts";

type ThreadControl = { mode: "fresh" } | { mode: "reuse"; episode: string };

type StateAction =
  | { action: "remember_relationship"; as: string; scope: string; text: string; at: string }
  | { action: "remember_fact"; as: string; slot: string; scope: string; text: string; at: string }
  | { action: "remember_preference"; as: string; slot: string; scope: string; text: string; at: string }
  | { action: "undertake"; as: string; slot: string; scope: string; text: string; at: string }
  | { action: "remember_episode"; as: string; slot: string; scope: string; text: string; at: string }
  | { action: "attach_detail"; as: string; episode: string; text: string; at: string }
  | { action: "supersede"; as: string; meaning: string; text: string; reason?: string; at: string }
  | { action: "withhold_detail"; as: string; evidence: string; reason: string; at: string };

export interface LongitudinalScenario {
  scenario_version: 1;
  id: string;
  description: string;
  ember: { name: string; principal: string; initial_at: string };
  setup: StateAction[];
  episodes: Array<{
    id: string;
    at: string;
    scope: string;
    cognition_backend: string;
    restart_ember: boolean;
    external_thread: ThreadControl;
    changes?: StateAction[];
    input: string;
    purpose?: "ordinary" | "explain";
    explain?: string[];
    expect: {
      selected_meanings: string[];
      forbidden_meanings: string[];
      reply_includes?: string[];
      reply_excludes?: string[];
    };
  }>;
}

export interface HarnessProviderInvocation {
  scenarioId: string;
  episodeId: string;
  cognitionBackend: string;
  thread: { mode: "fresh" } | { mode: "reuse"; externalThreadId: string; sourceEpisode: string };
  request: ProviderRequest;
}

export type HarnessProvider = (invocation: HarnessProviderInvocation) => Promise<ProviderResult>;

interface AssertionObservation {
  assertion: string;
  passed: boolean;
  expected: unknown;
  observed: unknown;
}

export interface LongitudinalReport {
  report_version: 1;
  scenario_id: string;
  description: string;
  lineage_id: string;
  ember_assertions_passed: boolean;
  model_observations_passed: boolean;
  episodes: Array<{
    episode_id: string;
    runtime_id: string;
    cognition_backend: string;
    external_thread: HarnessProviderInvocation["thread"];
    provider_thread_id: string | null;
    canonical_before: ReturnType<typeof inspectionView>;
    projection: Projection;
    provider_result: ProviderResult;
    canonical_after: ReturnType<typeof inspectionView>;
    ember_assertions: AssertionObservation[];
    model_observations: AssertionObservation[];
  }>;
}

export async function loadLongitudinalScenario(path: string): Promise<LongitudinalScenario> {
  const candidate: unknown = JSON.parse(await readFile(path, "utf8"));
  validateScenario(candidate);
  return candidate;
}

export async function runLongitudinalScenario(
  scenario: LongitudinalScenario,
  statePath: string,
  provider: HarnessProvider,
): Promise<LongitudinalReport> {
  validateScenario(scenario);
  const aliases = new Map<string, string>();
  let state = initialState(scenario.ember.name, scenario.ember.principal, scenario.ember.initial_at);
  applyActions(state, scenario.setup, scenario.ember.principal, aliases);
  const store = new StateStore(statePath);
  await store.create(state);
  const lease = await store.acquireWriteLease();
  const episodeThreads = new Map<string, string>();
  const reports: LongitudinalReport["episodes"] = [];
  let runtimeId: string | null = null;
  try {
    for (const episode of scenario.episodes) {
      state = await store.load();
      if (episode.changes?.length) {
        const changed = structuredClone(state);
        applyActions(changed, episode.changes, scenario.ember.principal, aliases);
        state = await store.commit(state.revision, changed);
      }
      if (runtimeId === null || episode.restart_ember) {
        if (runtimeId !== null) {
          state = await withFixedTime(episode.at, () => stopRuntime(state, runtimeId!, { reason: `longitudinal_restart_before:${episode.id}` }));
          state = await store.commit((await store.load()).revision, state);
        }
        const started = await withFixedTime(episode.at, () => startRuntime(state, scenario.ember.principal, episode.scope));
        state = await store.commit(state.revision, started.state);
        runtimeId = started.runtimeId;
      }
      const canonicalBefore = inspectionView(state);
      const thread = resolveThread(episode.external_thread, episodeThreads);
      const previouslyObservedThreadIds = new Set(episodeThreads.values());
      let observedRequest: ProviderRequest | null = null;
      let observedResult: ProviderResult | null = null;
      let reply = "";
      const result = await withFixedTime(episode.at, () => runCognition(store, state, {
        runtimeId: runtimeId as RuntimeId,
        principal: scenario.ember.principal,
        scope: episode.scope,
        text: episode.input,
        command: "longitudinal-provider",
        timeoutSeconds: 300,
        purpose: episode.purpose ?? "ordinary",
        explainIds: (episode.explain ?? []).map(alias => requireAlias(aliases, alias)),
        provider: async (_command, _arguments, request) => {
          observedRequest = request;
          observedResult = await provider({ scenarioId: scenario.id, episodeId: episode.id, cognitionBackend: episode.cognition_backend, thread, request });
          return observedResult;
        },
        output: text => { reply += text; },
      }));
      if (result.providerFailure !== null || observedRequest === null || observedResult === null) {
        throw new Error(`episode ${episode.id} provider failed: ${result.providerFailure ?? "no provider evidence"}`);
      }
      state = result.state;
      const providerResult = observedResult as ProviderResult;
      const request = observedRequest as ProviderRequest;
      const providerThreadId = providerResult.operational?.external_thread_id ?? null;
      if (providerThreadId !== null) episodeThreads.set(episode.id, providerThreadId);
      const expectedSelected = episode.expect.selected_meanings.map(alias => requireAlias(aliases, alias)).sort();
      const observedSelected = request.projection.selection.meaning_ids.map(String).sort();
      const forbiddenIds = episode.expect.forbidden_meanings.map(alias => requireAlias(aliases, alias));
      const emberAssertions: AssertionObservation[] = [
        observation("selected meanings", expectedSelected, observedSelected, sameJson(expectedSelected, observedSelected)),
        observation("forbidden meanings absent", [], forbiddenIds.filter(id => observedSelected.includes(id)), forbiddenIds.every(id => !observedSelected.includes(id))),
        observation("lineage remains canonical", canonicalBefore.lineage.lineage_id, request.projection.lineage.lineage_id, canonicalBefore.lineage.lineage_id === request.projection.lineage.lineage_id),
        observation("raw transcript excluded", false, request.projection.selection.raw_transcript_included, request.projection.selection.raw_transcript_included === false),
      ];
      if (thread.mode === "fresh") {
        emberAssertions.push(
          observation("fresh provider thread observed", "non-null thread id", providerThreadId, providerThreadId !== null),
          observation("fresh provider thread is new", "thread id absent from earlier episodes", providerThreadId, providerThreadId !== null && !previouslyObservedThreadIds.has(providerThreadId)),
        );
      }
      if (episode.restart_ember && reports.length > 0) {
        emberAssertions.push(observation("Ember runtime restarted", "different runtime id", runtimeId, reports.at(-1)!.runtime_id !== runtimeId));
      }
      if (thread.mode === "reuse") {
        emberAssertions.push(observation("provider thread explicitly reused", thread.externalThreadId, providerThreadId, providerThreadId === thread.externalThreadId));
      }
      const modelObservations = [
        ...(episode.expect.reply_includes ?? []).map(text => observation(`reply includes ${JSON.stringify(text)}`, true, reply.includes(text), reply.includes(text))),
        ...(episode.expect.reply_excludes ?? []).map(text => observation(`reply excludes ${JSON.stringify(text)}`, false, reply.includes(text), !reply.includes(text))),
      ];
      reports.push({
        episode_id: episode.id,
        runtime_id: runtimeId,
        cognition_backend: episode.cognition_backend,
        external_thread: thread,
        provider_thread_id: providerThreadId,
        canonical_before: canonicalBefore,
        projection: request.projection,
        provider_result: providerResult,
        canonical_after: inspectionView(state),
        ember_assertions: emberAssertions,
        model_observations: modelObservations,
      });
    }
  } finally {
    await store.releaseWriteLease(lease);
  }
  return {
    report_version: 1,
    scenario_id: scenario.id,
    description: scenario.description,
    lineage_id: state.lineage.lineage_id,
    ember_assertions_passed: reports.every(report => report.ember_assertions.every(item => item.passed)),
    model_observations_passed: reports.every(report => report.model_observations.every(item => item.passed)),
    episodes: reports,
  };
}

function applyActions(state: EmberState, actions: StateAction[], principal: string, aliases: Map<string, string>) {
  for (const item of actions) {
    if (aliases.has(item.as)) throw new Error(`duplicate scenario alias: ${item.as}`);
    const id = withFixedTimeSync(item.at, () => {
      switch (item.action) {
        case "remember_relationship": return rememberRelationship(state, principal, `relationship:${principal}`, item.scope, item.text);
        case "remember_fact": return rememberFact(state, principal, `user:${principal}`, item.slot, item.scope, item.text);
        case "remember_preference": return rememberPreference(state, principal, `user:${principal}`, item.slot, item.scope, item.text);
        case "undertake": return undertake(state, principal, item.slot, item.scope, item.text);
        case "remember_episode": return rememberEpisode(state, principal, item.slot, `relationship:${principal}`, item.scope, item.text);
        case "attach_detail": return attachDetail(state, principal, requireAlias(aliases, item.episode), item.text);
        case "supersede": return supersede(state, principal, requireAlias(aliases, item.meaning), item.text, { reason: item.reason });
        case "withhold_detail": return withholdDetail(state, principal, requireAlias(aliases, item.evidence), { reason: item.reason });
      }
    });
    aliases.set(item.as, id);
  }
  validateState(state);
}

function resolveThread(control: ThreadControl, threads: Map<string, string>): HarnessProviderInvocation["thread"] {
  if (control.mode === "fresh") return control;
  const externalThreadId = threads.get(control.episode);
  if (externalThreadId === undefined) throw new Error(`cannot reuse absent provider thread from episode: ${control.episode}`);
  return { mode: "reuse", externalThreadId, sourceEpisode: control.episode };
}

function requireAlias(aliases: Map<string, string>, alias: string): string {
  const id = aliases.get(alias);
  if (id === undefined) throw new Error(`unknown scenario alias: ${alias}`);
  return id;
}

function observation(assertion: string, expected: unknown, observed: unknown, passed: boolean): AssertionObservation {
  return { assertion, expected, observed, passed };
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withFixedTimeSync<T>(timestamp: string, action: () => T): T {
  const previous = process.env.EMBER_TEST_NOW;
  process.env.EMBER_TEST_NOW = timestamp;
  try { return action(); } finally {
    if (previous === undefined) delete process.env.EMBER_TEST_NOW;
    else process.env.EMBER_TEST_NOW = previous;
  }
}

async function withFixedTime<T>(timestamp: string, action: () => T | Promise<T>): Promise<T> {
  const previous = process.env.EMBER_TEST_NOW;
  process.env.EMBER_TEST_NOW = timestamp;
  try { return await action(); } finally {
    if (previous === undefined) delete process.env.EMBER_TEST_NOW;
    else process.env.EMBER_TEST_NOW = previous;
  }
}

function validateScenario(value: unknown): asserts value is LongitudinalScenario {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("longitudinal scenario must be an object");
  const scenario = value as Partial<LongitudinalScenario>;
  if (scenario.scenario_version !== 1 || typeof scenario.id !== "string" || !scenario.id.trim() || typeof scenario.description !== "string") throw new Error("longitudinal scenario header is invalid");
  if (!scenario.ember || typeof scenario.ember.name !== "string" || typeof scenario.ember.principal !== "string" || typeof scenario.ember.initial_at !== "string") throw new Error("longitudinal scenario Ember identity is invalid");
  if (!Array.isArray(scenario.setup) || !Array.isArray(scenario.episodes) || scenario.episodes.length < 2) throw new Error("longitudinal scenario requires setup and at least two episodes");
  const aliases = new Set<string>();
  const episodeIds = new Set<string>();
  for (const action of [...scenario.setup, ...scenario.episodes.flatMap(episode => episode.changes ?? [])]) {
    if (!action || typeof action !== "object" || typeof action.action !== "string" || typeof action.as !== "string" || typeof action.at !== "string") throw new Error("longitudinal scenario action is invalid");
    if (aliases.has(action.as)) throw new Error(`duplicate scenario alias: ${action.as}`);
    aliases.add(action.as);
  }
  for (const episode of scenario.episodes) {
    if (!episode || typeof episode.id !== "string" || episodeIds.has(episode.id) || typeof episode.at !== "string" || typeof episode.scope !== "string" || typeof episode.cognition_backend !== "string" || !episode.cognition_backend.trim() || typeof episode.restart_ember !== "boolean" || typeof episode.input !== "string") throw new Error("longitudinal episode is invalid");
    episodeIds.add(episode.id);
    if (!episode.external_thread || !["fresh", "reuse"].includes(episode.external_thread.mode)) throw new Error(`episode ${episode.id} thread control is invalid`);
    if (episode.external_thread.mode === "reuse" && !episodeIds.has(episode.external_thread.episode)) throw new Error(`episode ${episode.id} must reuse an earlier episode`);
    if (!episode.expect || !Array.isArray(episode.expect.selected_meanings) || !Array.isArray(episode.expect.forbidden_meanings)) throw new Error(`episode ${episode.id} expectations are invalid`);
  }
}
