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

/*
 * LA PLANCHE DU LOOK — les heros « Look du jour » (accueil), « Tenue du jour »
 * et « Tenue planifiée » (30/09/2026, brief « Refonte du hero Look du jour » :
 * « Voici la silhouette que Capsela a imaginée pour moi aujourd'hui »).
 *
 * Une autre hiérarchie que composerTenue (détail d'un look), décidée par ce
 * brief pour ces trois heros seulement — ARBITRAGE ÉDITORIAL, qui ne vaut pas
 * pour le détail d'un look sans nouvelle décision :
 *   1. la pièce HÉRO : la robe ou la combinaison ; sinon le haut, et d'abord
 *      celui que l'utilisatrice a photographié porté — c'est une pièce de son
 *      dressing, le point d'ancrage de la tenue ;
 *   2. la SURCOUCHE (veste, blazer, manteau ; sinon un second haut, gilet ou
 *      pull porté par-dessus) : derrière, plus grande que le sac ou les
 *      chaussures, jamais au point d'écraser le héro ;
 *   3. le BAS, posé devant, à cheval sur le héro : les deux se lisent comme
 *      une silhouette ;
 *   4. les chaussures, 5. le sac et les petits accessoires, en finition.
 *
 * Des emplacements RECTANGULAIRES (les vêtements ne sont pas carrés), qui se
 * chevauchent légèrement là où la planche d'un styliste le ferait : le bas
 * sur le bord du héro, les chaussures au pied de la silhouette, le sac contre
 * le bas. L'ordre d'empilement suit la profondeur (surcouche derrière,
 * accessoires devant). Seules les pièces présentes sont posées, puis la
 * planche est recadrée sur elles : aucun emplacement vide.
 */

export type RolePlanche = "hero" | "dessus" | "bas" | "chaussures" | "sac" | "petit";

export interface EmplacementPlanche {
  /** Bord gauche, bord haut, largeur et hauteur, en % de la largeur de la planche. */
  x: number;
  y: number;
  l: number;
  h: number;
}

interface GabaritPlanche {
  hero: EmplacementPlanche;
  dessus?: EmplacementPlanche;
  bas?: EmplacementPlanche;
  chaussures: EmplacementPlanche;
  sac: EmplacementPlanche;
  petits: EmplacementPlanche[];
}

/** Les gabarits, par silhouette. Exposés pour les tests (hiérarchie, chevauchements bornés). */
export const GABARITS_PLANCHE: Record<"haut" | "hautDessus" | "hautManteau" | "robe" | "robeDessus", GabaritPlanche> = {
  // Haut + bas (+ chaussures, sac) : le héro à gauche, le bas à droite et plus bas.
  haut: {
    hero: { x: 0, y: 0, l: 50, h: 66 },
    bas: { x: 45, y: 12, l: 36, h: 58 },
    chaussures: { x: 10, y: 60, l: 34, h: 24 },
    sac: { x: 64, y: 58, l: 28, h: 26 },
    petits: [
      { x: 83, y: 4, l: 16, h: 16 },
      { x: 84, y: 24, l: 14, h: 14 },
    ],
  },
  // Haut + veste / blazer + bas : la veste derrière à droite, le bas devant, entre les deux.
  hautDessus: {
    hero: { x: 0, y: 6, l: 46, h: 62 },
    dessus: { x: 54, y: 0, l: 44, h: 60 },
    bas: { x: 41, y: 20, l: 30, h: 52 },
    chaussures: { x: 8, y: 64, l: 34, h: 24 },
    sac: { x: 64, y: 58, l: 28, h: 26 },
    petits: [
      { x: 88, y: 62, l: 12, h: 12 },
      { x: 44, y: 74, l: 12, h: 12 },
    ],
  },
  // Même silhouette, manteau : plus haut que la veste, jamais plus grand que le héro.
  hautManteau: {
    hero: { x: 0, y: 6, l: 48, h: 64 },
    dessus: { x: 52, y: 0, l: 46, h: 64 },
    bas: { x: 43, y: 22, l: 28, h: 50 },
    chaussures: { x: 8, y: 64, l: 34, h: 24 },
    sac: { x: 62, y: 62, l: 28, h: 26 },
    petits: [
      { x: 88, y: 70, l: 12, h: 12 },
      { x: 44, y: 76, l: 12, h: 12 },
    ],
  },
  // Robe seule : la robe au centre-gauche, sac et chaussures à sa droite.
  robe: {
    hero: { x: 14, y: 0, l: 44, h: 80 },
    chaussures: { x: 54, y: 56, l: 34, h: 24 },
    sac: { x: 58, y: 22, l: 28, h: 26 },
    petits: [
      { x: 0, y: 10, l: 16, h: 16 },
      { x: 2, y: 30, l: 14, h: 14 },
    ],
  },
  // Robe + veste ou manteau : la surcouche derrière, à droite.
  robeDessus: {
    hero: { x: 0, y: 0, l: 44, h: 80 },
    dessus: { x: 44, y: 2, l: 46, h: 60 },
    chaussures: { x: 34, y: 62, l: 34, h: 24 },
    sac: { x: 68, y: 56, l: 28, h: 26 },
    petits: [
      { x: 88, y: 4, l: 12, h: 12 },
      { x: 90, y: 20, l: 10, h: 10 },
    ],
  },
};

