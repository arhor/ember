import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import { command, PRINCIPAL, PROVIDER, RELATIONSHIP_SCOPE, ROOT, SCOPE, readJson, tempDir } from "./support.ts";

const CHAT_ID = 424242;
const DRIVER = resolve(ROOT, "tests/fixtures/surfaces/telegram-continuity-driver.ts");
const CLI_OPENING = "Establish continuity through the CLI before the surface switch";
const TELEGRAM_CONFIRMED = "Continue the same Ember through Telegram without transcript replay";
const TELEGRAM_UNCERTAIN = "Continue through Telegram while outbound delivery becomes ambiguous";
const CLI_RETURN = "Continue locally after the ambiguous Telegram delivery";

function providerArguments(capturePath: string, counterPath: string) {
    return [
        "--provider-command",
        process.execPath,
        "--provider-arg",
        PROVIDER,
        "--provider-arg",
        "--capture",
        "--provider-arg",
        capturePath,
        "--provider-arg",
        "--counter",
        "--provider-arg",
        counterPath,
        "--provider-timeout-seconds",
        "2",
    ];
}

async function telegramCommand(
    args: string[],
    { now }: { now: string },
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
    return new Promise((resolveResult) => {
        const child = spawn(process.execPath, [DRIVER, ...args], {
            cwd: ROOT,
            env: { ...process.env, EMBER_TEST_NOW: now },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("close", (code, signal) => resolveResult({ code, signal, stdout, stderr }));
    });
}

function telegramArguments({
    statePath,
    capturePath,
    counterPath,
    updateId,
    text,
    delivery,
}: {
    statePath: string;
    capturePath: string;
    counterPath: string;
    updateId: number;
    text: string;
    delivery: "confirmed" | "uncertain";
}) {
    return [
        "--state",
        statePath,
        "--principal",
        PRINCIPAL,
        "--scope",
        SCOPE,
        "--chat-id",
        String(CHAT_ID),
        "--update-id",
        String(updateId),
        "--capture",
        capturePath,
        "--counter",
        counterPath,
        "--text",
        text,
        "--delivery",
        delivery,
    ];
}

function meaningSnapshot(view: { current_meanings: Array<Record<string, unknown>> }) {
    return view.current_meanings
        .map((meaning) => ({
            meaning_id: meaning.meaning_id,
            kind: meaning.kind,
            slot: meaning.slot,
            owner: meaning.owner,
            scope: meaning.scope,
            content: meaning.content,
            currentness: meaning.currentness,
            prospective_lifecycle: meaning.prospective_lifecycle,
        }))
        .sort((left, right) => String(left.meaning_id).localeCompare(String(right.meaning_id)));
}

function requireMeaning(
    meanings: Array<Record<string, any>>,
    predicate: (meaning: Record<string, any>) => boolean,
    description: string,
) {
    const meaning = meanings.find(predicate);
    assert.ok(meaning, `missing ${description}`);
    return meaning;
}

test("CLI -> Telegram -> CLI preserves one Ember across process restart without transcript-owned continuity", async () => {
    const directory = await tempDir();
    try {
        const statePath = join(directory, "ember.json");
        const counterPath = join(directory, "provider-count.txt");
        const cliOpeningCapture = join(directory, "cli-opening-request.json");
        const telegramConfirmedCapture = join(directory, "telegram-confirmed-request.json");
        const telegramUncertainCapture = join(directory, "telegram-uncertain-request.json");
        const cliReturnCapture = join(directory, "cli-return-request.json");

        const init = await command(["init", "--state", statePath, "--name", "Ember", "--principal", PRINCIPAL], {
            now: "2026-09-05T08:00:00Z",
        });
        assert.equal(init.code, 0, init.stderr);

        const opening = await command(
            [
                "run",
                "--state",
                statePath,
                "--principal",
                PRINCIPAL,
                "--scope",
                SCOPE,
                ...providerArguments(cliOpeningCapture, counterPath),
            ],
            {
                stdin: [
                    `:remember relationship relationship:${PRINCIPAL} ${RELATIONSHIP_SCOPE} Ember and ${PRINCIPAL} are continuing collaborators across surfaces`,
                    `:remember fact user:${PRINCIPAL} home-server ${SCOPE} The home server is a Raspberry Pi 5`,
                    `:prefer user:${PRINCIPAL} cross-surface-detail ${SCOPE} Prefer concise continuity evidence`,
                    `:undertake cross-surface-proof ${SCOPE} Preserve continuity when switching between CLI and Telegram`,
                    CLI_OPENING,
                    ":quit",
                    "",
                ].join("\n"),
                now: "2026-09-05T09:00:00Z",
            },
        );
        assert.equal(opening.code, 0, opening.stderr);

        const afterOpening = JSON.parse(
            (await command(["inspect", "--state", statePath, "--principal", PRINCIPAL, "--json"])).stdout,
        );
        const lineageId = afterOpening.lineage.lineage_id;
        const commitment = requireMeaning(
            afterOpening.current_meanings,
            (meaning) => meaning.kind === "commitment" && meaning.slot === "cross-surface-proof",
            "cross-surface commitment",
        );
        const fact = requireMeaning(
            afterOpening.current_meanings,
            (meaning) => meaning.kind === "fact" && meaning.slot === "home-server",
            "home-server fact",
        );
        const preference = requireMeaning(
            afterOpening.current_meanings,
            (meaning) => meaning.kind === "preference" && meaning.slot === "cross-surface-detail",
            "cross-surface preference",
        );
        assert.equal(commitment.prospective_lifecycle, "live");

        const telegramConfirmed = await telegramCommand(
            telegramArguments({
                statePath,
                capturePath: telegramConfirmedCapture,
                counterPath,
                updateId: 890,
                text: TELEGRAM_CONFIRMED,
                delivery: "confirmed",
            }),
            { now: "2026-09-05T10:00:00Z" },
        );
        assert.equal(telegramConfirmed.code, 0, telegramConfirmed.stderr);
        const confirmedReport = JSON.parse(telegramConfirmed.stdout);
        assert.equal(confirmedReport.outcome.kind, "processed");
        assert.equal(confirmedReport.outcome.deliveryFailure, null);
        assert.equal(confirmedReport.sends, 1);
        assert.match(confirmedReport.sent_text, /CONTINUITY_RESPONSE/);
        assert.match(confirmedReport.sent_text, new RegExp(`lineage:${lineageId}`));

        const telegramUncertain = await telegramCommand(
            telegramArguments({
                statePath,
                capturePath: telegramUncertainCapture,
                counterPath,
                updateId: 891,
                text: TELEGRAM_UNCERTAIN,
                delivery: "uncertain",
            }),
            { now: "2026-09-05T11:00:00Z" },
        );
        assert.equal(telegramUncertain.code, 0, telegramUncertain.stderr);
        const uncertainReport = JSON.parse(telegramUncertain.stdout);
        assert.equal(uncertainReport.outcome.kind, "processed");
        assert.equal(uncertainReport.outcome.deliveryFailure, "uncertain");
        assert.equal(uncertainReport.sends, 1);

        const returned = await command(
            [
                "run",
                "--state",
                statePath,
                "--principal",
                PRINCIPAL,
                "--scope",
                SCOPE,
                ...providerArguments(cliReturnCapture, counterPath),
            ],
            { stdin: `${CLI_RETURN}\n:quit\n`, now: "2026-09-05T12:00:00Z" },
        );
        assert.equal(returned.code, 0, returned.stderr);

        const finalView = JSON.parse(
            (await command(["inspect", "--state", statePath, "--principal", PRINCIPAL, "--json"])).stdout,
        );
        const openingRequest = await readJson(cliOpeningCapture);
        const confirmedRequest = await readJson(telegramConfirmedCapture);
        const uncertainRequest = await readJson(telegramUncertainCapture);
        const returnRequest = await readJson(cliReturnCapture);
        const requests = [openingRequest, confirmedRequest, uncertainRequest, returnRequest];

        assert.equal(await readFile(counterPath, "utf8"), "4");
        assert.equal(finalView.lineage.lineage_id, lineageId);
        assert.equal(new Set(requests.map((request) => request.projection.lineage.lineage_id)).size, 1);
        assert.equal(
            requests.every((request) => request.projection.lineage.lineage_id === lineageId),
            true,
        );
        assert.deepEqual(meaningSnapshot(finalView), meaningSnapshot(afterOpening));

        assert.deepEqual(
            requests.map((request) => request.projection.surface),
            ["local_cli", "telegram_bot", "telegram_bot", "local_cli"],
        );
        assert.deepEqual(
            requests.map((request) => request.projection.current_input),
            [CLI_OPENING, TELEGRAM_CONFIRMED, TELEGRAM_UNCERTAIN, CLI_RETURN],
        );
        assert.equal(
            requests.every((request) => request.projection.selection.raw_transcript_included === false),
            true,
        );

        const selection = [...openingRequest.projection.selection.meaning_ids].sort();
        for (const request of requests.slice(1))
            assert.deepEqual([...request.projection.selection.meaning_ids].sort(), selection);
        assert.equal(selection.includes(commitment.meaning_id), true);
        assert.equal(selection.includes(fact.meaning_id), true);
        assert.equal(selection.includes(preference.meaning_id), true);

        for (const request of requests) {
            const selectedCommitment = requireMeaning(
                request.projection.meanings,
                (meaning) => meaning.meaning_id === commitment.meaning_id,
                "selected cross-surface commitment",
            );
            assert.equal(selectedCommitment.prospective_lifecycle, "live");
            assert.deepEqual(
                new Set(
                    selectedCommitment.source_evidence.map((evidence: { source_role: string }) => evidence.source_role),
                ),
                new Set(["ember_adoption", "user_command"]),
            );
            const selectedFact = requireMeaning(
                request.projection.meanings,
                (meaning) => meaning.meaning_id === fact.meaning_id,
                "selected home-server fact",
            );
            assert.equal(selectedFact.epistemic_role, "user_testimony");
            assert.equal(selectedFact.source_evidence[0]?.source_actor, `user:${PRINCIPAL}`);
        }

        assert.equal(confirmedRequest.projection.recovery_account.gap_kind, "known_clean_stop_interval");
        assert.equal(
            confirmedRequest.projection.recovery_account.ember_cognition_during_interval,
            "none_in_supported_runtime",
        );
        assert.equal(returnRequest.projection.recovery_account.gap_kind, "known_clean_stop_interval");
        assert.equal(
            returnRequest.projection.recovery_account.ember_cognition_during_interval,
            "none_in_supported_runtime",
        );

        const telegramProjectionText = JSON.stringify([confirmedRequest.projection, uncertainRequest.projection]);
        assert.equal(telegramProjectionText.includes(String(CHAT_ID)), false);
        assert.equal(telegramProjectionText.includes("update:890"), false);
        assert.equal(telegramProjectionText.includes("update:891"), false);
        assert.equal(JSON.stringify(returnRequest.projection).includes(TELEGRAM_CONFIRMED), false);
        assert.equal(JSON.stringify(returnRequest.projection).includes(TELEGRAM_UNCERTAIN), false);

        const occurrences = finalView.interactions.inbound_occurrences;
        const deliveries = finalView.interactions.deliveries;
        assert.equal(occurrences.length, 4);
        assert.equal(deliveries.length, 4);
        const occurrenceByCognition = new Map(occurrences.map((record: any) => [record.cognition_id, record]));
        const deliveryByCognition = new Map(deliveries.map((record: any) => [record.cognition_id, record]));

        assert.equal(
            occurrenceByCognition.get(openingRequest.cognition_id)?.principal_provenance,
            "explicit_local_argument",
        );
        assert.equal(
            occurrenceByCognition.get(confirmedRequest.cognition_id)?.principal_provenance,
            "configured_surface_mapping",
        );
        assert.equal(
            occurrenceByCognition.get(uncertainRequest.cognition_id)?.principal_provenance,
            "configured_surface_mapping",
        );
        assert.equal(
            occurrenceByCognition.get(returnRequest.cognition_id)?.principal_provenance,
            "explicit_local_argument",
        );
        assert.equal(occurrenceByCognition.get(confirmedRequest.cognition_id)?.external_occurrence_id, "update:890");
        assert.equal(occurrenceByCognition.get(uncertainRequest.cognition_id)?.external_occurrence_id, "update:891");

        assert.equal(deliveryByCognition.get(openingRequest.cognition_id)?.attempts.at(-1)?.outcome, "confirmed");
        assert.equal(deliveryByCognition.get(confirmedRequest.cognition_id)?.attempts.at(-1)?.outcome, "confirmed");
        assert.equal(deliveryByCognition.get(uncertainRequest.cognition_id)?.attempts.at(-1)?.outcome, "uncertain");
        assert.equal(deliveryByCognition.get(returnRequest.cognition_id)?.attempts.at(-1)?.outcome, "confirmed");

        const finalCognitionById = new Map(
            finalView.cognition_episodes.map((cognition: any) => [cognition.cognition_id, cognition]),
        );
        assert.equal(finalCognitionById.get(uncertainRequest.cognition_id)?.status, "completed");
        assert.equal(finalCognitionById.get(uncertainRequest.cognition_id)?.delivery_status, "pending");
        assert.equal(finalCognitionById.get(returnRequest.cognition_id)?.delivery_status, "displayed");

        const canonical = await readJson(statePath);
        const retainedTelegramEvidence = canonical.evidence.filter(
            (evidence: any) =>
                evidence.source_role === "user_command" &&
                (evidence.payload === TELEGRAM_CONFIRMED || evidence.payload === TELEGRAM_UNCERTAIN),
        );
        assert.deepEqual(
            retainedTelegramEvidence.map((evidence: any) => evidence.payload).sort(),
            [TELEGRAM_CONFIRMED, TELEGRAM_UNCERTAIN].sort(),
        );
        assert.equal(
            retainedTelegramEvidence.every((evidence: any) => evidence.payload_mode === "retained_optional"),
            true,
        );
        assert.equal(
            finalView.current_meanings.some(
                (meaning: any) => meaning.content === TELEGRAM_CONFIRMED || meaning.content === TELEGRAM_UNCERTAIN,
            ),
            false,
        );
        const canonicalText = JSON.stringify(canonical);
        assert.equal(canonicalText.includes(String(CHAT_ID)), false);
        assert.equal(canonicalText.includes("CONTINUITY_RESPONSE"), false);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
