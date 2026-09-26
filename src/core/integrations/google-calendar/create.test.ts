import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { CapabilityJsonValue } from "../../capabilities/execution.ts";

import { tempDir } from "../../../../tests/support.ts";
import { actionProposalConfirmation, ActionProposalStore } from "../../capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../../capabilities/execution.ts";
import {
    calendarTargetFingerprint,
    createApprovedGoogleCalendarEventCapability,
    createGoogleCalendarEventProposalCapability,
    googleCalendarRecoveryBinding,
} from "./create.ts";

const config = {
    config_version: 1 as const,
    enabled: true,
    setup_lineage_id: "lineage-test",
    principal: "alice",
    scope: "private",
    surfaces: ["local_cli" as const],
    authority_source_id: "authority:gcal:test",
    calendar_id: "alice@example.test",
    calendar_label: "Personal",
    timezone: "Europe/Warsaw",
    client_id: "client",
    client_secret_file: "/secret/client",
    refresh_token_file: "/secret/refresh",
};
const context = {
    cognitionId: "cognition-test" as never,
    principal: "alice",
    scope: "private",
    surface: "local_cli",
    validatedRevision: 1,
};
const event = {
    title: "Dentist",
    start: "2026-09-18T08:00:00Z",
    end: "2026-09-18T09:00:00Z",
    timezone: "Europe/Warsaw",
};

async function proposed(store: ActionProposalStore) {
    return store.create({
        capability: "googleCalendarCreateEvent",
        principal: "alice",
        scope: "private",
        purpose: "Keep the dental appointment",
        consequence: "Creates one private calendar event without attendee notifications",
        payload: event as CapabilityJsonValue,
        target: { label: config.calendar_label, fingerprint: calendarTargetFingerprint(config) },
        sourceIds: ["evidence-user-request"],
        createdAt: "2026-09-16T10:00:00Z",
        expiresAt: "2026-09-16T11:00:00Z",
    });
}

async function approve(store: ActionProposalStore, proposal: Awaited<ReturnType<typeof proposed>>) {
    const presented = await store.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:04:00Z",
    });
    return store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: actionProposalConfirmation(proposal),
    });
}

test("calendar event capability should block execution when exact approval is absent", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        fetch: async () => {
            calls += 1;
            return new Response();
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "approval_required");
    assert.equal(result.executionAttempted, false);
    assert.equal(calls, 0);
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should create one event when durable exact approval remains current after restart", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const firstStore = new ActionProposalStore(statePath);
    const proposal = await proposed(firstStore);
    await approve(firstStore, proposal);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const restartedStore = new ActionProposalStore(statePath);
    const capability = createApprovedGoogleCalendarEventCapability(config, restartedStore, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async (input, init) => {
            calls.push({ url: String(input), ...(init ? { init } : {}) });
            if (calls.length === 1) return json({ access_token: "token" });
            if (calls.length === 2) return json({}, { status: 404 });
            return json({
                summary: event.title,
                start: { dateTime: event.start, timeZone: event.timezone },
                end: { dateTime: event.end, timeZone: event.timezone },
            });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "succeeded");
    assert.deepEqual(result.authority?.basis, "fresh_approval");
    assert.equal(calls.length, 3);
    assert.equal(calls[1]!.init?.method, undefined);
    assert.equal(calls[2]!.init?.method, "POST");
    assert.equal(new URL(calls[2]!.url).searchParams.get("sendUpdates"), "none");
    const persisted = (await restartedStore.load()).proposals[0]!;
    assert.equal(persisted.status, "succeeded");
    assert.equal(persisted.attempt?.outcome, "succeeded");
    await rm(directory, { recursive: true, force: true });
});

test("action proposal decision should reject stale and materially mismatched approval", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    const presented = await store.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:04:00Z",
    });

    // When
    const mismatch = store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: "sha256:mismatch",
        scope: "private",
        surface: "local_cli",
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: actionProposalConfirmation(proposal),
    });

    // Then
    await assert.rejects(mismatch, /does not match/);
    const decision = await store.authorize(
        proposal.proposal_id,
        proposal.capability,
        event as CapabilityJsonValue,
        context,
        "2026-09-16T11:00:01Z",
    );
    assert.deepEqual(decision, { status: "denied", reason: "action proposal approval is stale" });
    await rm(directory, { recursive: true, force: true });
});

