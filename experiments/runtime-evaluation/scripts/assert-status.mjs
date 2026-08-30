#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("usage: assert-status.mjs <runtime-status.tsv>");
const rows = (await readFile(path, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [label, rawStatus] = line.split("\t");
    const status = Number(rawStatus);
    if (!label || !Number.isInteger(status)) throw new Error(`invalid status row: ${line}`);
    return [label, status];
  });
const statuses = new Map(rows);
if (statuses.size !== rows.length) throw new Error("runtime status labels must be unique");

const expectedNegative = new Set([
  "node26-ts-diagnostics",
  "deno-ts-diagnostics",
  "deno-check-mcp",
]);
const required = [
  "node26-current-js-oracle",
  "node26-ts-typecheck",
  "node26-ts-tests",
  "node26-ts-diagnostics",
  "node26-lsp",
  "node26-mcp",
  "deno-check-core",
  "deno-ts-diagnostics",
  "deno-test",
  "deno-coverage-test",
  "deno-coverage-report",
  "deno-lint",
  "deno-fmt",
  "deno-lsp",
  "deno-check-mcp",
  "deno-mcp",
  "deno-current-js-oracle",
  "deno-current-js-cli",
  "deno-permissions",
  "measure-node24-js-cold-check",
  "measure-node26-js-cold-check",
  "measure-deno-current-js-cold-check",
  "measure-node24-js-full-tests",
  "measure-node26-js-full-tests",
  "measure-deno-current-js-full-tests",
  "measure-node24-js-restart-oracle",
  "measure-node26-js-restart-oracle",
  "measure-deno-current-js-restart-oracle",
  "measure-node24-js-idle-cli",
  "measure-node26-js-idle-cli",
  "measure-deno-current-js-idle-cli",
  "measure-node24-js-provider-cycle",
  "measure-node26-js-provider-cycle",
  "measure-deno-current-js-provider-cycle",
  "measure-node26-ts-tests",
  "measure-node26-ts-typecheck",
  "measure-deno-ts-tests",
  "measure-deno-ts-check",
];
const failures = [];
for (const label of required) {
  if (!statuses.has(label)) failures.push(`${label}: missing`);
}
for (const [label, status] of statuses) {
  if (expectedNegative.has(label)) {
    if (status === 0) failures.push(`${label}: unexpectedly succeeded; review the recorded compatibility evidence`);
  } else if (status !== 0) {
    failures.push(`${label}: expected success, got ${status}`);
  }
}
if (failures.length) throw new Error(`evaluation outcome regression:\n${failures.join("\n")}`);
console.log(`OK: ${statuses.size} evaluation outcomes match the declared evidence contract.`);
