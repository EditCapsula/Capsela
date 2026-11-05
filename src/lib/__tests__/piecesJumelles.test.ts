import { describe, expect, it } from "vitest";
import { STRATEGIE_AVANT_JUMELLES, STRATEGIE_PRODUCTION, computeDefaultCapsule, sontJumelles, representativeWeatherFor } from "../capsule";
import { EMPTY_PROFILE } from "../profile";
import type { CatalogItem } from "../catalog";
import type { Season } from "../types";

// SIGNALÉ LE 05/11/2026 : « dans cette capsule j'ai deux tee-shirts blancs » (T-shirt basique blanc, T-shirt coton col rond).
// La seule règle anti-doublon comparait les visuels ; deux photos différentes de la même pièce passaient.

const haut = (id: number, over: Partial<CatalogItem> = {}): CatalogItem =>
  ({
    id, name: `Haut ${id}`, cat: "haut", color: "Bleu", hex: "#556B8D", season: "Toutes saisons" as Season, worn: null, genre: "femme",
    subtype: "Chemise", manches: "longues", ...over,
  }) as CatalogItem;

const TEE_A = haut(1, { name: "T-shirt basique blanc", subtype: "T-shirt", color: "Blanc", manches: "courtes", estBasiqueCapsule: true });
const TEE_B = haut(2, { name: "T-shirt coton col rond", subtype: "T-shirt col rond", color: "Blanc", manches: "courtes", estBasiqueCapsule: true });
// Trente autres hauts, tous différents entre eux (sous-type × couleur) : aucun n'est jumeau d'un autre.
const COULEURS = ["Bleu", "Noir", "Rouge", "Vert", "Beige", "Gris"];
const SOUS_TYPES = ["Chemise", "Blouse", "Top", "Polo", "Débardeur"];
const AUTRES = Array.from({ length: 30 }, (_, i) => haut(100 + i, { color: COULEURS[i % 6], subtype: SOUS_TYPES[Math.floor(i / 6)] }));

const profil = { ...EMPTY_PROFILE, gender: "femme" as const };
const caps = (pool: CatalogItem[], strat = STRATEGIE_PRODUCTION) =>
  computeDefaultCapsule(profil, representativeWeatherFor("Automne"), [], "Automne", pool, strat);
const deux = (c: CatalogItem[]) => c.some((p) => p.id === TEE_A.id) && c.some((p) => p.id === TEE_B.id);

describe("sontJumelles", () => {
  it("rapproche « T-shirt » et « T-shirt col rond » blancs à manches courtes (ids 448 et 451)", () => {
    expect(sontJumelles(TEE_A, TEE_B)).toBe(true);
    expect(sontJumelles(TEE_A, { ...TEE_B, color: "blanc" })).toBe(true);
  });
  it("sépare deux précisions différentes d'un même sous-type", () => {
    expect(sontJumelles({ ...TEE_A, cat: "pull", subtype: "Pull col roulé" }, { ...TEE_A, cat: "pull", subtype: "Pull col rond" })).toBe(false);
    expect(sontJumelles({ ...TEE_A, cat: "robe", subtype: "Robe portefeuille" }, { ...TEE_A, cat: "robe", subtype: "Robe chemise" })).toBe(false);
  });
  it("sépare un autre sous-type, une autre couleur, un autre motif ou d'autres manches connues", () => {
    expect(sontJumelles(TEE_A, { ...TEE_B, subtype: "Chemise" })).toBe(false);
    expect(sontJumelles(TEE_A, { ...TEE_B, color: "Noir" })).toBe(false);
    expect(sontJumelles({ ...TEE_A, motif: "uni" } as CatalogItem, { ...TEE_B, motif: "rayures" } as CatalogItem)).toBe(false);
    expect(sontJumelles(TEE_A, { ...TEE_B, manches: "longues" })).toBe(false);
  });
  it("des manches ou un motif inconnus d'un côté ne séparent pas", () => {
    expect(sontJumelles(TEE_A, { ...TEE_B, manches: undefined })).toBe(true);
  });
  it("sans sous-type ou sans couleur : jamais jumelle", () => {
    expect(sontJumelles({ ...TEE_A, subtype: undefined }, TEE_B)).toBe(false);
    expect(sontJumelles({ ...TEE_A, color: "" }, { ...TEE_B, color: "" })).toBe(false);
  });
});

describe("pièces jumelles en capsule", () => {
  it("avant la règle, les deux t-shirts blancs entraient ensemble", () => {
    expect(deux(caps([TEE_A, TEE_B, ...AUTRES], STRATEGIE_AVANT_JUMELLES))).toBe(true);
  });
  it("la production n'en retient qu'un, et la capsule garde sa taille", () => {
    const avec = caps([TEE_A, TEE_B, ...AUTRES]);
    expect(deux(avec)).toBe(false);
    expect(avec.some((p) => p.id === TEE_A.id || p.id === TEE_B.id)).toBe(true);
    expect(avec.length).toBe(caps([TEE_A, TEE_B, ...AUTRES], STRATEGIE_AVANT_JUMELLES).length);
  });
  it("faute d'autre candidate, la jumelle entre quand même", () => {
    expect(deux(caps([TEE_A, TEE_B, ...AUTRES.slice(0, 2)]))).toBe(true);
  });
});
