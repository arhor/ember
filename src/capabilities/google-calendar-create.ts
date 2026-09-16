import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { ActionProposalStore } from "./action-proposal.ts";
import type { CapabilityBinding, CapabilityContext, CapabilityJsonValue } from "./execution.ts";
import type { GoogleCalendarConfig } from "./google-calendar.ts";

import { isRfc3339Utc } from "../core/model.ts";
import { exactKeys, isObject } from "../util.ts";
import { CapabilityExecutionFailure } from "./execution.ts";
import { GOOGLE_CALENDAR_API_ORIGIN, GOOGLE_OAUTH_TOKEN_ENDPOINT } from "./google-calendar.ts";

export const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface GoogleCalendarCreateInput {
    proposalId: string;
    event: {
        title: string;
        start: string;
        end: string;
        timezone: string;
    };
}

interface Dependencies {
    fetch: typeof fetch;
    now: () => Date;
    readSecret: (path: string) => Promise<string>;
    apiOrigin: string;
    tokenEndpoint: string;
}

export function createApprovedGoogleCalendarEventCapability(
    config: GoogleCalendarConfig,
    store: ActionProposalStore,
    overrides: Partial<Dependencies> = {},
): CapabilityBinding {
    const dependencies: Dependencies = {
        fetch,
        now: () => new Date(),
        readSecret: async (path) => (await readFile(path, "utf8")).trim(),
        apiOrigin: GOOGLE_CALENDAR_API_ORIGIN,
        tokenEndpoint: GOOGLE_OAUTH_TOKEN_ENDPOINT,
        ...overrides,
    };
    return {
        name: "googleCalendarCreateEvent",
        description: "Create exactly one approved event in the configured calendar.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                proposalId: { type: "string" },
                event: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        title: { type: "string" },
                        start: { type: "string", format: "date-time" },
                        end: { type: "string", format: "date-time" },
                        timezone: { type: "string" },
                    },
                    required: ["title", "start", "end", "timezone"],
                },
            },
            required: ["proposalId", "event"],
        },
        occurrencePolicy: "at_most_once_per_cognition",
        authorize: async (context, input) => {
            if (!validInput(input)) return { status: "denied", reason: "calendar event proposal payload is invalid" };
            return store.authorize(
                input.proposalId,
                "googleCalendarCreateEvent",
                input.event,
                context,
                dependencies.now().toISOString(),
            );
        },
        validateInput: (_context, input) =>
            validInput(input)
                ? { status: "allowed" }
                : {
                      status: "rejected",
                      reason: "calendar event must have exact bounded title/start/end/timezone fields",
                  },
        execute: (context, input, { signal }) =>
            executeCreate(config, store, context, input as unknown as GoogleCalendarCreateInput, dependencies, signal),
    };
}

