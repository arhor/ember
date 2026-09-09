#!/usr/bin/env node
import { main } from "../src/cli/index.ts";
process.exitCode = await main();
