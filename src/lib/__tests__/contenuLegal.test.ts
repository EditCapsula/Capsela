import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONTENU_LEGAL } from "../legal/contenu";
import { SLUGS_LEGAUX } from "../legal/documents";
import { contenuGenere } from "../../../scripts/generer-legal.mjs";

describe("textes légaux embarqués dans l'app", () => {
  it("contenu.ts est à jour avec docs/legal (sinon : npm run legal:generer)", () => {
    expect(readFileSync("src/lib/legal/contenu.ts", "utf8")).toBe(contenuGenere());
  });
  it("chaque document publié a son texte", () => {
    for (const slug of SLUGS_LEGAUX) expect(CONTENU_LEGAL[slug]?.length).toBeGreaterThan(100);
  });
});