async function executeCreate(
    config: GoogleCalendarConfig,
    store: ActionProposalStore,
    context: CapabilityContext,
    input: GoogleCalendarCreateInput,
    dependencies: Dependencies,
    signal?: AbortSignal,
): Promise<CapabilityJsonValue> {
    const startedAt = dependencies.now().toISOString();
    const proposal = await store.beginAttempt(input.proposalId, startedAt);
    const externalId = externalEventId(proposal.proposal_id);
    let effectSubmitted = false;
    let accessToken: string;
    try {
        accessToken = await token(config, dependencies, signal);
        const current = await dependencies.fetch(eventUrl(config, dependencies.apiOrigin, externalId), {
            ...(signal === undefined ? {} : { signal }),
            headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        });
        if (current.ok) {
            const existing: unknown = await current.json();
            if (matchesExisting(existing, input.event)) {
                const evidence = { status: "confirmed", reconciliation: "already_present" };
                await store.completeAttempt(input.proposalId, "succeeded", dependencies.now().toISOString(), evidence);
                return evidence;
            }
            await fail(store, input.proposalId, dependencies, "deterministic event identifier is already occupied");
        }
        if (current.status !== 404)
            await fail(store, input.proposalId, dependencies, "calendar currentness recheck failed");

        let response: Response;
        try {
            const url = new URL(
                `/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`,
                dependencies.apiOrigin,
            );
            url.searchParams.set("sendUpdates", "none");
            effectSubmitted = true;
            response = await dependencies.fetch(url, {
                method: "POST",
                ...(signal === undefined ? {} : { signal }),
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    accept: "application/json",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    id: externalId,
                    summary: input.event.title,
                    start: { dateTime: input.event.start, timeZone: input.event.timezone },
                    end: { dateTime: input.event.end, timeZone: input.event.timezone },
                }),
            });
        } catch (error) {
            await unknown(store, input.proposalId, dependencies, "calendar response was not observed after submission");
            throw new CapabilityExecutionFailure("calendar event outcome is unknown after request submission", {
                effectState: "unknown",
                cause: error,
            });
        }
        if (!response.ok)
            await fail(store, input.proposalId, dependencies, `calendar confirmed failure (${response.status})`);
        const body: unknown = await response.json();
        if (!matchesExisting(body, input.event)) {
            await unknown(
                store,
                input.proposalId,
                dependencies,
                "calendar success response did not confirm the exact event",
            );
            throw new CapabilityExecutionFailure("calendar event outcome could not be verified", {
                effectState: "unknown",
            });
        }
        const evidence = { status: "confirmed", reconciliation: "created" };
        await store.completeAttempt(input.proposalId, "succeeded", dependencies.now().toISOString(), evidence);
        return evidence;
    } catch (error) {
        if (error instanceof CapabilityExecutionFailure) throw error;
        const latest = (await store.load()).proposals.find((item) => item.proposal_id === input.proposalId);
        if (latest?.status === "executing") {
            if (effectSubmitted)
                await unknown(
                    store,
                    input.proposalId,
                    dependencies,
                    "execution ended without trustworthy effect evidence",
                );
            else
                await store.completeAttempt(input.proposalId, "failed", dependencies.now().toISOString(), {
                    status: "confirmed_failure",
                    reason: "execution failed before effect submission",
                });
        }
        throw error;
    }
}

async function token(config: GoogleCalendarConfig, dependencies: Dependencies, signal?: AbortSignal) {
    const [refreshToken, clientSecret] = await Promise.all([
        dependencies.readSecret(config.refresh_token_file),
        dependencies.readSecret(config.client_secret_file),
    ]);
    const response = await dependencies.fetch(dependencies.tokenEndpoint, {
        method: "POST",
        ...(signal === undefined ? {} : { signal }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: config.client_id,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const body: unknown = await response.json();
    if (!response.ok || !isObject(body) || typeof body.access_token !== "string")
        throw new Error("calendar authentication failed before effect submission");
    return body.access_token;
}

async function fail(
    store: ActionProposalStore,
    proposalId: string,
    dependencies: Dependencies,
    reason: string,
): Promise<never> {
    await store.completeAttempt(proposalId, "failed", dependencies.now().toISOString(), {
        status: "confirmed_failure",
        reason,
    });
    throw new Error(reason);
}
async function unknown(store: ActionProposalStore, proposalId: string, dependencies: Dependencies, reason: string) {
    await store.completeAttempt(proposalId, "outcome_unknown", dependencies.now().toISOString(), {
        status: "outcome_unknown",
        reason,
    });
}

function validInput(value: unknown): value is unknown & GoogleCalendarCreateInput {
    if (!isObject(value) || !exactKeys(value, ["event", "proposalId"]) || typeof value.proposalId !== "string")
        return false;
    const event = value.event;
    return (
        isObject(event) &&
        exactKeys(event, ["end", "start", "timezone", "title"]) &&
        typeof event.title === "string" &&
        event.title.trim().length > 0 &&
        event.title.length <= 256 &&
        isRfc3339Utc(event.start) &&
        isRfc3339Utc(event.end) &&
        event.end > event.start &&
        typeof event.timezone === "string" &&
        event.timezone.length > 0 &&
        event.timezone.length <= 100
    );
}
function eventUrl(config: GoogleCalendarConfig, origin: string, id: string) {
    return new URL(`/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${id}`, origin);
}
function externalEventId(proposalId: string) {
    return `ember${createHash("sha256").update(proposalId).digest("hex").slice(0, 32)}`;
}
function matchesExisting(value: unknown, event: GoogleCalendarCreateInput["event"]) {
    return (
        isObject(value) &&
        value.summary === event.title &&
        isObject(value.start) &&
        value.start.dateTime === event.start &&
        isObject(value.end) &&
        value.end.dateTime === event.end
    );
}
