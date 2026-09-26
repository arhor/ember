import type { Update } from "node-telegram-bot-api";

import { strict as assert } from "node:assert";
import { homedir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import type { SetupConfig } from "../../core/app/bootstrap.ts";
import type { TelegramSetupBinding, TelegramSetupDependencies, TelegramSetupIo } from "./setup.ts";

import { SystemdTelegramResidentHost } from "../../host/systemd.ts";
import { runTelegramSetup as runTelegramSetupWithResident } from "./setup.ts";

const SERVICE_DEFINITION_PATH = join(homedir(), ".config", "systemd", "user", "ember-telegram.service");

function runTelegramSetup(
    binding: TelegramSetupBinding,
    io: TelegramSetupIo,
    dependencies: Omit<TelegramSetupDependencies, "residentHost"> & {
        command: (file: string, args: string[]) => Promise<{ code: number | null; signal: string | null }>;
    },
) {
    const { command, read, write, ...rest } = dependencies;
    return runTelegramSetupWithResident(binding, io, {
        ...rest,
        read,
        write,
        residentHost: new SystemdTelegramResidentHost({
            command,
            read: async (path) => (await read?.(path)) ?? null,
            write: async (path, content, mode) => {
                if (!write) throw new Error("test resident definition writer is missing");
                await write(path, content, mode);
            },
        }),
    });
}

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

function pendingStart(): Update {
    return {
        update_id: 41,
        message: {
            message_id: 6,
            date: 1,
            chat: { id: 123, type: "private" },
            from: { id: 123, is_bot: false, first_name: "User" },
            text: "/start",
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

test("mapping discovery tolerates an earlier pending message without acknowledging it", async () => {
    const files = new Map<string, string>();
    let polls = 0;
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/mpc", tokenPath: "/tmp/mpt" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async () => "/opt/ember/bin/codex",
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async (prompt) => !prompt.startsWith("Install"),
            delay: async () => {},
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async (options) => {
                    polls++;
                    assert.equal("offset" in options, false);
                    return polls === 1 ? [pendingStart()] : [pendingStart(), candidate()];
                },
            }),
            command: async (_file, args) => ({
                code: args[1] === "is-enabled" || args[1] === "is-active" ? 1 : 0,
                signal: null,
            }),
        },
    );
    assert.equal(result.status, "configured_inactive");
    assert.equal(result.stages.mapping, "confirmed");
    assert.equal(polls, 2);
});

test("declining activation after stopping an active service leaves it inactive", async () => {
    const files = new Map<string, string>();
    const serviceActions: string[] = [];
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/ac", tokenPath: "/tmp/at" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            resolveExecutable: async () => "/opt/ember/bin/codex",
            read: async (path) => files.get(path) ?? null,
            write: async (path, value) => void files.set(path, value),
            confirm: async (prompt) => !prompt.startsWith("Install"),
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => [candidate()],
            }),
            command: async (_file, args) => {
                serviceActions.push(args[1]!);
                return { code: 0, signal: null };
            },
        },
    );
    assert.equal(result.status, "configured_inactive");
    assert.equal(result.stages.activation, "declined");
    assert.ok(serviceActions.includes("stop"));
    assert.equal(serviceActions.includes("start"), false);
    assert.equal(serviceActions.includes("restart"), false);
    assert.equal(serviceActions.includes("enable"), false);
});

test("unknown active-service state fails closed before mapping discovery", async () => {
    let getUpdatesCalled = false;
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/uc", tokenPath: "/tmp/ut" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            secretPrompt: async () => "12345:abcdefghijklmnopqrstuvwxyz",
            verificationCode: () => "654321",
            read: async () => null,
            write: async () => {},
            api: () => ({
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
                getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                getUpdates: async () => {
                    getUpdatesCalled = true;
                    return [];
                },
            }),
            command: async (_file, args) => {
                if (args[1] === "is-active") return { code: null, signal: "SIGTERM" };
                return { code: 0, signal: null };
            },
        },
    );
    assert.equal(result.status, "uncertain");
    assert.equal(result.stages.mapping, "uncertain");
    assert.equal(getUpdatesCalled, false);
});

test("round-trip verification polls correlated delivery while the service stays active", async () => {
    const files = new Map<string, string>([
        ["/tmp/c2", "drifted config"],
        [SERVICE_DEFINITION_PATH, "drifted unit"],
    ]);
    let observations = 0;
    let activeChecks = 0;
    const serviceActions: string[] = [];
    const result = await runTelegramSetup(
        { setup, scope: "relationship:user", configPath: "/tmp/c2", tokenPath: "/tmp/t2" },
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
        { setup, scope: "relationship:user", configPath: "/tmp/c", tokenPath: "/tmp/t" },
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

test("Telegram setup should use an injected resident host when installing the transport", async () => {
    // Given
    const files = new Map<string, string>();
    const installed: string[] = [];
    const residentHost = {
        render: () => "portable resident definition",
        readDefinition: async () => null,
        inspect: async () => ({ installed: "no" as const, active: "no" as const }),
        isActive: async () => "confirmed" as const,
        stop: async () => "confirmed" as const,
        start: async () => "confirmed" as const,
        install: async (content: string) => void installed.push(content),
        activate: async () => "confirmed" as const,
    };

    // When
    const result = await runTelegramSetupWithResident(
        { setup, scope: "relationship:user", configPath: "/tmp/portable-config", tokenPath: "/tmp/portable-token" },
        { input: new PassThrough(), output: new PassThrough(), error: new PassThrough() },
        {
            residentHost,
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
            observeRoundTrip: async () => true,
        },
    );

    // Then
    assert.equal(result.status, "complete");
    assert.equal(result.stages.service_installation, "confirmed");
    assert.deepEqual(installed, ["portable resident definition"]);
});