test("action proposal decision should preserve rejection and refuse ambiguous decision input", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const rejectedProposal = await proposed(store);
    const rejectedPresentation = await store.present({
        proposalId: rejectedProposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:04:00Z",
    });
    await store.decide({
        proposalId: rejectedProposal.proposal_id,
        decision: "rejected",
        principal: "alice",
        payloadDigest: rejectedProposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: rejectedPresentation.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: actionProposalConfirmation(rejectedProposal),
    });
    const ambiguousProposal = await proposed(store);
    const ambiguousPresentation = await store.present({
        proposalId: ambiguousProposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:04:00Z",
    });

    // When
    const rejected = await store.authorize(
        rejectedProposal.proposal_id,
        rejectedProposal.capability,
        event as CapabilityJsonValue,
        context,
        "2026-09-16T10:10:00Z",
    );
    const ambiguous = store.decide({
        proposalId: ambiguousProposal.proposal_id,
        decision: "maybe" as never,
        principal: "alice",
        payloadDigest: ambiguousProposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: ambiguousPresentation.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: actionProposalConfirmation(ambiguousProposal),
    });

    // Then
    assert.deepEqual(rejected, { status: "denied", reason: "action proposal is not execution eligible: rejected" });
    await assert.rejects(ambiguous, /does not match/);
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should persist uncertainty and never replay approval when submission is ambiguous", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const store = new ActionProposalStore(statePath);
    const proposal = await proposed(store);
    await approve(store, proposal);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            if (calls === 1) return json({ access_token: "token" });
            if (calls === 2) return json({}, { status: 404 });
            if (calls === 3) throw new Error("connection lost after submission");
            return json({}, { status: 404 });
        },
    });

    // When
    const first = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });
    const afterRestart = createApprovedGoogleCalendarEventCapability(config, new ActionProposalStore(statePath), {
        now: () => new Date("2026-09-16T10:11:00Z"),
    });
    const repeated = await createCapabilityExecutionFirewall([afterRestart], context).execute(afterRestart.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(first.outcome, "outcome_unknown");
    assert.equal(first.retry, "unsafe");
    assert.equal(repeated.outcome, "authority_denied");
    assert.match(repeated.reason ?? "", /outcome_unknown/);
    assert.equal((await store.load()).proposals[0]!.status, "outcome_unknown");
    await rm(directory, { recursive: true, force: true });
});

test("action proposal store should fail closed when persisted decision and lifecycle evidence are malformed", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    const document = await store.load();
    document.proposals[0] = {
        ...proposal,
        status: "approved",
        decision: { decision_id: "action-decision-forged", decision: "approved" } as never,
    };
    await writeFile(store.path, JSON.stringify(document));

    // When
    const loaded = store.load();

    // Then
    await assert.rejects(loaded, /record is invalid/);
    await rm(directory, { recursive: true, force: true });
});

test("action proposal store should serialize concurrent writers without losing an accepted mutation", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const first = new ActionProposalStore(statePath);
    const second = new ActionProposalStore(statePath);

    // When
    const results = await Promise.allSettled([proposed(first), proposed(second)]);

    // Then
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await first.load()).proposals.length, 1);
    await rm(directory, { recursive: true, force: true });
});

test("action proposal authorization should stop after durable withdrawal or supersession", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);

    // When
    await store.invalidate({
        proposalId: proposal.proposal_id,
        kind: "withdrawn",
        principal: "alice",
        occurredAt: "2026-09-16T10:06:00Z",
        authoritySourceId: "authenticated-cli:alice",
        reason: "the principal said stop",
    });
    const decision = await store.authorize(
        proposal.proposal_id,
        proposal.capability,
        event as CapabilityJsonValue,
        context,
        "2026-09-16T10:07:00Z",
    );

    // Then
    assert.deepEqual(decision, { status: "denied", reason: "action proposal is not execution eligible: withdrawn" });
    assert.equal(
        (await new ActionProposalStore(join(directory, "ember.json")).load()).proposals[0]!.status,
        "withdrawn",
    );
    await rm(directory, { recursive: true, force: true });
});

