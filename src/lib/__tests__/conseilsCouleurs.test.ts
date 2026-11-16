import { describe, expect, it } from "vitest";
import { PAL_COULEURS } from "../palCouleurs";
import { PALETTE } from "../data";
import { REGLES_ASSOCIATION, LIBELLES, conseilCouleur, phraseDe } from "../conseilsCouleurs";
import { colorimetrieMoteur } from "../colorimetrieMoteur";
import { colorimetrieDeSaison } from "../colorimetrie";
import type { Item } from "../types";

const hex = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
let id = 0;
const p = (nom: string, cat: Item["cat"] = "haut"): Item =>
  ({ id: ++id, name: nom, cat, color: nom, hex: hex(nom), season: "Toutes saisons", worn: 0, occasion: ["quotidien"] }) as Item;

describe("conseils d'association", () => {
  it("toutes les couleurs des règles existent dans une palette de l'app et ont un libellé", () => {
    for (const r of REGLES_ASSOCIATION) for (const n of [...r.accord, r.pointe]) {
      expect(PAL_COULEURS.some(([x]) => x === n) || PALETTE.some(([x]) => x === n), n).toBe(true);
      expect(LIBELLES[n], n).toBeTruthy();
    }
  });
  it("dix accords par saison, sans doublon dans une saison (16/11/2026)", () => {
    for (const saison of ["Printemps", "Été", "Automne", "Hiver"] as const) {
      const r = REGLES_ASSOCIATION.filter((x) => x.saison === saison);
      expect(r.length, saison).toBe(10);
      expect(new Set(r.map((x) => [...x.accord].sort().join("+"))).size, saison).toBe(10);
    }
  });
  it("printemps : « pour le printemps », jamais « l'printemps »", () => {
    const c = conseilCouleur([p("Rose poudré"), p("Gris clair", "pantalon")], "Printemps");
    expect(c?.texte).toBe("Le rose poudré et le gris clair ensemble, c'est top pour le printemps. Avec une pointe de vert sauge, ce serait parfait.");
  });
  it("une nuance du dressing se reconnaît par son nom (16/11/2026)", () => {
    const dressing = (nom: string, cat: Item["cat"] = "haut"): Item =>
      ({ id: ++id, name: nom, cat, color: nom, hex: PALETTE.find(([x]) => x === nom)![1], season: "Toutes saisons", worn: 0 }) as Item;
    expect(conseilCouleur([dressing("Bordeaux"), dressing("Gris anthracite", "pantalon")], "Automne")?.accord).toEqual(["Bordeaux", "Gris anthracite"]);
    expect(conseilCouleur([dressing("Rouille"), dressing("Marine", "pantalon")], "Été")?.accord).toEqual(["Rouille", "Marine"]);
    // Un gris anthracite n'est pas un gris clair.
    expect(conseilCouleur([dressing("Marine"), dressing("Gris anthracite", "pantalon")], "Hiver")).toBeNull();
  });
  it("été et hiver : leurs propres accords", () => {
    expect(conseilCouleur([p("Blanc"), p("Marine", "pantalon"), p("Rouge", "sac")], "Été")?.texte).toBe(
      "Le blanc et le marine, avec une pointe de rouge : c'est parfait pour l'été."
    );
    expect(conseilCouleur([p("Noir"), p("Camel", "manteau")], "Hiver")?.accord).toEqual(["Noir", "Camel"]);
    expect(conseilCouleur([p("Noir"), p("Camel", "manteau")], "Printemps")).toBeNull();
  });
  it("l'exemple de la propriétaire : rose et marron, avec une pointe de rouge", () => {
    const c = conseilCouleur([p("Vieux rose"), p("Marron", "pantalon"), p("Rouge", "sac")], "Automne");
    expect(c?.pointePresente).toBe(true);
    expect(c?.texte).toBe("Le vieux rose et le marron, avec une pointe de rouge : c'est parfait pour l'automne.");
  });
  it("sans la pointe : le conseil la suggère", () => {
    const c = conseilCouleur([p("Vieux rose"), p("Marron", "pantalon")], "Automne");
    expect(c?.texte).toBe("Le vieux rose et le marron ensemble, c'est top pour l'automne. Avec une pointe de rouge, ce serait parfait.");
  });
  it("un accord d'automne jamais en été, ni sans les deux couleurs réellement présentes", () => {
    expect(conseilCouleur([p("Vieux rose"), p("Marron", "pantalon")], "Été")).toBeNull();
    expect(conseilCouleur([p("Vieux rose"), p("Beige", "pantalon")], "Automne")).toBeNull();
  });
  it("une pointe déjà présente passe avant un accord sans pointe", () => {
    const c = conseilCouleur([p("Vieux rose"), p("Marron", "pantalon"), p("Moutarde", "pull"), p("Chocolat", "sac"), p("Bordeaux", "chaussures")], "Automne");
    expect(c?.accord).toEqual(["Moutarde", "Chocolat"]);
    expect(c?.pointePresente).toBe(true);
  });
  it("adoucie quand une couleur à doser est près du visage (hiver : Vieux rose à modérer)", () => {
    const hiver = colorimetrieMoteur(colorimetrieDeSaison("hiver", "questionnaire"));
    const c = conseilCouleur([p("Vieux rose"), p("Marron", "pantalon")], "Automne", hiver);
    expect(c?.adouci).toBe(true);
    expect(c?.texte).toContain("à porter plutôt en touches près du visage");
    expect(c?.texte).not.toContain("parfait");
  });
  it("jamais adoucie si la couleur à doser est loin du visage", () => {
    const hiver = colorimetrieMoteur(colorimetrieDeSaison("hiver", "questionnaire"));
    const c = conseilCouleur([p("Vert forêt"), p("Beige", "pantalon")], "Automne", hiver);
    expect(c?.adouci).toBe(false);
  });
  it("aucun mot interdit dans les phrases", () => {
    for (const r of REGLES_ASSOCIATION) for (const pp of [true, false]) for (const a of [true, false])
      expect(phraseDe(r, pp, a)).not.toMatch(/cacher|dissimul|camoufl|corrig|défaut|grossi|aminci|peu flatteur/i);
  });
});
