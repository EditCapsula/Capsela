import { defineConfig } from "vitest/config";

// Tests unitaires des règles du moteur (src/lib) — fonctions pures, aucun
// composant React, donc ni jsdom ni testing-library : environnement node,
// dépendances minimales, CI rapide. Le guide Next.js recommande Vitest
// (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) ; les
// alias "@/..." de tsconfig sont résolus nativement par Vite depuis la v7,
// sans le plugin vite-tsconfig-paths que ce guide mentionne encore.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
