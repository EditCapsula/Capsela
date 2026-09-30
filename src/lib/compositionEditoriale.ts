import { CAT_GENDER } from "./attributes";
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
 *      une silhouette — d'où des emplacements de surface presque égale
 *      (30/09/2026 : avec le haut deux fois plus grand, le bas était écrasé) ;
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

/**
 * Une annotation manuscrite : sa boîte (mêmes unités que les emplacements) et
 * le point visé par sa flèche, en fraction de l'emplacement de la pièce.
 */
interface NoteGabarit {
  boite: EmplacementPlanche;
  cible: [number, number];
}

interface GabaritPlanche {
  hero: EmplacementPlanche;
  dessus?: EmplacementPlanche;
  bas?: EmplacementPlanche;
  chaussures: EmplacementPlanche;
  sac: EmplacementPlanche;
  petits: EmplacementPlanche[];
  /**
   * Annotations « Ton haut », « Ta veste »… (30/09/2026, carte de l'accueil).
   * Dans les marges de chaque silhouette, jamais sur une pièce (vérifié par
   * les tests). Quatre au plus : avec une surcouche, le bas n'est pas annoté —
   * sa place, entre le héro et la veste, est prise par les vêtements.
   */
  notes: Partial<Record<RolePlanche, NoteGabarit>>;
}