/** Profondeur : ce qui est derrière d'abord. */
export const PROFONDEUR_PLANCHE: Record<RolePlanche, number> = { dessus: 1, hero: 2, bas: 3, petit: 4, chaussures: 5, sac: 5 };

const HAUTS: CategoryKey[] = ["haut", "pull"];
const BAS: CategoryKey[] = ["pantalon", "jean", "jupe", "short"];
const ROBES: CategoryKey[] = ["robe", "combinaison"];
const DESSUS: CategoryKey[] = ["veste", "manteau"];

/** Agrandissement maximal au recadrage (même borne que composerTenue). */
const AGRANDISSEMENT_MAX_PLANCHE = 1.15;

/**
 * Place les pièces d'une tenue sur la planche. `photo` dit si la pièce a une
 * photo de l'utilisatrice (photoUrl) : parmi les hauts, celui-là devient le
 * héro. Rend les pièces dans l'ordre d'empilement, et la hauteur de la planche
 * en % de sa largeur.
 */
export function composerPlanche<T extends Pick<Item, "id" | "cat"> & { photoUrl?: string | null }>(
  items: T[]
): { pieces: { item: T; role: RolePlanche; case: EmplacementPlanche; aligne: { x: Calage; y: Calage } }[]; hauteur: number } {
  const reste = [...items];
  const prendre = (pred: (it: T) => boolean) => {
    const i = reste.findIndex(pred);
    return i < 0 ? undefined : reste.splice(i, 1)[0];
  };
  const robe = prendre((it) => ROBES.includes(it.cat));
  const hero =
    robe ??
    prendre((it) => HAUTS.includes(it.cat) && Boolean(it.photoUrl)) ??
    prendre((it) => it.cat === "haut") ??
    prendre((it) => it.cat === "pull");
  const dessus = prendre((it) => DESSUS.includes(it.cat)) ?? (hero ? prendre((it) => HAUTS.includes(it.cat)) : undefined);
  const bas = robe ? undefined : prendre((it) => BAS.includes(it.cat));
  // Sans haut ni robe (cas limite), la première pièce principale restante tient le rôle de héro.
  const heroFinal = hero ?? bas ?? dessus;
  if (!heroFinal) return { pieces: [], hauteur: 0 };
  const basFinal = heroFinal === bas ? undefined : bas;
  const dessusFinal = heroFinal === dessus ? undefined : dessus;

  const gabarit =
    robe || !basFinal
      ? GABARITS_PLANCHE[dessusFinal ? "robeDessus" : "robe"]
      : dessusFinal
        ? GABARITS_PLANCHE[dessusFinal.cat === "manteau" ? "hautManteau" : "hautDessus"]
        : GABARITS_PLANCHE.haut;

  const libres = [...gabarit.petits];
  const poses: { item: T; role: RolePlanche; case: EmplacementPlanche }[] = [];
  const poser = (item: T | undefined, role: RolePlanche, c: EmplacementPlanche | undefined) => {
    if (item && c) poses.push({ item, role, case: c });
  };
  poser(heroFinal, "hero", gabarit.hero);
  poser(dessusFinal, "dessus", gabarit.dessus);
  poser(basFinal, "bas", gabarit.bas ?? libres.shift());
  poser(prendre((it) => it.cat === "chaussures"), "chaussures", gabarit.chaussures);
  poser(prendre((it) => it.cat === "sac"), "sac", gabarit.sac);
  // Le reste — bijoux, accessoires, pièces en surnombre — sur les emplacements de finition libres.
  reste.forEach((it) => poser(it, "petit", libres.shift()));

  const minX = Math.min(...poses.map((p) => p.case.x));
  const maxX = Math.max(...poses.map((p) => p.case.x + p.case.l));
  const minY = Math.min(...poses.map((p) => p.case.y));
  const maxY = Math.max(...poses.map((p) => p.case.y + p.case.h));
  const k = Math.min(AGRANDISSEMENT_MAX_PLANCHE, 100 / (maxX - minX));
  const decalage = (100 - (maxX - minX) * k) / 2;
  const hauteur = (maxY - minY) * k;
  const calage = (centre: number, milieu: number, etendue: number): Calage =>
    centre < milieu - etendue * 0.08 ? "fin" : centre > milieu + etendue * 0.08 ? "debut" : "centre";

  return {
    pieces: poses
      .map(({ item, role, case: c }) => {
        const r = { x: decalage + (c.x - minX) * k, y: (c.y - minY) * k, l: c.l * k, h: c.h * k };
        return { item, role, case: r, aligne: { x: calage(r.x + r.l / 2, 50, 100), y: calage(r.y + r.h / 2, hauteur / 2, hauteur) } };
      })
      .sort((a, b) => PROFONDEUR_PLANCHE[a.role] - PROFONDEUR_PLANCHE[b.role]),
    hauteur,
  };
}
