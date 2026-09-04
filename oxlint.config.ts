import { defineConfig } from "oxlint";

export default defineConfig({
    plugins: ["import"],
    rules: {
        "typescript/consistent-type-imports": [
            "error",
            {
                prefer: "type-imports",
                fixStyle: "separate-type-imports",
            },
        ],
        "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    },
});
