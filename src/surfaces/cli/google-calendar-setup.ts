import { createHash, randomBytes } from "node:crypto";
import { readFile, realpath, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import type { GoogleCalendarConfig } from "../../capabilities/google-calendar.ts";
import type { CliIo, SetupGoogleCalendarArgs } from "./model.ts";

import { createCapabilityExecutionFirewall } from "../../capabilities/execution.ts";
import {
    GOOGLE_CALENDAR_SCOPE,
    GOOGLE_OAUTH_TOKEN_ENDPOINT,
    createGoogleCalendarCapability,
    loadGoogleCalendarConfig,
} from "../../capabilities/google-calendar.ts";
import { ValidationError } from "../../core/errors.ts";
import { replaceFileDurably } from "../../persistence/file-replacement.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { loadSetupConfig } from "./setup.ts";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export interface GoogleCalendarSetupDependencies {
    authorize?: (
        clientId: string,
        verifier: string,
        state: string,
        io: CliIo,
    ) => Promise<{ code: string; redirectUri: string }>;
    fetch?: typeof fetch;
    write?: typeof durableWrite;
    remove?: (path: string) => Promise<void>;
    random?: (size: number) => Uint8Array;
    verify?: (config: GoogleCalendarConfig) => Promise<void>;
}

export async function setupGoogleCalendarMain(
    args: SetupGoogleCalendarArgs,
    io: CliIo,
    dependencies: GoogleCalendarSetupDependencies = {},
): Promise<number> {
    const [setupConfig, config] = await Promise.all([
        physicalPath(resolve(args.setupConfig)),
        physicalPath(resolve(args.config)),
    ]);
    const canonicalArgs = { ...args, setupConfig, config };
    const paths = [setupConfig, config].sort();
    const leases: Array<{ store: StateStore; lease: Awaited<ReturnType<StateStore["acquireWriteLease"]>> }> = [];
    try {
        for (const path of paths) {
            const store = new StateStore(path);
            leases.push({ store, lease: await store.acquireWriteLease() });
        }
        return await setupGoogleCalendarLocked(canonicalArgs, io, dependencies);
    } finally {
        for (const { store, lease } of leases.reverse()) await store.releaseWriteLease(lease);
    }
}

async function setupGoogleCalendarLocked(
    args: SetupGoogleCalendarArgs,
    io: CliIo,
    dependencies: GoogleCalendarSetupDependencies,
): Promise<number> {
    const write = dependencies.write ?? durableWrite;
    const remove = dependencies.remove ?? ((path: string) => unlink(path));
    const random = dependencies.random ?? randomBytes;
    const verify = dependencies.verify ?? verifyCalendarConfig;
    const setupPath = resolve(args.setupConfig);
    const configPath = resolve(args.config);
    const setup = await loadSetupConfig(setupPath);
    if (!setup) throw new ValidationError("setup-google-calendar requires an existing setup lineage");
    const protectedPaths = await Promise.all([setupPath, setup.statePath, configPath].map(physicalPath));
    assertSeparatePaths(protectedPaths);
    if (setup.version === 2 && (await physicalPath(setup.googleCalendarConfigPath!)) !== protectedPaths[2])
        throw new ValidationError("Google Calendar config path does not match the setup binding");
    if (args.disable) {
        const existing = await loadGoogleCalendarConfig(configPath);
        assertCalendarOwnership(existing, setup);
        await write(configPath, `${JSON.stringify({ ...existing, enabled: false }, null, 2)}\n`);
        io.output.write("Google Calendar integration disabled; credentials were preserved.\n");
        return 0;
    }
    let previous: GoogleCalendarConfig | null = null;
    try {
        previous = await loadGoogleCalendarConfig(configPath);
        assertCalendarOwnership(previous, setup);
        if (!args.reconfigure && setup.version === 1) {
            await verify(previous);
            await write(
                setupPath,
                `${JSON.stringify({ ...setup, version: 2, googleCalendarConfigPath: configPath }, null, 2)}\n`,
            );
            io.output.write("Recovered the verified Google Calendar setup binding.\n");
            return 0;
        }
        if (!args.reconfigure)
            throw new ValidationError("existing Google Calendar configuration requires --reconfigure");
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        if (!isMissing(error)) throw error;
    }
    const surfaces = args.surfaces;
    if (!surfaces.length || surfaces.some((surface) => surface !== "local_cli" && surface !== "telegram_bot"))
        throw new ValidationError("at least one --surface local_cli|telegram_bot is required");
    const clientId = required(args.clientId, "--client-id");
    const clientSecretFile = absolute(required(args.clientSecretFile, "--client-secret-file"));
    const requestedRefreshTokenFile = absolute(required(args.refreshTokenFile, "--refresh-token-file"));
    const credentialPaths = await Promise.all([clientSecretFile, requestedRefreshTokenFile].map(physicalPath));
    assertSeparatePaths([...protectedPaths, ...credentialPaths]);
    const refreshTokenFile = args.reconfigure
        ? `${requestedRefreshTokenFile}.${base64Url(random(12))}`
        : requestedRefreshTokenFile;
    const scope = required(args.scope, "--scope");
    const verifier = base64Url(random(48));
    const state = base64Url(random(32));
    const callback = await (dependencies.authorize ?? awaitAuthorizationCode)(clientId, verifier, state, io);
    const clientSecret = (await readFile(clientSecretFile, "utf8")).trim();
    const tokenResponse = await (dependencies.fetch ?? fetch)(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: callback.code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: callback.redirectUri,
            code_verifier: verifier,
            grant_type: "authorization_code",
        }),
    });
    const token: unknown = await tokenResponse.json();
    if (
        !tokenResponse.ok ||
        typeof token !== "object" ||
        token === null ||
        !("refresh_token" in token) ||
        typeof token.refresh_token !== "string"
    )
        throw new ValidationError(
            "Google authorization did not return a refresh token; revoke access and retry with consent",
        );
    const config: GoogleCalendarConfig = {
        config_version: 1,
        enabled: true,
        setup_lineage_id: setup.lineageId,
        principal: setup.principal,
        scope,
        surfaces: surfaces as GoogleCalendarConfig["surfaces"],
        authority_source_id: `standing-google-calendar:${createHash("sha256")
            .update(`${setup.lineageId}\0${scope}\0${surfaces.join(",")}`)
            .digest("hex")
            .slice(0, 24)}`,
        calendar_id: required(args.calendarId, "--calendar-id"),
        calendar_label: required(args.calendarLabel, "--calendar-label"),
        timezone: required(args.timezone, "--timezone"),
        client_id: clientId,
        client_secret_file: clientSecretFile,
        refresh_token_file: refreshTokenFile,
    };
    let publication: "before_token" | "token_written" | "config_started" = "before_token";
    try {
        await write(refreshTokenFile, `${token.refresh_token}\n`);
        publication = "token_written";
        await verify(config);
        publication = "config_started";
        await write(configPath, `${JSON.stringify(config, null, 2)}\n`);
        await write(
            setupPath,
            `${JSON.stringify({ ...setup, version: 2, googleCalendarConfigPath: configPath }, null, 2)}\n`,
        );
    } catch (error) {
        if (publication !== "config_started") await remove(refreshTokenFile).catch(() => {});
        throw error;
    }
    io.output.write(
        "Google Calendar read/write integration verified and activated; writes still require exact approval.\n",
    );
    if (previous && previous.refresh_token_file !== refreshTokenFile)
        io.output.write(
            `Prior refresh token retained for explicit rollback or revocation: ${previous.refresh_token_file}\n`,
        );
    return 0;
}

