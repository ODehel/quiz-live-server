import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/"] },
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
    files: ["**/*.test.ts"],
    // False alarm on expect(mock.method): the spy is not called with a lost `this`. See DEBTS.md.
    rules: { "@typescript-eslint/unbound-method": "off" }
  },
);
