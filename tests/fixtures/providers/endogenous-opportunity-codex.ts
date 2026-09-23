#!/usr/bin/env node

export {};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const input = prompt.split("\n").at(-1);
if (!input) throw new Error("fixture Codex prompt does not contain a structured opportunity request");
const request = JSON.parse(input) as { projection: { selection: { meaning_ids: string[] } } };
const result = {
    contractVersion: 1,
    decision: "cognition",
    selectedMeaningIds: request.projection.selection.meaning_ids,
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-endogenous-restart-fixture" })}\n`);
process.stdout.write(
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`,
);
