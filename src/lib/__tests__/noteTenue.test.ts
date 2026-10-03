import { describe, expect, it } from "vitest";
import { colorimetrieDeSaison } from "../colorimetrie";
import { colorimetrieMoteur } from "../colorimetrieMoteur";
import { PALETTE, type Weather } from "../data";
import { computeLookScore } from "../logic";
import { formaterNote, interpretationNote, noteDeLaTenue, type EntreeNote } from "../noteTenue";
import type { CategoryKey, Item } from "../types";
import { MOTS_INTERDITS } from "../../../supabase/functions/_shared/avisStyliste.ts";

// La note de l'avis de styliste (03/10/2026).

const w = { temp: 16, label: "Nuageux", icon: "", city: "", uv: 2, humidity: 50, wind: 10 } as unknown as Weather;
const hex = (nom: string) => PALETTE.find(([n]) => n === nom)?.[1] ?? "#999999";
let id = 0;
const piece = (cat: CategoryKey, couleur: string, over: Partial<Item> = {}): Item =>
  ({ id: ++id, name: `${cat} ${couleur}`, cat, color: couleur, hex: hex(couleur), season: "Toutes saisons", worn: null, ...over }) as Item;

const avis = (over: Partial<EntreeNote["avis"]> = {}) => ({ overallAssessment: "x", strengths: [], mainAdvice: "Une veste plus ajustée structurerait l'ensemble.", suggestions: [], ...over });
const entree = (composition: Item[], over: Partial<EntreeNote> = {}): EntreeNote => ({
  avis: avis(),
  composition,
  dressing: composition,
  piecesDuConseil: [],
  titreVerdict: "Réussi",
  palette: [],
  meteo: w,
  ...over,
});

const base = () => [piece("haut", "Blanc"), piece("pantalon", "Beige"), piece("chaussures", "Blanc", { shoeType: "Baskets" })];

describe("quand il y a une note", () => {
  it("rien sans composition reconnue : deux pièces et un socle haut + bas, sinon pas de note", () => {
    expect(noteDeLaTenue(entree([]))).toBeNull();
    expect(noteDeLaTenue(entree([piece("haut", "Blanc")]))).toBeNull();
    expect(noteDeLaTenue(entree([piece("haut", "Blanc"), piece("chaussures", "Blanc")]))).toBeNull();
    expect(noteDeLaTenue(entree(base()))).not.toBeNull();
  });

  it("une note de 0 à 10 à une décimale, et des poids qui font 1", () => {
    const n = noteDeLaTenue(entree(base()))!;
    expect(n.note).toBeGreaterThanOrEqual(0);
    expect(n.note).toBeLessThanOrEqual(10);
    expect(Number.isInteger(Math.round(n.note * 10))).toBe(true);
    expect(n.note).toBe(Math.round(n.note * 10) / 10);
    expect(n.dimensions.reduce((s, d) => s + d.poids, 0)).toBeCloseTo(1, 10);
    expect(formaterNote(8.2)).toBe("8,2");
    expect(formaterNote(9)).toBe("9,0");
  });

  it("n'évalue que ce qui peut l'être : sans titre de verdict, pas de lecture ; sans accessoire ni chaussure, pas de finition", () => {
    const sans = noteDeLaTenue(entree(base(), { titreVerdict: undefined }))!;
    expect(sans.dimensions.map((d) => d.cle)).toEqual(["couleurs", "coordination", "finition"]);
    const nu = noteDeLaTenue(entree([piece("haut", "Blanc"), piece("pantalon", "Beige")]))!;
    expect(nu.dimensions.map((d) => d.cle)).toEqual(["couleurs", "coordination", "lecture"]);
    // Aucune dimension « proportions » ni « style » : rien dans le code ne les calcule.
    for (const n of [sans, nu]) expect(n.dimensions.map((d) => d.cle as string)).not.toContain("proportions");
  });

  it("la lecture de la styliste pèse sur la note : un verdict « À affiner » la tire vers le bas", () => {
    const haut = noteDeLaTenue(entree(base(), { titreVerdict: "Très réussi" }))!.note;
    const bas = noteDeLaTenue(entree(base(), { titreVerdict: "À affiner" }))!.note;
    expect(haut).toBeGreaterThan(bas);
  });

  it("une palette trop chargée (plus de trois couleurs vives) baisse la note des couleurs et se lit dans « À améliorer »", () => {
    const chargee = [piece("haut", "Fuchsia"), piece("pantalon", "Turquoise"), piece("veste", "Jaune"), piece("pull", "Rouge cerise"), piece("chaussures", "Blanc")];
    const n = noteDeLaTenue(entree(chargee))!;
    const calme = noteDeLaTenue(entree(base()))!;
    const c = (x: typeof n) => x.dimensions.find((d) => d.cle === "couleurs")!.note;
    expect(n.ameliorations.map((a) => a.titre)).toContain("Alléger la palette");
    expect(c(n)).toBeLessThan(c(calme));
  });

  it("la coordination plafonne à 8 sans superposition : une tenue simple n'a pas 10 d'office", () => {
    const n = noteDeLaTenue(entree(base()))!;
    expect(n.dimensions.find((d) => d.cle === "coordination")!.note).toBeLessThanOrEqual(8);
  });

  it("un total look noir sans accessoire coloré propose une touche de couleur, avec une pièce du dressing quand il en a une", () => {
    const noir = [piece("haut", "Noir"), piece("pantalon", "Noir"), piece("chaussures", "Noir")];
    const foulard = piece("accessoire", "Terracotta", { accessoireType: "Foulard" } as Partial<Item>);
    const n = noteDeLaTenue(entree(noir, { dressing: [...noir, foulard] }))!;
    const a = n.ameliorations.find((x) => x.titre === "Ajouter une touche de couleur");
    expect(a).toBeDefined();
    expect(n.ameliorations.length).toBeLessThanOrEqual(3);
  });

  it("le conseil de la styliste vient en premier, avec ses pièces du dressing", () => {
    const veste = piece("veste", "Beige");
    const n = noteDeLaTenue(entree(base(), { piecesDuConseil: [veste], titreConseil: "Structurer la silhouette" }))!;
    expect(n.ameliorations[0]).toMatchObject({ titre: "Structurer la silhouette", pieces: [veste] });
  });

  it("trois « À améliorer » au plus, quoi qu'on lui donne", () => {
    const noir = [piece("haut", "Noir"), piece("pantalon", "Noir"), piece("chaussures", "Noir")];
    expect(noteDeLaTenue(entree(noir))!.ameliorations.length).toBeLessThanOrEqual(3);
  });
});

