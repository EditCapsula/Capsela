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
 *
 * L'UNITÉ (27/09/2026, demandé : « rapproche-les pour créer un esprit
 * d'unité »). Trois leviers, sans jamais faire se toucher deux pièces :
 *   · des emplacements resserrés (≈ 2 % de la largeur entre deux cases) ;
 *   · la composition RECADRÉE sur les pièces réellement posées : une pièce
 *     absente (pas de sac, pas d'accessoire) ne laisse plus un trou d'un
 *     côté — l'ensemble est recentré et agrandi pour occuper la largeur,
 *     au plus de 15 % et sans dépasser 1,12 fois la largeur en hauteur,
 *     pour ne jamais devenir trop vertical ;
 *   · chaque image calée VERS LE CENTRE de la composition dans sa case
 *     (`aligne`) : un visuel portrait posé dans un carré y laissait du vide
 *     sur ses deux côtés, désormais du seul côté extérieur.
 */

export type RoleEditorial = "principale" | "chaussures" | "sac" | "petit";

/** Où l'image se cale dans sa case : vers le centre de la composition. */
export type Calage = "debut" | "centre" | "fin";

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
    principales: [{ x: 22, y: 0, cote: 56 }],
    chaussures: { x: 16, y: 58, cote: 34 },
    sac: { x: 52, y: 58, cote: 30 },
    petits: [
      { x: 80, y: 6, cote: 20 },
      { x: 0, y: 6, cote: 20 },
    ],
  },
  2: {
    principales: [
      { x: 2, y: 0, cote: 50 },
      { x: 54, y: 10, cote: 45 },
    ],
    chaussures: { x: 56, y: 57, cote: 30 },
    sac: { x: 26, y: 52, cote: 26 },
    petits: [
      { x: 4, y: 52, cote: 20 },
      { x: 5, y: 74, cote: 18 },
    ],
  },
  3: {
    principales: [
      { x: 4, y: 0, cote: 46 },
      { x: 52, y: 2, cote: 40 },
      { x: 30, y: 48, cote: 42 },
    ],
    chaussures: { x: 74, y: 66, cote: 26 },
    sac: { x: 4, y: 52, cote: 24 },
    petits: [
      { x: 74, y: 44, cote: 20 },
      { x: 8, y: 78, cote: 18 },
    ],
  },
  4: {
    principales: [
      { x: 4, y: 0, cote: 42 },
      { x: 50, y: 2, cote: 36 },
      { x: 10, y: 44, cote: 34 },
      { x: 48, y: 40, cote: 38 },
    ],
    chaussures: { x: 52, y: 80, cote: 25 },
    sac: { x: 22, y: 80, cote: 22 },
    petits: [
      { x: 80, y: 80, cote: 16 },
      { x: 4, y: 80, cote: 16 },
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

/** Agrandissement maximal au recadrage : au-delà, une tenue courte deviendrait trop verticale. */
const AGRANDISSEMENT_MAX = 1.15;
/** Hauteur maximale de la composition, en % de sa largeur : le brief vise un ratio de 1/1 à 1/1,15. */
const HAUTEUR_MAX = 112;

/**
 * Place chaque pièce. Au-delà des emplacements d'une configuration (quatre
 * principales, deux accessoires, une paire de chaussures, un sac), une pièce
 * reste dans la composition sur un emplacement d'accessoire libre ; une
 * tenue générée n'en a jamais autant.
 */
export function composerTenue<T extends Pick<Item, "id" | "cat">>(
  items: T[]
): { pieces: { item: T; case: EmplacementEditorial; aligne: { x: Calage; y: Calage } }[]; hauteur: number } {
  const principales = items
    .filter((it) => roleEditorial(it.cat) === "principale")
    .sort((a, b) => RANG_PRINCIPAL[a.cat]! - RANG_PRINCIPAL[b.cat]!);
  const n = Math.min(4, Math.max(1, principales.length)) as 1 | 2 | 3 | 4;
  const config = CONFIGURATIONS[n];
  const libres = [...config.petits];
  const poses: { item: T; case: EmplacementEditorial }[] = [];
  const poser = (item: T, c: Case | undefined) => c && poses.push({ item, case: c });

  principales.forEach((it, i) => poser(it, config.principales[i] ?? libres.shift()));
  const chaussures = items.filter((it) => it.cat === "chaussures");
  const sacs = items.filter((it) => it.cat === "sac");
  chaussures.forEach((it, i) => poser(it, i === 0 ? config.chaussures : libres.shift()));
  sacs.forEach((it, i) => poser(it, i === 0 ? config.sac : libres.shift()));
  items.filter((it) => roleEditorial(it.cat) === "petit").forEach((it) => poser(it, libres.shift()));
  if (!poses.length) return { pieces: [], hauteur: 0 };

  // Recadrage sur les pièces posées : recentrées, agrandies dans la limite.
  const minX = Math.min(...poses.map((p) => p.case.x));
  const maxX = Math.max(...poses.map((p) => p.case.x + p.case.cote));
  const minY = Math.min(...poses.map((p) => p.case.y));
  const maxY = Math.max(...poses.map((p) => p.case.y + p.case.cote));
  const k = Math.min(AGRANDISSEMENT_MAX, 100 / (maxX - minX), Math.max(1, HAUTEUR_MAX / (maxY - minY)));
  const decalage = (100 - (maxX - minX) * k) / 2;
  const hauteur = (maxY - minY) * k;

  const calage = (centre: number, milieu: number, etendue: number): Calage =>
    centre < milieu - etendue * 0.08 ? "fin" : centre > milieu + etendue * 0.08 ? "debut" : "centre";
  const pieces = poses.map(({ item, case: c }) => {
    const r = { x: decalage + (c.x - minX) * k, y: (c.y - minY) * k, cote: c.cote * k };
    return {
      item,
      case: r,
      aligne: { x: calage(r.x + r.cote / 2, 50, 100), y: calage(r.y + r.cote / 2, hauteur / 2, hauteur) },
    };
  });
  return { pieces, hauteur };
}