test("action proposal timestamps should compare instants when fractional precision differs", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));

    // When
    const invalid = store.create({
        capability: "googleCalendarCreateEvent",
        principal: "alice",
        scope: "private",
        purpose: "test",
        consequence: "test",
        payload: event as CapabilityJsonValue,
        sourceIds: ["source"],
        createdAt: "2026-09-16T10:00:00.1Z",
        expiresAt: "2026-09-16T10:00:00Z",
    });

    // Then
    await assert.rejects(invalid, /positive/);
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should reconcile a submitted attempt after restart without replaying it", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const store = new ActionProposalStore(statePath);
    const proposal = await proposed(store);
    await approve(store, proposal);
    await store.beginAttempt(proposal.proposal_id, "2026-09-16T10:06:00Z", googleCalendarRecoveryBinding(config));
    await store.markSubmitted(proposal.proposal_id);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, new ActionProposalStore(statePath), {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            return calls === 1
                ? json({ access_token: "token" })
                : json({
                      summary: event.title,
                      start: { dateTime: event.start, timeZone: event.timezone },
                      end: { dateTime: event.end, timeZone: event.timezone },
                  });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.equal(calls, 2);
    assert.equal((await store.load()).proposals[0]!.status, "succeeded");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should treat timezone mismatch as a confirmed reconciliation conflict", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            if (calls === 1) return json({ access_token: "token" });
            if (calls === 2) return json({}, { status: 404 });
            if (calls === 3) return json({}, { status: 500 });
            return json({
                summary: event.title,
                start: { dateTime: event.start, timeZone: "UTC" },
                end: { dateTime: event.end, timeZone: "UTC" },
            });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "failed");
    assert.equal((await store.load()).proposals[0]!.status, "failed");
    await rm(directory, { recursive: true, force: true });
});

test("calendar proposal capability should create an approval-ready proposal during ordinary cognition", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const capability = createGoogleCalendarEventProposalCapability(config, store, {
        now: () => new Date("2026-09-16T10:00:00Z"),
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        event,
        purpose: "Keep the appointment",
        consequence: "Create one event without notifying attendees",
    });

    // Then
    assert.equal(result.outcome, "succeeded");
    assert.match(JSON.stringify(result.output), /approval_required/);
    const persisted = (await store.load()).proposals[0]!;
    assert.equal(persisted.status, "pending");
    assert.deepEqual(persisted.source_ids, [context.cognitionId]);
    await rm(directory, { recursive: true, force: true });
});

test("calendar recovery should not mutate submitted proposal when invocation payload is mismatched", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    await store.beginAttempt(proposal.proposal_id, "2026-09-16T10:06:00Z", googleCalendarRecoveryBinding(config));
    await store.markSubmitted(proposal.proposal_id);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        fetch: async () => {
            calls += 1;
            return json({});
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event: { ...event, title: "Different event" },
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.equal(calls, 0);
    assert.equal((await store.load()).proposals[0]!.status, "executing");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should preserve approval when currentness recheck fails before attempt", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => (++calls === 1 ? json({ access_token: "token" }) : json({}, { status: 503 })),
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "failed");
    assert.equal(result.retry, "safe");
    assert.equal((await store.load()).proposals[0]!.status, "approved");
    await rm(directory, { recursive: true, force: true });
});

test("calendar recovery should terminalize uncertainty when successful HTTP body is malformed", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    await store.beginAttempt(proposal.proposal_id, "2026-09-16T10:06:00Z", googleCalendarRecoveryBinding(config));
    await store.markSubmitted(proposal.proposal_id);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            return calls === 1 ? json({ access_token: "token" }) : new Response("not-json", { status: 200 });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.equal((await store.load()).proposals[0]!.status, "outcome_unknown");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event validation should compare fractional timestamps chronologically", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await store.create({
        capability: "googleCalendarCreateEvent",
        principal: "alice",
        scope: "private",
        purpose: "test",
        consequence: "test",
        payload: { ...event, start: "2026-09-18T08:00:00.1Z", end: "2026-09-18T08:00:00Z" },
        target: { label: config.calendar_label, fingerprint: calendarTargetFingerprint(config) },
        sourceIds: ["source"],
        createdAt: "2026-09-16T10:00:00Z",
        expiresAt: "2026-09-16T11:00:00Z",
    });
    const capability = createApprovedGoogleCalendarEventCapability(config, store);

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event: proposal.payload,
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.equal(result.executionAttempted, false);
    await rm(directory, { recursive: true, force: true });
});

test("action proposal decision should require trusted presentation in the same scope and surface", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);

    // When
    const decision = store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: "action-presentation-missing",
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: actionProposalConfirmation(proposal),
    });

    // Then
    await assert.rejects(decision, /does not match/);
    assert.equal((await store.load()).proposals[0]!.status, "pending");
    await rm(directory, { recursive: true, force: true });
});

