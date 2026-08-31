import test from "node:test";
import assert from "node:assert/strict";
import { runProbe } from "../experiments/external-agent-runtime/probe.ts";

test("external runtime probe should summarize JSONL lifecycle when child exits successfully", async () => {
  // Given
  const script = "process.stdout.write(JSON.stringify({type:'started'})+'\\n'+JSON.stringify({type:'completed'})+'\\n')";

  // When
  const result = await runProbe({ command: process.execPath, arguments_: ["-e", script], cwd: process.cwd(), timeoutMs: 1_000 });

  // Then
  assert.deepEqual([result.exit_code, result.exit_signal, result.jsonl_event_types], [0, null, ["started", "completed"]]);
});

test("external runtime probe should report only direct-child termination when cancellation is requested", async () => {
  // Given
  const script = "setInterval(()=>{},1000)";

  // When
  const result = await runProbe({ command: process.execPath, arguments_: ["-e", script], cwd: process.cwd(), timeoutMs: 1_000, cancelAfterMs: 20 });

  // Then
  assert.deepEqual([result.cancellation_requested, result.direct_child_exit_observed, result.exit_signal], [true, true, "SIGTERM"]);
});

test("external runtime probe should force direct-child termination when graceful cancellation is ignored", async () => {
  // Given
  const script = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";

  // When
  const result = await runProbe({ command: process.execPath, arguments_: ["-e", script], cwd: process.cwd(), timeoutMs: 2_000, cancelAfterMs: 50 });

  // Then
  assert.deepEqual([result.cancellation_requested, result.direct_child_exit_observed, result.exit_signal], [true, true, "SIGKILL"]);
});
