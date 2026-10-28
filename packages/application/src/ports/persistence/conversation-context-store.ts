import type {
    ActiveConversationTrajectory,
    ConversationContextDocument,
    ConversationExchangeRecord,
    ConversationId,
} from "@ember/domain/conversation-context.ts";
export type AcceptedConversationExchange = Pick<
    ConversationExchangeRecord,
    "conversation_id" | "cognition_id" | "principal" | "scope" | "surface" | "input_evidence_id" | "started_at"
>;
export interface CommittedConversationExpression {
    cognition_id: ConversationExchangeRecord["cognition_id"];
    expression_evidence_id: NonNullable<ConversationExchangeRecord["expression_evidence_id"]>;
    expression_occurred_at: string;
    expression_content: string;
}
export interface ConversationContextStore {
    readonly path: string;
    load(): Promise<ConversationContextDocument>;
    activeConversation(principal: string, scope: string): Promise<ActiveConversationTrajectory | null>;
    startFreshConversation(principal: string, scope: string, startedAt?: string): Promise<ConversationId>;
    recordAcceptedInput(input: AcceptedConversationExchange): Promise<ConversationExchangeRecord>;
    recordCommittedExpression(input: CommittedConversationExpression): Promise<ConversationExchangeRecord>;
}
