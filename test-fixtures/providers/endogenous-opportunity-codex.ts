#!/usr/bin/env node
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const match = prompt.match(/<ember_provider_request>\n([\s\S]+)\n<\/ember_provider_request>/);
if (!match) throw new Error("fixture Codex prompt does not contain an Ember provider request");
const request = JSON.parse(match[1]) as {
  projection: { selection: { meaning_ids: string[] } };
};
const result = {
  contract_version: 1,
  reply: "cognition",
  used_meaning_ids: request.projection.selection.meaning_ids,
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-endogenous-restart-fixture" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`);
