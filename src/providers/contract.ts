/**
 * Transitional aliases for provider adapters that have not yet moved beneath the
 * common AI SDK execution boundary. Application and domain code import the
 * Ember-owned execution contract from `src/ai/contract.ts` directly.
 */
export {
    AI_EXECUTION_CONTRACT_VERSION as CONTRACT_VERSION,
    MAX_AI_TIMEOUT_SECONDS as MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateAiExecutionResult as validateProviderResult,
} from "../ai/contract.ts";
export type {
    AiExecutionOptions as ProviderInvocationOptions,
    AiExecutionRequest as ProviderRequest,
    AiExecutionResult as ProviderResult,
    AiExecutor as ProviderInvoker,
    AiStreamObservation as ProviderStreamObservation,
    AiStreamObserver as ProviderStreamObserver,
} from "../ai/contract.ts";
