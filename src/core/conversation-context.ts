import type { CognitionId, DeliveryStatus, EmberState, EvidenceId } from "./model.ts";

import { exactKeys, isObject } from "../util.ts";
import { ValidationError } from "./errors.ts";
import { isRfc3339Utc, validateState } from "./model.ts";

export const RECENT_DIALOGUE_SELECTION_STRATEGY = "recent_same_conversation_v2" as const;
export const RECENT_DIALOGUE_MAX_EXCHANGES = 4;
export const RECENT_DIALOGUE_MAX_STORED_EXCHANGES = 16;
export const RECENT_DIALOGUE_MAX_TURN_BYTES = 4 * 1024;

export type ConversationId = `conversation-${string}`;

export interface ActiveConversationTrajectory {
    conversation_id: ConversationId;
    principal: string;
    scope: string;
    started_at: string;
}

export interface ConversationExchangeRecord {
    conversation_id: ConversationId;
    cognition_id: CognitionId;
    principal: string;
    scope: string;
    surface: string;
    input_evidence_id: EvidenceId;
    started_at: string;
    expression_evidence_id: EvidenceId | null;
    expression_occurred_at: string | null;
    expression_content: string | null;
    expression_content_truncated: boolean | null;
}

export interface ConversationContextDocument {
    conversation_context_version: 2;
    active_trajectories: ActiveConversationTrajectory[];
    exchanges: ConversationExchangeRecord[];
}

export interface LegacyConversationExchangeRecord extends Omit<ConversationExchangeRecord, "conversation_id"> {}

export interface LegacyConversationContextDocument {
    conversation_context_version: 1;
    exchanges: LegacyConversationExchangeRecord[];
}

export interface ProjectedConversationTurn {
    order: number;
    role: "user" | "ember";
    cognition_id: CognitionId;
    evidence_id: EvidenceId;
    source_surface: string;
    occurred_at: string;
    content: string;
    content_truncated: boolean;
    in_reply_to_evidence_id: EvidenceId | null;
    delivery_status: DeliveryStatus | null;
    user_awareness: "unknown" | null;
}

export interface ProjectedConversationContext {
    context_version: 2;
    conversation_id: ConversationId;
    turns: ProjectedConversationTurn[];
    selection: {
        strategy: typeof RECENT_DIALOGUE_SELECTION_STRATEGY;
        max_exchanges: number;
        max_turn_bytes: number;
        selected_cognition_ids: CognitionId[];
        selected_evidence_ids: EvidenceId[];
        excluded_older_exchange_count: number;
        excluded_unavailable_exchange_count: number;
        unavailable_expression_count: number;
        truncated_turn_count: number;
    };
}

export function emptyConversationContext(conversationId: ConversationId): ProjectedConversationContext {
    return {
        context_version: 2,
        conversation_id: conversationId,
        turns: [],
        selection: {
            strategy: RECENT_DIALOGUE_SELECTION_STRATEGY,
            max_exchanges: RECENT_DIALOGUE_MAX_EXCHANGES,
            max_turn_bytes: RECENT_DIALOGUE_MAX_TURN_BYTES,
            selected_cognition_ids: [],
            selected_evidence_ids: [],
            excluded_older_exchange_count: 0,
            excluded_unavailable_exchange_count: 0,
            unavailable_expression_count: 0,
            truncated_turn_count: 0,
        },
    };
}

