import type { SessionCommand } from "./contract.ts";

// ADR 0042: one catalogue drives parsing, help and surface discovery.
export interface CommandDescriptor {
    name: string;
    kind: SessionCommand["kind"] | "help";
    description: string;
    arguments: readonly string[];
    fields: readonly string[];
    explain?: boolean;
    fixture?: boolean;
}
export const commandCatalogue: readonly CommandDescriptor[] = [
    { name: "help", kind: "help", description: "List conversation commands", arguments: [], fields: [] },
    {
        name: "remember relationship",
        kind: "remember-relationship",
        description: "Remember a relationship",
        arguments: ["<owner>", "<scope>", "<text...>"],
        fields: ["owner", "scope", "text"],
    },
    {
        name: "remember fact",
        kind: "remember-fact",
        description: "Remember a fact",
        arguments: ["<owner>", "<slot>", "<scope>", "<text...>"],
        fields: ["owner", "slot", "scope", "text"],
    },
    {
        name: "remember episode",
        kind: "remember-episode",
        description: "Remember episode metadata",
        arguments: ["<slot>", "<owner>", "<scope>", "<summary...>"],
        fields: ["slot", "owner", "scope", "summary"],
    },
    {
        name: "prefer",
        kind: "prefer",
        description: "Remember a preference",
        arguments: ["<owner>", "<slot>", "<scope>", "<text...>"],
        fields: ["owner", "slot", "scope", "text"],
    },
    {
        name: "supersede",
        kind: "supersede",
        description: "Supersede a current meaning",
        arguments: ["<id>", "<text...>"],
        fields: ["id", "text"],
    },
    {
        name: "undertake",
        kind: "undertake",
        description: "Undertake a commitment",
        arguments: ["<slot>", "<scope>", "<text...>"],
        fields: ["slot", "scope", "text"],
    },
    {
        name: "attach-detail",
        kind: "attach-detail",
        description: "Attach one detail occurrence to an episode",
        arguments: ["<episode-id>", "<detail...>"],
        fields: ["episodeId", "detail"],
    },
    {
        name: "ask",
        kind: "ask",
        description: "Ask with explicit explanation ids",
        arguments: ["<text...>"],
        fields: ["text"],
        explain: true,
    },
    {
        name: "show-action",
        kind: "show-action",
        description: "Present an action proposal in this scope",
        arguments: ["<proposal-id>"],
        fields: ["proposalId"],
    },
    {
        name: "approve-action",
        kind: "approve-action",
        description: "Approve a presented action proposal",
        arguments: ["<proposal-id>", "<payload-digest>", "<material-confirmation>"],
        fields: ["proposalId", "payloadDigest", "materialConfirmation"],
    },
    {
        name: "reject-action",
        kind: "reject-action",
        description: "Reject a presented action proposal",
        arguments: ["<proposal-id>", "<payload-digest>", "<material-confirmation>"],
        fields: ["proposalId", "payloadDigest", "materialConfirmation"],
    },
    {
        name: "withdraw-action",
        kind: "withdraw-action",
        description: "Withdraw an action proposal",
        arguments: ["<proposal-id>", "<reason...>"],
        fields: ["proposalId", "reason"],
    },
    {
        name: "supersede-action",
        kind: "supersede-action",
        description: "Supersede an action proposal",
        arguments: ["<proposal-id>", "<reason...>"],
        fields: ["proposalId", "reason"],
    },
    {
        name: "new-conversation",
        kind: "new-conversation",
        description: "Start a fresh conversation in this scope",
        arguments: [],
        fields: [],
    },
    {
        name: "fixture-withhold",
        kind: "fixture-withhold",
        description: "Fixture-only withholding",
        arguments: ["<id>"],
        fields: ["id"],
        fixture: true,
    },
];

export function conversationCommands() {
    return commandCatalogue.filter((command) => !command.fixture);
}

export function commandSuggestions(line: string): string[] {
    if (!line.startsWith("/")) return [];
    const normalized = line.replaceAll("_", "-");
    const candidates = conversationCommands().map((command) => "/" + command.name);
    if (normalized === "/") return [...new Set(candidates.map((name) => name.split(" ")[0]!))];
    return candidates.filter((name) => name.startsWith(normalized));
}

export function conversationHelp(): string {
    return (
        conversationCommands()
            .map(
                (command) =>
                    "/" +
                    command.name +
                    (command.explain ? " --explain <ids>" : "") +
                    (command.arguments.length ? " " + command.arguments.join(" ") : "") +
                    " — " +
                    command.description,
            )
            .join("\n") + "\n"
    );
}

export function telegramCommandMenu() {
    const commands = new Map<string, { command: string; description: string }>();
    for (const descriptor of conversationCommands()) {
        const name = descriptor.name.split(" ")[0]!.replaceAll("-", "_");
        commands.set(name, {
            command: name,
            description: name === "remember" ? "Record relationship, fact, or episode meaning" : descriptor.description,
        });
    }
    return [...commands.values()];
}
