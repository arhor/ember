#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
if (!prompt.includes("SAFE_SPECIALIST_MARKER_60")) throw new Error("bounded context marker missing");
await writeFile(join(process.cwd(), "specialist-result.txt"), "controlled specialist work\n", "utf8");
const report = {
  contract_version: 1,
  summary: "Created the requested controlled artifact.",
  objective_disposition: "completed",
  artifacts_changed: ["specialist-result.txt"],
  artifacts_inspected: [],
  checks: [{ command: "read specialist-result.txt", outcome: "controlled specialist work" }],
  known_effects: ["Created specialist-result.txt in the selected workspace."],
  possible_effects: [], blockers: [], requested_follow_up: [],
};
process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-operational-60" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ ...report, summary: "Starting controlled work.", artifacts_changed: [], known_effects: [] }) } })}\n`);
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(report) } })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.completed" })}\n`);
