import { randomUUID } from "node:crypto";

import type {
    LineageId,
    AgentActor,
    MeaningId,
    EvidenceId,
    RuntimeId,
    CognitionId,
    OpportunityId,
} from "./contracts.ts";

import { ValidationError } from "../errors.ts";
import { isNotBlankString } from "../util.ts";

type IdPrefix = "lineage" | "meaning" | "evidence" | "runtime" | "cognition" | "opportunity";

export function newId(prefix: "lineage"): LineageId;
export function newId(prefix: "meaning"): MeaningId;
export function newId(prefix: "evidence"): EvidenceId;
export function newId(prefix: "runtime"): RuntimeId;
export function newId(prefix: "cognition"): CognitionId;
export function newId(prefix: "opportunity"): OpportunityId;
export function newId(prefix: IdPrefix): LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId | OpportunityId {
    return `${prefix}-${randomUUID()}` as LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId | OpportunityId;
}

export function agentActor(lineageId: LineageId | string): AgentActor {
    if (!isNotBlankString(lineageId) || !lineageId.startsWith("lineage-")) {
        throw new ValidationError("agent actor requires a stable lineage ID");
    }
    return `agent:${lineageId}`;
}
