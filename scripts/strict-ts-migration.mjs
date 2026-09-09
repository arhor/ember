import { readFileSync, writeFileSync } from "node:fs";

function replace(path, from, to) {
    const text = readFileSync(path, "utf8");
    if (text.includes(from)) {
        writeFileSync(path, text.replace(from, to));
        return;
    }
    if (text.includes(to)) return;
    throw new Error(`Expected migration pattern not found in ${path}: ${from.slice(0, 120)}`);
}

function replaceAll(path, from, to) {
    const text = readFileSync(path, "utf8");
    if (text.includes(from)) {
        writeFileSync(path, text.replaceAll(from, to));
        return;
    }
    if (text.includes(to)) return;
    throw new Error(`Expected migration pattern not found in ${path}: ${from.slice(0, 120)}`);
}

replace(
    "eval/process-restart/harness.ts",
    "    const [baselineEpisode, restartedEpisode] = scenario.episodes;",
    "    const [baselineEpisode, restartedEpisode] = scenario.episodes as [ScenarioEpisode, ScenarioEpisode];",
);
replace(
    "eval/process-restart/harness.ts",
    "    const [baseline, restarted] = scenario.episodes;",
    "    const [baseline, restarted] = scenario.episodes as [ScenarioEpisode, ScenarioEpisode];",
);
replace(
    "eval/process-restart/harness.ts",
    `    for (let index = 0; index < setup.length; index += 1) {
        const id = lines[index + 1];
        if (typeof id !== "string" || !id.startsWith("meaning-"))
            throw new Error(\`setup action \${setup[index].as} did not return a meaning id\`);
        aliases.set(setup[index].as, id);
    }`,
    `    for (let index = 0; index < setup.length; index += 1) {
        const action = setup[index]!;
        const id = lines[index + 1];
        if (typeof id !== "string" || !id.startsWith("meaning-"))
            throw new Error(\`setup action \${action.as} did not return a meaning id\`);
        aliases.set(action.as, id);
    }`,
);

replace(
    "src/agency/endogenous-selectivity-evaluation.ts",
    "    const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];",
    "    const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]!;",
);
replace(
    "src/agency/endogenous-selectivity-evaluation.ts",
    "        min: round(sorted[0]),",
    "        min: round(sorted[0]!),",
);

replace(
    "src/cli/main.ts",
    '        id = rememberRelationship(candidate, principal, parts[2], parts[3], parts.slice(4).join(" "));',
    '        id = rememberRelationship(candidate, principal, parts[2]!, parts[3]!, parts.slice(4).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = rememberFact(candidate, principal, parts[2], parts[3], parts[4], parts.slice(5).join(" "));',
    '        id = rememberFact(candidate, principal, parts[2]!, parts[3]!, parts[4]!, parts.slice(5).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = rememberPreference(candidate, principal, parts[1], parts[2], parts[3], parts.slice(4).join(" "));',
    '        id = rememberPreference(candidate, principal, parts[1]!, parts[2]!, parts[3]!, parts.slice(4).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = supersede(candidate, principal, parts[1], parts.slice(2).join(" "));',
    '        id = supersede(candidate, principal, parts[1]!, parts.slice(2).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = undertake(candidate, principal, parts[1], parts[2], parts.slice(3).join(" "));',
    '        id = undertake(candidate, principal, parts[1]!, parts[2]!, parts.slice(3).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = rememberEpisode(candidate, principal, parts[2], parts[3], parts[4], parts.slice(5).join(" "));',
    '        id = rememberEpisode(candidate, principal, parts[2]!, parts[3]!, parts[4]!, parts.slice(5).join(" "));',
);
replace(
    "src/cli/main.ts",
    '        id = attachDetail(candidate, principal, parts[1], parts.slice(2).join(" "));',
    '        id = attachDetail(candidate, principal, parts[1]!, parts.slice(2).join(" "));',
);
replace(
    "src/cli/main.ts",
    "        id = withholdDetail(candidate, principal, parts[1]);",
    "        id = withholdDetail(candidate, principal, parts[1]!);",
);
replace(
    "src/cli/main.ts",
    '    const ids = parts[2].split(",").filter(Boolean);',
    '    const ids = parts[2]!.split(",").filter(Boolean);',
);
replace("src/cli/main.ts", "    const command = argv[0];", "    const command = argv[0]!;");
replace("src/cli/main.ts", "        const item = argv[i];", "        const item = argv[i]!;");
replace("src/cli/main.ts", "            list.push(argv[++i]);", "            list.push(argv[++i]!);");
replace("src/cli/main.ts", "        } else values[item] = argv[++i];", "        } else values[item] = argv[++i]!;");
replaceAll("src/cli/main.ts", "meaningId: positionals[0]", "meaningId: positionals[0]!");

