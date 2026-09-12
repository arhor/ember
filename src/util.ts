import { createHash } from "node:crypto";

export function isObject(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sameContent<T>(left: readonly T[], right: readonly T[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    const expected = new Set<T>(left);
    return right.every((item) => expected.has(item));
}

export function exactKeys(object: unknown, keys: readonly string[]) {
    if (!isObject(object)) {
        return false;
    }

    const objectKeys = Object.keys(object);
    const expectedKeys = new Set(keys);

    return (
        expectedKeys.size === keys.length &&
        objectKeys.length === keys.length &&
        objectKeys.every((key) => expectedKeys.has(key))
    );
}

export function isNotBlankString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export function cloneState<T>(state: T): T {
    return structuredClone(state);
}

export function contentDigest(payload: string): `sha256:${string}` {
    const createdHash = createHash("sha256");
    const updatedHash = createdHash.update(payload, "utf8");

    return `sha256:${updatedHash.digest("hex")}`;
}

export function assertUnreachable(_: never): never {
    throw new Error("Didn't expect to get here");
}
