import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import { createShellInput } from "./shell-input.ts";

function terminalFixture(columns = 100) {
    const input = Object.assign(new PassThrough(), {
        isTTY: true,
        isRaw: false,
        setRawMode(value: boolean) {
            this.isRaw = value;
            return this;
        },
    });
    let display = "";
    const output = Object.assign(
        new Writable({
            write(chunk, _encoding, done) {
                display += String(chunk);
                done();
            },
        }),
        { isTTY: true, columns },
    );
    const reader = createShellInput({ input, output });
    return { input, reader, display: () => display };
}

test("shell input should insert the selected nested command when arrow selection is followed by Tab", async () => {
    // Given
    const f = terminalFixture();
    // When
    f.input.write("/remember ");
    f.input.write("\x1b[B");
    f.input.write("\t\r");
    const line = await f.reader.next();
    f.reader.close();
    // Then
    assert.equal(line.value, "/remember fact ");
    assert.match(f.display(), /Remember a fact/);
    assert.equal(f.input.isRaw, false);
});

test("shell input should submit the typed prefix when suggestions are dismissed with Escape", async () => {
    // Given
    const f = terminalFixture();
    // When
    f.input.write("/sho");
    f.input.emit("keypress", undefined, { name: "escape" });
    f.input.write("\t\r");
    const line = await f.reader.next();
    f.reader.close();
    // Then
    assert.equal(line.value, "/sho");
    assert.equal(f.input.listenerCount("keypress"), 0);
});

test("shell input should preserve plain piped lines when input is not a terminal", async () => {
    // Given
    const input = new PassThrough();
    let display = "";
    const output = new Writable({
        write(chunk, _encoding, done) {
            display += String(chunk);
            done();
        },
    });
    const reader = createShellInput({ input, output });
    // When
    input.end("/help\n/quit\n");
    const lines: string[] = [];
    for await (const line of reader) lines.push(line);
    reader.close();
    // Then
    assert.deepEqual(lines, ["/help", "/quit"]);
    assert.equal(display, "");
});

for (const text of ["😀", "👨‍👩‍👧‍👦", "e\u0301"]) {
    test("shell input should delete an entire grapheme when Backspace follows " + text, async () => {
        // Given
        const f = terminalFixture();
        f.input.write("A" + text);
        // When
        f.input.emit("keypress", undefined, { name: "backspace" });
        f.input.write("\r");
        const result = await f.reader.next();
        f.reader.close();
        // Then
        assert.equal(result.value, "A");
    });
}

test("shell input should preserve graphemes when moving left and deleting forward", async () => {
    // Given
    const f = terminalFixture();
    f.input.write("A😀B");
    // When
    f.input.write("\x1b[D\x1b[D\x1b[3~\r");
    const result = await f.reader.next();
    f.reader.close();
    // Then
    assert.equal(result.value, "AB");
});

test("shell input should keep the editable frame within terminal width when text exceeds one row", async () => {
    // Given
    const f = terminalFixture(20);
    const text = "a".repeat(60);
    // When
    f.input.write(text);
    const editingFrames = f.display();
    f.input.write("\x1b[D\x1b[DZ\r");
    const result = await f.reader.next();
    f.reader.close();
    // Then
    for (const frame of editingFrames.split("\r").filter((part) => part.startsWith("\x1b[2K> "))) {
        const input = frame.slice("\x1b[2K".length).split("\x1b[J")[0]!;
        assert.ok(input.length < 20, "editable content must never wrap");
    }
    for (const part of editingFrames.split("\x1b[")) {
        const cursor = /^(\d+)G/.exec(part);
        if (cursor) assert.ok(Number(cursor[1]) <= 20, "cursor must remain inside the terminal");
    }
    assert.equal(result.value, "a".repeat(58) + "Zaa");
});
