import { describe, expect, it } from "vitest";
import { computeDefaultCapsule } from "../capsule";
import type { CatalogItem } from "../catalog";
import { EMPTY_PROFILE, type Profile } from "../profile";
import { ajouterCouverture, chaussuresDeRandonnee, estBaignade, estPieceDeValise, piecesDeBaignade, piecesPourLaSituation, poolDeBaignade, poolDeRandonnee } from "../piecesDeValise";
import { generateurMoteur, type SituationValise } from "../valise";
import { at, item } from "./fixtures";

/** LES PIÈCES RÉSERVÉES À LA VALISE (06/11/2026) : plage, piscine, spa. */
const profil = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, gender: "femme", ...over });
const maillot = (id: number, style: string, genre = "femme") =>
  item({ id, category: "combinaisons", name: `Maillot ${style}`, sous_type: "Maillot de bain", styles: style, genre, saison_capsule: "Printemps, Été, Automne, Hiver", occasions: "quotidien,cocooning", niveau_formalite: "decontracte", role_piece: "piece_unique", couleur_dominante: "Noir" });
const surchemise = (id: number, style: string) =>
  item({ id, category: "hauts", name: `Surchemise ${style}`, sous_type: "Surchemise de plage", styles: style, genre: "femme", saison_capsule: "Printemps, Été", occasions: "quotidien", niveau_formalite: "decontracte", role_piece: "calque", couleur_dominante: "Blanc", manches: "longues" });
const plage = (sousIds = ["plage"]): SituationValise => ({ occasion: "quotidien", meteo: at(28, "Printemps / Été"), jours: ["2026-07-10"], contrainte: "chaleur", sousIds });

describe("pièces réservées à la valise", () => {
  it("reconnues par leur type ; la baignade par l'activité", () => {
    expect(estPieceDeValise(maillot(1, "Bohème"))).toBe(true);
    expect(estPieceDeValise(item({ id: 2, category: "hauts", name: "Chemise", sous_type: "Chemise" }))).toBe(false);
    expect(estBaignade({ sousIds: ["visites", "spa"] })).toBe(true);
    expect(estBaignade({ sousIds: ["visites"] })).toBe(false);
  });

  it("la pièce du style du profil d'abord, jamais l'autre genre", () => {
    const catalogue = [maillot(1, "Minimaliste"), maillot(2, "Bohème"), maillot(3, "Bohème", "homme"), surchemise(4, "Bohème"), surchemise(5, "Glamour")];
    expect(piecesDeBaignade(catalogue, profil({ styles: ["boheme"] }), []).map((p) => p.name)).toEqual(["Maillot Bohème", "Surchemise Bohème"]);
  });

  it("jamais dans une capsule", () => {
    const catalogue: CatalogItem[] = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    for (let k = 0; k < 40; k++) catalogue.push(item({ id: 100 + k, category: ["hauts", "pantalons", "chaussures", "accessoires"][k % 4], name: `Pièce ${k}`, couleur_dominante: "Noir", niveau_formalite: "decontracte", role_piece: "base", styles: "Bohème" }));
    const capsule = computeDefaultCapsule(profil({ styles: ["boheme"] }), at(28, "Printemps / Été"), [], "Été", catalogue);
    expect(capsule.some(estPieceDeValise)).toBe(false);
  });

  it("en baignade, la tenue de bain remplace les vêtements ; ailleurs rien ne change", () => {
    const pool = [maillot(1, "Bohème"), surchemise(2, "Bohème"), item({ id: 3, category: "shorts", name: "Short en jean" }), item({ id: 4, category: "chaussures", name: "Sandales", sous_type: "Sandales" })];
    expect(poolDeBaignade(pool, plage()).map((p) => p.name)).toEqual(["Maillot Bohème", "Surchemise Bohème", "Sandales"]);
    expect(poolDeBaignade(pool, { sousIds: ["visites"] })).toHaveLength(4);
  });

  it("la surchemise rejoint le maillot à la plage, jamais au spa", () => {
    const pool = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    const [m, s] = pool.map((p) => p.id);
    expect(ajouterCouverture([m], pool, plage())).toEqual([m, s]);
    expect(ajouterCouverture([m], pool, { sousIds: ["spa"] })).toEqual([m]);
  });

  it("le moteur compose un look de plage avec les pièces de la valise, même avec un dressing fourni", () => {
    const dressing = [
      item({ id: 10, category: "hauts", name: "T-shirt blanc", couleur_dominante: "Blanc", saison_capsule: "Printemps, Été", manches: "courtes" }),
      item({ id: 11, category: "shorts", name: "Short en jean", couleur_dominante: "Denim", saison_capsule: "Printemps, Été" }),
      item({ id: 12, category: "chaussures", name: "Sandales plates", sous_type: "Sandales", couleur_dominante: "Camel", saison_capsule: "Printemps, Été" }),
      item({ id: 13, category: "accessoires", name: "Cabas en paille", couleur_dominante: "Sable", saison_capsule: "Printemps, Été" }),
    ];
    const reservees = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    const t = generateurMoteur([], "femme", null, reservees)(dressing, plage());
    const noms = (t?.ids ?? []).map((id) => [...dressing, ...reservees].find((p) => p.id === id)?.name);
    expect(noms).toContain("Maillot Bohème");
    expect(noms).toContain("Surchemise Bohème");
    expect(noms).not.toContain("Short en jean");
  });
});

