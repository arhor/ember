export type { SessionCommand } from "@ember/application/commands/contract.ts";
import type { SessionCommand } from "@ember/application/commands/contract.ts";
import type { CommandOutput } from "@ember/composition/command-parser.ts";

import { createConversationProgram } from "@ember/composition/command-parser.ts";

export function createSessionProgram(io: CommandOutput, dispatch: (command: SessionCommand) => Promise<void>) {
    return createConversationProgram(io, dispatch, true);
}
