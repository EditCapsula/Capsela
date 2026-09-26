import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OCCASIONS_EDITORIALES, titreStyle } from "../occasionEditoriale";

describe("OCCASIONS_EDITORIALES — une source, les vrais assets", () => {
  it("les huit visuels fournis existent, chacun sur sa propre occasion, jamais partagé", () => {
    const visuels = Object.entries(OCCASIONS_EDITORIALES).filter(([, o]) => o.visuel);
    expect(visuels.map(([k]) => k).sort()).toEqual(["cocooning", "date", "evenement_perso", "quotidien", "soiree", "sport", "travail_formel", "voyage"]);
    const srcs = visuels.map(([, o]) => o.visuel!.src);
    expect(new Set(srcs).size).toBe(8);
    for (const src of srcs) expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
  });

  it("pas de visuel de repli pour Rendez-vous important et Sortie festive", () => {
    expect(OCCASIONS_EDITORIALES.entretien.visuel).toBeUndefined();
    expect(OCCASIONS_EDITORIALES.festive.visuel).toBeUndefined();
  });
});

describe("titreStyle — le verbe seulement au-delà de la moitié", () => {
  it("formulations du brief", () => {
    expect(titreStyle(OCCASIONS_EDITORIALES.travail_formel, true)).toBe("Le travail domine ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.soiree, true)).toBe("Les soirées rythment ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.cocooning, true)).toBe("Le cocooning s'invite dans ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.voyage, true)).toBe("Les déplacements rythment ton dressing ce mois-ci");
  });

  it("sans majorité : en tête, sans domination", () => {
    expect(titreStyle(OCCASIONS_EDITORIALES.sport, false)).toBe("Le sport arrive en tête de ton dressing ce mois-ci");
    expect(titreStyle(OCCASIONS_EDITORIALES.date, false)).toBe("Les rendez-vous arrivent en tête de ton dressing ce mois-ci");
  });
});
