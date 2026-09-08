---
summary: "Issue #200 evaluation of Telegram Bot API libraries for Ember, selecting node-telegram-bot-api v2 as a thin transport primitive while keeping acknowledgement, replay, delivery uncertainty, reconciliation, and runtime semantics Ember-owned."
read_when:
  - "Choosing, upgrading, or replacing the Telegram Bot API library used by Ember"
  - "Changing src/surfaces/telegram.ts polling, delivery, error, webhook, or shutdown behavior"
  - "Deciding which Telegram mechanics may be delegated to a dependency without moving Ember semantics into a framework"
role: design
discovery_status: current
---

# Telegram Bot Framework Evaluation

## Decision

**Adopt `node-telegram-bot-api@2.1.0` as Ember's Telegram Bot API transport library. Use its generated `Api`, generated Bot API types, structured transport/API errors, and injectable network transport. Keep polling coordination, update acknowledgement timing, inbound selection, delivery evidence, reconciliation, configuration, and worker lifecycle Ember-owned.**

Do not adopt the library's `Bot` middleware runtime as Ember's interaction boundary. Do not use library sessions or other framework state as Ember state. Configure the API client with `maxRetries: 0` so an Ember delivery attempt maps to exactly one library send attempt.

The runner-up is **grammY 1.46.0**. grammY has the strongest mature modern ecosystem and an excellent typed API client, but its built-in simple polling owns acknowledgement and webhook-removal behavior that conflicts with Ember's existing semantics. Using grammY only as an API client would be safe, but would give Ember a larger dependency and framework surface without removing the polling coordinator that must remain Ember-owned.

Puregram 3.10.0 is current and technically capable, but its polling transport advances offsets before dispatch settles and defaults to concurrent dispatch. Telegraf 4.16.3 is rejected both for stale released Bot API coverage and for polling semantics that advance a batch offset before concurrent handlers complete.

This decision is dated **2026-09-08**. Revalidate versions before implementation if the migration does not begin promptly.

## Why this is a transport decision, not an agent-framework decision

The Telegram dependency may own commodity protocol mechanics. It may not decide what Ember knows or what Ember has successfully done.

The semantic red lines are:

- Telegram `update_id` is stable external occurrence evidence. A library offset is not Ember occurrence truth.
- A received update may be acknowledged to Telegram only after Ember has completed the durable handoff required by the current interaction boundary.
- Replayed updates remain safe because Ember's interaction ledger owns idempotence. A framework session or middleware cache does not.
- A `sendMessage` request and a confirmed returned Telegram `message_id` are different facts.
- A timeout, abort, disconnect, unreadable response, malformed evidence-bearing result, or ambiguous server failure after a send begins remains an uncertain effect unless independently reconciled.
- A Telegram 400 or 429 response is evidence that the particular request was rejected. `retry_after` is retry metadata, not permission for an infrastructure layer to repeat the effect.
- Telegram `message_id`, `message_thread_id`, source time, and destination remain correlated operational metadata, not canonical memory.
- Bot token/configuration establishes a surface connection and configured principal mapping. It does not define Ember identity.
- Telegram framework middleware state, sessions, poll offsets, and runner state are disposable transport state.
- systemd supervision and Ember writer ownership remain outside the library.

The practical replacement test is simple: replacing the Telegram library later may require adapter work, but it must not require migrating Ember's interaction ledger, canonical state, identity, delivery evidence, or reconciliation records.

## Upstream snapshot

Telegram Bot API **10.3** was released on 2026-08-24. The comparison used stable package releases available on 2026-09-08.

| Candidate | Stable version evaluated | Bot API freshness | Runtime/package shape | Adoption snapshot | Result |
| --- | --- | --- | --- | --- | --- |
| `node-telegram-bot-api` | 2.1.0, 2026-08-24 | Bot API 10.3 | Native ESM plus CJS exports, Node >=18, **0 runtime dependencies** | Established project, about 9.2k GitHub stars and 160k+ weekly package downloads; the from-scratch v2 line itself is only weeks old | **Winner** |
| `grammy` | 1.46.0 | Current generated `@grammyjs/types` 5.0.0 | Node/Deno package, 4 runtime dependencies | About 3.7k GitHub stars, 5M+ weekly downloads, 800+ dependents | **Runner-up** |
| `puregram` | 3.10.0 | Pins `@puregram/api` 10.3.3 | Native ESM, Node >=22, 3 runtime dependencies | About 200 GitHub stars, under 1k weekly downloads | Viable API client, weaker overall fit |
| `telegraf` | 4.16.3 | Released package advertises Bot API 7.1 | CommonJS-oriented package, 8 runtime dependencies | About 9.2k GitHub stars and about 500k weekly downloads | **Reject** |

