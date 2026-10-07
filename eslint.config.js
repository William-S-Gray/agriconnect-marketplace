import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".next", "next-env.d.ts", "playwright-report", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      // Next.js code runs in both environments.
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Must come after the block above: in flat config the last matching entry
    // wins. Next.js route files are required to export metadata / dynamic /
    // runtime alongside the component, which react-refresh's single-export
    // rule flags by design. That rule targets Vite's Fast Refresh and does not
    // apply here, so without this it warns on every page ever added.
    files: ["app/**/*.{ts,tsx}", "middleware.ts"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
