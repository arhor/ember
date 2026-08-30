const [mode, target] = Deno.args;
if (!mode) throw new Error("usage: permission-probe.ts <env|read|write|run|net> [target]");

switch (mode) {
  case "env":
    console.log(Deno.env.get("EMBER_EVAL_PERMISSION_SENTINEL") ?? "missing");
    break;
  case "read":
    if (!target) throw new Error("read target required");
    console.log((await Deno.readTextFile(target)).length);
    break;
  case "write":
    if (!target) throw new Error("write target required");
    await Deno.writeTextFile(target, "permission-probe\n");
    console.log("wrote");
    break;
  case "run": {
    if (!target) throw new Error("run target required");
    const output = await new Deno.Command(target, { args: ["--version"] }).output();
    if (!output.success) throw new Error("child command failed");
    console.log(new TextDecoder().decode(output.stdout).trim());
    break;
  }
  case "net":
    try {
      await fetch("http://127.0.0.1:9/");
      console.log("connected");
    } catch (error) {
      if (error instanceof Deno.errors.NotCapable) throw error;
      console.log(`network permission granted; transport outcome=${error instanceof Error ? error.name : "unknown"}`);
    }
    break;
  default:
    throw new Error(`unknown mode: ${mode}`);
}
