const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemes(text: string): string[] {
    return Array.from(segmenter.segment(text), (part) => part.segment);
}

function cellWidth(grapheme: string): number {
    if ([...grapheme].every((part) => /\p{Mark}/u.test(part) || ["\u200d", "\ufe0e", "\ufe0f"].includes(part)))
        return 0;
    if (/\p{Emoji_Presentation}|\ufe0f/u.test(grapheme)) return 2;
    const point = grapheme.codePointAt(0)!;
    if (
        point >= 0x1100 &&
        (point <= 0x115f ||
            point === 0x2329 ||
            point === 0x232a ||
            (point >= 0x2e80 && point <= 0xa4cf && point !== 0x303f) ||
            (point >= 0xac00 && point <= 0xd7a3) ||
            (point >= 0xf900 && point <= 0xfaff) ||
            (point >= 0xfe10 && point <= 0xfe19) ||
            (point >= 0xfe30 && point <= 0xfe6f) ||
            (point >= 0xff00 && point <= 0xff60) ||
            (point >= 0xffe0 && point <= 0xffe6) ||
            (point >= 0x20000 && point <= 0x3fffd))
    )
        return 2;
    return 1;
}

export function fitTerminalText(text: string, columns: number): string {
    let used = 0;
    let fitted = "";
    for (const part of graphemes(text)) {
        const width = cellWidth(part);
        if (used + width > columns) break;
        fitted += part;
        used += width;
    }
    return fitted;
}

/** Keep the editable buffer on one physical row, with a horizontal viewport. */
export function terminalViewport(text: string, cursor: number, columns: number) {
    const parts = graphemes(text);
    const budget = Math.max(0, columns - 3); // prompt plus one unused cell prevents terminal autowrap
    let start = cursor;
    let cells = 0;
    while (start > 0 && cells + cellWidth(parts[start - 1]!) <= budget) {
        cells += cellWidth(parts[--start]!);
    }
    return {
        text: fitTerminalText(parts.slice(start).join(""), budget),
        cursorColumn: 3 + cells,
    };
}
