#!/usr/bin/env node

export {};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const start = prompt.indexOf("<ember_provider_request>");
const end = prompt.indexOf("</ember_provider_request>");
const memory = start < 0 || end < 0;
const payload = prompt.slice(start + "<ember_provider_request>".length, end);
const request = memory ? null : JSON.parse(payload.slice(payload.indexOf("{"), payload.lastIndexOf("}") + 1));
const result = memory
    ? { contractVersion: 1, candidates: [] }
    : {
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