Popularity is only a maintenance-risk signal here. It does not override acknowledgement or effect-uncertainty semantics. In particular, the winning `node-telegram-bot-api` v2 API is materially younger than grammY's current API line, and that is recorded as an explicit risk below.

## Candidate evaluation

### `node-telegram-bot-api@2.1.0`

Version 2 is a from-scratch TypeScript redesign of a long-running project rather than a compatibility layer over its historical API. Version 2.1.0 added Bot API 10.3 support on the same date Telegram published Bot API 10.3.

The core package is unusually close to the primitive Ember actually needs:

- `Api` is generated from Bot API documentation and mirrors Bot API methods with typed parameter/result objects.
- the package exports generated Telegram types directly;
- it is native ESM with CJS compatibility exports and declares Node >=18;
- it has zero runtime dependencies;
- network transport accepts an injected `fetch`, which is sufficient for deterministic failure simulation;
- `TelegramApiError` exposes `errorCode`, response parameters, and `retryAfter`;
- `NetworkError`, `TimeoutError`, and `ParseError` distinguish transport ambiguity from Telegram rejection;
- every API method accepts an `AbortSignal`;
- the optional `longPoll` primitive is an async generator rather than a mandatory middleware runtime;
- the project also provides a higher-level `Bot`, but Ember does not need to adopt it.

The main semantic hazard is explicit and controllable: the transport defaults to `maxRetries: 2` for 429, network, timeout, and 5xx failures. **Ember must construct the client with `maxRetries: 0`.** This setting belongs in one adapter factory and needs a regression test proving one `sendMessage` network attempt per Ember delivery attempt.

The low-level `longPoll` implementation is notably safer than the framework pollers considered below. It yields an update before advancing its local offset, honors cancellation, and does not advance the offset across polling errors. This demonstrates a compatible upstream model, but the first Ember migration should still keep the existing explicit `getUpdates` coordinator rather than consuming `longPoll` directly.

The reason is Ember-specific: the current worker runs delivery reconciliation before every `getUpdates` call, including repeated idle polls. `longPoll` keeps empty poll cycles inside the library and yields only updates, so adopting it directly would remove that idle reconciliation hook or force a new concurrent reconciliation scheduler. The tiny explicit coordinator therefore carries enough Ember policy to remain ours.

### `grammy@1.46.0`

grammY is the strongest runner-up and would be the default recommendation for a conventional Telegram bot. Its advantages are substantial:

- a mature, actively released TypeScript API with current generated Bot API types;
- excellent documentation and a large plugin ecosystem;
- very high package adoption;
- `GrammyError` for Bot API rejection and `HttpError` for failed HTTP transport;
- response parameters including Telegram `retry_after` remain available;
- outbound automatic retries are opt-in via a separate plugin rather than silently installed by core;
- API client networking is configurable enough for deterministic tests;
- simple polling is sequential rather than concurrent.

The problem is specifically `Bot.start()` and `Bot.stop()`, not grammY's general quality.

In grammY 1.46.0 simple polling:

1. up to 100 updates are fetched by default;
2. `lastTriedUpdateId` is set **before** middleware handles each update;
3. `stop()` aborts the current poll and explicitly confirms `lastTriedUpdateId + 1` to Telegram;
4. `stop()` does not wait for active middleware;
5. `start()` automatically calls `deleteWebhook` before polling begins.

Those mechanics make the framework's idea of "tried" too close to Telegram acknowledgement for Ember. A custom error handler, `limit: 1`, careful draining, and webhook workarounds could reduce the risk, but at that point Ember is adapting around the runner instead of using a primitive naturally aligned with its boundary.

Using `bot.api` or grammY's `Api` without `Bot.start()` would be semantically acceptable. It loses to `node-telegram-bot-api` v2 for this repository because Ember would still keep its polling coordinator while also accepting four runtime dependencies and a larger framework surface.

### `puregram@3.10.0`

Puregram is current, native ESM, requires Node >=22, exposes an injectable HTTP client, and pins current Bot API 10.3.x types. Its API retry budget is configurable and documented as disabled by default, and `ApiError` preserves Telegram response parameters.

Its polling transport is not suitable as Ember's acknowledgement owner:

- cross-update concurrency defaults to `Infinity`;
- a fetched update advances the transport offset before its dispatch promise settles;
- handler failures are reported to an error callback after the offset has already advanced;
- `stop()` changes local polling state but does not itself abort an already pending `getUpdates` request.

