import { interactionLedgerInspectionView } from "@ember/application/runtime/interaction-boundary.ts";
import { ValidationError } from "@ember/domain/errors.ts";
import { assessMemoryProposal, resolveMemoryProposal } from "@ember/domain/memory-proposal.ts";
import { explanationView, inspectionView } from "@ember/domain/projection.ts";
import { supersede } from "@ember/domain/semantics.ts";
import { buildStateMaterialization } from "@ember/domain/state-materialization.ts";
import { assertUnreachable, cloneState } from "@ember/domain/util.ts";
import {
    proactiveContactInspectionView,
    ProactiveContactStore,
} from "@ember/persistence/agency/proactive-contact-store.ts";
import {
    inspectMarkdownStateEdits,
    publishMarkdownStateViews,
    readMarkdownStateViews,
} from "@ember/persistence/persistence/markdown-state-materializer.ts";
import { MemoryProposalGenerationStore } from "@ember/persistence/persistence/memory-proposal-generation-store.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import { InteractionLedgerStore } from "@ember/persistence/runtime/interaction-ledger.ts";

import type {
    CheckArgs,
    ApplyMaterializedEditsArgs,
    CliCommandArgs,
    CliIo,
    CorrectArgs,
    ExplainArgs,
    InspectArgs,
    MaterializeArgs,
    LockStatusArgs,
    QuarantineStaleLockArgs,
} from "./model.ts";

import { Commands } from "./model.ts";

export async function executeLocalCommand(
    args: Exclude<CliCommandArgs, { command: "setup" | "setup-google-calendar" | "use" }>,
    io: CliIo,
): Promise<number> {
    switch (args.command) {
        case Commands.INSPECT: {
            return await onInspect(args, io);
        }
        case Commands.MATERIALIZE: {
            return await onMaterialize(args, io);
        }
        case Commands.APPLY_MATERIALIZED_EDITS: {
            return await onApplyMaterializedEdits(args, io);
        }
        case Commands.EXPLAIN: {
            return await onExplain(args, io);
        }
        case Commands.CORRECT: {
            return await onCorrect(args, io);
        }
        case Commands.CHECK: {
            return await onCheck(args, io);
        }
        case Commands.LOCK_STATUS: {
            return await onLockStatus(args, io);
        }
        case Commands.QUARANTINE_STALE_LOCK: {
            return await onQuarantineStaleLock(args, io);
        }
        default: {
            assertUnreachable();
        }
    }
}

async function onInspect(args: InspectArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const state = await loadForPrincipal(store, args.principal);
    const view = {
        ...inspectionView(state),
        interactions: interactionLedgerInspectionView(await new InteractionLedgerStore(store.path).load()),
        proactiveContacts: proactiveContactInspectionView(await new ProactiveContactStore(store.path).load()),
        memoryProposalGenerations: (await new MemoryProposalGenerationStore(store.path).load()).generations,
    };
    io.output.write(args.json ? `${JSON.stringify(view, null, 2)}\n` : renderInspection(view));
    return 0;
}

async function onMaterialize(args: MaterializeArgs, io: CliIo) {
    const state = await loadForPrincipal(new StateStore(args.state), args.principal);
    const files = await publishMarkdownStateViews(
        args.output,
        args.state,
        buildStateMaterialization(state, { principal: args.principal, scope: args.scope }),
    );
    io.output.write(
        `materialized Markdown v1 revision ${state.revision}:\n${files.map((file) => `  ${file}`).join("\n")}\n`,
    );
    return 0;
}

