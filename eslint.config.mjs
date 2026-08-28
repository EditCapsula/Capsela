import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Maquettes de référence livrées avec le design — code tiers, jamais
    // exécuté par l'application, hors du périmètre de nos règles.
    "design-reference/**",
  ]),
  {
    // Les Edge Functions tournent sous Deno, avec leur propre linter : les
    // `any` qui y subsistent sont déjà annotés `// deno-lint-ignore
    // no-explicit-any` (clients Supabase passés en paramètre, dont le type
    // n'est pas importable côté Deno). ESLint ne comprend pas ces
    // annotations et les signalait en doublon. Le reste des règles continue
    // de s'appliquer, notamment sur le miroir _shared/imagePrompt.ts.
    files: ["supabase/functions/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
