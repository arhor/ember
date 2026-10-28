import { fixtureMain } from "./support.ts";
process.exitCode = await fixtureMain(process.argv.slice(2), {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
});
