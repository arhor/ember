import { expectAssignable, expectNotAssignable, expectType } from "tsd";

import type {
    DeliveryObservation,
    EmberApplication,
    InteractionEvent,
    InteractionResult,
    TransportSend,
} from "./contract.ts";

declare const event: InteractionEvent;
declare const result: InteractionResult;
declare const transport: TransportSend;
declare const application: EmberApplication;

expectAssignable<InteractionEvent>(event);
expectType<"message">(event.kind);

expectAssignable<InteractionResult["delivery"]>(null);
expectNotAssignable<InteractionEvent>(result);

expectAssignable<DeliveryObservation>({ outcome: "confirmed", externalMessageId: null });
expectAssignable<DeliveryObservation>({ outcome: "failed", retryable: true, retryAfterSeconds: 30 });
expectAssignable<DeliveryObservation>({ outcome: "uncertain", externalMessageId: null });
expectNotAssignable<DeliveryObservation>({ outcome: "confirmed" });

expectType<TransportSend>(transport);
expectAssignable<Promise<InteractionResult>>(application.interact(event, transport));
