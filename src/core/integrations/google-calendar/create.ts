import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { ActionProposalStore } from "../../capabilities/action-proposal.ts";
import type { CapabilityBinding, CapabilityContext, CapabilityJsonValue } from "../../capabilities/execution.ts";
import type { GoogleCalendarConfig } from "./read.ts";

import { CapabilityExecutionFailure } from "../../capabilities/execution.ts";
import { isRfc3339Utc } from "../../model.ts";
import { exactKeys, isObject } from "../../util.ts";
import { GOOGLE_CALENDAR_API_ORIGIN, GOOGLE_OAUTH_TOKEN_ENDPOINT } from "./read.ts";

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

interface CalendarRecoveryBinding extends Record<string, CapabilityJsonValue> {
    kind: "google_calendar_v1";
    targetFingerprint: `sha256:${string}`;
    calendarId: string;
    clientId: string;
    clientSecretFile: string;
    refreshTokenFile: string;
    setupLineageId: string;
}

interface GoogleCalendarProposalInput {
    event: GoogleCalendarCreateInput["event"];
    purpose: string;
    consequence: string;
}

export function selectApprovedGoogleCalendarEventCapability(
    config: GoogleCalendarConfig | undefined,
    store: ActionProposalStore,
    context: Pick<CapabilityContext, "principal" | "scope" | "surface"> & { lineageId: string },
    dependencies: Partial<Dependencies> = {},
): CapabilityBinding[] {
    if (
        !config?.enabled ||
        config.principal !== context.principal ||
        config.setup_lineage_id !== context.lineageId ||
        config.scope !== context.scope ||
        !config.surfaces.includes(context.surface as never)
    )
        return [];
    return [
        createGoogleCalendarEventProposalCapability(config, store, dependencies),
        createApprovedGoogleCalendarEventCapability(config, store, dependencies),
    ];
}

export function createGoogleCalendarEventProposalCapability(
    config: GoogleCalendarConfig,
    store: ActionProposalStore,
    overrides: Partial<Dependencies> = {},
): CapabilityBinding {
    const now = overrides.now ?? (() => new Date());
    return {
        name: "googleCalendarProposeEvent",
        description:
            "Create a durable proposal for one calendar event. This does not create the event or grant approval.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
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
                purpose: { type: "string" },
                consequence: { type: "string" },
            },
            required: ["event", "purpose", "consequence"],
        },
        occurrencePolicy: "at_most_once_per_cognition",
        authorize: (context) =>
            context.principal === config.principal && context.scope === config.scope
                ? {
                      status: "authorized",
                      basis: "current_instruction",
                      sourceId: context.cognitionId,
                      current: true,
                  }
                : { status: "denied", reason: "calendar proposal principal or scope does not match configuration" },
        validateInput: (_context, input) =>
            validProposalInput(input)
                ? { status: "allowed" }
                : { status: "rejected", reason: "calendar proposal fields are invalid or unbounded" },
        execute: async (context, input) => {
            const value = input as GoogleCalendarProposalInput;
            const createdAt = now();
            const proposal = await store.create({
                capability: "googleCalendarCreateEvent",
                principal: context.principal,
                scope: context.scope,
                purpose: value.purpose,
                consequence: value.consequence,
                payload: value.event,
                target: { label: config.calendar_label, fingerprint: calendarTargetFingerprint(config) },
                sourceIds: [context.cognitionId],
                createdAt: createdAt.toISOString(),
                expiresAt: new Date(createdAt.getTime() + 15 * 60_000).toISOString(),
            });
            return {
                status: "approval_required",
                proposalId: proposal.proposal_id,
                payloadDigest: proposal.payload_digest,
                expiresAt: proposal.expires_at,
                event: proposal.payload,
                purpose: proposal.purpose,
                consequence: proposal.consequence,
            };
        },
    };
}

