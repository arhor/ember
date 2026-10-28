import type { ResidentServiceHost } from "@ember/host/resident-service.ts";

import { ValidationError } from "@ember/domain/errors.ts";

export async function telegramResidentHost(platform = process.platform): Promise<ResidentServiceHost> {
    if (platform === "darwin") {
        const { LaunchdTelegramResidentHost } = await import("@ember/host/launchd.ts");
        return new LaunchdTelegramResidentHost();
    }
    if (platform === "linux") {
        const { SystemdTelegramResidentHost } = await import("@ember/host/systemd.ts");
        return new SystemdTelegramResidentHost();
    }
    throw new ValidationError(`resident Telegram service is unsupported on ${platform}`);
}
