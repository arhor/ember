import { defineConfig } from "oxfmt";

export default defineConfig({
    // Keep skill formatting independent from the application formatter.
    ignorePatterns: [".agents/skills/adr-skill/**"],
    sortImports: {
        groups: [
            "type-import",
            ["value-builtin", "value-external"],
            "type-internal",
            "value-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "unknown",
        ],
    },
});
