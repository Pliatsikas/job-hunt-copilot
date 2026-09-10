import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next@15 still ships the legacy .eslintrc shape; FlatCompat
// bridges it into ESLint 9's flat config.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// CLAUDE.md rule 1 / SPEC.md §8 Α1: Analysis, Document and Event are reachable
// only through lib/applications/, which is the layer that pairs every query
// with both userId and applicationId. Enforced here so the convention fails CI
// instead of relying on memory. `no-restricted-imports` is the wrong lever —
// lib/db is legitimately imported all over for User/Application access — so the
// restriction is on the property access itself.
const ownedModelAccess = {
  selector:
    "MemberExpression[object.name='db'][property.name=/^(analysis|document|event)$/]",
  message:
    "Reach Analysis/Document/Event through lib/applications/ — those queries must filter by userId AND applicationId (CLAUDE.md rule 1).",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ownedModelAccess],
      // Server actions must keep the (prevState, formData) signature even when
      // a given action reads neither. Underscore marks that as deliberate.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // The one layer allowed to touch them directly.
    files: ["lib/applications/**/*.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // The seed is not request-handling code: it runs offline against a user
    // it just created, so there is no session to filter by and nothing for
    // the ownership guard to protect. Scoped to this one file rather than to
    // prisma/**, so a future script there still has to justify itself.
    files: ["prisma/seed.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default eslintConfig;