Puregram could still be used only as an API client, but then it offers no decisive advantage over the winner and has a materially smaller ecosystem. Its MPL-2.0 license is compatible with use as a dependency, but also provides no reason to prefer it over a zero-dependency MIT alternative with a better low-level shape.

### `telegraf@4.16.3`

Telegraf remains widely adopted, but the released package is not current enough for a new Ember dependency. Its npm documentation advertises full Bot API **7.1** support while Telegram is at Bot API 10.3.

Its polling semantics are also a poor fit independent of freshness:

- after `getUpdates`, Telegraf moves its offset to the final update in the fetched batch before handlers finish;
- it handles the batch with `Promise.all`, so updates run concurrently;
- shutdown synchronizes that offset after polling stops;
- `launch()` automatically calls `deleteWebhook` for long polling.

The GitHub project has a large historical ecosystem, but popularity cannot compensate for a stale stable release and an acknowledgement model that conflicts with Ember's interaction boundary.

## Comparison against Ember's criteria

| Criterion | node-telegram-bot-api 2.1 | grammY 1.46 | Puregram 3.10 | Telegraf 4.16 |
| --- | --- | --- | --- | --- |
| Current Bot API 10.3 | **Yes** | **Yes** | **Yes** | **No, released package says 7.1** |
| Generated/current TS method and update types | **Yes** | **Yes** | **Yes** | Stale with released package |
| Native ESM fit | **Yes** | Usable from ESM, Node package has compatibility/history layers | **Yes** | Weaker, CommonJS-oriented |
| Node 26 fit by declared engine/runtime design | **Yes** | **Yes** | **Yes** | Likely, but not a reason to select it |
| Low-level API without adopting middleware/session state | **Excellent** | **Excellent if using API only** | Good | Good |
| Built-in polling preserves Ember acknowledgement boundary | Compatible philosophy, but do not use directly in first migration | **No** | **No** | **No** |
| Abortable `getUpdates` | **Yes** | Yes | HTTP layer capable, polling stop is weaker | Yes |
| Structured 400/429 metadata | **Yes** | **Yes** | **Yes** | Yes |
| Distinguishes network/timeout/parse ambiguity cleanly | **Excellent** | Good, mainly `HttpError` plus cause | Good | Weaker/older error surface |
| Outbound retries disabled by safe configuration | **Yes, requires `maxRetries: 0`** | **Yes by default** | Yes by default | No automatic send retry in core path evaluated |
| Injectable networking for deterministic tests | **Yes, `fetch`** | Yes | **Yes, `HttpClient`** | Less direct |
| Runtime dependency pressure | **0 deps** | 4 deps | 3 deps | 8 deps |
| Mature current API line | **Medium, v2 is new** | **High** | Medium | Stable release is stale |
| Ecosystem/adoption | High project lineage, medium v2-specific evidence | **Very high** | Low | High historical adoption |
| Ember replacement seam | **Excellent** | Excellent if API-only | Good if API-only | Poor reason to accept stale package |

## Exact migration boundary

The migration should make `src/surfaces/telegram.ts` visibly thinner while refusing to outsource policy disguised as convenience.

### Delete and use library primitives

- local generic Telegram DTO declarations such as `TelegramUser`, `TelegramChat`, `TelegramMessage`, `TelegramUpdate`, `TelegramWebhookInfo`, and `TelegramSentMessage`;
- generic Bot API `{ ok, result }` envelope parsing;
- raw URL construction and JSON request encoding;
- the generic `TelegramBotApi.call` HTTP wrapper;
- hand-written extraction of Telegram `error_code` and `retry_after` from generic envelopes;
- method-specific HTTP wrappers for `getMe`, `getWebhookInfo`, `getUpdates`, and `sendMessage`.

Use `Api` and generated Telegram types from `node-telegram-bot-api` instead.

### Keep a thin adapter around library primitives

- construct `Api` in one place with the exact pinned version and **`maxRetries: 0`**;
- inject `fetch` in deterministic transport tests rather than replacing global networking;
- preflight `getMe` and `getWebhookInfo`; if a webhook URL is active, fail closed and require explicit operator removal;
- never call `deleteWebhook` automatically during startup;
- call typed `api.getUpdates` with Ember's current timeout, `allowed_updates: ["message"]`, caller cancellation, and the Ember-owned offset;
- map outbound library errors into `SurfaceDeliveryFailure` evidence;
- validate the small set of evidence-bearing result fields that TypeScript alone cannot validate at runtime, especially returned `message_id`, `update_id`, source timestamp, chat/user identifiers, and webhook status fields.

