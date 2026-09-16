import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { CapabilityJsonValue } from "./execution.ts";

import { tempDir } from "../../tests/support.ts";
import { ActionProposalStore } from "./action-proposal.ts";
import { createCapabilityExecutionFirewall } from "./execution.ts";
import { createApprovedGoogleCalendarEventCapability } from "./google-calendar-create.ts";

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
        sourceIds: ["evidence-user-request"],
        createdAt: "2026-09-16T10:00:00Z",
        expiresAt: "2026-09-16T11:00:00Z",
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
    await firstStore.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
    });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const restartedStore = new ActionProposalStore(statePath);
    const capability = createApprovedGoogleCalendarEventCapability(config, restartedStore, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async (input, init) => {
            calls.push({ url: String(input), ...(init ? { init } : {}) });
            if (calls.length === 1) return json({ access_token: "token" });
            if (calls.length === 2) return json({}, { status: 404 });
            return json({ summary: event.title, start: { dateTime: event.start }, end: { dateTime: event.end } });
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

    // When
    const mismatch = store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: "sha256:mismatch",
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
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
    await store.decide({
        proposalId: rejectedProposal.proposal_id,
        decision: "rejected",
        principal: "alice",
        payloadDigest: rejectedProposal.payload_digest,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
    });
    const ambiguousProposal = await proposed(store);

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
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
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
    await store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "authenticated-cli:alice",
    });
    let calls = 0;
    const capability = createApprovedGoogleCalendarEventCapability(config, store, {
        now: () => new Date("2026-09-16T10:10:00Z"),
        readSecret: async () => "secret",
        fetch: async () => {
            calls += 1;
            if (calls === 1) return json({ access_token: "token" });
            if (calls === 2) return json({}, { status: 404 });
            throw new Error("connection lost after submission");
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

function json(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}
