import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { CapabilityBinding, CapabilityContext, CapabilityJsonValue } from "./execution.ts";

import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, isRfc3339Utc } from "../core/model.ts";
import { exactKeys, isObject } from "../util.ts";
import { CapabilityExecutionFailure } from "./execution.ts";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_CALENDAR_API_ORIGIN = "https://www.googleapis.com";
export const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_STALENESS_MS = 5 * 60 * 1000;

export interface GoogleCalendarConfig {
    config_version: 1;
    enabled: boolean;
    setup_lineage_id: string;
    principal: string;
    scope: string;
    surfaces: ("local_cli" | "telegram_bot")[];
    authority_source_id: string;
    calendar_id: string;
    calendar_label: string;
    timezone: string;
    client_id: string;
    client_secret_file: string;
    refresh_token_file: string;
}

interface Dependencies {
    fetch: typeof fetch;
    now: () => Date;
    readSecret: (path: string) => Promise<string>;
    apiOrigin: string;
    tokenEndpoint: string;
}

export async function loadGoogleCalendarConfig(path: string): Promise<GoogleCalendarConfig> {
    if (!isAbsolute(path)) throw new ValidationError("Google Calendar config path must be absolute");
    let value: unknown;
    try {
        value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
        if (error instanceof SyntaxError) throw new ValidationError("Google Calendar config is not valid JSON");
        throw error;
    }
    validateGoogleCalendarConfig(value);
    return value;
}

export function validateGoogleCalendarConfig(value: unknown): asserts value is GoogleCalendarConfig {
    const keys = [
        "config_version",
        "enabled",
        "setup_lineage_id",
        "principal",
        "scope",
        "surfaces",
        "authority_source_id",
        "calendar_id",
        "calendar_label",
        "timezone",
        "client_id",
        "client_secret_file",
        "refresh_token_file",
    ];
    if (!isObject(value) || !exactKeys(value, keys) || value.config_version !== 1 || typeof value.enabled !== "boolean")
        throw new ValidationError("invalid Google Calendar configuration");
    for (const key of [
        "setup_lineage_id",
        "principal",
        "scope",
        "authority_source_id",
        "calendar_id",
        "calendar_label",
        "timezone",
        "client_id",
    ])
        if (!safeText(value[key])) throw new ValidationError("invalid Google Calendar configuration");
    if (
        !Array.isArray(value.surfaces) ||
        value.surfaces.length === 0 ||
        new Set(value.surfaces).size !== value.surfaces.length ||
        value.surfaces.some((x) => x !== "local_cli" && x !== "telegram_bot")
    )
        throw new ValidationError("Google Calendar surfaces must be an explicit local_cli/telegram_bot allowlist");
    for (const key of ["client_secret_file", "refresh_token_file"])
        if (!safeText(value[key]) || !isAbsolute(value[key] as string))
            throw new ValidationError("Google Calendar secret paths must be absolute");
}

export function selectGoogleCalendarCapability(
    config: GoogleCalendarConfig | undefined,
    context: Pick<CapabilityContext, "principal" | "scope" | "surface">,
    dependencies: Partial<Dependencies> = {},
): CapabilityBinding[] {
    if (
        !config?.enabled ||
        config.principal !== context.principal ||
        config.scope !== context.scope ||
        !config.surfaces.includes(context.surface as never)
    )
        return [];
    return [createGoogleCalendarCapability(config, dependencies)];
}

export function createGoogleCalendarCapability(
    config: GoogleCalendarConfig,
    overrides: Partial<Dependencies> = {},
): CapabilityBinding {
    validateGoogleCalendarConfig(config);
    const dependencies: Dependencies = {
        fetch,
        now: () => new Date(),
        readSecret: async (path) => (await readFile(path, "utf8")).trim(),
        apiOrigin: GOOGLE_CALENDAR_API_ORIGIN,
        tokenEndpoint: GOOGLE_OAUTH_TOKEN_ENDPOINT,
        ...overrides,
    };
    return {
        name: "googleCalendarEvents",
        description: "Read up to 20 events from the configured calendar in a bounded RFC 3339 interval.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                timeMin: { type: "string", format: "date-time" },
                timeMax: { type: "string", format: "date-time" },
            },
            required: ["timeMin", "timeMax"],
        },
        occurrencePolicy: "at_most_once_per_cognition",
        authorize: (context) =>
            context.principal === config.principal &&
            context.scope === config.scope &&
            config.surfaces.includes(context.surface as never)
                ? {
                      status: "authorized",
                      basis: "standing_authority",
                      sourceId: config.authority_source_id,
                      current: true,
                  }
                : {
                      status: "denied",
                      reason: "calendar standing authority does not match principal, scope, and surface",
                  },
        validateInput: (_context, input) => validateRange(input),
        execute: async (_context, input, { signal }) =>
            lookup(config, input as { timeMin: string; timeMax: string }, dependencies, signal),
    };
}