The dependency removes generic response/schema plumbing. It does **not** remove defensive validation of values that become durable Ember evidence.

### Keep Ember-owned

- `TelegramSurfaceConfig` and token-file/deployment handling;
- `TelegramInboundMessage` as the stable replacement seam;
- `selectTelegramInbound` and its authorization/private-chat/text filtering;
- the conversion of `update_id` into external occurrence evidence;
- correlation of Telegram message/thread/time/destination metadata;
- `processTelegramUpdate`;
- `runSurfaceInteraction` integration;
- `InteractionLedgerStore` and all replay/idempotence behavior;
- `reconcileTelegramDeliveries` and retry-safety decisions;
- the polling coordinator and acknowledgement offset timing;
- writer lease ownership and release while waiting on Telegram;
- shutdown admission/drain policy;
- systemd topology and forced-stop truthfulness.

## Polling and acknowledgement design

Keep the existing control flow conceptually intact, replacing only the HTTP plumbing:

```ts
const api = new Api(token, { maxRetries: 0, fetch: injectedFetch });
let offset: number | undefined;

while (!stopping) {
    await reconcileTelegramDeliveries(...);
    const updates = await api.getUpdates(
        {
            offset,
            timeout: config.poll_timeout_seconds,
            allowed_updates: ["message"],
        },
        pollSignal,
    );

    for (const update of updates) {
        const outcome = await processTelegramUpdate(..., update, ...);
        offset = update.update_id + 1;
        // offset moves only after Ember's durable processing boundary returns.
    }
}
```

The exact implementation may separate the signal that aborts an idle `getUpdates` call from the signal governing an already admitted handler. The desired shutdown rule is:

1. stop admitting new updates;
2. promptly abort an idle long-poll request;
3. if a handler has already been admitted, allow it to finish its bounded durable handoff before the next acknowledgement-bearing `getUpdates` call;
4. if the service manager ultimately forces termination, preserve truthful uncertainty rather than claiming the handler stopped cleanly.

No framework `stop()` call should synchronize an offset behind Ember's back.

## Outbound delivery classification

Constructing `Api` with `maxRetries: 0` is mandatory. The adapter then maps one library call to one Ember delivery attempt.

| Observed result | Ember delivery evidence | Retry metadata |
| --- | --- | --- |
| `sendMessage` returns a runtime-valid positive `message_id` | confirmed | none |
| `TelegramApiError` 400 or another non-5xx rejection | failed | normally none |
| `TelegramApiError` 429 | failed | expose `retryAfter`; Ember reconciliation decides whether/when a new attempt is safe |
| `TelegramApiError` >=500 | uncertain | none automatically |
| `NetworkError` | uncertain | none automatically |
| `TimeoutError` | uncertain | none automatically |
| `ParseError` | uncertain | none automatically |
| caller abort once the send boundary may have been entered | uncertain | none automatically |
| syntactically valid response with malformed evidence-bearing result, such as missing/invalid `message_id` | uncertain | none automatically |

A 429 tells Ember that Telegram rejected that request. It does not authorize the transport library to issue another request. A network or timeout error may occur after Telegram accepted the effect, so automatic retry below reconciliation is forbidden.

## Deterministic test plan for the implementation issue

The selected library's injected `fetch` makes the critical delivery cases deterministic without a live bot token.

The follow-up must cover at least:

- successful `sendMessage` returning a valid `message_id`;
- Telegram 400 rejection;
- Telegram 429 with `retry_after` and proof that the library does not retry when `maxRetries: 0`;
- Telegram/HTTP 500 and 5xx envelope variants;
- malformed JSON response;
- syntactically valid but malformed `sendMessage` result;
- disconnect or body-read failure after the request may have been sent;
- timeout and caller abort;
- one library HTTP call per Ember delivery attempt in every uncertain/failure case;
- replayed `update_id` reusing one occurrence/cognition and not repeating confirmed or uncertain delivery;
- processing failure before durable handoff leaving the Telegram update unacknowledged;
- shutdown while idle aborting `getUpdates` promptly;
- shutdown with an admitted handler draining it before any later offset synchronization;
- writer lease remaining released while waiting in `getUpdates`;
- active webhook configuration failing closed without an implicit `deleteWebhook`;
- Node 26, TypeScript 7, native-ESM compilation and the complete Ember test/check suite.

The research environment did not provide an exact Node 26 runtime compatibility execution for the candidate. The package declares Node >=18, ships ESM exports and TypeScript declarations, and has no runtime dependencies, so there is no identified incompatibility. Exact Node 26 / TypeScript 7 validation remains a required implementation gate rather than an assumed research result.

## Raspberry Pi-class operational fit

