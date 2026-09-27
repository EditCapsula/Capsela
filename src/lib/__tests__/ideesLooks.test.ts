import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nounInfoDuNom, type ItemOutfitVariation } from "../logic";
import { familleDe, ideesDressingDAbord, ordonnerLooks, provenanceLook, sourcePiece, texteProvenance, titreCommentPorter } from "../ideesLooks";
import type { CategoryKey, Item, OccasionKey } from "../types";

const piece = (id: number, cat: CategoryKey, name: string): Item => ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: 1 });

const dressing = [piece(1, "manteau", "Manteau chocolat"), piece(2, "haut", "Pull fin crème"), piece(3, "pantalon", "Pantalon noir")];
const v = (occasion: OccasionKey, ids: number[]): ItemOutfitVariation => ({ occasion, ids, score: 1 });

describe("sourcePiece / provenanceLook — la source est le dressing réel", () => {
  it("owned seulement si la pièce est au dressing, quel que soit son id", () => {
    expect(sourcePiece(2, dressing)).toBe("owned");
    expect(sourcePiece(4, dressing)).toBe("catalog");
    expect(sourcePiece(100500, dressing)).toBe("catalog");
  });

  it("compte les pièces du dressing et les suggestions", () => {
    expect(provenanceLook([1, 2, 3, 100500], dressing)).toEqual({ dressing: 3, suggestions: 1, total: 4 });
  });

  it("dit la provenance sans l'arrondir", () => {
    expect(texteProvenance({ dressing: 5, suggestions: 0, total: 5 })).toBe("Tout est dans ton dressing");
    expect(texteProvenance({ dressing: 4, suggestions: 1, total: 5 })).toBe("4 pièces de ton dressing · 1 suggestion");
    expect(texteProvenance({ dressing: 1, suggestions: 3, total: 4 })).toBe("1 pièce de ton dressing · 3 suggestions");
    expect(texteProvenance({ dressing: 0, suggestions: 2, total: 2 })).toBe("2 suggestions de ta capsule");
  });
});

describe("ordonnerLooks — trois looks différenciés, le dressing d'abord", () => {
  it("les trois premiers : le meilleur Quotidien, Travail, Sortie", () => {
    const looks = ordonnerLooks(
      [v("soiree", [1, 2, 3]), v("travail_formel", [1, 2, 100500]), v("quotidien", [1, 100501, 100502]), v("quotidien", [1, 2, 3])],
      dressing
    );
    expect(looks.map((l) => [l.famille, l.variation.ids.join(",")])).toEqual([
      ["quotidien", "1,2,3"],
      ["travail", "1,2,100500"],
      ["sortie", "1,2,3"],
      ["quotidien", "1,100501,100502"],
    ]);
    expect(looks.map((l) => l.numero)).toEqual([1, 2, 3, 4]);
  });

  it("une famille absente ne laisse pas de trou ; le Sport vient après", () => {
    const looks = ordonnerLooks([v("sport", [1, 2]), v("soiree", [1, 3])], dressing);
    expect(looks.map((l) => l.variation.occasion)).toEqual(["soiree", "sport"]);
    expect(familleDe("sport")).toBeNull();
  });

  it("à famille égale, moins de suggestions d'abord (ordre du moteur en départage)", () => {
    const looks = ordonnerLooks([v("quotidien", [1, 100500]), v("quotidien", [1, 2]), v("quotidien", [1, 3])], dressing);
    expect(looks.map((l) => l.variation.ids.join(","))).toEqual(["1,2", "1,3", "1,100500"]);
  });
});

describe("titreCommentPorter — l'article accordé au nom affiché", () => {
  it("possessif pour une pièce du dressing", () => {
    expect(titreCommentPorter(piece(1, "manteau", "Manteau chocolat"), true)).toBe("Comment porter ton manteau chocolat ?");
    expect(titreCommentPorter(piece(5, "haut", "Chemise blanche"), true)).toBe("Comment porter ta chemise blanche ?");
    expect(titreCommentPorter(piece(6, "chaussures", "Bottines noires"), true)).toBe("Comment porter tes bottines noires ?");
    expect(titreCommentPorter(piece(7, "accessoire", "Écharpe en laine"), true)).toBe("Comment porter ton écharpe en laine ?");
    expect(titreCommentPorter(piece(8, "veste", "Veste en jean délavée"), true)).toBe("Comment porter ta veste en jean délavée ?");
  });

  it("article défini pour une pièce qui n'est pas au dressing", () => {
    expect(titreCommentPorter(piece(9, "veste", "Blazer camel"), false)).toBe("Comment porter le blazer camel ?");
    expect(titreCommentPorter(piece(10, "robe", "Robe midi"), false)).toBe("Comment porter la robe midi ?");
    expect(titreCommentPorter(piece(11, "accessoire", "Écharpe"), false)).toBe("Comment porter l'écharpe ?");
  });

  it("nom non reconnu : aucun accord deviné", () => {
    expect(titreCommentPorter(piece(12, "haut", "Marcel rayé"), true)).toBe("Comment porter cette pièce ?");
    expect(nounInfoDuNom("Marcel rayé")).toBeNull();
  });
});