interface Dependencies {
    fetch: typeof fetch;
    now: () => Date;
    readSecret: (path: string) => Promise<string>;
    apiOrigin: string;
    tokenEndpoint: string;
    revalidateObjective: (proposalId: string) => Promise<{ status: "current" } | { status: "stale"; reason: string }>;
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
        revalidateObjective: async () => ({
            status: "stale",
            reason: "objective currentness revalidation is unavailable",
        }),
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
            const existing = await store.correlate(input.proposalId, "googleCalendarCreateEvent", input.event, context);
            if (existing?.status === "executing") {
                const persistedInput = { proposalId: existing.proposal_id, event: existing.payload };
                if (!validInput(persistedInput))
                    return { status: "denied", reason: "persisted proposal payload is invalid" };
                const recoveryConfig = recoveryConfigFor(existing.attempt!.recovery_binding, config);
                if (!recoveryConfig)
                    return { status: "denied", reason: "submitted attempt recovery binding is invalid" };
                await reconcileInterruptedAttempt(
                    recoveryConfig,
                    store,
                    persistedInput,
                    dependencies,
                    existing.attempt!.phase,
                );
            }
            if (existing?.status !== "executing" && existing?.target.fingerprint !== calendarTargetFingerprint(config))
                return { status: "denied", reason: "calendar target configuration changed after proposal creation" };
            if (existing?.objective_step) {
                const currentness = await dependencies.revalidateObjective(existing.proposal_id);
                if (currentness.status === "stale")
                    return { status: "denied", reason: `objective action is stale: ${currentness.reason}` };
            }
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
    const externalId = externalEventId(input.proposalId);
    let effectSubmitted = false;
    let accessToken: string;
    try {
        let current: Response;
        try {
            accessToken = await token(config, dependencies, signal);
            current = await dependencies.fetch(eventUrl(config, dependencies.apiOrigin, externalId), {
                ...(signal === undefined ? {} : { signal }),
                headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
            });
        } catch (error) {
            throw new CapabilityExecutionFailure("calendar pre-effect authentication or currentness check failed", {
                effectState: "not_started",
                cause: error,
            });
        }
        if (current.ok) {
            await store.beginAttempt(input.proposalId, startedAt, googleCalendarRecoveryBinding(config));
            await fail(store, input.proposalId, dependencies, "deterministic event identifier is already occupied");
        }
        if (current.status !== 404)
            throw new CapabilityExecutionFailure("calendar currentness recheck failed before effect submission", {
                effectState: "not_started",
            });

        await store.beginAttempt(input.proposalId, startedAt, googleCalendarRecoveryBinding(config));
        let response: Response;
        try {
            const url = new URL(
                `/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`,
                dependencies.apiOrigin,
            );
            url.searchParams.set("sendUpdates", "none");
            await store.markSubmitted(input.proposalId);
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
            return await reconcileAfterSubmission(
                config,
                store,
                input,
                dependencies,
                accessToken,
                `calendar response was not observed after submission: ${error instanceof Error ? error.message : String(error)}`,
                signal,
            );
        }
        if (!response.ok)
            return await reconcileAfterSubmission(
                config,
                store,
                input,
                dependencies,
                accessToken,
                `calendar returned HTTP ${response.status} after submission`,
                signal,
            );
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
            if (effectSubmitted) {
                await unknown(
                    store,
                    input.proposalId,
                    dependencies,
                    "execution ended without trustworthy effect evidence",
                );
                throw new CapabilityExecutionFailure("calendar event outcome is unknown after effect submission", {
                    effectState: "unknown",
                    cause: error,
                });
            } else
                await store.completeAttempt(input.proposalId, "failed", dependencies.now().toISOString(), {
                    status: "confirmed_failure",
                    reason: "execution failed before effect submission",
                });
        }
        throw error;
    }
}

async function reconcileInterruptedAttempt(
    config: GoogleCalendarConfig,
    store: ActionProposalStore,
    input: GoogleCalendarCreateInput,
    dependencies: Dependencies,
    phase: "prepared" | "submitted" | "terminal",
) {
    if (phase === "prepared") {
        await store.completeAttempt(input.proposalId, "failed", dependencies.now().toISOString(), {
            status: "confirmed_failure",
            reason: "process stopped before effect submission",
        });
        return;
    }
    if (phase !== "submitted") return;
    let accessToken: string;
    try {
        accessToken = await token(config, dependencies);
    } catch {
        await unknown(store, input.proposalId, dependencies, "submitted attempt could not be reconciled after restart");
        return;
    }
    try {
        await reconcileAfterSubmission(
            config,
            store,
            input,
            dependencies,
            accessToken,
            "process stopped after effect submission",
        );
    } catch {
        // Reconciliation persists a terminal state before reporting it.
    }
}

