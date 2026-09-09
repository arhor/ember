#!/usr/bin/env node
import { main } from "../src/surfaces/cli/index.ts";
process.exitCode = await main();
