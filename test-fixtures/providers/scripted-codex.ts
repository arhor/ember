#!/usr/bin/env node

export {};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const match = /<ember_provider_request>\n([^\n]+)\n<\/ember_provider_request>/.exec(prompt);
if (!match) throw new Error("bounded Ember request is missing");
const request = JSON.parse(match[1]);
const result = {
    contract_version: 1,
    reply: "CODEX_CLI_RESPONSE",
    used_meaning_ids: request.projection.selection.meaning_ids,
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-cli-46" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
process.stdout.write(
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`,
);
process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`);
