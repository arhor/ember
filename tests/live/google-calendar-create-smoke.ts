#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CapabilityJsonValue } from "../../src/core/capabilities/execution.ts";

import { actionProposalConfirmation, ActionProposalStore } from "../../src/core/capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../../src/core/capabilities/execution.ts";
import {
    calendarTargetFingerprint,
    createApprovedGoogleCalendarEventCapability,
} from "../../src/integrations/google-calendar/create.ts";
import { loadGoogleCalendarConfig } from "../../src/integrations/google-calendar/read.ts";

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
        target: { label: config.calendar_label, fingerprint: calendarTargetFingerprint(config) },
        sourceIds: ["live-smoke:explicit-environment-approval"],
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    });
    const presented = await store.present({
        proposalId: proposal.proposal_id,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
        presentedAt: new Date().toISOString(),
    });
    await store.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: config.principal,
        payloadDigest: proposal.payload_digest,
        scope: config.scope,
        surface: "local_cli",
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: new Date().toISOString(),
        authoritySourceId: "live-smoke:exact-environment-confirmation",
        materialConfirmation: actionProposalConfirmation(proposal),
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
