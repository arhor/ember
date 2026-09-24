import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";

export function validateSetupProvider(value: Record<string, unknown>): void {
    if (
        typeof value.kind !== "string" ||
        !["codex", "cursor", "claude-code", "ollama"].includes(String(value.kind)) ||
        (value.kind !== "ollama" && !safeText(value.command)) ||
        (value.kind === "ollama" && value.command !== undefined) ||
        typeof value.model !== "string" ||
        (value.kind === "ollama" && !safeText(value.model)) ||
        (value.kind !== "ollama" && value.model !== "" && !safeText(value.model)) ||
        typeof value.timeoutSeconds !== "number" ||
        !Number.isFinite(value.timeoutSeconds) ||
        value.timeoutSeconds <= 0 ||
        value.timeoutSeconds > 120 ||
        (value.kind === "claude-code" && value.command !== "claude-code") ||
        (value.kind === "ollama" && value.baseUrl !== undefined && !isLocalOllamaUrl(value.baseUrl))
    )
        throw new ValidationError(
            "setup provider requires codex, cursor, claude-code, or Ollama with a timeout in (0, 120] seconds",
        );
}

function isLocalOllamaUrl(value: unknown): boolean {
    if (!safeText(value)) return false;
    try {
        const url = new URL(value);
        return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    } catch {
        return false;
    }
}

export function safeText(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 4096 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}
