import type { ComposedEmberApplicationDependencies } from "../composition/ember.ts";

/** Repositories used by explicit CLI commands and Telegram delivery recovery. */
export type SurfaceRepositories = ComposedEmberApplicationDependencies["repositories"];
