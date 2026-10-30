import type { InteractionEvent, TransportSend } from "@ember/application/app/contract.ts";
import type { CommandJournalDocument } from "@ember/application/commands/journal.ts";

import { createConversationCommandService } from "@ember/application/commands/service.ts";
import { initialState } from "@ember/domain/model.ts";
import { ActionProposalStore, actionProposalConfirmation } from "@ember/persistence/capabilities/action-proposal.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import { FileCommandJournal } from "@ember/persistence/runtime/command-journal.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { composeCliSurface } from "./cli.ts";
import { parseConversationCommand } from "./command-parser.ts";

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-shared-commands-"));
    const statePath = join(directory, "state.json");
    const state = new StateStore(statePath);
    await state.create(initialState("alice"));
    const services = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "must-not-run", arguments: [], timeoutSeconds: 1 },
    });
    return {
        ...services,
        state,
        statePath,
        async close() {
            await services.close();
            await rm(directory, { recursive: true, force: true });
        },
    };
}
function event(id: string, text: string): InteractionEvent {
    return {
        kind: "message",
        principal: "alice",
        scope: "private",
        text,
        surfaceId: "telegram_bot",
        principalProvenance: "configured_surface_mapping",
        deliveryDestinationId: "telegram:chat:42",
        externalOccurrence: { occurrenceId: id },
    };
}
const send: TransportSend = async () => ({ outcome: "confirmed", externalMessageId: "42" });

test("command recovery should block reexecution when completion persistence fails after mutation", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    class InterruptedJournal extends FileCommandJournal {
        override async save(document: CommandJournalDocument) {
            if (document.commands.some((record) => record.status === "completed")) throw new Error("completion lost");
            await super.save(document);
        }
    }
    const interrupted = createConversationCommandService({
        repositories: f.repositories,
        application: f.application,
        journal: new InterruptedJournal(f.statePath),
        parse: parseConversationCommand,
    });
    const request = event("interrupted", "/remember fact user:alice once private retained");
    // When
    await assert.rejects(interrupted.execute(request, send), /completion lost/);
    const replay = f.commands.execute(request, send);
    // Then
    await assert.rejects(replay, /outcome is uncertain/);
    assert.equal((await f.state.load()).meanings.filter((meaning) => meaning.content === "retained").length, 1);
    assert.equal((await f.state.lockStatus()).status, "absent");
});

test("command delivery should reuse retained bytes when a definite retryable failure is reconciled", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    const bytes: string[] = [];
    const request = event("retry", "/remember fact user:alice once private retained");
    await f.commands.execute(request, async ({ text }) => {
        bytes.push(text);
        return { outcome: "failed", externalMessageId: null, retryable: true, retryAfterSeconds: 0 };
    });
    // When
    await f.commands.reconcile(
        {
            principal: "alice",
            scope: "private",
            surfaceId: "telegram_bot",
            acceptsDestination: (destination) => destination === "telegram:chat:42",
        },
        async ({ text }) => {
            bytes.push(text);
            return { outcome: "confirmed", externalMessageId: "42" };
        },
    );
    // Then
    assert.equal(bytes.length, 2);
    assert.equal(bytes[0], bytes[1]);
    assert.equal((await f.state.load()).meanings.filter((meaning) => meaning.content === "retained").length, 1);
});

test("action commands should require a presentation on the deciding surface when another surface already presented", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    const actions = new ActionProposalStore(f.statePath);
    const proposal = await actions.create({
        capability: "fixture",
        principal: "alice",
        scope: "private",
        purpose: "test",
        consequence: "creates an event",
        payload: { title: "appointment" },
        target: { label: "calendar", fingerprint: ("sha256:" + "a".repeat(64)) as `sha256:${string}` },
        sourceIds: ["evidence-request"],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    await actions.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: new Date().toISOString(),
    });
    const confirmation = actionProposalConfirmation(proposal);
    let rejection = "";
    const approve =
        "/approve_action " + proposal.proposal_id + " " + proposal.payload_digest + " '" + confirmation + "'";
    // When
    await f.commands.execute(event("before-presentation", approve), async ({ text }) => {
        rejection = text;
        return { outcome: "confirmed", externalMessageId: "42" };
    });
    await f.commands.execute(event("show", "/show_action " + proposal.proposal_id), send);
    await f.commands.execute(event("after-presentation", approve), send);
    // Then
    assert.match(rejection, /requires :show-action in this scope first/);
    const stored = await actions.get(proposal.proposal_id);
    assert.equal(stored?.status, "approved");
    assert.equal(stored?.presentations.at(-1)?.surface, "telegram_bot");
});

test("explanation commands should reject inaccessible meanings when invoked remotely", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    await f.commands.execute(event("remember", "/remember fact user:alice once private private-text"), send);
    const meaning = (await f.state.load()).meanings.find((candidate) => candidate.content === "private-text")!;
    const request = { ...event("explain", "/ask --explain " + meaning.meaningId + " explain"), scope: "other" };
    // When
    let rejection = "";
    await f.commands.execute(request, async ({ text }) => {
        rejection = text;
        return { outcome: "confirmed", externalMessageId: "42" };
    });
    // Then
    assert.match(rejection, /outside the active scope/);
    assert.equal((await f.state.load()).operations.cognitionEpisodes.length, 0);
});

const reconciliationContext = {
    principal: "alice",
    scope: "private",
    surfaceId: "telegram_bot",
    acceptsDestination: (destination: string) => destination === "telegram:chat:42",
};
const retryableSend: TransportSend = async () => ({
    outcome: "failed",
    externalMessageId: null,
    retryable: true,
    retryAfterSeconds: 0,
});

test("command reconciliation should block retained replies when canonical continuity is replaced", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    await f.commands.execute(event("replacement", "/help"), retryableSend);
    const lease = await f.state.acquireWriteLease();
    try {
        await f.state.replaceDocument(initialState("alice"));
    } finally {
        await f.state.releaseWriteLease(lease);
    }
    let sends = 0;
    // When
    const attempt = f.commands.reconcile(reconciliationContext, async () => {
        sends++;
        return { outcome: "confirmed", externalMessageId: "42" };
    });
    // Then
    await assert.rejects(attempt, /continuity no longer matches/);
    assert.equal(sends, 0);
    assert.equal((await f.state.lockStatus()).status, "absent");
});

test("command reconciliation should exclude prior authority when configured principal or scope changes", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    await f.commands.execute(event("authority", "/help"), retryableSend);
    let sends = 0;
    const transport: TransportSend = async () => {
        sends++;
        return { outcome: "confirmed", externalMessageId: "42" };
    };
    // When
    await f.commands.reconcile({ ...reconciliationContext, principal: "bob" }, transport);
    await f.commands.reconcile({ ...reconciliationContext, scope: "other" }, transport);
    // Then
    assert.equal(sends, 0);
});

test("command replay should check configured continuity when a retained reply is retried", async (t) => {
    // Given
    const f = await fixture();
    t.after(f.close);
    const request = event("expected-binding", "/help");
    await f.commands.execute(request, retryableSend);
    const rebound = createConversationCommandService({
        application: f.application,
        repositories: f.repositories,
        journal: new FileCommandJournal(f.statePath),
        parse: parseConversationCommand,
        expectedContinuityBinding: { lineageId: "unrelated-lineage", establishedAt: "2026-01-01T00:00:00Z" },
    });
    let sends = 0;
    // When
    const attempt = rebound.execute(request, async () => {
        sends++;
        return { outcome: "confirmed", externalMessageId: "42" };
    });
    // Then
    await assert.rejects(attempt, /continuity no longer matches/);
    assert.equal(sends, 0);
});
