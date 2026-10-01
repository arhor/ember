import type { CapabilityAuthorityDecision, CapabilityBinding, CapabilityContext } from "./execution.ts";

import { exactKeys, isObject } from "../util.ts";

export interface LocalLookupCapabilityOptions {
    entries: Readonly<Record<string, string>>;
    allowedKeys?: readonly string[];
    authority:
        | CapabilityAuthorityDecision
        | ((
              context: CapabilityContext,
              input: unknown,
          ) => CapabilityAuthorityDecision | Promise<CapabilityAuthorityDecision>);
}

export function createLocalLookupCapability({
    entries,
    allowedKeys = Object.keys(entries),
    authority,
}: LocalLookupCapabilityOptions): CapabilityBinding {
    const allowed = new Set(allowedKeys);

    return {
        name: "localLookup",
        description: "Look up one explicitly bounded value from Ember's supplied local capability data.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                key: { type: "string", minLength: 1 },
            },
            required: ["key"],
        },
        occurrencePolicy: "at_most_once_per_cognition",
        authorize: (context, input) => (typeof authority === "function" ? authority(context, input) : authority),
        validateInput: (_context, input) => {
            if (!isObject(input) || !exactKeys(input, ["key"]) || typeof input.key !== "string" || !input.key.trim()) {
                return { status: "rejected", reason: "local lookup input must contain one non-empty key" };
            }
            if (!allowed.has(input.key) || !(input.key in entries)) {
                return {
                    status: "rejected",
                    reason: "requested local lookup key is outside the selected capability scope",
                };
            }
            return { status: "allowed" };
        },
        execute: (_context, input) => {
            if (!isObject(input) || typeof input.key !== "string") {
                throw new Error("validated local lookup input became invalid before execution");
            }
            const value = entries[input.key];
            if (value === undefined) {
                throw new Error("validated local lookup key disappeared before execution");
            }
            return { key: input.key, value };
        },
    };
}
