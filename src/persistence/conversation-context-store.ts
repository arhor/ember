import { readFile } from "node:fs/promises";

import type { ConversationContextDocument, ConversationExchangeRecord } from "../core/conversation-context.ts";

import {
    RECENT_DIALOGUE_MAX_STORED_EXCHANGES,
    truncateConversationText,
    validateConversationContextDocument,
} from "../core/conversation-context.ts";
import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { replaceFileDurably } from "./file-replacement.ts";

export type CompletedConversationExchange = Omit<
    ConversationExchangeRecord,
    "expression_content" | "expression_content_truncated"
> & {
    expression_content: string;
};

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
            validateConversationContextDocument(value);
        } catch (error) {
            throw new StoreUnavailable(`conversation context is invalid: ${errorMessage(error)}`, { cause: error });
        }
        return value;
    }

    async recordCompletedExchange(input: CompletedConversationExchange): Promise<ConversationExchangeRecord> {
        const projection = truncateConversationText(input.expression_content);
        const record: ConversationExchangeRecord = {
            ...input,
            expression_content: projection.content,
            expression_content_truncated: projection.truncated,
        };
        validateConversationContextDocument({ conversation_context_version: 1, exchanges: [record] });

        const document = await this.load();
        const existing = document.exchanges.find((exchange) => exchange.cognition_id === record.cognition_id);
        if (existing) {
            if (JSON.stringify(existing) !== JSON.stringify(record)) {
                throw new ValidationError(`conversation context conflicts with cognition ${record.cognition_id}`);
            }
            return structuredClone(existing);
        }

        document.exchanges.push(record);
        document.exchanges.sort(
            (left, right) =>
                left.expression_occurred_at.localeCompare(right.expression_occurred_at) ||
                left.cognition_id.localeCompare(right.cognition_id),
        );
        if (document.exchanges.length > RECENT_DIALOGUE_MAX_STORED_EXCHANGES) {
            document.exchanges.splice(0, document.exchanges.length - RECENT_DIALOGUE_MAX_STORED_EXCHANGES);
        }
        validateConversationContextDocument(document);
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage:
                "conversation context replacement may be visible, but directory synchronization failed",
        });
        return structuredClone(record);
    }
}

function emptyDocument(): ConversationContextDocument {
    return { conversation_context_version: 1, exchanges: [] };
}

function errorCode(error: unknown): string | undefined {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