async function reconcileAfterSubmission(
    config: GoogleCalendarConfig,
    store: ActionProposalStore,
    input: GoogleCalendarCreateInput,
    dependencies: Dependencies,
    accessToken: string,
    ambiguity: string,
    signal?: AbortSignal,
): Promise<CapabilityJsonValue> {
    let response: Response;
    try {
        response = await dependencies.fetch(
            eventUrl(config, dependencies.apiOrigin, externalEventId(input.proposalId)),
            {
                ...(signal === undefined ? {} : { signal }),
                headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
            },
        );
    } catch (error) {
        await unknown(store, input.proposalId, dependencies, `${ambiguity}; reconciliation request failed`);
        throw new CapabilityExecutionFailure("calendar event outcome remains unknown after reconciliation failed", {
            effectState: "unknown",
            cause: error,
        });
    }
    if (response.ok) {
        let body: unknown;
        try {
            body = await response.json();
        } catch (error) {
            await unknown(store, input.proposalId, dependencies, `${ambiguity}; reconciliation response was malformed`);
            throw new CapabilityExecutionFailure(
                "calendar event outcome remains unknown after malformed reconciliation",
                {
                    effectState: "unknown",
                    cause: error,
                },
            );
        }
        if (!validReconciliationEvent(body)) {
            await unknown(
                store,
                input.proposalId,
                dependencies,
                `${ambiguity}; reconciliation response shape was invalid`,
            );
            throw new CapabilityExecutionFailure(
                "calendar event outcome remains unknown after invalid reconciliation",
                {
                    effectState: "unknown",
                },
            );
        }
        if (matchesExisting(body, input.event)) {
            const evidence = { status: "confirmed", reconciliation: "found_after_ambiguity" };
            await store.completeAttempt(input.proposalId, "succeeded", dependencies.now().toISOString(), evidence);
            return evidence;
        }
        await fail(store, input.proposalId, dependencies, "calendar event identifier contains a conflicting event");
    }
    await unknown(
        store,
        input.proposalId,
        dependencies,
        response.status === 404
            ? `${ambiguity}; absence now cannot prove the effect never occurred`
            : `${ambiguity}; reconciliation returned HTTP ${response.status}`,
    );
    throw new CapabilityExecutionFailure("calendar event outcome remains unknown after submission", {
        effectState: "unknown",
    });
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
        Date.parse(event.end) > Date.parse(event.start) &&
        typeof event.timezone === "string" &&
        event.timezone.length > 0 &&
        event.timezone.length <= 100
    );
}
function validProposalInput(value: unknown): value is unknown & GoogleCalendarProposalInput {
    return (
        isObject(value) &&
        exactKeys(value, ["consequence", "event", "purpose"]) &&
        typeof value.purpose === "string" &&
        value.purpose.trim().length > 0 &&
        value.purpose.length <= 1_024 &&
        typeof value.consequence === "string" &&
        value.consequence.trim().length > 0 &&
        value.consequence.length <= 1_024 &&
        validInput({ proposalId: "action-proposal-validation", event: value.event })
    );
}
function eventUrl(config: GoogleCalendarConfig, origin: string, id: string) {
    return new URL(`/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events/${id}`, origin);
}
export function calendarTargetFingerprint(config: GoogleCalendarConfig): `sha256:${string}` {
    return `sha256:${createHash("sha256")
        .update(
            JSON.stringify({
                setupLineageId: config.setup_lineage_id,
                calendarId: config.calendar_id,
                clientId: config.client_id,
                clientSecretFile: config.client_secret_file,
                refreshTokenFile: config.refresh_token_file,
            }),
        )
        .digest("hex")}`;
}
export function googleCalendarRecoveryBinding(config: GoogleCalendarConfig): CalendarRecoveryBinding {
    return {
        kind: "google_calendar_v1",
        targetFingerprint: calendarTargetFingerprint(config),
        calendarId: config.calendar_id,
        clientId: config.client_id,
        clientSecretFile: config.client_secret_file,
        refreshTokenFile: config.refresh_token_file,
        setupLineageId: config.setup_lineage_id,
    };
}
function recoveryConfigFor(value: CapabilityJsonValue, current: GoogleCalendarConfig): GoogleCalendarConfig | null {
    if (
        !isObject(value) ||
        Array.isArray(value) ||
        !exactKeys(value, [
            "calendarId",
            "clientId",
            "clientSecretFile",
            "kind",
            "refreshTokenFile",
            "setupLineageId",
            "targetFingerprint",
        ]) ||
        value.kind !== "google_calendar_v1" ||
        ![value.calendarId, value.clientId, value.clientSecretFile, value.refreshTokenFile, value.setupLineageId].every(
            (item) => typeof item === "string" && item.length > 0,
        ) ||
        typeof value.targetFingerprint !== "string"
    )
        return null;
    const recovered = {
        ...current,
        calendar_id: value.calendarId as string,
        client_id: value.clientId as string,
        client_secret_file: value.clientSecretFile as string,
        refresh_token_file: value.refreshTokenFile as string,
        setup_lineage_id: value.setupLineageId as string,
    };
    return calendarTargetFingerprint(recovered) === value.targetFingerprint ? recovered : null;
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
        value.start.timeZone === event.timezone &&
        isObject(value.end) &&
        value.end.dateTime === event.end &&
        value.end.timeZone === event.timezone
    );
}
function validReconciliationEvent(value: unknown) {
    return (
        isObject(value) &&
        typeof value.summary === "string" &&
        isObject(value.start) &&
        typeof value.start.dateTime === "string" &&
        typeof value.start.timeZone === "string" &&
        isObject(value.end) &&
        typeof value.end.dateTime === "string" &&
        typeof value.end.timeZone === "string"
    );
}
