import { expectAssignable, expectNotAssignable } from "tsd";

import type { EmberState } from "./model.ts";
import type { Projection } from "./projection.ts";

declare const state: EmberState;
declare const projection: Projection;

expectAssignable<EmberState>(state);
expectNotAssignable<EmberState>(projection);