describe("la trace des règles ne change pas le score existant", () => {
  it("score = 100 + somme des contributions, borné comme avant", () => {
    const pieces = [piece("haut", "Terracotta"), piece("pantalon", "Denim"), piece("chaussures", "Blanc"), piece("sac", "Chocolat")];
    for (const colo of [null, colorimetrieMoteur(colorimetrieDeSaison("automne", "questionnaire"))]) {
      const s = computeLookScore(pieces, "quotidien", [], null, new Set(), w, undefined, undefined, [], colo);
      const somme = s.regles.reduce((t, r) => t + r.points, 0);
      expect(s.score).toBe(Math.max(0, Math.min(120, 100 + somme)));
    }
  });
});

describe("les mots", () => {
  it("les libellés suivent les seuils du brief", () => {
    expect(interpretationNote(9.4).libelle).toBe("Une tenue très maîtrisée");
    expect(interpretationNote(8.9).libelle).toBe("Une tenue harmonieuse");
    expect(interpretationNote(8).libelle).toBe("Une tenue harmonieuse");
    expect(interpretationNote(7.9).libelle).toBe("Une base très réussie");
    expect(interpretationNote(6.5).libelle).toBe("Une bonne base à affiner");
    expect(interpretationNote(5.2).libelle).toBe("Une base intéressante");
    expect(interpretationNote(4.9).libelle).toBe("Une tenue à rééquilibrer");
  });

  it("aucun vocabulaire de la liste interdite, jamais un jugement sur la personne", () => {
    for (let n = 0; n <= 10; n += 0.5) {
      const { libelle, phrase } = interpretationNote(n);
      const t = `${libelle} ${phrase}`.toLowerCase();
      for (const m of MOTS_INTERDITS) expect(t).not.toContain(m);
      expect(t).not.toMatch(/\btu (es|as)\b|\bmauvais/);
    }
  });
});