test("action proposal decision should require explicit material awareness when presentation exists", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    const presented = await store.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:04:00Z",
    });

    // When
    const decision = store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
        materialConfirmation: "I saw something",
    });

    // Then
    await assert.rejects(decision, /does not match/);
    assert.equal((await store.load()).proposals[0]!.status, "pending");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should block approved proposal when configured target changes", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(
        { ...config, calendar_id: "different@example.test", refresh_token_file: "/secret/reconfigured-refresh" },
        store,
        {
            now: () => new Date("2026-09-16T10:10:00Z"),
            fetch: async () => {
                calls += 1;
                return json({});
            },
        },
    );

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.match(result.reason ?? "", /target configuration changed/);
    assert.equal(calls, 0);
    assert.equal((await store.load()).proposals[0]!.status, "approved");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should reconcile submitted attempt against original target after reconfiguration", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    await store.beginAttempt(proposal.proposal_id, "2026-09-16T10:06:00Z", googleCalendarRecoveryBinding(config));
    await store.markSubmitted(proposal.proposal_id);
    const reconfigured = {
        ...config,
        calendar_id: "different@example.test",
        client_id: "different-client",
        client_secret_file: "/secret/different-client",
        refresh_token_file: "/secret/different-refresh",
    };
    const requestedSecrets: string[] = [];
    const requestedUrls: string[] = [];
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(reconfigured, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async (path) => {
            requestedSecrets.push(path);
            return "secret";
        },
        fetch: async (url) => {
            calls += 1;
            requestedUrls.push(String(url));
            return calls === 1
                ? json({ access_token: "token" })
                : json({
                      summary: event.title,
                      start: { dateTime: event.start, timeZone: event.timezone },
                      end: { dateTime: event.end, timeZone: event.timezone },
                  });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "authority_denied");
    assert.deepEqual(requestedSecrets.sort(), [config.client_secret_file, config.refresh_token_file].sort());
    assert.match(requestedUrls.at(-1)!, /alice%40example\.test/);
    assert.equal((await store.load()).proposals[0]!.status, "succeeded");
    await rm(directory, { recursive: true, force: true });
});

test("action proposal store should reject causally impossible persisted lifecycle timestamps", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    const document = await store.load();
    document.proposals[0]!.presentations[0]!.presented_at = "2026-09-16T09:59:00Z";
    await writeFile(store.path, JSON.stringify(document));

    // When
    const loaded = store.load();

    // Then
    await assert.rejects(loaded, /record is invalid/);
    await rm(directory, { recursive: true, force: true });
});

test("action proposal store should reject persisted decision before correlated presentation", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    const document = await store.load();
    document.proposals[0]!.decision!.decided_at = "2026-09-16T10:03:00Z";
    await writeFile(store.path, JSON.stringify(document));

    // When
    const loaded = store.load();

    // Then
    await assert.rejects(loaded, /record is invalid/);
    await rm(directory, { recursive: true, force: true });
});

test("action proposal attempt should reject start before approval decision", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);

    // When
    const attempt = store.beginAttempt(
        proposal.proposal_id,
        "2026-09-16T10:04:30Z",
        googleCalendarRecoveryBinding(config),
    );

    // Then
    await assert.rejects(attempt, /no longer execution eligible/);
    assert.equal((await store.load()).proposals[0]!.status, "approved");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should align durable and firewall uncertainty when POST response is malformed", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            if (calls === 1) return json({ access_token: "token" });
            if (calls === 2) return json({}, { status: 404 });
            return new Response("not-json", { status: 200 });
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "outcome_unknown");
    assert.equal(result.retry, "unsafe");
    assert.equal((await store.load()).proposals[0]!.status, "outcome_unknown");
    await rm(directory, { recursive: true, force: true });
});

test("calendar event capability should classify authentication transport failure before attempt as safe", async () => {
    // Given
    const directory = await tempDir();
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const proposal = await proposed(store);
    await approve(store, proposal);
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            throw new Error("token transport unavailable");
        },
    });

    // When
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        proposalId: proposal.proposal_id,
        event,
    });

    // Then
    assert.equal(result.outcome, "failed");
    assert.equal(result.retry, "safe");
    assert.equal((await store.load()).proposals[0]!.status, "approved");
    await rm(directory, { recursive: true, force: true });
});

function json(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}
