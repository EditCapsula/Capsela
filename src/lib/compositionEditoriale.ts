import type { CategoryKey, Item } from "./types";

/*
 * COMPOSITION ÉDITORIALE D'UNE TENUE — le hero du détail d'un look
 * (27/09/2026, correctif « Hero du look » : « Voici une silhouette complète
 * imaginée par ton styliste », et non une grille de produits).
 *
 * Une pièce = un emplacement carré (les visuels du catalogue sont carrés ;
 * une photo du dressing s'y pose entière, à son ratio), placé selon sa
 * CATÉGORIE et selon les autres pièces présentes — jamais une position fixe
 * valable pour toutes les tenues. Coordonnées en % de la LARGEUR de la zone,
 * verticales comprises : un carré reste un carré, et la hauteur de la zone
 * est l'étendue réelle des pièces (`hauteur`), sans bande vide en bas.
 *
 * LA HIÉRARCHIE DE TAILLES est celle du brief, mesurée sur les côtés des
 * carrés : pièce principale 100 %, seconde pièce principale 85-90 %,
 * chaussures 55-65 %, sac 45-55 %, accessoires 35-45 %. Aucun emplacement
 * n'en recouvre un autre (vérifié par les tests, pour chaque configuration).
 *
 * LES CONFIGURATIONS se lisent sur les pièces principales, dans l'ordre
 * dessus (veste, manteau) → robe → hauts → bas :
 *   · une seule (robe) : au centre, chaussures et sac en bas ;
 *   · deux (manteau + robe, haut + bas) : la première en haut à gauche, la
 *     seconde à droite et plus bas — la diagonale d'une silhouette ;
 *   · trois (blazer + chemise + pantalon) : dessus et haut en partie haute,
 *     le bas vertical au centre ;
 *   · quatre (manteau + chemise + pull + jean) : la même logique resserrée.
 * Les pièces secondaires occupent les emplacements libres de chaque
 * configuration : chaussures en bas, sac en zone secondaire, accessoires en
 * marge. ARBITRAGE ÉDITORIAL : les emplacements eux-mêmes.
 */

export type RoleEditorial = "principale" | "chaussures" | "sac" | "petit";

export interface EmplacementEditorial {
  /** Bord gauche, bord haut et côté du carré, en % de la largeur de la zone. */
  x: number;
  y: number;
  cote: number;
}

type Case = EmplacementEditorial;

interface Configuration {
  principales: Case[];
  chaussures: Case;
  sac: Case;
  petits: Case[];
}

const CONFIGURATIONS: Record<1 | 2 | 3 | 4, Configuration> = {
  1: {
    principales: [{ x: 22, y: 2, cote: 56 }],
    chaussures: { x: 20, y: 64, cote: 34 },
    sac: { x: 60, y: 64, cote: 30 },
    petits: [
      { x: 79, y: 8, cote: 21 },
      { x: 0, y: 8, cote: 21 },
    ],
  },
  2: {
    principales: [
      { x: 2, y: 2, cote: 50 },
      { x: 54, y: 14, cote: 45 },
    ],
    chaussures: { x: 60, y: 66, cote: 30 },
    sac: { x: 26, y: 62, cote: 26 },
    petits: [
      { x: 3, y: 58, cote: 20 },
      { x: 4, y: 82, cote: 18 },
    ],
  },
  3: {
    principales: [
      { x: 2, y: 2, cote: 46 },
      { x: 54, y: 2, cote: 40 },
      { x: 30, y: 50, cote: 42 },
    ],
    chaussures: { x: 74, y: 74, cote: 26 },
    sac: { x: 4, y: 56, cote: 24 },
    petits: [
      { x: 76, y: 46, cote: 20 },
      { x: 6, y: 84, cote: 18 },
    ],
  },
  4: {
    principales: [
      { x: 2, y: 2, cote: 44 },
      { x: 56, y: 4, cote: 38 },
      { x: 10, y: 50, cote: 36 },
      { x: 52, y: 46, cote: 40 },
    ],
    chaussures: { x: 58, y: 89, cote: 26 },
    sac: { x: 16, y: 90, cote: 23 },
    petits: [
      { x: 40, y: 92, cote: 16 },
      { x: 84, y: 90, cote: 16 },
    ],
  },
};

const RANG_PRINCIPAL: Partial<Record<CategoryKey, number>> = {
  veste: 0,
  manteau: 0,
  robe: 1,
  combinaison: 1,
  haut: 2,
  pull: 2,
  pantalon: 3,
  jean: 3,
  jupe: 3,
  short: 3,
};

export function roleEditorial(cat: CategoryKey): RoleEditorial {
  if (RANG_PRINCIPAL[cat] != null) return "principale";
  if (cat === "chaussures") return "chaussures";
  if (cat === "sac") return "sac";
  return "petit";
}

/** Toutes les configurations — exposées pour les tests (aucun chevauchement, hiérarchie). */
export const CONFIGURATIONS_EDITORIALES = CONFIGURATIONS;

/**
 * Place chaque pièce. Au-delà des emplacements d'une configuration (quatre
 * principales, deux accessoires, une paire de chaussures, un sac), une pièce
 * reste dans la composition sur un emplacement d'accessoire libre ; une
 * tenue générée n'en a jamais autant.
 */
export function composerTenue<T extends Pick<Item, "id" | "cat">>(
  items: T[]
): { pieces: { item: T; case: EmplacementEditorial }[]; hauteur: number } {
  const principales = items
    .filter((it) => roleEditorial(it.cat) === "principale")
    .sort((a, b) => RANG_PRINCIPAL[a.cat]! - RANG_PRINCIPAL[b.cat]!);
  const n = Math.min(4, Math.max(1, principales.length)) as 1 | 2 | 3 | 4;
  const config = CONFIGURATIONS[n];
  const libres = [...config.petits];
  const pieces: { item: T; case: EmplacementEditorial }[] = [];
  const poser = (item: T, c: Case | undefined) => c && pieces.push({ item, case: c });

  principales.forEach((it, i) => poser(it, config.principales[i] ?? libres.shift()));
  const chaussures = items.filter((it) => it.cat === "chaussures");
  const sacs = items.filter((it) => it.cat === "sac");
  chaussures.forEach((it, i) => poser(it, i === 0 ? config.chaussures : libres.shift()));
  sacs.forEach((it, i) => poser(it, i === 0 ? config.sac : libres.shift()));
  items.filter((it) => roleEditorial(it.cat) === "petit").forEach((it) => poser(it, libres.shift()));

  const hauteur = Math.max(...pieces.map((p) => p.case.y + p.case.cote), 0);
  return { pieces, hauteur };
}
