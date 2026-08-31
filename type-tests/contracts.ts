import type { EmberState, EvidenceId, MeaningId } from "../src/ember/model.ts";
import type { Projection } from "../src/ember/projection.ts";

declare const evidenceId: EvidenceId;
declare const meaningId: MeaningId;
declare const state: EmberState;
declare const projection: Projection;

const acceptMeaningId = (_value: MeaningId): void => {};
const acceptCanonicalState = (_value: EmberState): void => {};

acceptMeaningId(meaningId);
acceptCanonicalState(state);

// @ts-expect-error Evidence and meaning identifiers are intentionally non-interchangeable.
acceptMeaningId(evidenceId);

// @ts-expect-error A derived projection must never be accepted as canonical persistent state.
acceptCanonicalState(projection);
