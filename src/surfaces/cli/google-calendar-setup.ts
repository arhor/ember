import { createHash, randomBytes } from "node:crypto";
import { chmod, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute, resolve } from "node:path";

import type { GoogleCalendarConfig } from "../../capabilities/google-calendar.ts";
import type { CliIo, SetupGoogleCalendarArgs } from "./model.ts";

import { createCapabilityExecutionFirewall } from "../../capabilities/execution.ts";
import {
    GOOGLE_CALENDAR_SCOPE,
    GOOGLE_OAUTH_TOKEN_ENDPOINT,
    createGoogleCalendarCapability,
} from "../../capabilities/google-calendar.ts";
import { ValidationError } from "../../core/errors.ts";
import { replaceFileDurably } from "../../persistence/file-replacement.ts";
import { loadSetupConfig } from "./setup.ts";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export async function setupGoogleCalendarMain(args: SetupGoogleCalendarArgs, io: CliIo): Promise<number> {
    const setupPath = resolve(args.setupConfig);
    const configPath = resolve(args.config);
    const setup = await loadSetupConfig(setupPath);
    if (!setup) throw new ValidationError("setup-google-calendar requires an existing setup lineage");
    if (args.disable) {
        const existing = JSON.parse(await readFile(configPath, "utf8")) as GoogleCalendarConfig;
        await durableWrite(configPath, `${JSON.stringify({ ...existing, enabled: false }, null, 2)}\n`);
        io.output.write("Google Calendar integration disabled; credentials were preserved.\n");
        return 0;
    }
    try {
        await readFile(configPath, "utf8");
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
    const refreshTokenFile = args.reconfigure
        ? `${requestedRefreshTokenFile}.${base64Url(randomBytes(12))}`
        : requestedRefreshTokenFile;
    const scope = required(args.scope, "--scope");
    const verifier = base64Url(randomBytes(48));
    const state = base64Url(randomBytes(32));
    const callback = await awaitAuthorizationCode(clientId, verifier, state, io);
    const clientSecret = (await readFile(clientSecretFile, "utf8")).trim();
    const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
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
    await durableWrite(refreshTokenFile, `${token.refresh_token}\n`);
    await chmod(refreshTokenFile, 0o600);
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
    const verification = await createCapabilityExecutionFirewall([createGoogleCalendarCapability(config)], {
        cognitionId: "cognition-google-calendar-setup" as never,
        principal: setup.principal,
        scope,
        surface: surfaces[0]!,
        validatedRevision: 0,
    }).execute("googleCalendarEvents", {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 60_000).toISOString(),
    });
    if (verification.outcome !== "succeeded")
        throw new ValidationError(`Google Calendar verification failed: ${verification.outcome}`);
    await durableWrite(configPath, `${JSON.stringify(config, null, 2)}\n`);
    await durableWrite(
        setupPath,
        `${JSON.stringify({ ...setup, version: 2, googleCalendarConfigPath: configPath }, null, 2)}\n`,
    );
    io.output.write("Google Calendar read-only integration verified and activated.\n");
    return 0;
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
