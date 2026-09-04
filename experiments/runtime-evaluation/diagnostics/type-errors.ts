import { evidenceId, fixtureState, type MeaningId, type Projection } from "../src/model.ts";

const wrongMeaningId: MeaningId = evidenceId("evidence-diagnostic");
const wrongProjection: Projection = fixtureState();

void wrongMeaningId;
void wrongProjection;