async function verifyCalendarConfig(config: GoogleCalendarConfig) {
    const verification = await createCapabilityExecutionFirewall([createGoogleCalendarCapability(config)], {
        cognitionId: "cognition-google-calendar-setup" as never,
        principal: config.principal,
        scope: config.scope,
        surface: config.surfaces[0]!,
        validatedRevision: 0,
    }).execute("googleCalendarEvents", {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 60_000).toISOString(),
    });
    if (verification.outcome !== "succeeded")
        throw new ValidationError(`Google Calendar verification failed: ${verification.outcome}`);
}

function assertCalendarOwnership(
    config: GoogleCalendarConfig,
    setup: NonNullable<Awaited<ReturnType<typeof loadSetupConfig>>>,
) {
    if (config.setup_lineage_id !== setup.lineageId || config.principal !== setup.principal)
        throw new ValidationError("Google Calendar configuration belongs to a different setup binding");
}

export function googleAuthorizationUrl(clientId: string, redirectUri: string, state: string, verifier: string) {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    for (const [key, value] of Object.entries({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GOOGLE_CALENDAR_SCOPE,
        state,
        code_challenge: base64Url(createHash("sha256").update(verifier).digest()),
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
    }))
        url.searchParams.set(key, value);
    return url.toString();
}

async function awaitAuthorizationCode(clientId: string, verifier: string, expectedState: string, io: CliIo) {
    return await new Promise<{ code: string; redirectUri: string }>((resolvePromise, reject) => {
        const server = createServer((request, response) => {
            const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/oauth2/callback`;
            const url = new URL(request.url ?? "/", redirectUri);
            if (
                url.pathname !== "/oauth2/callback" ||
                url.searchParams.get("state") !== expectedState ||
                !url.searchParams.get("code")
            ) {
                response.writeHead(400).end("Authorization rejected. You may close this window.");
                return;
            }
            response
                .writeHead(200, { "content-type": "text/plain" })
                .end("Ember Google Calendar authorization received. You may close this window.");
            const code = url.searchParams.get("code")!;
            server.close();
            resolvePromise({ code, redirectUri });
        });
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/oauth2/callback`;
            io.output.write(
                `Open this Google authorization URL:\n${googleAuthorizationUrl(clientId, redirectUri, expectedState, verifier)}\n`,
            );
        });
        setTimeout(() => {
            server.close();
            reject(new ValidationError("Google authorization timed out"));
        }, 300_000).unref();
    });
}

function required(value: string | undefined, flag: string) {
    if (!value) throw new ValidationError(`${flag} is required`);
    return value;
}
function absolute(path: string) {
    if (!isAbsolute(path)) throw new ValidationError("credential and token paths must be absolute");
    return path;
}
function base64Url(value: Uint8Array) {
    return Buffer.from(value).toString("base64url");
}
function isMissing(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function durableWrite(path: string, content: string) {
    return replaceFileDurably(path, content, {
        durabilityUncertainMessage: "Google Calendar configuration write may be visible; inspect it before retrying",
    });
}

export function assertSeparatePaths(paths: readonly string[]) {
    for (const [index, path] of paths.entries())
        for (const other of paths.slice(index + 1))
            if (path === other || path.startsWith(`${other}.`) || other.startsWith(`${path}.`))
                throw new ValidationError("setup, continuity, Calendar config, and credential paths must be separate");
}

async function physicalPath(path: string): Promise<string> {
    try {
        return await realpath(path);
    } catch (error) {
        if (!isMissing(error)) throw error;
        const parent = dirname(path);
        if (parent === path) throw error;
        return join(await physicalPath(parent), basename(path));
    }
}
