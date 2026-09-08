import type { MCPClient, MCPTransport, MCPTransportCloseOptions, MCPTransportSendOptions } from "@ai-sdk/mcp";

import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

import type { CapabilityBinding, CapabilityJsonValue } from "./execution.ts";

import { CapabilityExecutionFailure } from "./execution.ts";

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 2_000;
const DEFAULT_CLOSE_TIMEOUT_MS = 1_000;
const MAX_DISCOVERY_PAGES = 16;
const MAX_ERROR_MESSAGE_CHARS = 1_024;

export interface AiSdkMcpStdioCapabilitySourceConfig {
    serverLabel: string;
    command: string;
    args?: readonly string[];
    cwd?: string;
    env?: Readonly<Record<string, string>>;
    initializationTimeoutMs?: number;
    requestTimeoutMs?: number;
    closeTimeoutMs?: number;
}

export interface McpDiscoveredTool {
    sourceToolName: string;
    sourceDescription: string;
    inputSchema: Readonly<Record<string, unknown>>;
}

export interface McpCapabilityPolicy {
    name: string;
    description: string;
    authorize: CapabilityBinding["authorize"];
    validateInput?: CapabilityBinding["validateInput"];
}

export interface McpCapabilitySource {
    discover(options?: { signal?: AbortSignal }): Promise<readonly McpDiscoveredTool[]>;
    bind(sourceToolName: string, policy: McpCapabilityPolicy): CapabilityBinding;
    close(): Promise<void>;
}

export type McpCapabilitySourcePhase = "connection" | "discovery" | "close";

export class McpCapabilitySourceError extends Error {
    readonly phase: McpCapabilitySourcePhase;

    constructor(phase: McpCapabilitySourcePhase, message: string, options: { cause?: unknown } = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "McpCapabilitySourceError";
        this.phase = phase;
    }
}

export async function openAiSdkMcpStdioCapabilitySource(
    config: AiSdkMcpStdioCapabilitySourceConfig,
    options: { signal?: AbortSignal } = {},
): Promise<McpCapabilitySource> {
    validateConfig(config);
    const initializationTimeoutMs = config.initializationTimeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS;
    const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const closeTimeoutMs = config.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;
    const transport = new CloseObservedTransport(
        new Experimental_StdioMCPTransport({
            command: config.command,
            args: config.args ? [...config.args] : undefined,
            cwd: config.cwd,
            env: config.env ? { ...config.env } : undefined,
        }),
        closeTimeoutMs,
    );

    let client: MCPClient;
    try {
        client = await createMCPClient({
            transport,
            clientName: "ember",
            version: "0.0.0",
            maxRetries: 0,
            initializationOptions: {
                signal: options.signal,
                timeout: initializationTimeoutMs,
                maxTotalTimeout: initializationTimeoutMs,
            },
        });
    } catch (error) {
        throw new McpCapabilitySourceError(
            "connection",
            `MCP source ${config.serverLabel} failed to connect or initialize: ${boundedErrorMessage(error)}`,
            { cause: error },
        );
    }

    return new AiSdkMcpCapabilitySource(config.serverLabel, client, transport, requestTimeoutMs);
}

class AiSdkMcpCapabilitySource implements McpCapabilitySource {
    private readonly serverLabel: string;
    private readonly client: MCPClient;
    private readonly transport: CloseObservedTransport;
    private readonly requestTimeoutMs: number;
    private readonly discovered = new Map<string, McpDiscoveredTool>();
    private closed = false;

    constructor(serverLabel: string, client: MCPClient, transport: CloseObservedTransport, requestTimeoutMs: number) {
        this.serverLabel = serverLabel;
        this.client = client;
        this.transport = transport;
        this.requestTimeoutMs = requestTimeoutMs;
    }

