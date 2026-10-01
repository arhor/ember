import type { EmberState, Evidence, Meaning } from "./model.ts";

import { ValidationError } from "./errors.ts";
import { validateState } from "./model.ts";
import { cloneState } from "./util.ts";

export const MARKDOWN_MATERIALIZATION_VERSION = 1;

export type MaterializedViewName = "SELF.md" | "USER.md" | "RELATIONSHIP.md" | "MEMORY.md";

export interface StateMaterializationPolicy {
    principal: string;
    scope: string;
}

export type MaterializedMeaning = Meaning & {
    sourceEvidence: Array<Omit<Evidence, "payload" | "contentDigest">>;
};

export interface StateMaterialization {
    materializationVersion: 1;
    sourceSchemaVersion: number;
    sourceRevision: number;
    lineageId: string;
    purpose: "filesystem_inspection";
    disclosurePolicy: { principal: string; scope: string; evidencePayloads: "excluded" };
    interactionModes: Record<MaterializedViewName, "generated_only" | "selective_proposal_authoring">;
    views: Record<MaterializedViewName, MaterializedMeaning[]>;
}

/** Selects a purpose- and scope-bounded semantic view without depending on Markdown layout. */
export function buildStateMaterialization(state: EmberState, policy: StateMaterializationPolicy): StateMaterialization {
    validateState(state);
    if (policy.principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("materialization principal does not match initialized local principal");
    if (!policy.scope.trim()) throw new ValidationError("materialization scope must be non-empty");

    const evidence = new Map(state.evidence.map((item) => [item.evidenceId, item]));
    const selected = state.meanings
        .filter((meaning) => meaning.scope === policy.scope)
        .sort((left, right) => left.meaningId.localeCompare(right.meaningId))
        .map((meaning) => ({
            ...cloneState(meaning),
            sourceEvidence: meaning.sourceEvidenceIds.map((id) => {
                const source = evidence.get(id);
                if (!source) throw new ValidationError(`materialization evidence does not exist: ${id}`);
                const descriptor = cloneState(source) as Omit<Evidence, "payload" | "contentDigest"> & {
                    payload?: string;
                    contentDigest?: string;
                };
                delete descriptor.payload;
                delete descriptor.contentDigest;
                return descriptor;
            }),
        }));

    const views: StateMaterialization["views"] = {
        "SELF.md": selected.filter((meaning) => meaning.owner === `agent:${state.lineage.lineageId}`),
        "USER.md": selected.filter((meaning) => meaning.owner === `user:${policy.principal}`),
        "RELATIONSHIP.md": selected.filter((meaning) => meaning.owner === `relationship:${policy.principal}`),
        "MEMORY.md": selected,
    };
    return {
        materializationVersion: MARKDOWN_MATERIALIZATION_VERSION,
        sourceSchemaVersion: state.schemaVersion,
        sourceRevision: state.revision,
        lineageId: state.lineage.lineageId,
        purpose: "filesystem_inspection",
        disclosurePolicy: { principal: policy.principal, scope: policy.scope, evidencePayloads: "excluded" },
        interactionModes: {
            "SELF.md": "generated_only",
            "USER.md": "selective_proposal_authoring",
            "RELATIONSHIP.md": "generated_only",
            "MEMORY.md": "generated_only",
        },
        views,
    };
}
