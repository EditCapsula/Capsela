import { describe, expect, it } from "vitest";
import { occasionVoisine, sensDuGlissement } from "../glissementOccasion";

describe("glissement d'occasion", () => {
  it("vers la gauche : suivante ; vers la droite : précédente", () => {
    expect(sensDuGlissement(-120, 10, 250)).toBe(1);
    expect(sensDuGlissement(120, -10, 250)).toBe(-1);
  });
  it("un défilement vertical, un toucher ou un geste lent ne changent rien", () => {
    expect(sensDuGlissement(-80, 90, 250)).toBe(0);
    expect(sensDuGlissement(-30, 0, 150)).toBe(0);
    expect(sensDuGlissement(-150, 0, 1200)).toBe(0);
  });
  it("boucle aux extrémités, comme les flèches du clavier ; sans occasion, la première ou la dernière", () => {
    const o = ["quotidien", "travail_formel", "soiree"] as const;
    expect(occasionVoisine(o, "soiree", 1)).toBe("quotidien");
    expect(occasionVoisine(o, "quotidien", -1)).toBe("soiree");
    expect(occasionVoisine(o, "travail_formel", 1)).toBe("soiree");
    expect(occasionVoisine(o, "all", 1)).toBe("quotidien");
    expect(occasionVoisine(o, "all", -1)).toBe("soiree");
  });
});
