import type { Update } from "node-telegram-bot-api";

import { strict as assert } from "node:assert";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import type { SetupConfig } from "../cli/setup.ts";

import { runTelegramSetup } from "./setup.ts";

const setup: SetupConfig = {
    version: 1,
    intent: "create-new",
    statePath: "/var/lib/ember/state.json",
    principal: "user",
    lineageId: "lineage-test",
    establishedAt: "2026-01-01T00:00:00.000Z",
    provider: { kind: "codex", command: "/usr/bin/codex", model: "gpt-test", timeoutSeconds: 60 },
    verification: "verified",
    continuity: "available",
    cancellationRequested: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
};

function candidate(): Update {
    return {
        update_id: 42,
        message: {
            message_id: 7,
            date: 1,
            chat: { id: 123, type: "private" },
            from: { id: 123, is_bot: false, first_name: "User" },
            text: "654321",
        },
    };
}

test("guided Telegram setup keeps the token out of v2 config and preserves inactive truth", async () => {
    const files = new Map<string, string>();
    const output = new PassThrough();
    const result = await runTelegramSetup(
        {
            setup,
            scope: "relationship:user",
            configPath: "/tmp/telegram.json",
            tokenPath: "/tmp/telegram.token",
            unitPath: "/tmp/telegram.service",
        },
        { input: new PassThrough(), output, error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async (command) => {
                assert.equal(command, "/usr/bin/codex");
                return "/opt/ember/bin/codex";
            },
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async (prompt) => !prompt.startsWith("Install"),
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => [candidate()],
            }),
            command: async () => ({ code: 1, signal: null }),
        },
    );
    assert.equal(result.status, "configured_inactive");
    assert.equal(result.stages.mapping, "confirmed");
    assert.equal(result.stages.activation, "declined");
    assert.equal(files.get("/tmp/telegram.token"), "12345:abcdefghijklmnopqrstuvwxyz\n");
    const config = files.get("/tmp/telegram.json")!;
    assert.match(config, /"config_version": 2/);
    assert.match(config, /"kind": "codex"/);
    assert.match(config, /"command": "\/opt\/ember\/bin\/codex"/);
    assert.match(config, /"surface_entrypoint": ".*\/bin\/ember-telegram\.ts"/);
    assert.doesNotMatch(config, /abcdefghijklmnopqrstuvwxyz/);
});

test("round-trip verification polls correlated delivery while the service stays active", async () => {
    const files = new Map<string, string>([
        ["/tmp/c2", "drifted config"],
        ["/tmp/u2", "drifted unit"],
    ]);
    let observations = 0;
    let activeChecks = 0;
    const serviceActions: string[] = [];
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/c2", tokenPath: "/tmp/t2", unitPath: "/tmp/u2" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async () => "/opt/ember/bin/codex",
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async () => true,
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => [candidate()],
            }),
            command: async (_file, args) => {
                serviceActions.push(args[1]!);
                if (args[1] === "is-active") activeChecks++;
                return { code: 0, signal: null };
            },
            observeRoundTrip: async () => ++observations === 2,
            delay: async () => {},
        },
    );
    assert.equal(result.status, "complete");
    assert.equal(observations, 2);
    assert.equal(activeChecks, 2); // Initial inspection plus the bounded verification poll.
    assert.ok(serviceActions.indexOf("stop") < serviceActions.indexOf("restart"));
    assert.equal(serviceActions.includes("enable"), false);
});

test("Claude Code v2 setup does not resolve or persist a process executable", async () => {
    const files = new Map<string, string>();
    const claudeSetup: SetupConfig = {
        ...setup,
        provider: { kind: "claude-code", command: "claude-code", model: "sonnet", timeoutSeconds: 60 },
    };
    const result = await runTelegramSetup(
        {
            setup: claudeSetup,
            scope: "relationship:user",
            configPath: "/tmp/cc",
            tokenPath: "/tmp/ct",
            unitPath: "/tmp/cu",
        },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async () => assert.fail("Claude Code must not resolve a process executable"),
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async (prompt) => !prompt.startsWith("Install"),
            command: async () => ({ code: 1, signal: null }),
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => [candidate()],
            }),
        },
    );
    assert.equal(result.status, "configured_inactive");
    assert.deepEqual(JSON.parse(files.get("/tmp/cc")!).provider, {
        kind: "claude-code",
        model: "sonnet",
        timeout_seconds: 60,
    });
});

test("guided Telegram setup executes fixed systemctl arrays and confirms observed delivery", async () => {
    const files = new Map<string, string>();
    const commands: Array<[string, string[]]> = [];
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/c", tokenPath: "/tmp/t", unitPath: "/tmp/u" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async () => "/opt/ember/bin/codex",
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async () => true,
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => [candidate()],
            }),
            command: async (file, args) => {
                commands.push([file, args]);
                return {
                    code: args[1] === "is-enabled" || args[1] === "is-active" ? 1 : 0,
                    signal: null,
                };
            },
            observeRoundTrip: async (_path, updateId) => updateId === 42,
        },
    );
    assert.equal(result.status, "complete");
    assert.deepEqual(commands, [
        ["systemctl", ["--user", "is-enabled", "ember-telegram.service"]],
        ["systemctl", ["--user", "is-active", "ember-telegram.service"]],
        ["systemctl", ["--user", "daemon-reload"]],
        ["systemctl", ["--user", "enable", "--now", "ember-telegram.service"]],
    ]);
});
