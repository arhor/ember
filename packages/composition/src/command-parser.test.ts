import { commandSuggestions, telegramCommandMenu } from "@ember/application/commands/catalogue.ts";
import assert from "node:assert/strict";
import test from "node:test";

import { parseConversationCommand } from "./command-parser.ts";

test("conversation parser should preserve quoted material confirmation when parsing underscore aliases", async () => {
    // Given
    const confirmation = '{"target":"calendar","action":"create"}';
    // When
    const result = await parseConversationCommand("/approve_action proposal digest '" + confirmation + "'");
    // Then
    assert.deepEqual(result.command, {
        kind: "approve-action",
        proposalId: "proposal",
        payloadDigest: "digest",
        materialConfirmation: confirmation,
    });
});

test("conversation parser should return deterministic usage when command arguments are absent", async () => {
    // Given
    const line = "/remember fact";
    // When
    const result = await parseConversationCommand(line);
    // Then
    assert.equal(result.command, null);
    assert.match(result.text, /missing required argument/);
});

test("command discovery should exclude local and fixture operations when listing conversation commands", () => {
    // Given
    const prefix = "/remember ";
    // When
    const suggestions = commandSuggestions(prefix);
    const menu = telegramCommandMenu();
    // Then
    assert.deepEqual(suggestions, ["/remember relationship", "/remember fact", "/remember episode"]);
    assert.ok(menu.some((entry) => entry.command === "show_action"));
    assert.ok(menu.every((entry) => /^[a-z0-9_]{1,32}$/.test(entry.command)));
    assert.ok(menu.every((entry) => !["setup", "quit", "fixture_withhold"].includes(entry.command)));
});
