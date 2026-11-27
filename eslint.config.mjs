import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // The probe preloaded into the real seed process by seed-all-or-none.test.ts is plain JavaScript, outside the tsconfig (no type-checked rules apply to it).
  { ignores: ["dist/", "coverage/", "src/test-support/*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Cyclomatic complexity of every function, production and tests alike. What it leaves through: DEBTS.md, "outillage".
    rules: { complexity: ["error", { max: 10 }] }
  },
  {
    files: ["**/*.test.ts"],
    // False alarm on expect(mock.method): the spy is not called with a lost `this`. See DEBTS.md.
    rules: { "@typescript-eslint/unbound-method": "off" }
  },
);
