#!/usr/bin/env node
import { main } from "../src/ember/cli.mjs";
process.exitCode = await main();
