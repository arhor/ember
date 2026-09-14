#!/usr/bin/env node

export {};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const start = prompt.indexOf("<ember_provider_request>");
const end = prompt.indexOf("</ember_provider_request>");
if (start < 0 || end < 0) throw new Error("bounded Ember request is missing");
const payload = prompt.slice(start + "<ember_provider_request>".length, end);
const request = JSON.parse(payload.slice(payload.indexOf("{"), payload.lastIndexOf("}") + 1));
const result = {
    contractVersion: 1,
    reply: "CODEX_CLI_RESPONSE",
    usedMeaningIds: request.projection.selection.meaning_ids,
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-cli-46" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
process.stdout.write(
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`,
);
process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`);
