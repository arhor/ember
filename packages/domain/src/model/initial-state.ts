import type { EmberState } from "./contracts.ts";

import { TOPOLOGY, CONSTITUTIVE_TEXT } from "./contracts.ts";
import { newId } from "./identity.ts";
import { nowUtc } from "./time.ts";
import { validateState } from "./validation.ts";

export function initialState(principal: string, timestamp = nowUtc()): EmberState {
    const state: EmberState = {
        schemaVersion: 1,
        revision: 0,
        runtimeContract: { localPrincipal: principal, topology: TOPOLOGY },
        lineage: {
            lineageId: newId("lineage"),
            establishedAt: timestamp,
            constitutiveBoundaries: [{ boundaryId: "minimal-continuity-v1", text: CONSTITUTIVE_TEXT }],
        },
        evidence: [],
        meanings: [],
        operations: { runtimeEpisodes: [], cognitionEpisodes: [], cognitionOpportunities: [] },
    };
    validateState(state);
    return state;
}
