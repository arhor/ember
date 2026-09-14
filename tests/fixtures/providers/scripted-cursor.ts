#!/usr/bin/env node

export {};

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
const start = input.indexOf("<ember_provider_request>");
const end = input.indexOf("</ember_provider_request>");
if (start < 0 || end < 0) throw new Error("missing bounded provider request");
const payload = input.slice(start + "<ember_provider_request>".length, end);
const request = JSON.parse(payload.slice(payload.indexOf("{"), payload.lastIndexOf("}") + 1));
process.stdout.write(
    `${JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        result: JSON.stringify({
            contractVersion: 1,
            reply: "CURSOR_CLI_RESPONSE",
            usedMeaningIds: request.projection.selection.meaning_ids,
        }),
        session_id: "session-cli-90",
    })}\n`,
);