export function selectRecentConversationContext(
    state: EmberState,
    document: ConversationContextDocument,
    {
        principal,
        scope,
        conversationId,
    }: {
        principal: string;
        scope: string;
        conversationId: ConversationId;
    },
): ProjectedConversationContext {
    validateState(state);
    validateConversationContextDocument(document);

    const active = document.active_trajectories.find(
        (trajectory) => trajectory.principal === principal && trajectory.scope === scope,
    );
    if (!active || active.conversation_id !== conversationId) {
        throw new ValidationError("conversation trajectory is not current for the requested principal and scope");
    }

    const matching = document.exchanges.filter((exchange) => exchange.conversation_id === conversationId);
    const selected = matching.slice(-RECENT_DIALOGUE_MAX_EXCHANGES);
    const result = emptyConversationContext(conversationId);
    result.selection.excluded_older_exchange_count = Math.max(0, matching.length - selected.length);

    const cognitionById = new Map(
        state.operations.cognitionEpisodes.map((cognition) => [cognition.cognitionId, cognition]),
    );
    const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence]));

    for (const exchange of selected) {
        if (exchange.principal !== principal || exchange.scope !== scope) {
            throw new ValidationError(`conversation exchange crosses principal or scope boundary: ${exchange.cognition_id}`);
        }
        const cognition = cognitionById.get(exchange.cognition_id);
        if (!cognition) {
            throw new ValidationError(`conversation exchange refers to absent cognition ${exchange.cognition_id}`);
        }
        if (
            cognition.principal !== exchange.principal ||
            cognition.activeScope !== exchange.scope ||
            cognition.inputEvidenceId !== exchange.input_evidence_id ||
            cognition.startedAt !== exchange.started_at
        ) {
            throw new ValidationError(`conversation exchange conflicts with cognition ${exchange.cognition_id}`);
        }

        const input = evidenceById.get(exchange.input_evidence_id);
        if (!input || input.sourceRole !== "user_command") {
            throw new ValidationError(`conversation exchange input evidence is invalid: ${exchange.input_evidence_id}`);
        }

        let expression = null;
        if (exchange.expression_evidence_id !== null) {
            if (
                cognition.status !== "completed" ||
                cognition.expressionEvidenceId !== exchange.expression_evidence_id
            ) {
                throw new ValidationError(
                    `conversation exchange exposes an unestablished expression for ${exchange.cognition_id}`,
                );
            }
            expression = evidenceById.get(exchange.expression_evidence_id) ?? null;
            if (!expression || expression.sourceRole !== "ember_expression_via_provider") {
                throw new ValidationError(
                    `conversation exchange expression evidence is invalid: ${exchange.expression_evidence_id}`,
                );
            }
            if (expression.occurredAt !== exchange.expression_occurred_at) {
                throw new ValidationError(
                    `conversation exchange occurrence conflicts with ${exchange.expression_evidence_id}`,
                );
            }
        }

        if (input.availability !== "available") {
            result.selection.excluded_unavailable_exchange_count += 1;
            continue;
        }

        const projectedInput = truncateConversationText(input.payload);
        const userOrder = result.turns.length;
        result.turns.push({
            order: userOrder,
            role: "user",
            cognition_id: cognition.cognitionId,
            evidence_id: input.evidenceId,
            source_surface: exchange.surface,
            occurred_at: input.occurredAt,
            content: projectedInput.content,
            content_truncated: projectedInput.truncated,
            in_reply_to_evidence_id: null,
            delivery_status: null,
            user_awareness: null,
        });
        result.selection.selected_cognition_ids.push(cognition.cognitionId);
        result.selection.selected_evidence_ids.push(input.evidenceId);
        result.selection.truncated_turn_count += Number(projectedInput.truncated);

        if (expression === null) {
            if (cognition.status === "completed" && cognition.expressionEvidenceId !== null) {
                result.selection.unavailable_expression_count += 1;
            }
            continue;
        }

        const projectedExpression = truncateConversationText(exchange.expression_content!);
        const expressionTruncated = exchange.expression_content_truncated! || projectedExpression.truncated;
        result.turns.push({
            order: userOrder + 1,
            role: "ember",
            cognition_id: cognition.cognitionId,
            evidence_id: expression.evidenceId,
            source_surface: exchange.surface,
            occurred_at: expression.occurredAt,
            content: projectedExpression.content,
            content_truncated: expressionTruncated,
            in_reply_to_evidence_id: input.evidenceId,
            delivery_status: cognition.deliveryStatus,
            user_awareness: "unknown",
        });
        result.selection.selected_evidence_ids.push(expression.evidenceId);
        result.selection.truncated_turn_count += Number(expressionTruncated);
    }

    return result;
}

export function truncateConversationText(
    text: string,
    maxBytes = RECENT_DIALOGUE_MAX_TURN_BYTES,
): { content: string; truncated: boolean } {
    if (typeof text !== "string") {
        throw new ValidationError("conversation turn content must be a string");
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
        throw new ValidationError("conversation turn byte limit must be a positive safe integer");
    }
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return { content: text, truncated: false };
    }

    const symbols: string[] = [];
    let bytes = 0;
    for (const symbol of text) {
        const symbolBytes = Buffer.byteLength(symbol, "utf8");
        if (bytes + symbolBytes > maxBytes) {
            break;
        }
        symbols.push(symbol);
        bytes += symbolBytes;
    }
    return { content: symbols.join(""), truncated: true };
}

export function validateConversationContextDocument(value: unknown): asserts value is ConversationContextDocument {
    if (!isObject(value) || !exactKeys(value, ["conversation_context_version", "active_trajectories", "exchanges"])) {
        throw new ValidationError("conversation context document does not match schema v2");
    }
    if (
        value.conversation_context_version !== 2 ||
        !Array.isArray(value.active_trajectories) ||
        !Array.isArray(value.exchanges)
    ) {
        throw new ValidationError("conversation context document does not match schema v2");
    }
    validateActiveTrajectories(value.active_trajectories);
    validateExchangeCollection(value.exchanges, false);
}

export function validateLegacyConversationContextDocument(
    value: unknown,
): asserts value is LegacyConversationContextDocument {
    if (!isObject(value) || !exactKeys(value, ["conversation_context_version", "exchanges"])) {
        throw new ValidationError("conversation context document does not match schema v1");
    }
    if (value.conversation_context_version !== 1 || !Array.isArray(value.exchanges)) {
        throw new ValidationError("conversation context document does not match schema v1");
    }
    validateExchangeCollection(value.exchanges, true);
}

