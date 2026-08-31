import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { EmberError, ValidationError } from "./errors.ts";
import { invokeCodexProvider } from "./codex-provider.ts";
import { cloneState, initialState, nowUtc, type EmberState, type MeaningId, type RuntimeId } from "./model.ts";
import { explanationView, inspectionView } from "./projection.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "./provider.ts";
import { startRuntime, stopRuntime, runCognition } from "./runtime.ts";
import { attachDetail, rememberEpisode, rememberFact, rememberPreference, rememberRelationship, supersede, undertake, withholdDetail } from "./semantics.ts";
import { StateStore } from "./store.ts";

interface CliIo {
  input: Readable;
  output: Writable;
  error: Writable;
}

type CliArgs =
  | { command: "init"; state: string; name: string; principal: string }
  | { command: "run"; state: string; principal: string; scope: string; providerKind: "process" | "codex"; providerCommand: string; providerArgs: string[]; providerTimeoutSeconds: number }
  | { command: "inspect"; state: string; principal: string; json: boolean }
  | { command: "explain"; state: string; principal: string; meaningId: string }
  | { command: "correct"; state: string; principal: string; meaningId: string; text: string; reason: string }
  | { command: "check"; state: string }
  | { command: "lock-status"; state: string }
  | { command: "quarantine-stale-lock"; state: string; ownerToken: string; confirmQuiescent: boolean };

