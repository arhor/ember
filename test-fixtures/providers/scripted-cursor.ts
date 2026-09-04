#!/usr/bin/env node

export {};

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
const match = input.match(/<ember_provider_request>\n(.+)\n<\/ember_provider_request>/s);
if (!match) throw new Error("missing bounded provider request");
const request = JSON.parse(match[1]);
process.stdout.write(
    `${JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        result: JSON.stringify({
            contract_version: 1,
            reply: "CURSOR_CLI_RESPONSE",
            used_meaning_ids: request.projection.selection.meaning_ids,
        }),
        session_id: "session-cli-90",
    })}\n`,
);
