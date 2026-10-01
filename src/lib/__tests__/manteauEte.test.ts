import { describe, expect, it } from "vitest";
import { STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor } from "../capsule";
import { EMPTY_PROFILE } from "../profile";
import type { CatalogItem } from "../catalog";
import type { Season } from "../types";

// SIGNALÉ LE 01/10/2026 : « le manteau cape structuré apparaît dans une capsule
// été » (étiqueté Suggestion). Le filet ensure("manteau") puisait dans le
// catalogue non filtré par saison dès qu'aucun manteau de saison n'était
// retenu. Mesuré avant/après sur le catalogue réel par manteau-ete.audit.ts.

const manteau = (id: number, name: string, season: Season): CatalogItem => ({
  id, name, cat: "manteau", color: "Beige", hex: "#CBB38E", season, worn: null, genre: "femme",
} as CatalogItem);

// Le filtre saisonnier de la sélection principale ne s'applique qu'à partir de
// 16 pièces de saison (computeDefaultCapsule) : le vivier d'été en fournit assez
// pour que seul le filet de sécurité puisse faire revenir un manteau d'hiver.
const ETE: CatalogItem[] = Array.from({ length: 16 }, (_, i) => ({
  id: 100 + i, name: `Haut d'été ${i}`, cat: "haut", color: "Blanc", hex: "#F4F1EA", season: "Printemps / Été" as Season, worn: null, genre: "femme",
}) as CatalogItem);

const CAPE = manteau(1, "Manteau cape structuré", "Automne / Hiver");
const TRENCH = manteau(2, "Trench-coat", "Toutes saisons");
const profil = { ...EMPTY_PROFILE, gender: "femme" as const };
const caps = (pool: CatalogItem[], saison: "Été" | "Automne" | "Printemps", strat = STRATEGIE_PRODUCTION) =>
  computeDefaultCapsule(profil, representativeWeatherFor(saison), [], saison, pool, strat);

describe("manteau d'automne-hiver en capsule Été", () => {
  it("n'est pas ressorti par le filet de sécurité quand c'est le seul manteau", () => {
    expect(caps([...ETE, CAPE], "Été").some((p) => p.id === CAPE.id)).toBe(false);
  });

  it("le levier « admis » reproduit le comportement d'avant", () => {
    expect(caps([...ETE, CAPE], "Été", { ...STRATEGIE_PRODUCTION, manteauHorsSaisonEte: "admis" }).some((p) => p.id === CAPE.id)).toBe(true);
  });

  it("laisse passer un manteau « Toutes saisons »", () => {
    expect(caps([...ETE, CAPE, TRENCH], "Été").some((p) => p.id === TRENCH.id)).toBe(true);
    expect(caps([...ETE, CAPE, TRENCH], "Été").some((p) => p.id === CAPE.id)).toBe(false);
  });

  it("ne change rien en Automne ni au Printemps", () => {
    expect(caps([...ETE, CAPE], "Automne").some((p) => p.id === CAPE.id)).toBe(true);
    expect(caps([...ETE, CAPE], "Printemps").some((p) => p.id === CAPE.id)).toBe(true);
  });
});
