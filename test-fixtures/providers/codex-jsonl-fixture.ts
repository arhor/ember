#!/usr/bin/env node
import { randomUUID } from "node:crypto";

const arguments_ = process.argv.slice(2);
const threadIdIndex = arguments_.indexOf("--thread-id");
const threadId =
    threadIdIndex >= 0 && arguments_[threadIdIndex + 1] ? arguments_[threadIdIndex + 1] : `fixture-${randomUUID()}`;

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");
const match = prompt.match(/<ember_provider_request>\n([\s\S]+)\n<\/ember_provider_request>/);
if (!match) throw new Error("fixture Codex prompt does not contain an Ember provider request");
const request = JSON.parse(match[1]) as {
    projection: {
        meanings?: Array<{ content?: string }>;
        selection: { meaning_ids: string[] };
        recovery_account?: { ember_cognition_during_interval?: string };
    };
};
const reply = [
    ...(request.projection.meanings ?? []).map((item) => item.content ?? ""),
    request.projection.recovery_account?.ember_cognition_during_interval ?? "unknown_downtime",
]
    .filter(Boolean)
    .join(" | ");
const result = {
    contract_version: 1,
    reply,
    used_meaning_ids: request.projection.selection.meaning_ids,
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: threadId })}\n`);
process.stdout.write(
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`,
);
