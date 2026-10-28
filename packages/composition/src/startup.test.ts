import { initialState } from "@ember/domain/model.ts";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { composeCliSurface } from "./cli.ts";

test("composed application should retain run records and release registered plugins on close", async () => {
    // Given a persisted agent and an independently registered observation plugin.
    const directory = await mkdtemp(join(tmpdir(), "ember-composition-"));
    const statePath = join(directory, "state.json");
    const states: string[] = [];
    let cleaned = false;
    const services = composeCliSurface(
        {
            statePath,
            provider: {
                kind: "process",
                command: "/bin/echo",
                arguments: [],
                timeoutSeconds: 5,
            },
        },
        {
            executor: async () => ({ contractVersion: 1, reply: "hello", usedMeaningIds: [] }),
            plugins: [
                {
                    id: "fixture.observer",
                    setup(registration) {
                        registration.observe((event) => {
                            states.push(event.run.state);
                        });
                        registration.onCleanup(() => {
                            cleaned = true;
                        });
                    },
                },
            ],
        },
    );
    try {
        await services.repositories.state.create(initialState("max"));
        // When ordinary input enters through the composed application boundary.
        const result = await services.application.interact(
            {
                kind: "message",
                principal: "max",
                principalProvenance: "explicit_local_argument",
                scope: "shared",
                surfaceId: "cli",
                text: "hello",
            },
            async () => ({ outcome: "confirmed", externalMessageId: null }),
        );
        await services.close();
        // Then policy execution, operational bookkeeping and plugin cleanup all complete.
        assert.equal(result.cognitionStatus, "completed");
        assert.deepEqual(states, ["queued", "running", "completed"]);
        assert.equal((await readdir(join(`${statePath}.engine`, "runs"))).length, 1);
        assert.equal(cleaned, true);
        await assert.rejects(
            services.application.interact({} as never, async () => ({ outcome: "confirmed", externalMessageId: null })),
            /closed/,
        );
    } finally {
        await services.close();
        await rm(directory, { recursive: true, force: true });
    }
});
