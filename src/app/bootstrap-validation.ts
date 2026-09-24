import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";

export function validateSetupProvider(value: Record<string, unknown>): void {
    if (
        typeof value.kind !== "string" ||
        !["codex", "cursor", "claude-code"].includes(String(value.kind)) ||
        !safeText(value.command) ||
        typeof value.model !== "string" ||
        (value.model !== "" && !safeText(value.model)) ||
        typeof value.timeoutSeconds !== "number" ||
        !Number.isFinite(value.timeoutSeconds) ||
        value.timeoutSeconds <= 0 ||
        value.timeoutSeconds > 120 ||
        (value.kind === "claude-code" && value.command !== "claude-code")
    )
        throw new ValidationError(
            "setup provider requires codex, cursor, or claude-code and a timeout in (0, 120] seconds",
        );
}

export function safeText(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 4096 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}