describe("ideesDressingDAbord — la capsule complète seulement si nécessaire", () => {
  const OCC: OccasionKey[] = ["quotidien", "travail_formel", "entretien", "soiree", "festive", "date", "voyage", "cocooning", "evenement_perso"];
  let n = 0;
  const p = (id: number, cat: CategoryKey, name: string, extra: Partial<Item> = {}): Item => ({ ...piece(id, cat, name), occasion: OCC, worn: 2, ...extra, id: id || ++n });
  const manteau = p(1, "manteau", "Manteau chocolat", { season: "Automne / Hiver", color: "Chocolat", hex: "#4A3326" });
  const dressingComplet = [
    manteau,
    p(2, "haut", "Chemise blanche", { subtype: "Chemise", color: "Blanc", hex: "#F7F5EF" }),
    p(3, "pull", "Pull fin crème", { color: "Crème", hex: "#EFE6D4" }),
    p(4, "pantalon", "Pantalon noir"),
    p(5, "jean", "Jean brut", { color: "Denim", hex: "#34445E" }),
    p(6, "chaussures", "Bottines noires", { shoeType: "Bottines" }),
    p(7, "chaussures", "Mocassins cuir", { shoeType: "Mocassins", color: "Marron", hex: "#5B3A24" }),
    p(8, "sac", "Sac cuir camel", { color: "Camel", hex: "#B07A45" }),
  ];
  const capsule = [
    p(100001, "veste", "Blazer structuré", { subtype: "Blazer", color: "Beige", hex: "#CDB89A" }),
    p(100002, "robe", "Robe chemise", { color: "Marine", hex: "#2C3A55" }),
    p(100003, "accessoire", "Foulard soie", { subtype: "Foulard", color: "Moutarde", hex: "#C9A24A" }),
    p(100004, "chaussures", "Baskets blanches", { shoeType: "Baskets", color: "Blanc", hex: "#F4F2EC" }),
  ];
  const suggestions = (idees: ItemOutfitVariation[], dressing: Item[]) => idees.filter((i) => provenanceLook(i.ids, dressing).suggestions > 0).length;

  // Tirages rejoués à l'identique (graine fixe) : avant et après se comparent
  // sur les mêmes aléas, et le test ne dépend pas de la chance.
  beforeEach(() => {
    let graine = 42;
    vi.spyOn(Math, "random").mockImplementation(() => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("dressing complet : les occasions que le dressing couvre n'ont plus de suggestion (avant/après, même exécution)", () => {
    const pool = [...dressingComplet, ...capsule];
    const avant = ideesDressingDAbord(manteau, pool, null, "Automne", [], "femme");
    const apres = ideesDressingDAbord(manteau, pool, dressingComplet, "Automne", [], "femme");
    const quotidienTravail = apres.filter((i) => i.occasion === "quotidien" || i.occasion === "travail_formel");
    expect(quotidienTravail.length).toBeGreaterThan(0);
    expect(suggestions(quotidienTravail, dressingComplet)).toBe(0);
    expect(suggestions(apres, dressingComplet)).toBeLessThan(suggestions(avant, dressingComplet));
    for (const i of apres) expect(i.ids).toContain(manteau.id);
  });

  it("dressing sans chaussures : la capsule complète, les idées restent possibles", () => {
    const sansChaussures = dressingComplet.filter((it) => it.cat !== "chaussures");
    const idees = ideesDressingDAbord(manteau, [...sansChaussures, ...capsule], sansChaussures, "Automne", [], "femme");
    expect(idees.length).toBeGreaterThan(0);
    expect(idees.every((i) => provenanceLook(i.ids, sansChaussures).suggestions > 0)).toBe(true);
  });
});
