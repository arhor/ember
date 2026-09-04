const SENSITIVE_NAME = /(?:api[_-]?key|auth|credential|password|secret|token)/i;
const MODEL_OPTION = new Set(["--model", "-m", "--profile"]);
const CONFIG_OPTION = new Set(["--config", "-c"]);

export interface CodexArgumentEvidence {
    explicit_arguments_sanitized: string;
    model_selection: string;
}

export function codexArgumentEvidence(arguments_: string[]): CodexArgumentEvidence {
    const sanitized: string[] = [];
    const modelSelection: string[] = [];
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index]!;
        const [name, inlineValue] = splitOption(argument);
        if (inlineValue !== undefined) {
            const value = sanitizeOptionValue(name, inlineValue);
            sanitized.push(`${name}=${value}`);
            recordModelSelection(modelSelection, name, inlineValue);
            continue;
        }
        sanitized.push(argument.startsWith("-") ? argument : "<redacted-positional>");
        const consumesValue =
            MODEL_OPTION.has(argument) || CONFIG_OPTION.has(argument) || SENSITIVE_NAME.test(argument);
        if (
            !argument.startsWith("-") ||
            index + 1 >= arguments_.length ||
            (!consumesValue && arguments_[index + 1]!.startsWith("-"))
        )
            continue;
        const value = arguments_[index + 1]!;
        const safeValue = MODEL_OPTION.has(argument)
            ? bounded(value)
            : CONFIG_OPTION.has(argument)
              ? sanitizeConfig(value)
              : "<redacted>";
        sanitized.push(safeValue);
        recordModelSelection(modelSelection, argument, value);
        index += 1;
    }
    return {
        explicit_arguments_sanitized: boundedJson(sanitized, 4096),
        model_selection: modelSelection.length ? boundedJson(modelSelection, 2048) : "runtime_default",
    };
}

function splitOption(argument: string): [string, string | undefined] {
    const index = argument.indexOf("=");
    return index > 0 && argument.startsWith("-")
        ? [argument.slice(0, index), argument.slice(index + 1)]
        : [argument, undefined];
}

function sanitizeOptionValue(name: string, value: string) {
    if (SENSITIVE_NAME.test(name)) return "<redacted>";
    if (MODEL_OPTION.has(name)) return bounded(value);
    if (CONFIG_OPTION.has(name)) return sanitizeConfig(value);
    return "<redacted>";
}

function sanitizeConfig(expression: string) {
    const index = expression.indexOf("=");
    if (index <= 0) return "<redacted>";
    const key = expression.slice(0, index);
    const value = expression.slice(index + 1);
    return `${bounded(key, 256)}=${isModelConfiguration(key) && !SENSITIVE_NAME.test(key) ? bounded(value) : "<redacted>"}`;
}

function recordModelSelection(target: string[], name: string, value: string) {
    if (MODEL_OPTION.has(name)) target.push(`${name}=${bounded(value)}`);
    if (CONFIG_OPTION.has(name)) {
        const sanitized = sanitizeConfig(value);
        const key = sanitized.slice(0, sanitized.indexOf("="));
        if (isModelConfiguration(key)) target.push(sanitized);
    }
}

function isModelConfiguration(key: string) {
    return /^(?:model|model_provider|model_reasoning_effort|model_reasoning_summary|model_verbosity|service_tier)$/i.test(
        key,
    );
}

function bounded(value: string, maximum = 512) {
    return value.slice(0, maximum);
}

function boundedJson(values: string[], maximum: number) {
    const kept: string[] = [];
    for (const value of values) {
        if (Buffer.byteLength(JSON.stringify([...kept, value]), "utf8") > maximum) {
            while (kept.length && Buffer.byteLength(JSON.stringify([...kept, "<truncated>"]), "utf8") > maximum)
                kept.pop();
            return JSON.stringify([...kept, "<truncated>"]);
        }
        kept.push(value);
    }
    return JSON.stringify(kept);
}
