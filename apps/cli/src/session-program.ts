import type { Writable } from "node:stream";

import { ValidationError } from "@ember/domain/errors.ts";
import { Command } from "commander";

import { bindCommandIo } from "./command-io.ts";

export type SessionCommand =
    | { kind: "remember-relationship"; owner: string; scope: string; text: string }
    | { kind: "remember-fact"; owner: string; slot: string; scope: string; text: string }
    | { kind: "remember-episode"; slot: string; owner: string; scope: string; summary: string }
    | { kind: "prefer"; owner: string; slot: string; scope: string; text: string }
    | { kind: "supersede"; id: string; text: string }
    | { kind: "undertake"; slot: string; scope: string; text: string }
    | { kind: "attach-detail"; episodeId: string; detail: string }
    | { kind: "fixture-withhold"; id: string }
    | { kind: "ask"; explainIds: string[]; text: string }
    | { kind: "show-action"; proposalId: string }
    | { kind: "approve-action"; proposalId: string; payloadDigest: string; materialConfirmation: string }
    | { kind: "reject-action"; proposalId: string; payloadDigest: string; materialConfirmation: string }
    | { kind: "withdraw-action"; proposalId: string; reason: string }
    | { kind: "supersede-action"; proposalId: string; reason: string }
    | { kind: "new-conversation" }
    | { kind: "quit" };

export function createSessionProgram(
    io: { output: Writable; error: Writable },
    dispatch: (command: SessionCommand) => Promise<void>,
): Command {
    const program = bindCommandIo(new Command(), io, true);
    program.name(":").helpCommand(false);

    const remember = program.command("remember").description("Record relationship, fact, or episode meaning");
    remember
        .command("relationship")
        .description("Remember a relationship")
        .argument("<owner>", "relationship owner")
        .argument("<scope>", "active scope")
        .argument("<text...>", "relationship text")
        .action(async (owner: string, scope: string, text: string[]) => {
            await dispatch({ kind: "remember-relationship", owner, scope, text: text.join(" ") });
        });
    remember
        .command("fact")
        .description("Remember a fact")
        .argument("<owner>", "fact owner")
        .argument("<slot>", "fact slot")
        .argument("<scope>", "active scope")
        .argument("<text...>", "fact text")
        .action(async (owner: string, slot: string, scope: string, text: string[]) => {
            await dispatch({ kind: "remember-fact", owner, slot, scope, text: text.join(" ") });
        });
    remember
        .command("episode")
        .description("Remember episode metadata")
        .argument("<slot>", "episode slot")
        .argument("<owner>", "episode owner")
        .argument("<scope>", "active scope")
        .argument("<summary...>", "episode summary")
        .action(async (slot: string, owner: string, scope: string, summary: string[]) => {
            await dispatch({ kind: "remember-episode", slot, owner, scope, summary: summary.join(" ") });
        });

    program
        .command("prefer")
        .description("Remember a preference")
        .argument("<owner>", "preference owner")
        .argument("<slot>", "preference slot")
        .argument("<scope>", "active scope")
        .argument("<text...>", "preference text")
        .action(async (owner: string, slot: string, scope: string, text: string[]) => {
            await dispatch({ kind: "prefer", owner, slot, scope, text: text.join(" ") });
        });
    program
        .command("supersede")
        .description("Supersede a current meaning")
        .argument("<id>", "meaning id")
        .argument("<text...>", "replacement text")
        .action(async (id: string, text: string[]) => {
            await dispatch({ kind: "supersede", id, text: text.join(" ") });
        });
    program
        .command("undertake")
        .description("Undertake a commitment")
        .argument("<slot>", "commitment slot")
        .argument("<scope>", "active scope")
        .argument("<text...>", "commitment text")
        .action(async (slot: string, scope: string, text: string[]) => {
            await dispatch({ kind: "undertake", slot, scope, text: text.join(" ") });
        });
    program
        .command("attach-detail")
        .description("Attach one detail occurrence to an episode")
        .argument("<episode-id>", "episode meaning id")
        .argument("<detail...>", "detail text")
        .action(async (episodeId: string, detail: string[]) => {
            await dispatch({ kind: "attach-detail", episodeId, detail: detail.join(" ") });
        });
    program
        .command("fixture-withhold")
        .description("Fixture-only withholding, available when EMBER_ENABLE_FIXTURE_FAULTS=1")
        .argument("<id>", "detail id")
        .action(async (id: string) => {
            await dispatch({ kind: "fixture-withhold", id });
        });
    program
        .command("ask")
        .description("Ask with explicit explanation ids")
        .requiredOption("--explain <ids>", "comma-separated meaning ids")
        .argument("<text...>", "question text")
        .action(async (text: string[], options: { explain: string }) => {
            const explainIds = options.explain.split(",").filter(Boolean);
            if (!explainIds.length) throw new ValidationError("at least one explanation ID is required");
            await dispatch({ kind: "ask", explainIds, text: text.join(" ") });
        });
    program
        .command("show-action")
        .description("Present an action proposal in this scope")
        .argument("<proposal-id>", "proposal id")
        .action(async (proposalId: string) => {
            await dispatch({ kind: "show-action", proposalId });
        });
    program
        .command("approve-action")
        .description("Approve a presented action proposal")
        .argument("<proposal-id>", "proposal id")
        .argument("<payload-digest>", "payload digest")
        .argument("<material-confirmation>", "material confirmation")
        .action(async (proposalId: string, payloadDigest: string, materialConfirmation: string) => {
            await dispatch({ kind: "approve-action", proposalId, payloadDigest, materialConfirmation });
        });
    program
        .command("reject-action")
        .description("Reject a presented action proposal")
        .argument("<proposal-id>", "proposal id")
        .argument("<payload-digest>", "payload digest")
        .argument("<material-confirmation>", "material confirmation")
        .action(async (proposalId: string, payloadDigest: string, materialConfirmation: string) => {
            await dispatch({ kind: "reject-action", proposalId, payloadDigest, materialConfirmation });
        });
    program
        .command("withdraw-action")
        .description("Withdraw an action proposal")
        .argument("<proposal-id>", "proposal id")
        .argument("<reason...>", "withdrawal reason")
        .action(async (proposalId: string, reason: string[]) => {
            await dispatch({ kind: "withdraw-action", proposalId, reason: reason.join(" ") });
        });
    program
        .command("supersede-action")
        .description("Supersede an action proposal")
        .argument("<proposal-id>", "proposal id")
        .argument("<reason...>", "supersession reason")
        .action(async (proposalId: string, reason: string[]) => {
            await dispatch({ kind: "supersede-action", proposalId, reason: reason.join(" ") });
        });
    program
        .command("new-conversation")
        .description("Start a fresh conversation in this scope")
        .action(async () => {
            await dispatch({ kind: "new-conversation" });
        });
    program
        .command("quit")
        .description("End the interactive session")
        .action(async () => {
            await dispatch({ kind: "quit" });
        });
    return program;
}
