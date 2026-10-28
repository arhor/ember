#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const counterIndex = args.indexOf("--reflection-counter");
const counterPath = counterIndex < 0 ? null : args[counterIndex + 1];
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));

let reply = "PRIMARY_RESPONSE";
if (request.projection.surface === "memory_proposal_reflection") {
    if (counterPath === null) throw new Error("reflection counter path is required");
    let count = 0;
    try {
        count = Number(await readFile(counterPath, "utf8"));
    } catch {}
    await writeFile(counterPath, String(count + 1));
    reply = JSON.stringify({ contractVersion: 1, candidates: [] });
}

process.stdout.write(JSON.stringify({ contractVersion: 1, reply, usedMeaningIds: [] }));