    async discover({ signal }: { signal?: AbortSignal } = {}): Promise<readonly McpDiscoveredTool[]> {
        this.ensureOpenForDiscovery();
        const discovered = new Map<string, McpDiscoveredTool>();
        let cursor: string | undefined;

        try {
            for (let page = 0; page < MAX_DISCOVERY_PAGES; page += 1) {
                const result = await this.client.listTools({
                    ...(cursor === undefined ? {} : { params: { cursor } }),
                    options: {
                        signal,
                        timeout: this.requestTimeoutMs,
                        maxTotalTimeout: this.requestTimeoutMs,
                    },
                });
                for (const tool of result.tools) {
                    if (discovered.has(tool.name)) {
                        throw new Error(`duplicate MCP tool name: ${tool.name}`);
                    }
                    if (!isObject(tool.inputSchema)) {
                        throw new Error(`MCP tool ${tool.name} did not provide an object input schema`);
                    }
                    discovered.set(tool.name, {
                        sourceToolName: tool.name,
                        sourceDescription: tool.description ?? "",
                        inputSchema: structuredClone(tool.inputSchema),
                    });
                }
                cursor = result.nextCursor;
                if (cursor === undefined) {
                    this.discovered.clear();
                    for (const [name, tool] of discovered) this.discovered.set(name, tool);
                    return [...discovered.values()];
                }
            }
            throw new Error(`MCP discovery exceeded ${MAX_DISCOVERY_PAGES} pages`);
        } catch (error) {
            throw new McpCapabilitySourceError(
                "discovery",
                `MCP source ${this.serverLabel} tool discovery failed before capability execution: ${boundedErrorMessage(error)}`,
                { cause: error },
            );
        }
    }

    bind(sourceToolName: string, policy: McpCapabilityPolicy): CapabilityBinding {
        const tool = this.discovered.get(sourceToolName);
        if (!tool) {
            throw new Error(`MCP tool must be discovered before it can be mapped into an Ember capability: ${sourceToolName}`);
        }

        return {
            name: policy.name,
            description: policy.description,
            inputSchema: tool.inputSchema,
            occurrencePolicy: "at_most_once_per_cognition",
            authorize: policy.authorize,
            validateInput: policy.validateInput,
            execute: (_context, input, { signal }) => this.callTool(sourceToolName, input, signal),
        };
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        try {
            await this.client.close();
        } catch (error) {
            throw new McpCapabilitySourceError(
                "close",
                `MCP source ${this.serverLabel} failed to close deterministically: ${boundedErrorMessage(error)}`,
                { cause: error },
            );
        }
    }

    private ensureOpenForDiscovery() {
        if (this.closed || this.transport.isClosed) {
            throw new McpCapabilitySourceError("discovery", `MCP source ${this.serverLabel} is already closed`);
        }
    }

    private async callTool(sourceToolName: string, input: unknown, signal?: AbortSignal): Promise<CapabilityJsonValue> {
        if (this.closed || this.transport.isClosed) {
            throw new CapabilityExecutionFailure(
                `MCP source ${this.serverLabel} was closed before tool request submission; no remote effect began`,
                { effectState: "not_started" },
            );
        }
        if (!isObject(input)) {
            throw new CapabilityExecutionFailure(
                `MCP tool ${sourceToolName} requires an object argument payload before request submission`,
                { effectState: "not_started" },
            );
        }
        if (signal?.aborted) {
            throw new CapabilityExecutionFailure(
                `MCP tool ${sourceToolName} was cancelled before request submission; no remote effect began`,
                { effectState: "not_started", cause: signal.reason },
            );
        }

        let result;
        try {
            result = await this.client.callTool({
                name: sourceToolName,
                arguments: input,
                options: {
                    signal,
                    timeout: this.requestTimeoutMs,
                    maxTotalTimeout: this.requestTimeoutMs,
                },
            });
        } catch (error) {
            throw new CapabilityExecutionFailure(
                `MCP tool ${sourceToolName} request did not produce a trustworthy terminal result after submission; remote effects may have occurred: ${boundedErrorMessage(error)}`,
                { effectState: "unknown", cause: error },
            );
        }

        if (result.isError) {
            throw new Error(`MCP tool reported an explicit failure: ${boundedMcpFailure(result.content)}`);
        }

        return normalizeMcpResult(result);
    }
}

class CloseObservedTransport implements MCPTransport {
    readonly supportsProtocolVersionDiscovery: boolean | undefined;
    readonly supportsMcpToolParameterHeaders: boolean | undefined;
    protocolVersion?: string;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: MCPTransport["onmessage"];

