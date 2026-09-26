import type { ResidentServiceHost } from "./resident-service.ts";

import { ValidationError } from "../errors.ts";

export async function telegramResidentHost(platform = process.platform): Promise<ResidentServiceHost> {
    if (platform === "darwin") {
        const { LaunchdTelegramResidentHost } = await import("./launchd.ts");
        return new LaunchdTelegramResidentHost();
    }
    if (platform === "linux") {
        const { SystemdTelegramResidentHost } = await import("./systemd.ts");
        return new SystemdTelegramResidentHost();
    }
    throw new ValidationError(`resident Telegram service is unsupported on ${platform}`);
}
