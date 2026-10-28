import { basename } from "node:path";

export function providerLabel(command: string) {
    return basename(command) || command;
}