function validateActiveTrajectories(value: unknown[]) {
    const activePairs = new Set<string>();
    const activeIds = new Set<string>();
    for (const [index, raw] of value.entries()) {
        const path = `conversation context active_trajectories[${index}]`;
        if (!isObject(raw) || !exactKeys(raw, ["conversation_id", "principal", "scope", "started_at"])) {
            throw new ValidationError(`${path} contains missing or unsupported fields`);
        }
        validateConversationId(raw.conversation_id, `${path}.conversation_id`);
        for (const field of ["principal", "scope"] as const) {
            if (typeof raw[field] !== "string" || !raw[field].trim()) {
                throw new ValidationError(`${path}.${field} must be non-empty`);
            }
        }
        if (!isRfc3339Utc(raw.started_at)) {
            throw new ValidationError(`${path}.started_at must be RFC 3339 UTC`);
        }
        const pair = `${raw.principal}\u0000${raw.scope}`;
        if (activePairs.has(pair)) {
            throw new ValidationError(`${path} duplicates an active principal/scope trajectory`);
        }
        if (activeIds.has(raw.conversation_id)) {
            throw new ValidationError(`${path}.conversation_id is duplicated`);
        }
        activePairs.add(pair);
        activeIds.add(raw.conversation_id);
    }
}

function validateExchangeCollection(value: unknown[], legacy: boolean) {
    if (value.length > RECENT_DIALOGUE_MAX_STORED_EXCHANGES) {
        throw new ValidationError("conversation context document exceeds the stored exchange bound");
    }

    const cognitionIds = new Set<string>();
    const conversationOwners = new Map<string, string>();
    for (const [index, raw] of value.entries()) {
        const path = `conversation context exchanges[${index}]`;
        const keys = [
            ...(legacy ? [] : ["conversation_id"]),
            "cognition_id",
            "principal",
            "scope",
            "surface",
            "input_evidence_id",
            "started_at",
            "expression_evidence_id",
            "expression_occurred_at",
            "expression_content",
            "expression_content_truncated",
        ];
        if (!isObject(raw) || !exactKeys(raw, keys)) {
            throw new ValidationError(`${path} contains missing or unsupported fields`);
        }
        if (!legacy) {
            validateConversationId(raw.conversation_id, `${path}.conversation_id`);
        }
        if (typeof raw.cognition_id !== "string" || !raw.cognition_id.startsWith("cognition-")) {
            throw new ValidationError(`${path}.cognition_id is invalid`);
        }
        if (cognitionIds.has(raw.cognition_id)) {
            throw new ValidationError(`${path}.cognition_id is duplicated`);
        }
        cognitionIds.add(raw.cognition_id);
        if (typeof raw.input_evidence_id !== "string" || !raw.input_evidence_id.startsWith("evidence-")) {
            throw new ValidationError(`${path}.input_evidence_id is invalid`);
        }
        for (const field of ["principal", "scope", "surface"] as const) {
            if (typeof raw[field] !== "string" || !raw[field].trim()) {
                throw new ValidationError(`${path}.${field} must be non-empty`);
            }
        }
        if (!legacy) {
            const owner = `${raw.principal}\u0000${raw.scope}`;
            const existingOwner = conversationOwners.get(raw.conversation_id);
            if (existingOwner !== undefined && existingOwner !== owner) {
                throw new ValidationError(`${path}.conversation_id crosses principal or scope boundary`);
            }
            conversationOwners.set(raw.conversation_id, owner);
        }
        if (!isRfc3339Utc(raw.started_at)) {
            throw new ValidationError(`${path}.started_at must be RFC 3339 UTC`);
        }

        const expressionAbsent =
            raw.expression_evidence_id === null &&
            raw.expression_occurred_at === null &&
            raw.expression_content === null &&
            raw.expression_content_truncated === null;
        const expressionPresent =
            typeof raw.expression_evidence_id === "string" &&
            raw.expression_evidence_id.startsWith("evidence-") &&
            isRfc3339Utc(raw.expression_occurred_at) &&
            typeof raw.expression_content === "string" &&
            raw.expression_content.length > 0 &&
            Buffer.byteLength(raw.expression_content, "utf8") <= RECENT_DIALOGUE_MAX_TURN_BYTES &&
            typeof raw.expression_content_truncated === "boolean";
        if (!expressionAbsent && !expressionPresent) {
            throw new ValidationError(`${path} expression fields must be all absent or all established`);
        }
        if (expressionPresent && Date.parse(raw.started_at) > Date.parse(raw.expression_occurred_at)) {
            throw new ValidationError(`${path} expression cannot precede cognition start`);
        }
    }
}

function validateConversationId(value: unknown, path: string): asserts value is ConversationId {
    if (typeof value !== "string" || !value.startsWith("conversation-") || value.length <= "conversation-".length) {
        throw new ValidationError(`${path} is invalid`);
    }
}
