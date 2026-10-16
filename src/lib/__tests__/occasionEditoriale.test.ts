import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OCCASIONS, occasionShortLabel } from "../data";
import { OCCASIONS_EDITORIALES, libelleOccasion } from "../occasionEditoriale";

const nomVisuel = (k: keyof typeof OCCASIONS_EDITORIALES) => OCCASIONS_EDITORIALES[k].visuel?.src.split("/").pop();

describe("OCCASIONS_EDITORIALES — une source, les vrais assets", () => {
  it("toutes les occasions de l'app ont un visuel, et les huit fichiers fournis existent", () => {
    const cles = OCCASIONS.map(([k]) => k).filter((k) => k !== "all") as (keyof typeof OCCASIONS_EDITORIALES)[];
    for (const k of cles) expect(OCCASIONS_EDITORIALES[k].visuel, k).toBeDefined();
    const srcs = new Set(cles.map((k) => OCCASIONS_EDITORIALES[k].visuel!.src));
    expect(srcs.size).toBe(8);
    for (const src of srcs) expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
  });

  it("Voyage → le visuel « déplacement » (« Sortie festive » et « Rendez-vous important » n'existent plus, 08/10/2026)", () => {
    expect(nomVisuel("voyage")).toBe("capsela_editorial_deplacement_unisex_900x1200.jpg");
  });

  it("le nom affiché est celui de l'application (le même que les pastilles du filtre)", () => {
    expect(libelleOccasion("voyage")).toBe(occasionShortLabel("voyage"));
    expect(libelleOccasion("voyage")).toBe("Voyage");
  });
});
