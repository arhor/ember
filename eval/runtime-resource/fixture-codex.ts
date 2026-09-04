#!/usr/bin/env node

import { setTimeout as delay } from "node:timers/promises";

const holdMs = readPositiveInteger("--hold-ms", 1_200);
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const prompt = Buffer.concat(chunks).toString("utf8");

await delay(holdMs);

const threadId = prompt.includes("<ember_specialist_episode>")
    ? "thread-resource-specialist"
    : "thread-resource-cognition";
const result = prompt.includes("<ember_specialist_episode>") ? specialistReport() : providerResult(prompt);

process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: threadId })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
process.stdout.write(
    `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } })}\n`,
);
process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`);

function providerResult(promptText: string) {
    const match = /<ember_provider_request>\n([^\n]+)\n<\/ember_provider_request>/.exec(promptText);
    if (!match) throw new Error("bounded Ember provider request is missing");
    const request = JSON.parse(match[1]) as {
        input?: { text?: string };
        projection?: { selection?: { meaning_ids?: string[] } };
    };
    const isOpportunity = request.input?.text?.includes("discretionary cognition now") ?? false;
    return {
        contract_version: 1,
        reply: isOpportunity ? "no_cognition" : "RESOURCE_EVALUATION_REPLY",
        used_meaning_ids: isOpportunity ? [] : (request.projection?.selection?.meaning_ids ?? []),
    };
}

function specialistReport() {
    return {
        contract_version: 1,
        summary: "Inspected the bounded resource-evaluation workspace without mutation.",
        objective_disposition: "completed",
        artifacts_changed: [],
        artifacts_inspected: [],
        checks: [],
        known_effects: [],
        possible_effects: [],
        blockers: [],
        requested_follow_up: [],
        expansion_requests: [],
    };
}

function readPositiveInteger(flag: string, fallback: number) {
    const index = process.argv.indexOf(flag);
    if (index < 0) return fallback;
    const value = Number(process.argv[index + 1]);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${flag} must be a positive integer`);
    return value;
}
