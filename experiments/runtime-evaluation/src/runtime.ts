import { cognitionId, type CliInput, type PersistentState, type ProviderResult } from "./model.ts";
import { buildProjection } from "./projection.ts";
import { invokeProvider } from "./provider.ts";

export async function runCognition(
  command: string,
  args: readonly string[],
  state: PersistentState,
  input: CliInput,
  purpose: "ordinary" | "explain" = "ordinary",
): Promise<ProviderResult> {
  const projection = buildProjection(state, purpose, input);
  return invokeProvider(command, args, {
    contract_version: 1,
    cognition_id: cognitionId("cognition-evaluation"),
    projection,
    input: { text: input.text },
  });
}
