import { readFileSync, writeFileSync } from "node:fs";

const path = "eval/longitudinal/harness.ts";
const source = readFileSync(path, "utf8");
const before = `                    return supersede(state, principal, requireAlias(aliases, item.meaning), item.text, {
                        reason: item.reason,
                    });`;
const after = `                    return supersede(state, principal, requireAlias(aliases, item.meaning), item.text, {
                        reason: item.reason ?? null,
                    });`;
if (!source.includes(before)) throw new Error("expected longitudinal supersede call not found");
writeFileSync(path, source.replace(before, after));