function validateRange(input: unknown) {
    if (
        !isObject(input) ||
        !exactKeys(input, ["timeMin", "timeMax"]) ||
        !isRfc3339Utc(input.timeMin) ||
        !isRfc3339Utc(input.timeMax)
    )
        return { status: "rejected" as const, reason: "timeMin and timeMax must be exact RFC 3339 UTC timestamps" };
    const range = Date.parse(input.timeMax) - Date.parse(input.timeMin);
    return range > 0 && range <= MAX_RANGE_MS
        ? { status: "allowed" as const }
        : { status: "rejected" as const, reason: "calendar interval must be positive and no longer than 31 days" };
}

async function lookup(
    config: GoogleCalendarConfig,
    input: { timeMin: string; timeMax: string },
    dependencies: Dependencies,
    signal?: AbortSignal,
): Promise<CapabilityJsonValue> {
    let accessToken: string;
    try {
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
        if (!response.ok) {
            throw new CapabilityExecutionFailure("calendar authentication is unavailable", {
                effectState: "not_started",
                outcome: response.status === 400 || response.status === 401 ? "source_unavailable" : "failed",
            });
        }
        if (!isObject(body) || !safeText(body.access_token))
            throw new CapabilityExecutionFailure("calendar authentication response was malformed", {
                effectState: "not_started",
            });
        accessToken = body.access_token;
    } catch (error) {
        if (signal?.aborted) throw error;
        if (error instanceof CapabilityExecutionFailure) throw error;
        throw new CapabilityExecutionFailure("calendar authentication request failed", {
            effectState: "not_started",
            cause: error,
        });
    }
    const url = new URL(
        `/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`,
        dependencies.apiOrigin,
    );
    for (const [key, value] of Object.entries({
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        timeZone: config.timezone,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "20",
        fields: "etag,updated,nextPageToken,items(id,summary,status,start,end,updated)",
    }))
        url.searchParams.set(key, value);
    let response: Response;
    try {
        response = await dependencies.fetch(url, {
            ...(signal === undefined ? {} : { signal }),
            headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        });
    } catch (error) {
        throw new CapabilityExecutionFailure("calendar request failed", {
            effectState: signal?.aborted ? "unknown" : "not_started",
            cause: error,
        });
    }
    if (response.status === 401 || response.status === 403 || response.status === 404)
        throw new CapabilityExecutionFailure("calendar source is unavailable", {
            effectState: "not_started",
            outcome: "source_unavailable",
        });
    if (!response.ok) throw new CapabilityExecutionFailure("calendar request failed", { effectState: "not_started" });
    const responseDate = Date.parse(response.headers.get("date") ?? "");
    const ageSeconds = Number(response.headers.get("age") ?? "0");
    const provenAge = Math.max(
        Number.isFinite(responseDate) ? dependencies.now().getTime() - responseDate : 0,
        Number.isFinite(ageSeconds) ? ageSeconds * 1000 : 0,
    );
    if (provenAge > MAX_STALENESS_MS)
        throw new CapabilityExecutionFailure("calendar response freshness is stale", {
            effectState: "not_started",
            outcome: "source_stale",
        });
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new CapabilityExecutionFailure("calendar response was malformed", { effectState: "not_started" });
    }
    if (!isObject(body) || !Array.isArray(body.items) || body.items.some((item) => !validEvent(item)))
        throw new CapabilityExecutionFailure("calendar response was malformed", { effectState: "not_started" });
    const observedAt = dependencies.now().toISOString();
    return {
        status: "observed",
        observedAt,
        source: { id: hash(config.calendar_id), label: config.calendar_label },
        collection: {
            etag: typeof body.etag === "string" ? body.etag : null,
            updatedAt: typeof body.updated === "string" ? body.updated : null,
        },
        query: input,
        truncated: typeof body.nextPageToken === "string",
        events: body.items.map((item: Record<string, unknown>) => ({
            id: hash(item.id as string),
            title: item.summary as string,
            status: item.status as string,
            start: eventTime(item.start as Record<string, unknown>),
            end: eventTime(item.end as Record<string, unknown>),
            sourceUpdatedAt: item.updated as string,
        })),
    };
}

function validEvent(value: unknown): value is Record<string, unknown> {
    return (
        isObject(value) &&
        safeText(value.id) &&
        typeof value.summary === "string" &&
        safeText(value.status) &&
        validEventTime(value.start) &&
        validEventTime(value.end) &&
        safeText(value.updated)
    );
}
function validEventTime(value: unknown): value is Record<string, unknown> {
    return (
        isObject(value) &&
        ((typeof value.dateTime === "string" && value.dateTime.length > 0) ||
            (typeof value.date === "string" && value.date.length > 0))
    );
}
function eventTime(value: Record<string, unknown>): CapabilityJsonValue {
    return typeof value.dateTime === "string"
        ? { dateTime: value.dateTime, ...(typeof value.timeZone === "string" ? { timeZone: value.timeZone } : {}) }
        : { date: value.date as string };
}
function hash(value: string) {
    return `gcal_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}
function safeText(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 4096 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}
