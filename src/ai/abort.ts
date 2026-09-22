/** Relay the shared executor's caller cancellation or timeout into a process adapter. */
export function relayCallerCancellation(source: AbortSignal | undefined): {
    signal: AbortSignal | undefined;
    dispose(): void;
} {
    if (source === undefined) return { signal: undefined, dispose() {} };
    const controller = new AbortController();
    const relay = () => controller.abort(source.reason);
    if (source.aborted) relay();
    else source.addEventListener("abort", relay, { once: true });
    return {
        signal: controller.signal,
        dispose: () => source.removeEventListener("abort", relay),
    };
}
