import { FlatCompat } from "@eslint/eslintrc"
import eslint from "@eslint/js"
import importPlugin from "eslint-plugin-import"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys"
import * as Path from "node:path"
import * as Url from "node:url"
import tseslint from "typescript-eslint"

const __filename = Url.fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

export default tseslint.config(
  {
    ignores: ["**/dist", "**/build", "**/docs", "**/*.md"]
  },
  eslint.configs.recommended,
  tseslint.configs.strict,
  importPlugin.flatConfigs.recommended,
  ...compat.extends("plugin:@effect/recommended"),
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "sort-destructure-keys": sortDestructureKeys
    },

    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2018,
      sourceType: "module"
    },

    // settings: {
    //   "import/parsers": {
    //     "@typescript-eslint/parser": [".ts", ".tsx"]
    //   }
    // },

    rules: {
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "object-shorthand": "error",
      "prefer-destructuring": "off",
      "sort-imports": "off",

      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
          message: "Do not use spread arguments in Array.push"
        }
      ],

      "no-unused-vars": "off",
      "require-yield": "off",
      "prefer-rest-params": "off",
      "prefer-spread": "off",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "off",
      "import/order": "off",
      "simple-import-sort/imports": "off",
      "sort-destructure-keys/sort-destructure-keys": "error",
      "deprecation/deprecation": "off",

      "@typescript-eslint/array-type": [
        "warn",
        {
          default: "generic",
          readonly: "generic"
        }
      ],

      "@typescript-eslint/member-delimiter-style": 0,
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/consistent-type-imports": "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],

      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-array-constructor": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-namespace": "off",

      "@effect/dprint": [
        "error",
        {
          config: {
            indentWidth: 2,
            lineWidth: 120,
            semiColons: "asi",
            quoteStyle: "alwaysDouble",
            trailingCommas: "never",
            operatorPosition: "maintain",
            "arrowFunction.useParentheses": "force"
          }
        }
      ]
    }
  },
  {
    files: ["packages/*/src/**/*", "packages/*/test/**/*"],
    rules: {
      "no-console": "error"
    }
  }
)
