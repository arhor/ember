import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
    ConversationContextDocument,
    ConversationExchangeRecord,
    ConversationId,
    LegacyConversationContextDocument,
} from "../core/conversation-context.ts";

import {
    RECENT_DIALOGUE_MAX_STORED_EXCHANGES,
    truncateConversationText,
    validateConversationContextDocument,
    validateLegacyConversationContextDocument,
} from "../core/conversation-context.ts";
import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { isRfc3339Utc, nowUtc } from "../core/model.ts";
import { replaceFileDurably } from "./file-replacement.ts";

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

export class ConversationContextStore {
    readonly path: string;

    constructor(statePath: string) {
        if (!statePath.trim()) {
            throw new ValidationError("conversation context store requires a state path");
        }
        this.path = `${statePath}.conversation.json`;
    }

    async load(): Promise<ConversationContextDocument> {
        let text: string;
        try {
            text = await readFile(this.path, "utf8");
        } catch (error) {
            if (errorCode(error) === "ENOENT") {
                return emptyDocument();
            }
            throw new StoreUnavailable(`cannot read conversation context ${this.path}: ${errorMessage(error)}`, {
                cause: error,
            });
        }

        let value: unknown;
        try {
            value = JSON.parse(text);
        } catch (error) {
            throw new StoreUnavailable(`conversation context is not valid JSON: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        try {
            if (conversationContextVersion(value) === 1) {
                validateLegacyConversationContextDocument(value);
                return migrateLegacyDocument(value);
            }
            validateConversationContextDocument(value);
        } catch (error) {
            throw new StoreUnavailable(`conversation context is invalid: ${errorMessage(error)}`, { cause: error });
        }
        return value;
    }

    async currentConversation(principal: string, scope: string, startedAt = nowUtc()): Promise<ConversationId> {
        validateTrajectoryInput(principal, scope, startedAt);
        const document = await this.load();
        const active = document.active_trajectories.find(
            (trajectory) => trajectory.principal === principal && trajectory.scope === scope,
        );
        if (active) {
            return active.conversation_id;
        }

        const conversationId = newConversationId();
        document.active_trajectories.push({
            conversation_id: conversationId,
            principal,
            scope,
            started_at: startedAt,
        });
        await this.writeDocument(document);
        return conversationId;
    }

    async startFreshConversation(principal: string, scope: string, startedAt = nowUtc()): Promise<ConversationId> {
        validateTrajectoryInput(principal, scope, startedAt);
        const document = await this.load();
        const conversationId = newConversationId();
        const index = document.active_trajectories.findIndex(
            (trajectory) => trajectory.principal === principal && trajectory.scope === scope,
        );
        const trajectory = {
            conversation_id: conversationId,
            principal,
            scope,
            started_at: startedAt,
        };
        if (index < 0) {
            document.active_trajectories.push(trajectory);
        } else {
            document.active_trajectories[index] = trajectory;
        }
        await this.writeDocument(document);
        return conversationId;
    }

    async recordAcceptedInput(input: AcceptedConversationExchange): Promise<ConversationExchangeRecord> {
        const record: ConversationExchangeRecord = {
            ...input,
            expression_evidence_id: null,
            expression_occurred_at: null,
            expression_content: null,
            expression_content_truncated: null,
        };
        const document = await this.load();
        const active = document.active_trajectories.find(
            (trajectory) => trajectory.principal === record.principal && trajectory.scope === record.scope,
        );
        if (!active || active.conversation_id !== record.conversation_id) {
            throw new ValidationError(`conversation ${record.conversation_id} is no longer current`);
        }

        const existing = document.exchanges.find((exchange) => exchange.cognition_id === record.cognition_id);
        if (existing) {
            if (JSON.stringify(existing) !== JSON.stringify(record)) {
                throw new ValidationError(`conversation context conflicts with cognition ${record.cognition_id}`);
            }
            return structuredClone(existing);
        }

        document.exchanges.push(record);
        if (document.exchanges.length > RECENT_DIALOGUE_MAX_STORED_EXCHANGES) {
            document.exchanges.splice(0, document.exchanges.length - RECENT_DIALOGUE_MAX_STORED_EXCHANGES);
        }
        await this.writeDocument(document);
        return structuredClone(record);
    }

    async recordCommittedExpression(input: CommittedConversationExpression): Promise<ConversationExchangeRecord> {
        const projection = truncateConversationText(input.expression_content);
        const document = await this.load();
        const index = document.exchanges.findIndex((exchange) => exchange.cognition_id === input.cognition_id);
        if (index < 0) {
            throw new ValidationError(`conversation context is missing accepted cognition ${input.cognition_id}`);
        }
        const existing = document.exchanges[index]!;
        const updated: ConversationExchangeRecord = {
            ...existing,
            expression_evidence_id: input.expression_evidence_id,
            expression_occurred_at: input.expression_occurred_at,
            expression_content: projection.content,
            expression_content_truncated: projection.truncated,
        };

        if (existing.expression_evidence_id !== null) {
            if (JSON.stringify(existing) !== JSON.stringify(updated)) {
                throw new ValidationError(
                    `conversation context expression conflicts with cognition ${input.cognition_id}`,
                );
            }
            return structuredClone(existing);
        }

        document.exchanges[index] = updated;
        await this.writeDocument(document);
        return structuredClone(updated);
    }

    private async writeDocument(document: ConversationContextDocument): Promise<void> {
        validateConversationContextDocument(document);
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage:
                "conversation context replacement may be visible, but directory synchronization failed",
        });
    }
}

function emptyDocument(): ConversationContextDocument {
    return { conversation_context_version: 2, active_trajectories: [], exchanges: [] };
}

function migrateLegacyDocument(legacy: LegacyConversationContextDocument): ConversationContextDocument {
    const conversationBySurface = new Map<string, ConversationId>();
    const firstStartedAtByConversation = new Map<ConversationId, string>();
    const activeByPrincipalScope = new Map<string, ConversationId>();
    const exchanges = legacy.exchanges.map((exchange) => {
        const surfaceKey = legacySurfaceKey(exchange.principal, exchange.scope, exchange.surface);
        let conversationId = conversationBySurface.get(surfaceKey);
        if (!conversationId) {
            conversationId = legacyConversationId(surfaceKey);
            conversationBySurface.set(surfaceKey, conversationId);
            firstStartedAtByConversation.set(conversationId, exchange.started_at);
        }
        activeByPrincipalScope.set(principalScopeKey(exchange.principal, exchange.scope), conversationId);
        return { ...exchange, conversation_id: conversationId };
    });

    const active_trajectories = [...activeByPrincipalScope.entries()].map(([key, conversationId]) => {
        const exchange = exchanges.find(
            (candidate) =>
                candidate.conversation_id === conversationId &&
                principalScopeKey(candidate.principal, candidate.scope) === key,
        )!;
        return {
            conversation_id: conversationId,
            principal: exchange.principal,
            scope: exchange.scope,
            started_at: firstStartedAtByConversation.get(conversationId)!,
        };
    });
    const document: ConversationContextDocument = {
        conversation_context_version: 2,
        active_trajectories,
        exchanges,
    };
    validateConversationContextDocument(document);
    return document;
}

function legacyConversationId(key: string): ConversationId {
    const digest = createHash("sha256").update(key).digest("hex").slice(0, 24);
    return `conversation-legacy-${digest}`;
}

function newConversationId(): ConversationId {
    return `conversation-${randomUUID()}`;
}

function validateTrajectoryInput(principal: string, scope: string, startedAt: string) {
    if (!principal.trim()) throw new ValidationError("conversation principal must be non-empty");
    if (!scope.trim()) throw new ValidationError("conversation scope must be non-empty");
    if (!isRfc3339Utc(startedAt)) throw new ValidationError("conversation start must be RFC 3339 UTC");
}

function legacySurfaceKey(principal: string, scope: string, surface: string) {
    return `${principal}\u0000${scope}\u0000${surface}`;
}

function principalScopeKey(principal: string, scope: string) {
    return `${principal}\u0000${scope}`;
}

function conversationContextVersion(value: unknown): unknown {
    return typeof value === "object" && value !== null && "conversation_context_version" in value
        ? value.conversation_context_version
        : null;
}

function errorCode(error: unknown): string | undefined {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
