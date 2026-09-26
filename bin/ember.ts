#!/usr/bin/env node
import { main } from "../src/apps/cli/index.ts";

process.exitCode = await main();
