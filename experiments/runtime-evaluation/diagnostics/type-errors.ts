import type { MeaningId, Projection } from "../src/model.ts";

import { evidenceId, fixtureState } from "../src/model.ts";

const wrongMeaningId: MeaningId = evidenceId("evidence-diagnostic");
const wrongProjection: Projection = fixtureState();

void wrongMeaningId;
void wrongProjection;
