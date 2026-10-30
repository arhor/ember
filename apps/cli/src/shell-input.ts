import type { Readable, Writable } from "node:stream";
import type { ReadStream } from "node:tty";

import { commandSuggestions, conversationCommands } from "@ember/application/commands/catalogue.ts";
import { createInterface, emitKeypressEvents } from "node:readline";

import { graphemes, fitTerminalText, terminalViewport } from "./terminal-text.ts";

interface ShellInputOptions {
    input: Readable;
    output: Writable;
    localNames?: readonly string[];
}

/** A single input owner across setup and conversation; pipes never receive terminal controls. */
export function createShellInput({
    input,
    output,
    localNames = [],
}: ShellInputOptions): AsyncIterableIterator<string> & { close(): void } {
    const terminal = input as ReadStream;
    if (!terminal.isTTY || !(output as Writable & { isTTY?: boolean }).isTTY) {
        const reader = createInterface({ input, crlfDelay: Infinity, terminal: false });
        const iterator = reader[Symbol.asyncIterator]();
        return {
            [Symbol.asyncIterator]() {
                return this;
            },
            next: () => iterator.next(),
            async return() {
                reader.close();
                return { done: true, value: undefined };
            },
            close: () => reader.close(),
        };
    }
    emitKeypressEvents(input);
    const wasRaw = terminal.isRaw;
    terminal.setRawMode(true);
    input.resume();
    let line = "";
    let cursor = 0;
    let selected = -1;
    let hidden = false;
    let ended = false;
    const queue: string[] = [];
    const waiters: Array<(value: IteratorResult<string>) => void> = [];
    const candidates = () =>
        hidden
            ? []
            : [
                  ...new Set([
                      ...commandSuggestions(line),
                      ...(line.startsWith("/")
                          ? [...localNames, "quit"].map((name) => "/" + name).filter((name) => name.startsWith(line))
                          : []),
                  ]),
              ];
    const render = () => {
        const matches = candidates();
        const active = selected < 0 ? 0 : selected;
        const start = Math.floor(active / 6) * 6;
        const visible = matches.slice(start, start + 6);
        const width = (output as Writable & { columns?: number }).columns ?? 80;
        const viewport = terminalViewport(line, cursor, width);
        const rows = visible.map((candidate, index) => {
            const name = candidate.slice(1);
            const description = conversationCommands().find((command) => command.name === name)?.description ?? "";
            return fitTerminalText(
                (start + index === active ? "› " : "  ") + candidate + (description ? " — " + description : ""),
                Math.max(0, width - 1),
            );
        });
        if (matches.length)
            rows.push(
                fitTerminalText(
                    "  ↑↓ select · Tab insert · Esc dismiss (" + matches.length + " matches)",
                    Math.max(0, width - 1),
                ),
            );
        output.write(
            "\r\x1b[2K> " +
                viewport.text +
                "\x1b[J" +
                (rows.length ? "\n" + rows.join("\n") + "\x1b[" + rows.length + "A" : "") +
                "\r\x1b[" +
                viewport.cursorColumn +
                "G",
        );
    };
    const publish = (value: string) => {
        const waiter = waiters.shift();
        if (waiter) waiter({ done: false, value });
        else queue.push(value);
    };
    const close = () => {
        if (ended) return;
        ended = true;
        input.off("keypress", onKey);
        input.off("end", close);
        terminal.setRawMode(wasRaw);
        input.pause();
        output.write("\r\x1b[J\n");
        while (waiters.length) waiters.shift()!({ done: true, value: undefined });
    };
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean }) => {
        if (key.ctrl && key.name === "d" && !line) {
            close();
            return;
        }
        if (key.ctrl && key.name === "c") {
            line = "";
            cursor = 0;
            hidden = true;
            process.emit("SIGINT");
            render();
            return;
        }
        if (key.name === "return" || key.name === "enter") {
            output.write("\r\x1b[J> " + line + "\n");
            publish(line);
            line = "";
            cursor = 0;
            selected = -1;
            hidden = false;
        } else if (key.name === "escape") {
            hidden = true;
            selected = -1;
        } else if (key.name === "up" || key.name === "down") {
            const matches = candidates();
            if (matches.length)
                selected =
                    ((selected < 0 ? 0 : selected) + (key.name === "down" ? 1 : matches.length - 1) + matches.length) %
                    matches.length;
        } else if (key.name === "tab") {
            const candidate = candidates()[selected < 0 ? 0 : selected];
            if (candidate) {
                line = candidate + " ";
                cursor = graphemes(line).length;
                selected = -1;
            }
        } else if (key.name === "left") cursor = Math.max(0, cursor - 1);
        else if (key.name === "right") cursor = Math.min(graphemes(line).length, cursor + 1);
        else if (key.name === "home" || (key.ctrl && key.name === "a")) cursor = 0;
        else if (key.name === "end" || (key.ctrl && key.name === "e")) cursor = graphemes(line).length;
        else if (key.ctrl && key.name === "u") {
            line = graphemes(line).slice(cursor).join("");
            cursor = 0;
            hidden = false;
        } else if (key.name === "backspace" && cursor > 0) {
            line = graphemes(line)
                .filter((_, index) => index !== cursor - 1)
                .join("");
            cursor--;
            hidden = false;
            selected = -1;
        } else if (key.name === "delete") {
            line = graphemes(line)
                .filter((_, index) => index !== cursor)
                .join("");
            hidden = false;
            selected = -1;
        } else if (
            text &&
            !key.ctrl &&
            !key.meta &&
            ![...text].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
        ) {
            const parts = graphemes(line);
            const prefix = parts.slice(0, cursor).join("") + text;
            line = prefix + parts.slice(cursor).join("");
            cursor = graphemes(prefix).length;
            hidden = false;
            selected = -1;
        }
        render();
    };
    input.on("keypress", onKey);
    input.once("end", close);
    render();
    return {
        [Symbol.asyncIterator]() {
            return this;
        },
        next() {
            if (queue.length) return Promise.resolve({ done: false as const, value: queue.shift()! });
            if (ended) return Promise.resolve({ done: true as const, value: undefined });
            return new Promise<IteratorResult<string>>((resolve) => waiters.push(resolve));
        },
        async return() {
            close();
            return { done: true as const, value: undefined };
        },
        close,
    };
}
