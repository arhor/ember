import { inspectSpecialistEpisode, reconcileSpecialistResult } from "@ember/ai-sdk/codex-specialist.ts";
import { createSpecialistReintegration } from "@ember/application/delegation/specialist-reintegration.ts";
import { replaceFileAtomically } from "@ember/persistence/persistence/file-replacement.ts";
import { readFile, rm, writeFile } from "node:fs/promises";
export type * from "@ember/application/delegation/specialist-reintegration.ts";
const reintegration = createSpecialistReintegration({
    inspectSpecialistEpisode,
    reconcileSpecialistResult,
    read: (path) => readFile(path, "utf8"),
    writeCandidate: (path, content) => writeFile(path, content, { encoding: "utf8", mode: 0o600 }),
    replace: replaceFileAtomically,
    removeCandidate: (path) => rm(path, { force: true }),
});
export const { reintegrateSpecialistResult, inspectSpecialistReintegration } = reintegration;
