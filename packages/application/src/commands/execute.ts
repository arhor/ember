import type { SurfaceRepositories } from "@ember/application/app/surface-repositories.ts";
import type { ActionProposalRecord } from "@ember/domain/capabilities/action-proposal.ts";
import type { EmberState, MeaningId, RuntimeId } from "@ember/domain/model.ts";

import { ValidationError } from "@ember/domain/errors.ts";
import { nowUtc } from "@ember/domain/model.ts";
import {
    attachDetail,
    rememberEpisode,
    rememberFact,
    rememberPreference,
    rememberRelationship,
    supersede,
    undertake,
    withholdDetail,
} from "@ember/domain/semantics.ts";
import { cloneState } from "@ember/domain/util.ts";

import type { SessionCommand, CommandContext } from "./contract.ts";

type OperatorCommand = Exclude<SessionCommand, { kind: "ask" | "quit" }>;

export async function executeCommand(
    command: OperatorCommand,
    state: EmberState,
    runtimeId: RuntimeId,
    context: CommandContext,
    repositories: SurfaceRepositories,
): Promise<{ text: string }> {
    if (context.principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
    validateCommandScope(command, state, context);
    let text = "";
    await executeOperatorCommand(
        command,
        state,
        runtimeId,
        context,
        {
            output: {
                write(value) {
                    text += value;
                },
            },
        },
        repositories,
    );
    return { text };
}

function actionProposalConfirmation(proposal: ActionProposalRecord): string {
    return JSON.stringify({
        target: proposal.target.label,
        action: proposal.payload,
        purpose: proposal.purpose,
        consequence: proposal.consequence,
        expiresAt: proposal.expires_at,
    });
}

async function executeOperatorCommand(
    command: OperatorCommand,
    state: EmberState,
    runtimeId: RuntimeId,
    config: CommandContext,
    io: { output: { write(text: string): void } },
    repositories: SurfaceRepositories,
) {
    const store = repositories.state;
    switch (command.kind) {
        case "new-conversation": {
            const conversationId = await repositories.conversation.startFreshConversation(
                config.principal,
                config.scope,
            );
            io.output.write(`${conversationId}\n`);
            return;
        }
        case "show-action": {
            const proposal = await repositories.actions.present({
                proposalId: command.proposalId,
                principal: config.principal,
                scope: config.scope,
                surface: config.surfaceId,
                presentedAt: nowUtc(),
            });
            const presentation = proposal.presentations.at(-1)!;
            io.output.write(
                `${JSON.stringify({
                    proposalId: proposal.proposal_id,
                    payloadDigest: proposal.payload_digest,
                    target: proposal.target.label,
                    event: proposal.payload,
                    purpose: proposal.purpose,
                    consequence: proposal.consequence,
                    expiresAt: proposal.expires_at,
                    presentationId: presentation.presentation_id,
                    approvalConfirmation: actionProposalConfirmation(proposal),
                })}\n`,
            );
            return;
        }
        case "approve-action":
        case "reject-action": {
            const actions = repositories.actions;
            const pending = await actions.get(command.proposalId);
            const presentation = pending?.presentations
                .filter(
                    (candidate) =>
                        candidate.principal === config.principal &&
                        candidate.scope === config.scope &&
                        candidate.surface === config.surfaceId,
                )
                .at(-1);
            if (!presentation) throw new ValidationError("action approval requires :show-action in this scope first");
            const proposal = await actions.decide({
                proposalId: command.proposalId,
                decision: command.kind === "approve-action" ? "approved" : "rejected",
                principal: config.principal,
                payloadDigest: command.payloadDigest,
                scope: config.scope,
                surface: config.surfaceId,
                presentationId: presentation.presentation_id,
                decidedAt: nowUtc(),
                authoritySourceId: `${config.surfaceId}:${config.principal}`,
                materialConfirmation: command.materialConfirmation,
            });
            io.output.write(`${JSON.stringify({ proposalId: command.proposalId, status: proposal.status })}\n`);
            return;
        }
        case "withdraw-action":
        case "supersede-action": {
            const pending = await repositories.actions.get(command.proposalId);
            if (!pending || pending.principal !== config.principal || pending.scope !== config.scope)
                throw new ValidationError("action proposal is outside the active principal and scope");
            const proposal = await repositories.actions.invalidate({
                proposalId: command.proposalId,
                kind: command.kind === "withdraw-action" ? "withdrawn" : "superseded",
                principal: config.principal,
                occurredAt: nowUtc(),
                authoritySourceId: `${config.surfaceId}:${config.principal}`,
                reason: command.reason,
            });
            io.output.write(`${JSON.stringify({ proposalId: command.proposalId, status: proposal.status })}\n`);
            return;
        }
        case "remember-relationship":
        case "remember-fact":
        case "remember-episode":
        case "prefer":
        case "supersede":
        case "undertake":
        case "attach-detail":
        case "fixture-withhold":
            await commitSemanticCommand(store, state, runtimeId, config.principal, command, io);
            return;
    }
}

async function commitSemanticCommand(
    store: SurfaceRepositories["state"],
    state: EmberState,
    runtimeId: RuntimeId,
    principal: string,
    command: Extract<
        OperatorCommand,
        {
            kind:
                | "remember-relationship"
                | "remember-fact"
                | "remember-episode"
                | "prefer"
                | "supersede"
                | "undertake"
                | "attach-detail"
                | "fixture-withhold";
        }
    >,
    io: { output: { write(text: string): void } },
) {
    const candidate = cloneState(state);
    let id: MeaningId | string;
    switch (command.kind) {
        case "remember-relationship":
            id = rememberRelationship(candidate, principal, command.owner, command.scope, command.text);
            break;
        case "remember-fact":
            id = rememberFact(candidate, principal, command.owner, command.slot, command.scope, command.text);
            break;
        case "prefer":
            id = rememberPreference(candidate, principal, command.owner, command.slot, command.scope, command.text);
            break;
        case "supersede":
            id = supersede(candidate, principal, command.id, command.text);
            break;
        case "undertake":
            id = undertake(candidate, principal, command.slot, command.scope, command.text);
            break;
        case "remember-episode":
            id = rememberEpisode(candidate, principal, command.slot, command.owner, command.scope, command.summary);
            break;
        case "attach-detail":
            id = attachDetail(candidate, principal, command.episodeId, command.detail);
            break;
        case "fixture-withhold":
            if (process.env.EMBER_ENABLE_FIXTURE_FAULTS !== "1")
                throw new ValidationError("fixture fault command is available only to deterministic test harness");
            id = withholdDetail(candidate, principal, command.id);
            break;
    }
    const runtime = candidate.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
    if (!runtime) throw new ValidationError(`runtime does not exist: ${runtimeId}`);
    if (runtime.cleanStopAt === null) runtime.lastDurableObservationAt = nowUtc();
    await store.commit(state.revision, candidate);
    io.output.write(`${id}\n`);
}

export function validateCommandScope(
    command: Exclude<SessionCommand, { kind: "quit" }>,
    state: EmberState,
    context: CommandContext,
) {
    if (context.surfaceId === "local_cli") return;
    if ("scope" in command && command.scope !== context.scope)
        throw new ValidationError("command scope differs from the active scope");
    if (
        "owner" in command &&
        (command.owner.startsWith("user:") || command.owner.startsWith("relationship:")) &&
        ![context.principal, "user:" + context.principal, "relationship:" + context.principal].includes(command.owner)
    )
        throw new ValidationError("command owner differs from the active principal");
    const ids =
        command.kind === "ask"
            ? command.explainIds
            : command.kind === "supersede"
              ? [command.id]
              : command.kind === "attach-detail"
                ? [command.episodeId]
                : [];
    const visited = new Set<string>();
    const check = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        const meaning = state.meanings.find((candidate) => candidate.meaningId === id);
        if (!meaning || meaning.scope !== context.scope)
            throw new ValidationError("meaning is missing or outside the active scope");
        if (
            (meaning.owner.startsWith("user:") || meaning.owner.startsWith("relationship:")) &&
            !["user:" + context.principal, "relationship:" + context.principal].includes(meaning.owner)
        )
            throw new ValidationError("meaning is outside the active principal");
        if (command.kind === "ask") {
            if (meaning.supersedes) check(meaning.supersedes);
            if (meaning.supersededBy) check(meaning.supersededBy);
        }
    };
    for (const id of ids) check(id);
}