/** Les gabarits, par silhouette. Exposés pour les tests (hiérarchie, chevauchements bornés). */
export const GABARITS_PLANCHE: Record<"haut" | "hautDessus" | "hautManteau" | "robe" | "robeDessus", GabaritPlanche> = {
  // Haut + bas (+ chaussures, sac) : le héro à gauche, le bas à droite et plus bas.
  // Emplacements de surface presque égale (30/09/2026, signalé : « le haut est
  // trop grand par rapport au bas ») : ils forment ensemble la silhouette ; le
  // héro reste le point focal par sa place, à gauche et en premier.
  haut: {
    hero: { x: 0, y: 4, l: 42, h: 58 },
    bas: { x: 38, y: 6, l: 38, h: 64 },
    chaussures: { x: 6, y: 60, l: 32, h: 22 },
    sac: { x: 62, y: 62, l: 26, h: 24 },
    petits: [
      { x: 80, y: 4, l: 16, h: 16 },
      { x: 82, y: 24, l: 14, h: 14 },
    ],
    notes: {
      hero: { boite: { x: 2, y: -6, l: 28, h: 8 }, cible: [0.3, 0.08] },
      bas: { boite: { x: 46, y: -4, l: 28, h: 8 }, cible: [0.45, 0.06] },
      chaussures: { boite: { x: 6, y: 84, l: 32, h: 8 }, cible: [0.5, 0.75] },
      sac: { boite: { x: 60, y: 88, l: 28, h: 8 }, cible: [0.45, 0.75] },
    },
  },
  // Haut + veste / blazer + bas : la veste derrière à droite, le bas devant, entre les deux.
  hautDessus: {
    hero: { x: 0, y: 8, l: 40, h: 56 },
    dessus: { x: 58, y: 0, l: 38, h: 54 },
    bas: { x: 36, y: 14, l: 34, h: 62 },
    chaussures: { x: 4, y: 62, l: 32, h: 22 },
    sac: { x: 62, y: 58, l: 26, h: 24 },
    petits: [
      { x: 86, y: 56, l: 12, h: 12 },
      { x: 40, y: 78, l: 10, h: 10 },
    ],
    notes: {
      hero: { boite: { x: 2, y: -4, l: 28, h: 8 }, cible: [0.3, 0.08] },
      dessus: { boite: { x: 64, y: -10, l: 28, h: 8 }, cible: [0.7, 0.08] },
      chaussures: { boite: { x: 4, y: 86, l: 32, h: 8 }, cible: [0.5, 0.75] },
      sac: { boite: { x: 60, y: 84, l: 28, h: 8 }, cible: [0.45, 0.75] },
    },
  },
  // Même silhouette, manteau : plus haut que la veste, jamais plus grand que le héro.
  hautManteau: {
    hero: { x: 0, y: 6, l: 42, h: 58 },
    dessus: { x: 56, y: 0, l: 40, h: 60 },
    bas: { x: 38, y: 16, l: 34, h: 62 },
    chaussures: { x: 4, y: 62, l: 32, h: 22 },
    sac: { x: 62, y: 64, l: 26, h: 24 },
    petits: [
      { x: 88, y: 66, l: 12, h: 12 },
      { x: 44, y: 80, l: 12, h: 12 },
    ],
    notes: {
      hero: { boite: { x: 2, y: -4, l: 28, h: 8 }, cible: [0.3, 0.08] },
      dessus: { boite: { x: 64, y: -10, l: 30, h: 8 }, cible: [0.7, 0.08] },
      chaussures: { boite: { x: 4, y: 86, l: 32, h: 8 }, cible: [0.5, 0.75] },
      sac: { boite: { x: 60, y: 90, l: 28, h: 8 }, cible: [0.45, 0.75] },
    },
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
    notes: {
      hero: { boite: { x: 16, y: -10, l: 28, h: 8 }, cible: [0.4, 0.08] },
      sac: { boite: { x: 60, y: 12, l: 28, h: 8 }, cible: [0.5, 0.25] },
      chaussures: { boite: { x: 56, y: 82, l: 32, h: 8 }, cible: [0.5, 0.75] },
    },
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
    notes: {
      hero: { boite: { x: 2, y: -10, l: 28, h: 8 }, cible: [0.4, 0.06] },
      dessus: { boite: { x: 50, y: -9, l: 28, h: 8 }, cible: [0.5, 0.08] },
      chaussures: { boite: { x: 32, y: 88, l: 32, h: 8 }, cible: [0.5, 0.75] },
      sac: { boite: { x: 68, y: 84, l: 28, h: 8 }, cible: [0.45, 0.75] },
    },
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
 * LES FORMES DE LA SILHOUETTE DE CHARGEMENT du « Look du jour » (30/09/2026,
 * brief « Optimisation du loading ») : une forme abstraite par pièce
 * structurante — héro, surcouche, bas, chaussures, sac —, posée par
 * composerPlanche aux MÊMES emplacements que les pièces du look final. Une
 * forme n'est pas une pièce : elle ne porte qu'une catégorie, jamais un nom ni
 * une image. Bijoux et accessoires n'en ont pas : petits et facultatifs, ils
 * ajouteraient du bruit à une silhouette qui doit rester calme.
 *
 * `photo` : la pièce a une photo du dressing (le haut photographié porté). Sa
 * forme est alors un cadre de photo, pas un vêtement dessiné : c'est une
 * photo qui va arriver à cet emplacement, et à peu près à ce format.
 */
export function formesSilhouette(
  pieces: { cat: CategoryKey; photoUrl?: string | null }[]
): { id: number; cat: CategoryKey; photo: boolean; photoUrl?: string | null }[] {
  // photoUrl est transmis à composerPlanche, qui en fait le héro parmi les hauts — comme dans le look final.
  return pieces
    .filter((p) => p.cat !== "bijou" && p.cat !== "accessoire")
    .map((p, id) => ({ id, cat: p.cat, photo: Boolean(p.photoUrl), photoUrl: p.photoUrl }));
}

/**
 * Place les pièces d'une tenue sur la planche. `photo` dit si la pièce a une
 * photo de l'utilisatrice (photoUrl) : parmi les hauts, celui-là devient le
 * héro. Rend les pièces dans l'ordre d'empilement, et la hauteur de la planche
 * en % de sa largeur.
 */
export interface NotePlanche<T> {
  item: T;
  role: RolePlanche;
  boite: EmplacementPlanche;
  /** La flèche : départ au bord de la boîte, arrivée sur la pièce, point de contrôle de la courbe. */
  fleche: { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number };
}

export function composerPlanche<T extends Pick<Item, "id" | "cat"> & { photoUrl?: string | null }>(
  items: T[],
  options: { annotations?: boolean } = {}
): {
  pieces: { item: T; role: RolePlanche; case: EmplacementPlanche; aligne: { x: Calage; y: Calage } }[];
  notes: NotePlanche<T>[];
  hauteur: number;
} {
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
  if (!heroFinal) return { pieces: [], notes: [], hauteur: 0 };
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

  // Les annotations des pièces posées : elles comptent dans le recadrage, les
  // pièces rétrécissent d'autant pour leur laisser la marge.
  const notesBrutes = options.annotations
    ? poses.flatMap((p) => {
        const n = gabarit.notes[p.role];
        return n ? [{ ...p, note: n }] : [];
      })
    : [];
  const boites = [...poses.map((p) => p.case), ...notesBrutes.map((n) => n.note.boite)];
  const minX = Math.min(...boites.map((c) => c.x));
  const maxX = Math.max(...boites.map((c) => c.x + c.l));
  const minY = Math.min(...boites.map((c) => c.y));
  const maxY = Math.max(...boites.map((c) => c.y + c.h));
  const k = Math.min(AGRANDISSEMENT_MAX_PLANCHE, 100 / (maxX - minX));
  const decalage = (100 - (maxX - minX) * k) / 2;
  const hauteur = (maxY - minY) * k;
  const calage = (centre: number, milieu: number, etendue: number): Calage =>
    centre < milieu - etendue * 0.08 ? "fin" : centre > milieu + etendue * 0.08 ? "debut" : "centre";
  const tx = (x: number) => decalage + (x - minX) * k;
  const ty = (y: number) => (y - minY) * k;

  const notes: NotePlanche<T>[] = notesBrutes.map(({ item, role, case: c, note }) => {
    const b = note.boite;
    const x2 = c.x + c.l * note.cible[0];
    const y2 = c.y + c.h * note.cible[1];
    // Départ au bord de la boîte tourné vers la pièce, un peu décalé du centre.
    const dessous = y2 > b.y + b.h;
    const x1 = b.x + b.l * (x2 > b.x + b.l / 2 ? 0.62 : 0.38);
    const y1 = dessous ? b.y + b.h + 0.5 : b.y - 0.5;
    // Courbe à la main : le contrôle s'écarte vers l'extérieur de la planche.
    const cx = (x1 + x2) / 2 + (x2 < 50 ? -5 : 5);
    const cy = (y1 + y2) / 2;
    return {
      item,
      role,
      boite: { x: tx(b.x), y: ty(b.y), l: b.l * k, h: b.h * k },
      fleche: { x1: tx(x1), y1: ty(y1), cx: tx(cx), cy: ty(cy), x2: tx(x2), y2: ty(y2) },
    };
  });

  return {
    notes,
    pieces: poses
      .map(({ item, role, case: c }) => {
        const r = { x: decalage + (c.x - minX) * k, y: (c.y - minY) * k, l: c.l * k, h: c.h * k };
        return { item, role, case: r, aligne: { x: calage(r.x + r.l / 2, 50, 100), y: calage(r.y + r.h / 2, hauteur / 2, hauteur) } };
      })
      .sort((a, b) => PROFONDEUR_PLANCHE[a.role] - PROFONDEUR_PLANCHE[b.role]),
    hauteur,
  };
}

/**
 * Le texte d'une annotation : « Ton haut », « Ta veste », « Tes chaussures »
 * pour une pièce du DRESSING ; « Le sac », « La jupe », « Les chaussures » pour
 * une suggestion de la capsule — une information vraie, lue sur la
 * provenance réelle, jamais un style d'écriture. Accord sur le genre de la
 * catégorie (CAT_GENDER, le même que pour les noms de pièces).
 */
const NOM_ANNOTATION: Partial<Record<CategoryKey, string>> = {
  haut: "haut",
  pull: "pull",
  pantalon: "pantalon",
  jean: "jean",
  jupe: "jupe",
  short: "short",
  robe: "robe",
  combinaison: "combinaison",
  veste: "veste",
  manteau: "manteau",
  chaussures: "chaussures",
  sac: "sac",
};

export function libelleAnnotation(cat: CategoryKey, duDressing: boolean): string | null {
  const nom = NOM_ANNOTATION[cat];
  if (!nom) return null;
  const g = CAT_GENDER[cat];
  const article = g.plural ? (duDressing ? "Tes" : "Les") : g.gender === "f" ? (duDressing ? "Ta" : "La") : duDressing ? "Ton" : "Le";
  return `${article} ${nom}`;
}
