#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CapabilityJsonValue } from "../../src/capabilities/execution.ts";

import { ActionProposalStore } from "../../src/capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../../src/capabilities/execution.ts";
import { createApprovedGoogleCalendarEventCapability } from "../../src/capabilities/google-calendar-create.ts";
import { loadGoogleCalendarConfig } from "../../src/capabilities/google-calendar.ts";

if (process.env.EMBER_RUN_LIVE_GOOGLE_CALENDAR_CREATE !== "1") {
    process.stdout.write("skipped: set EMBER_RUN_LIVE_GOOGLE_CALENDAR_CREATE=1 and documented event variables\n");
    process.exit(0);
}

const configPath = required("EMBER_GOOGLE_CALENDAR_CONFIG");
const title = required("EMBER_GOOGLE_CALENDAR_EVENT_TITLE");
const start = required("EMBER_GOOGLE_CALENDAR_EVENT_START");
const end = required("EMBER_GOOGLE_CALENDAR_EVENT_END");
if (process.env.EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL !== `${title}|${start}|${end}`)
    throw new Error("EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL must exactly repeat title|start|end");

const config = await loadGoogleCalendarConfig(configPath);
const event = { title, start, end, timezone: config.timezone };
const directory = await mkdtemp(join(tmpdir(), "ember-google-calendar-create-"));
const store = new ActionProposalStore(join(directory, "ember.json"));

try {
    const now = new Date();
    const proposal = await store.create({
        capability: "googleCalendarCreateEvent",
        principal: config.principal,
        scope: config.scope,
        purpose: "Operator-requested live integration smoke",
        consequence: "Creates one real calendar event without sending attendee updates",
        payload: event as CapabilityJsonValue,
        sourceIds: ["live-smoke:explicit-environment-approval"],
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    });
    await store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: config.principal,
        payloadDigest: proposal.payload_digest,
        decidedAt: new Date().toISOString(),
        authoritySourceId: "live-smoke:exact-environment-confirmation",
    });
    const capability = createApprovedGoogleCalendarEventCapability(config, store);
    const result = await createCapabilityExecutionFirewall([capability], {
        cognitionId: "cognition-live-google-calendar-create" as never,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
        validatedRevision: 1,
    }).execute(capability.name, { proposalId: proposal.proposal_id, event });
    assert.equal(result.outcome, "succeeded");
    process.stdout.write(`${JSON.stringify({ proposal_id: proposal.proposal_id, outcome: result.outcome })}\n`);
} finally {
    await rm(directory, { recursive: true, force: true });
}

function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}