    private readonly delegate: MCPTransport;
    private readonly closeTimeoutMs: number;
    private closeObservedResolve!: () => void;
    private readonly closeObserved = new Promise<void>((resolve) => {
        this.closeObservedResolve = resolve;
    });
    private closeWasObserved = false;

    constructor(delegate: MCPTransport, closeTimeoutMs: number) {
        this.delegate = delegate;
        this.closeTimeoutMs = closeTimeoutMs;
        this.supportsProtocolVersionDiscovery = delegate.supportsProtocolVersionDiscovery;
        this.supportsMcpToolParameterHeaders = delegate.supportsMcpToolParameterHeaders;
        delegate.onclose = () => this.observeClose();
        delegate.onerror = (error) => this.onerror?.(error instanceof Error ? error : new Error(String(error)));
        delegate.onmessage = (message) => this.onmessage?.(message);
    }

    get isClosed() {
        return this.closeWasObserved;
    }

    start() {
        return this.delegate.start();
    }

    send(message: Parameters<MCPTransport["send"]>[0], options?: MCPTransportSendOptions) {
        return this.delegate.send(message, options);
    }

    setProtocolVersion(version: string) {
        this.protocolVersion = version;
        if (this.delegate.setProtocolVersion) this.delegate.setProtocolVersion(version);
        else this.delegate.protocolVersion = version;
    }

    async close(_options?: MCPTransportCloseOptions): Promise<void> {
        if (this.closeWasObserved) return;
        await this.delegate.close();
        await waitForClose(this.closeObserved, this.closeTimeoutMs);
    }

    private observeClose() {
        if (!this.closeWasObserved) {
            this.closeWasObserved = true;
            this.closeObservedResolve();
        }
        this.onclose?.();
    }
}

async function waitForClose(closeObserved: Promise<void>, timeoutMs: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            closeObserved,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`MCP stdio transport close was not observed within ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

function normalizeMcpResult(result: { content: readonly unknown[]; structuredContent?: unknown }): CapabilityJsonValue {
    const text = result.content.flatMap((part) => {
        if (isObject(part) && part.type === "text" && typeof part.text === "string") return [part.text];
        return [];
    });
    const structured = toCapabilityJson(result.structuredContent);
    if (structured !== undefined && text.length > 0) return { structured, text };
    if (structured !== undefined) return { structured };
    if (text.length > 0) return { text };
    return { status: "completed" };
}

function toCapabilityJson(value: unknown): CapabilityJsonValue | undefined {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) {
        const converted = value.map(toCapabilityJson);
        return converted.every((item) => item !== undefined) ? (converted as CapabilityJsonValue[]) : undefined;
    }
    if (!isObject(value)) return undefined;

    const converted: Record<string, CapabilityJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
        const json = toCapabilityJson(item);
        if (json === undefined) return undefined;
        converted[key] = json;
    }
    return converted;
}

function boundedMcpFailure(content: readonly unknown[]) {
    const text = content
        .flatMap((part) => (isObject(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : []))
        .join("; ");
    return text ? truncate(text) : "server returned isError=true";
}

function boundedErrorMessage(error: unknown) {
    return truncate(error instanceof Error ? error.message : String(error));
}

function truncate(value: string) {
    return value.length <= MAX_ERROR_MESSAGE_CHARS ? value : `${value.slice(0, MAX_ERROR_MESSAGE_CHARS)}…`;
}

function validateConfig(config: AiSdkMcpStdioCapabilitySourceConfig) {
    if (!config.serverLabel.trim()) throw new Error("MCP serverLabel must be non-empty");
    if (!config.command.trim()) throw new Error("MCP stdio command must be non-empty");
    validatePositiveTimeout("initializationTimeoutMs", config.initializationTimeoutMs);
    validatePositiveTimeout("requestTimeoutMs", config.requestTimeoutMs);
    validatePositiveTimeout("closeTimeoutMs", config.closeTimeoutMs);
}

function validatePositiveTimeout(name: string, value: number | undefined) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new Error(`MCP ${name} must be a positive finite number`);
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
