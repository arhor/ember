#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2),
    value = (flag) => {
        const index = args.indexOf(flag);
        return index >= 0 ? args[index + 1] : null;
    },
    mode = value("--mode") ?? "normal";
if (mode === "timeout") setInterval(() => {}, 1000);
else if (mode === "oversized") process.stdout.write("x".repeat(1024 * 1024 + 1));
else if (mode === "malformed") process.stdout.write("{");
else if (mode === "invalid-utf8") process.stdout.write(Buffer.from([0xff, 0xfe]));
else if (mode === "extra") process.stdout.write('{"contractVersion":1,"reply":"ok","usedMeaningIds":[]} trailing');
else if (mode === "empty") process.stdout.write(JSON.stringify({ contractVersion: 1, reply: "", usedMeaningIds: [] }));
else if (mode === "nonzero") {
    process.stderr.write("provider diagnostic");
    process.exitCode = 7;
} else if (mode === "noisy-nonzero") {
    for (let i = 0; i < 128; i++) process.stderr.write("x".repeat(1024));
    process.exitCode = 9;
} else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const capture = value("--capture");
    if (capture) await writeFile(capture, JSON.stringify(request));
    const counter = value("--counter");
    if (counter) {
        let count = 0;
        try {
            count = Number(await readFile(counter, "utf8"));
        } catch {}
        await writeFile(counter, String(count + 1));
    }
    const projection = request.projection,
        meanings = projection.meanings ?? [],
        relationship = meanings.find((item) => item.kind === "relationship"),
        fact = meanings.find((item) => item.kind === "fact" && item.currentness === "current"),
        preference = meanings.find((item) => item.kind === "preference" && item.currentness === "current"),
        commitment = meanings.find((item) => item.kind === "commitment" && item.prospectiveLifecycle === "live"),
        gap = projection.gaps?.[0];
    const reply = [
        "CONTINUITY_RESPONSE",
        `lineage:${projection.lineage?.lineageId ?? "not_selected"}`,
        `relationship:${relationship?.content ?? "not_selected"}`,
        `fact:${fact?.content ?? "not_selected"}`,
        `fact_epistemic_role:${fact?.epistemicRole ?? "not_selected"}`,
        `fact_source_actor:${fact?.source_evidence?.[0]?.sourceActor ?? "not_selected"}`,
        `preference:${preference?.content ?? "not_selected"}`,
        `commitment:${commitment?.content ?? "not_selected"}`,
        `commitment_applicability:${commitment?.applicability ?? "not_selected"}`,
        `gap:${gap?.gapKind ?? "none"}`,
        `nickname:${gap ? "unavailable" : "not_requested"}`,
        `downtime:${projection.recoveryAccount?.emberCognitionDuringInterval ?? "none"}`,
    ].join(" | ");
    const result = { contractVersion: 1, reply, usedMeaningIds: projection.selection.meaning_ids };
    if (mode === "unknown-field") result.mutations = [];
    process.stdout.write(JSON.stringify(result));
}
