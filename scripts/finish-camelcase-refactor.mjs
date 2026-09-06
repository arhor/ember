import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const roots = ["bin", "docs", "eval", "experiments", "src", "tests"];
const extensions = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".md", ".json"]);
const modelPath = resolve("src/core/model.ts");
const utilPath = resolve("src/util.ts");
const movedUtilities = new Set(["cloneState", "contentDigest", "exactKeys", "isNotBlankString", "isObject"]);

// Ember-owned model / projection / provider contract names. String-valued
// semantic vocabulary and third-party protocol keys (notably Telegram) are
// deliberately not part of this map.
const renames = new Map(
    Object.entries({
        schema_version: "schemaVersion",
        runtime_contract: "runtimeContract",
        local_principal: "localPrincipal",
        boundary_id: "boundaryId",
        lineage_id: "lineageId",
        display_name: "displayName",
        established_at: "establishedAt",
        constitutive_boundaries: "constitutiveBoundaries",
        evidence_id: "evidenceId",
        source_role: "sourceRole",
        source_actor: "sourceActor",
        asserted_principal: "assertedPrincipal",
        occurred_at: "occurredAt",
        observed_at: "observedAt",
        derived_from_evidence_ids: "derivedFromEvidenceIds",
        related_meaning_id: "relatedMeaningId",
        cognition_id: "cognitionId",
        provider_label: "providerLabel",
        payload_mode: "payloadMode",
        content_digest: "contentDigest",
        unavailable_reason: "unavailableReason",
        meaning_id: "meaningId",
        source_evidence_ids: "sourceEvidenceIds",
        epistemic_role: "epistemicRole",
        learned_at: "learnedAt",
        applicable_from: "applicableFrom",
        applicable_until: "applicableUntil",
        prospective_lifecycle: "prospectiveLifecycle",
        superseded_by: "supersededBy",
        previous_runtime: "previousRuntime",
        current_runtime: "currentRuntime",
        gap_kind: "gapKind",
        last_durable_observation_at: "lastDurableObservationAt",
        clean_stop_at: "cleanStopAt",
        restart_at: "restartAt",
        ember_cognition_during_interval: "emberCognitionDuringInterval",
        external_changes_during_interval: "externalChangesDuringInterval",
        runtime_id: "runtimeId",
        active_scope: "activeScope",
        started_at: "startedAt",
        stop_reason: "stopReason",
        recovery_account: "recoveryAccount",
        direct_child_exit_observed: "directChildExitObserved",
        selected_meaning_ids: "selectedMeaningIds",
        selected_evidence_ids: "selectedEvidenceIds",
        used_meaning_ids: "usedMeaningIds",
        input_evidence_id: "inputEvidenceId",
        expression_evidence_id: "expressionEvidenceId",
        delivery_status: "deliveryStatus",
        external_provider_thread_id: "externalProviderThreadId",
        provider_termination: "providerTermination",
        opportunity_id: "opportunityId",
        validated_revision: "validatedRevision",
        projected_meaning_ids: "projectedMeaningIds",
        projected_evidence_ids: "projectedEvidenceIds",
        interruption_status: "interruptionStatus",
        runtime_episodes: "runtimeEpisodes",
        cognition_episodes: "cognitionEpisodes",
        cognition_opportunities: "cognitionOpportunities",
        prior_snapshot: "priorSnapshot",
        current_observation: "currentObservation",
        current_meanings: "currentMeanings",
        relevant_history: "relevantHistory",
        contract_version: "contractVersion",
        current_time_utc: "currentTimeUtc",
        external_thread_id: "externalThreadId",
        state_revision: "stateRevision",
    }),
);

let changedFiles = 0;
for (const root of roots) await visit(root);
console.log(`updated ${changedFiles} files`);

async function visit(path) {
    let entries;
    try {
        entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
    }

    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const child = join(path, entry.name);
        if (entry.isDirectory()) {
            await visit(child);
            continue;
        }
        if (!extensions.has(extname(entry.name))) continue;

        const original = await readFile(child, "utf8");
        let updated = original;
        for (const [from, to] of renames) {
            updated = updated.replace(new RegExp(`\\b${from}\\b`, "g"), to);
        }
        if ([".ts", ".mts", ".cts"].includes(extname(entry.name))) {
            updated = migrateUtilityImports(child, updated);
        }
        if (updated !== original) {
            await writeFile(child, updated);
            changedFiles += 1;
        }
    }
}

function migrateUtilityImports(path, source) {
    const moved = new Set();
    const modelImport = /import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)";/g;
    let updated = source.replace(modelImport, (whole, body, specifier) => {
        if (resolve(dirname(path), specifier) !== modelPath) return whole;

        const kept = [];
        for (const raw of body.split(",")) {
            const spec = raw.trim();
            if (!spec) continue;
            const imported = /^(?:type\s+)?([A-Za-z_$][\w$]*)/.exec(spec)?.[1];
            if (imported && movedUtilities.has(imported)) moved.add(imported);
            else kept.push(spec);
        }
        if (kept.length === 0) return "";
        return `import { ${kept.join(", ")} } from "${specifier}";`;
    });

    if (moved.size === 0) return updated;

    let utilSpecifier = relative(dirname(path), utilPath).replaceAll("\\", "/");
    if (!utilSpecifier.startsWith(".")) utilSpecifier = `./${utilSpecifier}`;

    let merged = false;
    updated = updated.replace(modelImport, (whole, body, specifier) => {
        if (resolve(dirname(path), specifier) !== utilPath) return whole;
        const existing = body
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        const names = [...new Set([...existing, ...moved])].sort();
        merged = true;
        return `import { ${names.join(", ")} } from "${specifier}";`;
    });

    if (!merged) updated = `import { ${[...moved].sort().join(", ")} } from "${utilSpecifier}";\n${updated}`;
    return updated;
}
