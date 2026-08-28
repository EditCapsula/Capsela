import { defineConfig } from "vitest/config";

// Configuration séparée pour les audits catalogue (scripts/*.audit.ts).
//
// Ces fichiers interrogent Supabase en lecture : ils n'ont rien à faire dans
// `npm test`, qui doit rester hors-ligne et déterministe — d'où un `include`
// distinct de celui de vitest.config.mts, qui ne couvre que src/**/*.test.ts.
//
// Pourquoi Vitest plutôt qu'un script Node : ces audits recalculent les
// attributs dérivés avec le VRAI moteur (src/lib/attributes, src/lib/capsule)
// pour vérifier qu'un renommage ne change rien. Ces modules s'importent entre
// eux sans extension de fichier, ce que `node --experimental-strip-types` ne
// sait pas résoudre. Vitest applique la résolution du projet, alias "@/"
// compris. Le corps de l'audit est donc enveloppé dans un `it()` unique.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["scripts/**/*.audit.ts"],
    testTimeout: 120_000,
    disableConsoleIntercept: true,
  },
});
