#!/usr/bin/env node
import { main } from "../src/ember/cli.ts";
process.exitCode = await main();
