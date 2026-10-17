import { describe, expect, it } from "vitest";
import { computeLookScore } from "../logic";
import type { Weather } from "../data";
import type { CategoryKey, Item } from "../types";

// SUGGESTIONS PROACTIVES SOUS LES RÈGLES DU MOTEUR (12/10/2026) : « compléter avec une veste » (R-S14) et « une touche de couleur »
// (R-S13) ne proposent plus une pièce que le moteur refuserait pour cette tenue.

let n = 0;
const piece = (cat: CategoryKey, name: string, color: string, extra: Partial<Item> = {}): Item => ({ id: ++n, name, cat, color, hex: "#888888", season: "Toutes saisons", worn: null, ...extra });
const meteo = (temp: number, label: string) => ({ season: "Automne / Hiver", temp, label, seasons: ["Automne / Hiver", "Toutes saisons"] }) as Weather;

describe("R-S13 — la touche de couleur", () => {
  const noir = [piece("haut", "Haut noir", "Noir"), piece("pantalon", "Pantalon noir", "Noir"), piece("chaussures", "Bottines noires", "Noir", { shoeType: "Bottines" })];
  const lunettes = piece("accessoire", "Lunettes de soleil rouges", "Rouge", { accessoireType: "Lunettes" });
  const foulard = piece("accessoire", "Foulard rouge", "Rouge", { accessoireType: "Foulard" });
  const cle = (w: Weather, pool: Item[]) => computeLookScore(noir, "quotidien", [], null, new Set(), w, "Présentiel", "Verre", pool).proactives.find((p) => p.key === "contraste_noir" || /noir/i.test(p.text))?.suggestedId;

  it("par temps nuageux, jamais des lunettes de soleil (elles ne se portent que s'il y a du soleil)", () => {
    expect(cle(meteo(18, "Nuageux"), [...noir, lunettes])).toBeUndefined();
    expect(cle(meteo(18, "Nuageux"), [...noir, lunettes, foulard])).toBe(foulard.id);
  });
  it("au soleil, les lunettes redeviennent possibles", () => {
    expect(cle(meteo(24, "Ensoleillé"), [...noir, lunettes])).toBe(lunettes.id);
  });
});

describe("R-S14 — la veste du soir", () => {
  const robe = piece("robe", "Robe", "Noir");
  const chaussures = piece("chaussures", "Escarpins", "Noir", { shoeType: "Escarpins" });
  const veste = (nom: string, extra: Partial<Item> = {}) => piece("veste", nom, "Noir", extra);

  it("jamais une veste dont la borne de température est dépassée", () => {
    const tropChaude = veste("Veste doublée", { meteoMinTemp: 25 });
    const ok = veste("Veste légère", { meteoMinTemp: 5 });
    const sug = computeLookScore([robe, chaussures], "quotidien", [], null, new Set(), meteo(12, "Nuageux"), "Présentiel", "Verre", [robe, chaussures, tropChaude, ok]).proactives.find((p) => p.key === "veste_soir")?.suggestedId;
    expect(sug).toBe(ok.id);
  });
  it("le dressing reste devant le catalogue", () => {
    const catalogue = veste("Veste du catalogue");
    catalogue.id = 900001;
    const dressing = veste("Veste du dressing");
    const sug = computeLookScore([robe, chaussures], "quotidien", [], null, new Set(), meteo(12, "Nuageux"), "Présentiel", "Verre", [catalogue, dressing, robe, chaussures]).proactives.find((p) => p.key === "veste_soir")?.suggestedId;
    expect(sug).toBe(dressing.id);
  });
});

describe("R-S14 — en Sport, le hoodie d'abord (17/10/2026)", () => {
  const sport = { occasion: ["sport"] as Item["occasion"] };
  const tenue = [
    piece("haut", "Débardeur de sport", "Noir", { subtype: "Débardeur", ...sport }),
    piece("pantalon", "Legging de sport", "Noir", { subtype: "Legging", ...sport }),
    piece("chaussures", "Baskets running", "Blanc", { shoeType: "Baskets", ...sport }),
  ];
  const hoodie = piece("pull", "Sweat à capuche", "Gris", { subtype: "Hoodie", ...sport });
  const coupeVent = piece("veste", "Coupe-vent", "Noir", { subtype: "Coupe-vent", ...sport });
  const sug = (pool: Item[]) =>
    computeLookScore(tenue, "sport", [], null, new Set(), meteo(12, "Nuageux"), "Présentiel", "Verre", [...tenue, ...pool]).proactives.find((p) => p.key === "veste_soir")?.suggestedId;

  it("propose le hoodie de la capsule, même quand une veste existe", () => {
    expect(sug([coupeVent, hoodie])).toBe(hoodie.id);
  });
  it("sans hoodie, la veste décontractée comme avant", () => {
    expect(sug([coupeVent])).toBe(coupeVent.id);
  });
});
