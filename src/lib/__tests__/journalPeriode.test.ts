import { describe, expect, it } from "vitest";
import { chiffresPeriode, debutPeriode, detailPartDressing, filtrePourPart, historiqueDansPeriode, peutEtreDiteJamaisPortee, repartitionDressing } from "../selectors";
import type { HistoryEntry, Item } from "../types";

const item = (id: number, cat: string): Item => ({ id, cat, name: `p${id}`, hex: "#000000" }) as unknown as Item;
const entree = (id: string, ts: Date, pieceIds: number[]): HistoryEntry => ({ id, ts: ts.getTime(), pieceIds, occasion: "quotidien" });
const NOW = new Date(2026, 9, 12, 14, 0); // 12 octobre 2026, heure locale

describe("périodes du Journal", () => {
  it("le mois commence le 1er à 00:00 ; trois mois = le mois en cours et les deux précédents", () => {
    expect(debutPeriode("mois", NOW)).toBe(new Date(2026, 9, 1).getTime());
    expect(debutPeriode("trois_mois", NOW)).toBe(new Date(2026, 7, 1).getTime());
    expect(debutPeriode("tout", NOW)).toBe(-Infinity);
  });
  it("passe l'année : janvier + 3 mois commence en novembre", () => {
    expect(debutPeriode("trois_mois", new Date(2026, 0, 15))).toBe(new Date(2025, 10, 1).getTime());
  });
  it("aucun doublon au changement de mois : la tenue du 1er à 00:00 est du nouveau mois seulement", () => {
    const h = [entree("a", new Date(2026, 8, 30, 23, 59), [1]), entree("b", new Date(2026, 9, 1, 0, 0), [2])];
    expect(historiqueDansPeriode(h, "mois", NOW).map((e) => e.id)).toEqual(["b"]);
    expect(historiqueDansPeriode(h, "trois_mois", NOW).map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("une tenue du futur n'est jamais comptée", () => {
    expect(historiqueDansPeriode([entree("f", new Date(2026, 9, 20), [1])], "tout", NOW)).toEqual([]);
  });
});

describe("chiffresPeriode", () => {
  const dressing = [item(1, "haut"), item(2, "jean"), item(3, "robe"), item(4, "sac")];
  const h = [entree("a", new Date(2026, 9, 2), [1, 2, 99]), entree("b", new Date(2026, 9, 5), [1]), entree("c", new Date(2026, 8, 5), [3])];
  it("compte les tenues et les pièces DU DRESSING portées (pas une suggestion, pas une pièce seulement ajoutée)", () => {
    expect(chiffresPeriode(dressing, h, "mois", NOW)).toEqual({ tenues: 2, piecesUtilisees: 2, totalDressing: 4, part: 50 });
  });
  it("change avec la période", () => {
    expect(chiffresPeriode(dressing, h, "trois_mois", NOW)).toMatchObject({ tenues: 3, piecesUtilisees: 3, part: 75 });
  });
  it("dressing vide : part 0 sans division par zéro", () => {
    expect(chiffresPeriode([], h, "tout", NOW)).toMatchObject({ piecesUtilisees: 0, totalDressing: 0, part: 0 });
  });
});

describe("repartitionDressing", () => {
  it("une pièce, une catégorie : le total est la somme des parts", () => {
    const items = [item(1, "haut"), item(2, "haut"), item(3, "jean"), item(4, "robe")];
    const r = repartitionDressing(items);
    expect(r.reduce((a, l) => a + l.nb, 0)).toBe(items.length);
    expect(r[0]).toMatchObject({ cat: "haut", nb: 2, pct: 50 });
  });
  it("trois parts égales font 100 %, pas 99", () => {
    const r = repartitionDressing([item(1, "haut"), item(2, "jean"), item(3, "robe")]);
    expect(r.reduce((a, l) => a + l.pct, 0)).toBe(100);
  });
  it("une catégorie hors taxonomie est rangée dans « Autres », jamais perdue", () => {
    const r = repartitionDressing([item(1, "haut"), item(2, "inconnue")]);
    expect(r.map((l) => l.cat)).toEqual(["haut", "autre"]);
    expect(r.find((l) => l.cat === "autre")?.libelle).toBe("Autres");
  });
  it("ordre déterministe à égalité : celui de la taxonomie", () => {
    expect(repartitionDressing([item(1, "robe"), item(2, "haut")]).map((l) => l.cat)).toEqual(["haut", "robe"]);
  });
  it("dressing vide : aucune ligne", () => {
    expect(repartitionDressing([])).toEqual([]);
  });
});

describe("la part choisie dans l'anneau (15/10/2026) — mêmes données que l'arc et la légende", () => {
  // 19 pièces dont 5 hauts : l'exemple du brief (« 5 pièces · 26 % du dressing »).
  const items = [
    ...[1, 2, 3, 4, 5].map((i) => item(i, "haut")),
    ...Array.from({ length: 14 }, (_, k) => item(10 + k, k % 2 ? "jean" : "robe")),
  ];
  const parts = repartitionDressing(items);
  const hauts = parts.find((p) => p.cat === "haut")!;
  it("titre pluriel de la taxonomie, nombre et pourcentage de la part", () => {
    expect(detailPartDressing(hauts)).toEqual({ titre: "Hauts", sousTitre: "5 pièces · 26 % du dressing" });
  });
  it("une seule pièce s'accorde au singulier", () => {
    const [seule] = repartitionDressing([item(1, "veste")]);
    expect(detailPartDressing(seule)).toEqual({ titre: "Vestes & blazers", sousTitre: "1 pièce · 100 % du dressing" });
  });
  it("le filtre du Dressing est la catégorie exacte, avec le retour au Journal", () => {
    expect(filtrePourPart(hauts)).toEqual({ libelle: "Hauts", categories: ["haut"], retour: "journal" });
  });
  it("« Autres » n'a pas de filtre : l'action n'est pas proposée", () => {
    const autre = repartitionDressing([item(1, "inconnue")])[0];
    expect(detailPartDressing(autre).titre).toBe("Autres");
    expect(filtrePourPart(autre)).toBeNull();
  });
});

describe("peutEtreDiteJamaisPortee — « À sortir du placard » n'affirme que ce que les données permettent", () => {
  const J = 86400000;
  const base = { id: 1, cat: "haut", name: "p", hex: "#000" } as unknown as Item;
  it("une pièce importée il y a 5 jours n'est pas « oubliée »", () => {
    expect(peutEtreDiteJamaisPortee({ ...base, worn: null, createdAt: NOW.getTime() - 5 * J }, NOW.getTime())).toBe(false);
  });
  it("après 30 jours sans port, elle peut l'être", () => {
    expect(peutEtreDiteJamaisPortee({ ...base, worn: null, createdAt: NOW.getTime() - 40 * J }, NOW.getTime())).toBe(true);
  });
  it("une pièce marquée portée (Item.worn) n'est pas « jamais portée », même sans entrée d'historique", () => {
    expect(peutEtreDiteJamaisPortee({ ...base, worn: 12, createdAt: NOW.getTime() - 90 * J }, NOW.getTime())).toBe(false);
  });
  it("sans date d'ajout, on ne sait pas qu'elle est récente : admise", () => {
    expect(peutEtreDiteJamaisPortee({ ...base, worn: null } as Item, NOW.getTime())).toBe(true);
  });
});