describe("pendant le séjour, jamais en tenue du jour (06/11/2026)", () => {
  it("le vivier de la tenue du jour écarte les pièces de baignade", async () => {
    const { piecesDeLaValisePourLeJour } = await import("../valiseDuJour");
    const pool = [maillot(1, "Bohème"), item({ id: 10, category: "hauts", name: "T-shirt" })];
    const v = { pieceIds: pool.map((p) => p.id) } as unknown as Parameters<typeof piecesDeLaValisePourLeJour>[0];
    expect(piecesDeLaValisePourLeJour(v, pool).map((p) => p.name)).toEqual(["T-shirt"]);
  });
});

describe("le look de vacances, tenue du jour le jour de son activité (06/11/2026)", () => {
  it("plage, piscine, spa et randonnée seulement", async () => {
    const { estActiviteDeVacances } = await import("../piecesDeValise");
    expect(["plage", "piscine", "spa", "randonnee"].every(estActiviteDeVacances)).toBe(true);
    expect(estActiviteDeVacances("visites")).toBe(false);
    expect(estActiviteDeVacances(null)).toBe(false);
  });
});

describe("chaussures de randonnée (06/11/2026) : une paire par genre, pour les seules journées de randonnée", () => {
  const rando = (id: number, genre: string) =>
    item({ id, category: "chaussures", name: `Rando ${genre}`, sous_type: "Chaussures de randonnée", genre, saison_capsule: "Printemps, Été, Automne, Hiver", occasions: "sport" });
  const catalogue: CatalogItem[] = [rando(1, "femme"), rando(2, "homme"), maillot(3, "Minimaliste")];

  it("réservées à la valise, chaussure de sport pour le moteur", () => {
    expect(estPieceDeValise(catalogue[0])).toBe(true);
    expect(catalogue[0].shoeType).toBe("Baskets");
  });
  it("la paire du genre du profil, jamais celle de l'autre", () => {
    expect(chaussuresDeRandonnee(catalogue, { gender: "femme" }).map((p) => p.name)).toEqual(["Rando femme"]);
    expect(chaussuresDeRandonnee(catalogue, { gender: "homme" }).map((p) => p.name)).toEqual(["Rando homme"]);
    expect(chaussuresDeRandonnee([rando(4, "unisexe")], { gender: "homme" }).map((p) => p.name)).toEqual(["Rando unisexe"]);
  });
  it("une situation reçoit ses pièces : la paire à la randonnée, le maillot à la plage", () => {
    const pieces = [catalogue[0], catalogue[2]];
    expect(piecesPourLaSituation(pieces, { sousIds: ["randonnee"] }).map((p) => p.name)).toEqual(["Rando femme"]);
    expect(piecesPourLaSituation(pieces, { sousIds: ["plage"] }).map((p) => p.name)).toEqual(["Maillot Minimaliste"]);
    expect(piecesPourLaSituation(pieces, { sousIds: ["visites"] })).toEqual([]);
  });
  it("à la randonnée, la paire de randonnée remplace les autres chaussures ; ailleurs, rien ne change", () => {
    const baskets = item({ id: 11, category: "chaussures", name: "Baskets", sous_type: "Baskets" });
    const haut = item({ id: 10, category: "hauts", name: "T-shirt", sous_type: "T-shirt" });
    const pool = [haut, baskets, catalogue[0]];
    expect(poolDeRandonnee(pool, { sousIds: ["randonnee"] }).map((p) => p.name)).toEqual(["T-shirt", "Rando femme"]);
    expect(poolDeRandonnee(pool, { sousIds: ["visites"] })).toEqual(pool);
  });
});