No candidate was installed and measured side by side on the target Raspberry Pi in this research task. Do not turn package metadata into fake RSS measurements.

The selected package has the lowest dependency pressure in the comparison: `node-telegram-bot-api@2.1.0` declares zero runtime dependencies and does not require a runner, web server, session store, or background database for the chosen integration. That makes a material regression less likely, not impossible.

The follow-up implementation should measure against the existing Telegram worker baseline:

- installed dependency footprint;
- idle RSS after startup;
- RSS while blocked in long polling;
- shutdown latency while idle;
- shutdown latency with an admitted handler.

Treat those as measured operational evidence. If a material regression is observed, document the absolute and relative change rather than hiding it behind the library choice.

## Risks and escape hatch

### Young v2 API line

`node-telegram-bot-api` is an old and widely used project, but the selected v2 API is a recent from-scratch redesign. Version 2.0.0 was released in August 2026, 2.1.0 followed with Bot API 10.3, and 2.2 release candidates already exist.

Mitigations:

- pin **exactly `2.1.0`** for the first migration;
- do not follow prerelease tags automatically;
- keep all package types and configuration inside `src/surfaces/telegram.ts` or a Telegram-local transport module;
- cover the replacement seam with Ember-owned behavioral tests rather than library-specific snapshots;
- re-evaluate upgrades against the error/retry/polling contract, not only changelog features.

### Default API retries are unsafe for Ember delivery

The package default is `maxRetries: 2`. An accidental default client construction would violate Ember's delivery semantics.

Mitigations:

- one constructor/factory with `maxRetries: 0`;
- no ad hoc `new Api(token)` in production Telegram code;
- deterministic test asserting exactly one underlying fetch for 429, timeout, network failure, and 5xx during `sendMessage`.

### TypeScript types are not runtime validation

Generated types remove maintenance burden but do not prove a network payload is well shaped at runtime.

Mitigation: retain small evidence-bound validators at the adapter edge and remove only the broad hand-maintained Bot API DTO/schema layer.

### Replacement

The stable replacement seam remains Ember-owned `TelegramInboundMessage` plus `processTelegramUpdate` and the interaction boundary. No `node-telegram-bot-api` type should appear in canonical state or cross-surface contracts.

If the v2 API proves unstable, grammY's API client is the preferred fallback. Replacing the dependency should require changing Telegram-local mapping/error code and package-level tests, not migrating ledger or canonical state.

## Follow-up

Issue [#207](https://github.com/arhor/ember/issues/207) already exists as the implementation follow-up, but its current proposed scope assumes grammY and grammY simple polling. **Do not implement #207 as currently written.** If this research decision is accepted, revise #207 before implementation to:

- pin `node-telegram-bot-api@2.1.0` instead of grammY;
- use the generated `Api` and Telegram types;
- construct the API with `maxRetries: 0`;
- retain the Ember-owned polling coordinator/offset timing and reconciliation hook;
- fail closed on an active webhook without implicit deletion;
- retain runtime validation only for evidence-bearing fields;
- preserve the existing ledger, delivery-reconciliation, writer-lease, principal, and systemd boundaries;
- implement the deterministic failure/shutdown tests and Raspberry Pi measurements above.

## Primary upstream evidence

- Telegram Bot API change log: <https://core.telegram.org/bots/api>
- `node-telegram-bot-api` 2.1.0 package and Bot API 10.3 change log: <https://github.com/yagop/node-telegram-bot-api/tree/v2.1.0>
- selected transport/retry implementation: <https://github.com/yagop/node-telegram-bot-api/blob/v2.1.0/src/core/transport.ts>
- selected error hierarchy: <https://github.com/yagop/node-telegram-bot-api/blob/v2.1.0/src/core/errors.ts>
- selected low-level polling primitive: <https://github.com/yagop/node-telegram-bot-api/blob/v2.1.0/src/core/longpoll.ts>
- grammY 1.46.0 simple polling lifecycle: <https://github.com/grammyjs/grammY/blob/v1.46.0/src/bot.ts>
- grammY 1.46.0 error hierarchy: <https://github.com/grammyjs/grammY/blob/v1.46.0/src/core/error.ts>
- Puregram v3 polling transport: <https://github.com/puregram/puregram/blob/v3/packages/puregram/src/transport/polling.ts>
- Telegraf 4.16.3 polling transport: <https://github.com/telegraf/telegraf/blob/v4.16.3/src/core/network/polling.ts>
- Telegraf 4.16.3 launch lifecycle: <https://github.com/telegraf/telegraf/blob/v4.16.3/src/telegraf.ts>
