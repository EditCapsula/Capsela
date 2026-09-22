import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accessoireTypeFor } from "../attributes";
import { applySportCocooningFilter } from "../logic";
import type { Item } from "../types";

/**
 * MESURÉ LE 22/09/2026 sur un dressing de sport saisi à la main : une
 * « Casquette de course » enregistrée sans dérouler le menu du type
 * disparaissait des tenues de Sport, la liste blanche R-B11 refusant tout
 * type inconnu. Le menu est facultatif — seul le type de chaussure bloque
 * (R-B6) — alors qu'au catalogue le nom est toujours lu. Deux chemins, deux
 * résultats pour la même casquette.
 */

const perso = (over: Partial<Item> & Pick<Item, "id" | "cat" | "name">): Item =>
  ({ color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;

describe("accessoireTypeFor", () => {
  it("déduit le type du nom quand il n'a pas été saisi", () => {
    expect(accessoireTypeFor("accessoire", null, "Casquette de course")).toBe("Casquette");
    expect(accessoireTypeFor("accessoire", undefined, "Gourde isotherme")).toBe("Gourde");
  });

  it("ne comble qu'un vide : la valeur saisie l'emporte toujours sur le nom", () => {
    // Le nom dit « casquette », l'utilisatrice a choisi « Chapeau ». C'est
    // son choix qui vaut — la déduction ne corrige jamais une saisie.
    expect(accessoireTypeFor("accessoire", "Chapeau", "Casquette de course")).toBe("Chapeau");
  });

  it("laisse sans type un nom qu'aucune expression ne reconnaît", () => {
    // Pas de devinette : « inconnu » est la réponse honnête, et R-B11 la
    // traite comme un refus.
    expect(accessoireTypeFor("accessoire", null, "Brassard réfléchissant")).toBeUndefined();
  });

  it("ne s'applique qu'aux accessoires", () => {
    // « Ceinture » dans le nom d'une robe ne doit pas lui donner un type
    // d'accessoire.
    expect(accessoireTypeFor("robe", null, "Robe à ceinture")).toBeUndefined();
    expect(accessoireTypeFor("sac", null, "Sac de sport")).toBeUndefined();
  });

  it("répare le cas mesuré : la casquette non typée revient en Sport", () => {
    const casquette = perso({ id: 1, cat: "accessoire", name: "Casquette de course" });
    expect(applySportCocooningFilter([casquette], "sport")).toHaveLength(0);

    const reparee = { ...casquette, accessoireType: accessoireTypeFor("accessoire", null, casquette.name) };
    expect(applySportCocooningFilter([reparee], "sport")).toHaveLength(1);
  });
});

/**
 * Deux endroits fabriquent une pièce du dressing — `saveItem` juste après le
 * formulaire, `rowToItem` après rechargement. S'ils divergent, la même
 * casquette n'a pas le même type avant et après un rafraîchissement, et le
 * défaut est invisible en test unitaire comme à l'écran. Ce garde lit les
 * deux fichiers source plutôt que de faire confiance à la relecture.
 */
describe("les deux chemins de construction passent par le même point", () => {
  it.each([
    ["src/lib/store.tsx", "saveItem, après le formulaire"],
    ["src/lib/dressing.ts", "rowToItem, après rechargement"],
  ])("%s (%s)", (fichier) => {
    const source = readFileSync(fichier, "utf8");
    const assignations = source.match(/^\s*accessoireType:.*$/gm) ?? [];
    expect(assignations.length).toBeGreaterThan(0);
    for (const ligne of assignations) {
      expect(ligne).toContain("accessoireTypeFor(");
    }
  });
});
