import { defineConfig } from "oxfmt";

export default defineConfig({
    sortImports: {
        // oxfmt-ignore
        groups: [
            "builtin",
            "external",
            ["internal", "subpath"],
            ["parent", "sibling", "index"],
            "style",
            "unknown",
        ],
    },
});
