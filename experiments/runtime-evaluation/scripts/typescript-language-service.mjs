#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as tsModule from "typescript";

const ts = tsModule.default ?? tsModule;
const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig.json not found");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
const versions = new Map(parsed.fileNames.map((file) => [file, "0"]));
const host = {
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: (file) => versions.get(file) ?? "0",
  getScriptSnapshot: (file) => {
    const text = ts.sys.readFile(file);
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const runtimePath = resolve("src/runtime.ts");
const runtimeText = readFileSync(runtimePath, "utf8");
const position = runtimeText.indexOf("buildProjection(state");
if (position < 0) throw new Error("buildProjection call not found in runtime.ts");
const definitions = service.getDefinitionAtPosition(runtimePath, position) ?? [];
const target = definitions.find((definition) => definition.fileName.endsWith("/src/projection.ts"));
if (!target) {
  throw new Error(`language service did not resolve buildProjection to projection.ts: ${JSON.stringify(definitions)}`);
}
const quickInfo = service.getQuickInfoAtPosition(runtimePath, position);
if (!quickInfo) throw new Error("language service returned no quick info for buildProjection");
console.log(JSON.stringify({
  engine: "typescript-language-service",
  source: relative(process.cwd(), runtimePath),
  definition: relative(process.cwd(), target.fileName),
  quick_info: ts.displayPartsToString(quickInfo.displayParts),
}));
