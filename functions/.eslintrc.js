module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
  },
  overrides: [
    {
      // The player market documents its modules with prose blocks rather than
      // per-function @param/@return tags, and its refusal messages are full
      // sentences a player reads, so those two google rules are relaxed here.
      files: ["src/market/**/*.ts", "test/**/*.ts"],
      rules: {
        "require-jsdoc": "off",
        "valid-jsdoc": "off",
        "max-len": ["error", {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
        }],
      },
    },
    {
      files: ["test/**/*.ts"],
      rules: {"@typescript-eslint/no-non-null-assertion": "off"},
    },
  ],
};
