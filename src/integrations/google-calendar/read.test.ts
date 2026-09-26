import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityExecutionFirewall } from "../../core/capabilities/execution.ts";
import { createGoogleCalendarCapability, selectGoogleCalendarCapability } from "./read.ts";

const config = {
    config_version: 1 as const,
    enabled: true,
    setup_lineage_id: "lineage-test",
    principal: "alice",
    scope: "private",
    surfaces: ["local_cli" as const, "telegram_bot" as const],
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

function response(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json", date: "Tue, 15 Sep 2026 10:00:00 GMT" },
        ...init,
    });
}

test("calendar binding constructs a bounded request and redacts external identifiers", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const capability = createGoogleCalendarCapability(config, {
        now: () => new Date("2026-09-15T10:01:00Z"),
        readSecret: async (path) => (path.includes("refresh") ? "refresh-secret" : "client-secret"),
        fetch: async (input, init) => {
            calls.push({ url: String(input), ...(init ? { init } : {}) });
            return calls.length === 1
                ? response({ access_token: "access-secret" })
                : response({
                      etag: "collection-etag",
                      updated: "2026-09-15T10:00:00Z",
                      nextPageToken: "more",
                      items: [
                          {
                              id: "raw-google-id",
                              summary: "Dentist",
                              status: "confirmed",
                              start: { dateTime: "2026-09-16T09:00:00+02:00" },
                              end: { dateTime: "2026-09-16T10:00:00+02:00" },
                              updated: "2026-09-14T12:00:00Z",
                              description: "private",
                          },
                      ],
                  });
        },
    });
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        timeMin: "2026-09-15T00:00:00Z",
        timeMax: "2026-09-30T00:00:00Z",
    });
    assert.equal(result.outcome, "succeeded");
    const serialized = JSON.stringify(result);
    assert.match(serialized, /Dentist/);
    assert.doesNotMatch(serialized, /raw-google-id|alice@example|private|access-secret|refresh-secret/);
    const url = new URL(calls[1]!.url);
    assert.equal(url.searchParams.get("maxResults"), "20");
    assert.equal(url.searchParams.get("singleEvents"), "true");
    assert.equal(
        calls[1]!.init?.headers && (calls[1]!.init.headers as Record<string, string>).authorization,
        "Bearer access-secret",
    );
});

test("calendar selection and ranges preserve standing-authority boundaries", async () => {
    assert.equal(
        selectGoogleCalendarCapability(config, {
            lineageId: "lineage-test",
            principal: "mallory",
            scope: "private",
            surface: "local_cli",
        }).length,
        0,
    );
    assert.equal(
        selectGoogleCalendarCapability(config, {
            lineageId: "lineage-test",
            principal: "alice",
            scope: "other",
            surface: "local_cli",
        }).length,
        0,
    );
    assert.equal(
        selectGoogleCalendarCapability(config, {
            lineageId: "lineage-other",
            principal: "alice",
            scope: "private",
            surface: "local_cli",
        }).length,
        0,
    );
    const capability = createGoogleCalendarCapability(config);
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        timeMin: "2026-01-01T00:00:00Z",
        timeMax: "2026-03-01T00:00:00Z",
    });
    assert.equal(result.outcome, "input_rejected");
});

test("calendar reports unavailable and stale sources without exposing events", async () => {
    for (const [status, expected] of [
        [401, "source_unavailable"],
        [200, "source_stale"],
    ] as const) {
        let call = 0;
        const capability = createGoogleCalendarCapability(config, {
            now: () => new Date("2026-09-15T10:10:01Z"),
            readSecret: async () => "secret",
            fetch: async () =>
                ++call === 1
                    ? response({ access_token: "token" })
                    : status === 401
                      ? response({}, { status })
                      : response({ items: [{ id: "must-not-leak" }] }),
        });
        const result = await createCapabilityExecutionFirewall([capability], {
            ...context,
            cognitionId: `cognition-${status}` as never,
        }).execute(capability.name, { timeMin: "2026-09-15T00:00:00Z", timeMax: "2026-09-16T00:00:00Z" });
        assert.equal(result.outcome, expected);
        assert.equal(result.output, undefined);
        assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
    }
});

test("calendar observes legitimate untitled events with Google's default status", async () => {
    let call = 0;
    const capability = createGoogleCalendarCapability(config, {
        now: () => new Date("2026-09-15T10:01:00Z"),
        readSecret: async () => "secret",
        fetch: async () =>
            ++call === 1
                ? response({ access_token: "token" })
                : response({
                      items: [
                          {
                              id: "untitled-event",
                              start: { date: "2026-09-16" },
                              end: { date: "2026-09-17" },
                              updated: "2026-09-15T09:00:00Z",
                          },
                      ],
                  }),
    });
    const result = await createCapabilityExecutionFirewall([capability], context).execute(capability.name, {
        timeMin: "2026-09-15T00:00:00Z",
        timeMax: "2026-09-16T00:00:00Z",
    });
    assert.equal(result.outcome, "succeeded");
    assert.match(JSON.stringify(result.output), /"title":null/);
    assert.match(JSON.stringify(result.output), /"status":"confirmed"/);
});