replace(
    "src/core/model.ts",
    `    const [, year, month, day, hour, minute, second, fraction = ""] = match;
    const parts = [year, month, day, hour, minute, second].map(Number);
    const millisecond = Number(fraction.slice(0, 3).padEnd(3, "0"));`,
    `    const year = Number(match[1]!);
    const month = Number(match[2]!);
    const day = Number(match[3]!);
    const hour = Number(match[4]!);
    const minute = Number(match[5]!);
    const second = Number(match[6]!);
    const fraction = match[7] ?? "";
    const millisecond = Number(fraction.slice(0, 3).padEnd(3, "0"));`,
);
replace(
    "src/core/model.ts",
    "    instant.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);",
    "    instant.setUTCFullYear(year, month - 1, day);",
);
replace(
    "src/core/model.ts",
    "    instant.setUTCHours(parts[3], parts[4], parts[5], millisecond);",
    "    instant.setUTCHours(hour, minute, second, millisecond);",
);
replace(
    "src/core/model.ts",
    `        instant.getUTCFullYear() === parts[0] &&
        instant.getUTCMonth() === parts[1] - 1 &&
        instant.getUTCDate() === parts[2] &&
        instant.getUTCHours() === parts[3] &&
        instant.getUTCMinutes() === parts[4] &&
        instant.getUTCSeconds() === parts[5] &&`,
    `        instant.getUTCFullYear() === year &&
        instant.getUTCMonth() === month - 1 &&
        instant.getUTCDate() === day &&
        instant.getUTCHours() === hour &&
        instant.getUTCMinutes() === minute &&
        instant.getUTCSeconds() === second &&`,
);

replace(
    "src/core/semantics.ts",
    '{ reason = "fixture detail payload unavailable" }: { reason?: string } = {},',
    '{ reason = "fixture detail payload unavailable" }: { reason?: string | undefined } = {},',
);
replace(
    "src/core/semantics.ts",
    `    if (index < 0) throw new ValidationError(\`evidence does not exist: \${evidenceId}\`);
    const ev = state.evidence[index];`,
    `    if (index < 0) throw new ValidationError(\`evidence does not exist: \${evidenceId}\`);
    const ev = state.evidence[index]!;`,
);
replace(
    "src/core/semantics.ts",
    `    if (ev.payloadMode !== "retained_optional" || ev.availability !== "available")
        throw new ValidationError("detail evidence is not currently available");`,
    `    if (
        ev.sourceRole !== "user_command" ||
        ev.payloadMode !== "retained_optional" ||
        ev.availability !== "available"
    )
        throw new ValidationError("detail evidence is not currently available");`,
);

replace(
    "src/delegation/codex-specialist.ts",
    `export interface RunCodexSpecialistOptions {
    recordPath: string;
    environment?: NodeJS.ProcessEnv;
    signal?: AbortSignal;`,
    `export interface RunCodexSpecialistOptions {
    recordPath: string;
    environment?: NodeJS.ProcessEnv;
    signal?: AbortSignal | undefined;`,
);
replace(
    "src/delegation/codex-specialist.ts",
    "            record.externalThreadId = parsed.threadId;",
    "            if (parsed.threadId !== undefined) record.externalThreadId = parsed.threadId;",
);
replace(
    "src/delegation/codex-specialist.ts",
    "    return { report, threadId };",
    "    return threadId === undefined ? { report } : { report, threadId };",
);

replace(
    "src/delegation/specialist-reintegration.ts",
    `        let reconciled = (await reconcileSpecialistResult(candidatePath, currentness, {
            now,
            disposition: explicitRejection ? "rejected" : undefined,
        })) as PersistedSpecialistRecord;`,
    `        let reconciled = (await reconcileSpecialistResult(candidatePath, currentness, {
            now,
            ...(explicitRejection ? { disposition: "rejected" as const } : {}),
        })) as PersistedSpecialistRecord;`,
);

replace(
    "src/providers/ai-sdk.ts",
    "                abortSignal: signal,",
    "                ...(signal === undefined ? {} : { abortSignal: signal }),",
);

replace(
    "src/providers/codex.ts",
    '    thread?: { mode: "ephemeral" } | { mode: "fresh_persistent" } | { mode: "resume"; externalThreadId: string };',
    '    thread?:\n        | { mode: "ephemeral" }\n        | { mode: "fresh_persistent" }\n        | { mode: "resume"; externalThreadId: string }\n        | undefined;',
);
replace(
    "src/providers/codex.ts",
    "    return { result: candidate as ProviderResult, externalThreadId };",
    "    return externalThreadId === undefined\n        ? { result: candidate as ProviderResult }\n        : { result: candidate as ProviderResult, externalThreadId };",
);

replace(
    "src/providers/cursor.ts",
    '    session?: { mode: "fresh" } | { mode: "resume"; externalSessionId: string };',
    '    session?: { mode: "fresh" } | { mode: "resume"; externalSessionId: string } | undefined;',
);

replace("src/runtime/runtime.ts", "    signal?: AbortSignal;", "    signal?: AbortSignal | undefined;");
replace("src/runtime/runtime.ts", "    return tails[0];", "    return tails[0]!;");

replace(
    "src/surfaces/telegram.ts",
    "    { messageThreadId = null, signal }: { messageThreadId?: number | null; signal?: AbortSignal } = {},",
    "    { messageThreadId = null, signal }: { messageThreadId?: number | null; signal?: AbortSignal | undefined } = {},",
);
replace(
    "src/surfaces/telegram.ts",
    "    { provider, signal }: { provider?: ProviderInvoker; signal?: AbortSignal } = {},",
    "    { provider, signal }: { provider?: ProviderInvoker | undefined; signal?: AbortSignal | undefined } = {},",
);
replace(
    "src/surfaces/telegram.ts",
    "    { signal, observedAt }: { signal?: AbortSignal; observedAt?: string } = {},",
    "    { signal, observedAt }: { signal?: AbortSignal | undefined; observedAt?: string } = {},",
);

console.log("Applied strict TypeScript migration fixes.");
