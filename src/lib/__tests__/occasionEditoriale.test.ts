import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OCCASIONS, occasionShortLabel } from "../data";
import { OCCASIONS_EDITORIALES, libelleOccasion, titreStyle } from "../occasionEditoriale";

const nomVisuel = (k: keyof typeof OCCASIONS_EDITORIALES) => OCCASIONS_EDITORIALES[k].visuel?.src.split("/").pop();

describe("OCCASIONS_EDITORIALES — une source, les vrais assets", () => {
  it("toutes les occasions de l'app ont un visuel, et les huit fichiers fournis existent", () => {
    const cles = OCCASIONS.map(([k]) => k).filter((k) => k !== "all") as (keyof typeof OCCASIONS_EDITORIALES)[];
    for (const k of cles) expect(OCCASIONS_EDITORIALES[k].visuel, k).toBeDefined();
    const srcs = new Set(cles.map((k) => OCCASIONS_EDITORIALES[k].visuel!.src));
    expect(srcs.size).toBe(8);
    for (const src of srcs) expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
  });

  it("l'emprunt décidé : Rendez-vous important → Travail ; Voyage → le visuel « déplacement » (Sortie festive n'existe plus, 08/10/2026)", () => {
    expect(nomVisuel("entretien")).toBe(nomVisuel("travail_formel"));
    expect(nomVisuel("voyage")).toBe("capsela_editorial_deplacement_unisex_900x1200.jpg");
  });

  it("le nom affiché est celui de l'application (le même que les pastilles du filtre)", () => {
    expect(libelleOccasion("voyage")).toBe(occasionShortLabel("voyage"));
    expect(libelleOccasion("voyage")).toBe("Voyage");
  });
});

describe("titreStyle — le verbe seulement au-delà de la moitié", () => {
  it("avec les mots de l'application", () => {
    expect(titreStyle(OCCASIONS_EDITORIALES.travail_formel, true)).toBe("Le travail domine ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.soiree, true)).toBe("Les soirées rythment ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.cocooning, true)).toBe("Le cocooning s'invite dans ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.voyage, true)).toBe("Les voyages rythment ton dressing ce mois-ci");
  });

  it("sans majorité : en tête, sans domination", () => {
    expect(titreStyle(OCCASIONS_EDITORIALES.sport, false)).toBe("Le sport arrive en tête ce mois-ci");
  });
});
