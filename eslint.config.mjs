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
// `tx` too: a transaction client is the same surface, and the first code
// that reached Analysis from outside lib/applications/ did it through one.
const ownedModelAccess = {
  selector:
    "MemberExpression[object.name=/^(db|tx)$/][property.name=/^(analysis|document|event)$/]",
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
    // The end-to-end spec asserts on the database directly — checking that the
    // right row was written, with the right userId, is the point of the
    // assertion, and routing it through the guarded query layer would test the
    // layer against itself.
    files: ["e2e/**/*.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Offline scripts, not request-handling code: the seed and the README
    // screenshot stager both run against the demo user with no session to
    // filter by and nothing for the ownership guard to protect. Listed by
    // file rather than by directory, so a future script still has to justify
    // itself here.
    files: ["prisma/seed.ts", "docs/screenshots/capture.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default eslintConfig;
