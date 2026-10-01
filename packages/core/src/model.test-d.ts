import { expectAssignable, expectNotAssignable } from "tsd";

import type { EmberState, EvidenceId, MeaningId } from "./model.ts";

declare const evidenceId: EvidenceId;
declare const meaningId: MeaningId;
declare const state: EmberState;

expectAssignable<MeaningId>(meaningId);
expectAssignable<EmberState>(state);
expectNotAssignable<MeaningId>(evidenceId);
