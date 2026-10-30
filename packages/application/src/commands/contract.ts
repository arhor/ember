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

export interface CommandContext {
    principal: string;
    scope: string;
    surfaceId: string;
    expectedContinuityBinding?: { lineageId: string; establishedAt: string };
}