export async function main(
  argv = process.argv.slice(2),
  io: CliIo = { input: process.stdin, output: process.stdout, error: process.stderr },
): Promise<number> {
  try {
    const args = parseArgs(argv);
    switch (args.command) {
      case "init":
        await new StateStore(args.state).create(initialState(args.name, args.principal));
        io.output.write("initialized schema v1 continuity state\n");
        break;
      case "run":
        return await runInteractive(args, io);
      case "inspect": {
        const state = await loadForPrincipal(new StateStore(args.state), args.principal);
        const view = inspectionView(state);
        io.output.write(args.json ? `${JSON.stringify(view, null, 2)}\n` : renderInspection(view));
        break;
      }
      case "explain": {
        const state = await loadForPrincipal(new StateStore(args.state), args.principal);
        io.output.write(`${JSON.stringify(explanationView(state, args.meaningId), null, 2)}\n`);
        break;
      }
      case "correct": {
        const store = new StateStore(args.state);
        const lease = await store.acquireWriteLease();
        try {
          const state = await loadForPrincipal(store, args.principal);
          const candidate = cloneState(state);
          const id = supersede(candidate, args.principal, args.meaningId, args.text, { reason: args.reason });
          await store.commit(state.revision, candidate);
          io.output.write(`${id}\n`);
        } finally {
          await store.releaseWriteLease(lease);
        }
        break;
      }
      case "check": {
        const store = new StateStore(args.state);
        const state = await store.load();
        const lock = await store.lockStatus();
        io.output.write(`valid schema v1 revision ${state.revision}; lock ${JSON.stringify(lock)}\n`);
        break;
      }
      case "lock-status": {
        const status = await new StateStore(args.state).lockStatus();
        io.output.write(`${JSON.stringify(status, null, 2)}\n`);
        break;
      }
      case "quarantine-stale-lock": {
        const destination = await new StateStore(args.state).quarantineStaleLock({ ownerToken: args.ownerToken, confirmQuiescent: args.confirmQuiescent });
        io.output.write(`${destination}\n`);
        break;
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof EmberError || error instanceof SyntaxError || isOperationalSystemError(error)) {
      io.error.write(`ember: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

async function runInteractive(args: Extract<CliArgs, { command: "run" }>, io: CliIo) {
  const store = new StateStore(args.state);
  const lease = await store.acquireWriteLease();
  try {
    let state = await loadForPrincipal(store, args.principal);
    const started = startRuntime(state, args.principal, args.scope);
    state = await store.commit(state.revision, started.state);
    io.output.write(`runtime ${started.runtimeId} started\n`);
    let stopReason = "input_eof";
    const lines = createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    for await (const line of lines) {
      if (!line.trim()) continue;
      if (line === ":quit") {
        stopReason = "explicit_cli_exit";
        break;
      }
      try {
        if (line.startsWith(":")) {
          if (line.startsWith(":ask ")) {
            const result = await withSigintCancellation(signal => ask(args, store, state, started.runtimeId, line, io.output, signal));
            state = result.state;
            if (result.providerFailure) io.error.write(`provider: ${result.providerFailure}\n`);
          } else {
            const result = await semanticCommand(store, state, started.runtimeId, args.principal, args.scope, line);
            state = result.state;
            io.output.write(`${result.id}\n`);
          }
        } else {
          const result = await withSigintCancellation(signal => runCognition(store, state, {
            runtimeId: started.runtimeId,
            principal: args.principal,
            scope: args.scope,
            text: line,
            command: args.providerCommand,
            arguments_: args.providerArgs,
            timeoutSeconds: args.providerTimeoutSeconds,
            signal,
            provider: args.providerKind === "codex" ? invokeCodexProvider : undefined,
            output: io.output,
          }));
          state = result.state;
          if (result.providerFailure) io.error.write(`provider: ${result.providerFailure}\n`);
        }
      } catch (error) {
        if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
        else throw error;
      }
    }
    const stopped = stopRuntime(state, started.runtimeId, { reason: stopReason });
    await store.commit(state.revision, stopped);
    return 0;
  } finally {
    await store.releaseWriteLease(lease);
  }
}

async function semanticCommand(store: StateStore, state: EmberState, runtimeId: RuntimeId, principal: string, scope: string, line: string) {
  const parts = splitCommand(line);
  const candidate = cloneState(state);
  let id: MeaningId | string;
  if (parts[0] === ":remember" && parts[1] === "relationship" && parts.length >= 5) id = rememberRelationship(candidate, principal, parts[2], parts[3], parts.slice(4).join(" "));
  else if (parts[0] === ":remember" && parts[1] === "fact" && parts.length >= 6) id = rememberFact(candidate, principal, parts[2], parts[3], parts[4], parts.slice(5).join(" "));
  else if (parts[0] === ":prefer" && parts.length >= 5) id = rememberPreference(candidate, principal, parts[1], parts[2], parts[3], parts.slice(4).join(" "));
  else if (parts[0] === ":supersede" && parts.length >= 3) id = supersede(candidate, principal, parts[1], parts.slice(2).join(" "));
  else if (parts[0] === ":undertake" && parts.length >= 4) id = undertake(candidate, principal, parts[1], parts[2], parts.slice(3).join(" "));
  else if (parts[0] === ":remember" && parts[1] === "episode" && parts.length >= 6) id = rememberEpisode(candidate, principal, parts[2], parts[3], parts[4], parts.slice(5).join(" "));
  else if (parts[0] === ":attach-detail" && parts.length >= 3) id = attachDetail(candidate, principal, parts[1], parts.slice(2).join(" "));
  else if (parts[0] === ":fixture-withhold" && parts.length === 2) {
    if (process.env.EMBER_ENABLE_FIXTURE_FAULTS !== "1") throw new ValidationError("fixture fault command is available only to deterministic test harness");
    id = withholdDetail(candidate, principal, parts[1]);
  } else throw new ValidationError("unsupported or malformed semantic command");
  const runtime = candidate.operations.runtime_episodes.find(r => r.runtime_id === runtimeId);
  if (!runtime) throw new ValidationError(`runtime does not exist: ${runtimeId}`);
  if (runtime.clean_stop_at === null) runtime.last_durable_observation_at = nowUtc();
  return { state: await store.commit(state.revision, candidate), id };
}

async function ask(args: Extract<CliArgs, { command: "run" }>, store: StateStore, state: EmberState, runtimeId: RuntimeId, line: string, output: Writable, signal: AbortSignal) {
  const parts = splitCommand(line);
  if (parts.length < 4 || parts[0] !== ":ask" || parts[1] !== "--explain") throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");
  const ids = parts[2].split(",").filter(Boolean);
  if (!ids.length) throw new ValidationError("at least one explanation ID is required");
  return runCognition(store, state, {
    runtimeId,
    principal: args.principal,
    scope: args.scope,
    text: parts.slice(3).join(" "),
    command: args.providerCommand,
    arguments_: args.providerArgs,
    timeoutSeconds: args.providerTimeoutSeconds,
    signal,
    provider: args.providerKind === "codex" ? invokeCodexProvider : undefined,
    output,
    purpose: "explain",
    explainIds: ids,
  });
}

async function loadForPrincipal(store: StateStore, principal: string) {
  const state = await store.load();
  if (principal !== state.runtime_contract.local_principal) throw new ValidationError("asserted principal does not match initialized local principal");
  return state;
}

type InspectionView = ReturnType<typeof inspectionView>;
function renderInspection(view: InspectionView) {
  let text = `Lineage ${view.lineage.lineage_id} (${view.lineage.display_name}), revision ${view.revision}\nConstitutive boundaries:\n`;
  for (const boundary of view.lineage.constitutive_boundaries) text += `  ${boundary.boundary_id}: ${boundary.text}\n`;
  const sections: Array<[string, Array<unknown>]> = [
    ["Current meanings", view.current_meanings],
    ["Historical/superseded meanings", view.historical_meanings],
    ["Unavailable gaps", view.gaps],
    ["Runtime episodes", view.runtime_episodes],
    ["Cognition episodes", view.cognition_episodes],
  ];
  for (const [label, items] of sections) {
    text += `${label}:\n`;
    for (const item of items) text += `  ${JSON.stringify(item)}\n`;
  }
  return text;
}

export function splitCommand(line: string) {
  const result: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let started = false;
  for (const char of line) {
    if (escaping) { token += char; escaping = false; started = true; continue; }
    if (char === "\\" && quote !== "'") { escaping = true; started = true; continue; }
    if (quote) {
      if (char === quote) { quote = null; started = true; }
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; started = true; continue; }
    if (/\s/.test(char)) {
      if (started) { result.push(token); token = ""; started = false; }
      continue;
    }
    token += char;
    started = true;
  }
  if (escaping) throw new ValidationError("malformed quoted command: dangling escape");
  if (quote) throw new ValidationError("malformed quoted command: unterminated quote");
  if (started) result.push(token);
  return result;
}

type RawValue = string | string[] | boolean | undefined;
interface CommandSpec {
  flags: string[];
  booleans?: string[];
  repeatable?: string[];
  positionals: number;
}

export function parseArgs(argv: string[]): CliArgs {
  if (!argv.length) throw new ValidationError("a command is required");
  const command = argv[0];
  const specs: Record<string, CommandSpec> = {
    init: { flags: ["--state", "--name", "--principal"], positionals: 0 },
    run: { flags: ["--state", "--principal", "--scope", "--provider", "--provider-command", "--provider-arg", "--codex-command", "--codex-arg", "--provider-timeout-seconds"], repeatable: ["--provider-arg", "--codex-arg"], positionals: 0 },
    inspect: { flags: ["--state", "--principal", "--json"], booleans: ["--json"], positionals: 0 },
    explain: { flags: ["--state", "--principal"], positionals: 1 },
    correct: { flags: ["--state", "--principal", "--text", "--reason"], positionals: 1 },
    check: { flags: ["--state"], positionals: 0 },
    "lock-status": { flags: ["--state"], positionals: 0 },
    "quarantine-stale-lock": { flags: ["--state", "--owner-token", "--confirm-quiescent"], booleans: ["--confirm-quiescent"], positionals: 0 },
  };
  const spec = specs[command];
  if (!spec) throw new ValidationError(`unsupported command: ${command}`);
  const allowed = new Set(spec.flags);
  const booleans = new Set(spec.booleans ?? []);
  const repeatable = new Set(spec.repeatable ?? []);
  const values: Record<string, RawValue> = {};
  const positionals: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) { positionals.push(item); continue; }
    if (!allowed.has(item)) throw new ValidationError(`unsupported option for ${command}: ${item}`);
    if (item in values && !repeatable.has(item)) throw new ValidationError(`${item} must not be repeated`);
    if (booleans.has(item)) { values[item] = true; continue; }
    if (i + 1 >= argv.length) throw new ValidationError(`${item} requires a value`);
    if (repeatable.has(item)) {
      const current = values[item];
      const list = Array.isArray(current) ? current : [];
      list.push(argv[++i]);
      values[item] = list;
    } else values[item] = argv[++i];
  }
  if (positionals.length !== spec.positionals) throw new ValidationError(`${command} requires ${spec.positionals} positional argument${spec.positionals === 1 ? "" : "s"}`);
  const required = (flag: string) => {
    const value = values[flag];
    if (typeof value !== "string" || !value) throw new ValidationError(`${flag} is required`);
    return value;
  };
  if (command === "init") return { command, state: required("--state"), name: required("--name"), principal: required("--principal") };
  if (command === "run") {
    const timeout = Number(required("--provider-timeout-seconds"));
    if (!Number.isFinite(timeout) || timeout <= 0) throw new ValidationError("--provider-timeout-seconds must be a positive finite number");
    if (timeout > MAX_PROVIDER_TIMEOUT_SECONDS) throw new ValidationError(`--provider-timeout-seconds must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS}`);
    const provider = values["--provider"];
    if (provider !== undefined && provider !== "codex") throw new ValidationError("--provider currently supports only codex");
    if (provider === "codex") {
      if (values["--provider-command"] !== undefined || values["--provider-arg"] !== undefined) throw new ValidationError("--provider-command and --provider-arg cannot be combined with --provider codex");
      return { command, state: required("--state"), principal: required("--principal"), scope: required("--scope"), providerKind: "codex", providerCommand: typeof values["--codex-command"] === "string" ? values["--codex-command"] : "codex", providerArgs: Array.isArray(values["--codex-arg"]) ? values["--codex-arg"] as string[] : [], providerTimeoutSeconds: timeout };
    }
    if (values["--codex-command"] !== undefined || values["--codex-arg"] !== undefined) throw new ValidationError("--codex-command and --codex-arg require --provider codex");
    return { command, state: required("--state"), principal: required("--principal"), scope: required("--scope"), providerKind: "process", providerCommand: required("--provider-command"), providerArgs: Array.isArray(values["--provider-arg"]) ? values["--provider-arg"] as string[] : [], providerTimeoutSeconds: timeout };
  }
  if (command === "inspect") return { command, state: required("--state"), principal: required("--principal"), json: values["--json"] === true };
  if (command === "explain") return { command, state: required("--state"), principal: required("--principal"), meaningId: positionals[0] };
  if (command === "correct") return { command, state: required("--state"), principal: required("--principal"), meaningId: positionals[0], text: required("--text"), reason: required("--reason") };
  if (command === "check" || command === "lock-status") return { command, state: required("--state") };
  return { command: "quarantine-stale-lock", state: required("--state"), ownerToken: required("--owner-token"), confirmQuiescent: values["--confirm-quiescent"] === true };
}

async function withSigintCancellation<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    return await operation(controller.signal);
  } finally {
    process.off("SIGINT", cancel);
  }
}

function isOperationalSystemError(error: unknown): error is Error & { code: string } {
  return error !== null && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string" && /^E[A-Z0-9]+$/.test((error as { code: string }).code);
}