async function onApplyMaterializedEdits(args: ApplyMaterializedEditsArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const lease = await store.acquireWriteLease();
    try {
        const state = await loadForPrincipal(store, args.principal);
        const materialization = buildStateMaterialization(state, { principal: args.principal, scope: args.scope });
        const inspection = inspectMarkdownStateEdits(materialization, await readMarkdownStateViews(args.input));
        if (args.approvalEvidenceIds.length !== inspection.edits.length)
            throw new ValidationError("each materialized edit requires one --approval-evidence ID");
        if (new Set(args.approvalEvidenceIds).size !== args.approvalEvidenceIds.length)
            throw new ValidationError("materialized edits require distinct approval evidence IDs");
        let candidate = state;
        const outcomes = [];
        for (const [index, edit] of inspection.edits.entries()) {
            const approvalId = args.approvalEvidenceIds[index]!;
            const approval = candidate.evidence.find((evidence) => evidence.evidenceId === approvalId);
            const target = candidate.meanings.find((meaning) => meaning.meaningId === edit.meaning_id);
            if (
                !approval ||
                !target ||
                approval.sourceRole !== "user_command" ||
                approval.sourceActor !== `user:${args.principal}` ||
                approval.assertedPrincipal !== args.principal ||
                approval.scope !== edit.scope ||
                approval.availability !== "available" ||
                approval.payload !== edit.content
            )
                throw new ValidationError(
                    `approval evidence must be available attributable user evidence with payload exactly matching edit: ${edit.meaning_id}`,
                );
            const targetCurrentnessBoundary = Math.max(Date.parse(target.learnedAt), Date.parse(target.applicableFrom));
            if (Date.parse(approval.occurredAt) <= targetCurrentnessBoundary)
                throw new ValidationError(
                    `approval evidence must be newer than the current meaning it supersedes: ${edit.meaning_id}`,
                );
            const proposedAt = approval.observedAt;
            const assessment = assessMemoryProposal(candidate, {
                proposal_version: 1,
                proposal_id: `memory-proposal-file-edit-${inspection.base_revision}-${edit.meaning_id}`,
                proposed_at: proposedAt,
                kind: edit.kind,
                owner: edit.owner,
                slot: edit.slot,
                scope: edit.scope,
                content: edit.content,
                source_evidence_ids: [approval.evidenceId],
                epistemic_role: edit.epistemic_role,
                applicable_from: proposedAt,
                applicable_until: null,
                proposed_currentness: "current",
                confidence: { source: "high", proposition: "high", interpretation: "high" },
                uncertainty: edit.uncertainty,
                supersedes_meaning_id: edit.meaning_id,
            });
            if (assessment.status !== "valid")
                throw new ValidationError(`materialized edit proposal was ${assessment.status}: ${assessment.detail}`);
            const resolution = resolveMemoryProposal(candidate, assessment.proposal, state.revision, {
                decidedAt: proposedAt,
            });
            outcomes.push(resolution.proposal);
            if (resolution.proposal.status !== "adopted")
                throw new ValidationError(`materialized edit was rejected: ${resolution.proposal.resolution.reason}`);
            candidate = resolution.state;
        }
        candidate.revision = state.revision + 1;
        await publishMarkdownStateViews(
            args.input,
            args.state,
            buildStateMaterialization(candidate, { principal: args.principal, scope: args.scope }),
        );
        const committed = await store.commit(state.revision, candidate);
        io.output.write(
            `${JSON.stringify({ ...inspection, proposals: outcomes, resulting_revision: committed.revision }, null, 2)}\n`,
        );
        return 0;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

async function onExplain(args: ExplainArgs, io: CliIo) {
    const state = await loadForPrincipal(new StateStore(args.state), args.principal);
    io.output.write(`${JSON.stringify(explanationView(state, args.meaningId), null, 2)}\n`);
    return 0;
}

async function onCorrect(args: CorrectArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const lease = await store.acquireWriteLease();
    try {
        const state = await loadForPrincipal(store, args.principal);
        const candidate = cloneState(state);
        const id = supersede(candidate, args.principal, args.meaningId, args.text, { reason: args.reason });
        await store.commit(state.revision, candidate);
        io.output.write(`${id}\n`);
        return 0;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

async function onCheck(args: CheckArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const state = await store.load();
    const lock = await store.lockStatus();
    io.output.write(`valid schema v1 revision ${state.revision}; lock ${JSON.stringify(lock)}\n`);
    return 0;
}

async function onLockStatus(args: LockStatusArgs, io: CliIo) {
    const status = await new StateStore(args.state).lockStatus();
    io.output.write(`${JSON.stringify(status, null, 2)}\n`);
    return 0;
}

async function onQuarantineStaleLock(args: QuarantineStaleLockArgs, io: CliIo) {
    const destination = await new StateStore(args.state).quarantineStaleLock({
        ownerToken: args.ownerToken,
        confirmQuiescent: args.confirmQuiescent,
    });
    io.output.write(`${destination}\n`);
    return 0;
}

async function loadForPrincipal(store: StateStore, principal: string) {
    const state = await store.load();
    if (principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
    return state;
}

type InspectionView = ReturnType<typeof inspectionView> & {
    interactions: ReturnType<typeof interactionLedgerInspectionView>;
    proactiveContacts: ReturnType<typeof proactiveContactInspectionView>;
    memoryProposalGenerations: Awaited<ReturnType<MemoryProposalGenerationStore["load"]>>["generations"];
};

function renderInspection({
    cognitionEpisodes,
    currentMeanings,
    gaps,
    historical_meanings,
    interactions: { deliveries, inbound_occurrences },
    lineage: { constitutiveBoundaries, lineageId },
    memoryProposalGenerations,
    proactiveContacts,
    revision,
    runtimeEpisodes,
}: InspectionView) {
    let text = `Lineage ${lineageId}, revision ${revision}\nConstitutive boundaries:\n`;
    for (const boundary of constitutiveBoundaries) {
        text += `  ${boundary.boundaryId}: ${boundary.text}\n`;
    }
    const sections: Array<[string, Array<unknown>]> = [
        ["Current meanings", currentMeanings],
        ["Historical/superseded meanings", historical_meanings],
        ["Unavailable gaps", gaps],
        ["Runtime episodes", runtimeEpisodes],
        ["Cognition episodes", cognitionEpisodes],
        ["Interaction occurrences", inbound_occurrences],
        ["Delivery records", deliveries],
        ["Proactive contact intents", proactiveContacts.intents],
        ["Memory proposal generations", memoryProposalGenerations],
    ];
    for (const [label, items] of sections) {
        text += `${label}:\n`;
        for (const item of items) {
            text += `  ${JSON.stringify(item)}\n`;
        }
    }
    return text;
}
