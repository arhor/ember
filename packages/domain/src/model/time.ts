import { ValidationError } from "../errors.ts";

export function nowUtc(): string {
    const fixed = process.env.EMBER_TEST_NOW;
    if (fixed) {
        requireTimestamp(fixed, "EMBER_TEST_NOW");
        return fixed;
    }
    return new Date().toISOString();
}

export function isRfc3339Utc(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
    if (!match) {
        return false;
    }
    const year = Number(match[1]!);
    const month = Number(match[2]!);
    const day = Number(match[3]!);
    const hour = Number(match[4]!);
    const minute = Number(match[5]!);
    const second = Number(match[6]!);
    const fraction = match[7] ?? "";
    const millisecond = Number(fraction.slice(0, 3).padEnd(3, "0"));
    const instant = new Date(0);

    instant.setUTCFullYear(year, month - 1, day);
    instant.setUTCHours(hour, minute, second, millisecond);

    return (
        instant.getUTCFullYear() === year &&
        instant.getUTCMonth() === month - 1 &&
        instant.getUTCDate() === day &&
        instant.getUTCHours() === hour &&
        instant.getUTCMinutes() === minute &&
        instant.getUTCSeconds() === second &&
        instant.getUTCMilliseconds() === millisecond
    );
}

export function requireTimestamp(value: unknown, path: string): asserts value is string {
    if (!isRfc3339Utc(value)) {
        throw new ValidationError(`${path} must be RFC 3339 UTC`);
    }
}
