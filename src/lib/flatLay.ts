import type { CategoryKey } from "./types";

/**
 * LE FLAT LAY ÉDITORIAL (08/10/2026, brief « Optimisation du hero Tenue du jour ») — la composition des pièces d'un look,
 * pure et déterministe : mêmes pièces + même graine = même planche, à chaque rendu. La graine (l'identité du look) ne fait
 * varier que ce que le brief autorise, dans des plages bornées : le gabarit (ou son miroir), la taille, l'inclinaison et un
 * léger décalage de chaque pièce. Jamais de grille, jamais deux looks identiques.
 *
 * ESPACE : la zone fait 100 de large sur `hauteurZone` de haut (100 = la largeur de la zone). Toutes les tailles sont des
 * parts de LARGEUR DE ZONE, mesurées sur la partie visible de la pièce (les marges transparentes du catalogue sont retirées
 * à l'affichage, cf. catalogMarges.ts).
 *
 * Les tailles et positions viennent des gabarits de CONTEXTES (hero-home : la maquette validée du 08/10/2026 ; look-detail : l'écran
 * Tenue du jour), pas de plages libres. Un seul moteur : le contexte ne change que ses paramètres.
 */
/** Où la planche s'affiche : chaque contexte a sa zone, sa marge et son gabarit (cf. CONTEXTES). */
export type ContexteFlatLay = "hero-home" | "look-detail" | "capsule" | "dressing" | "packing";

/**
 * `couche` (calibrage du 08/10/2026, « regroupement stylistique ») : la seconde pièce du haut d'une tenue — un t-shirt sous un
 * pull, une chemise sous un blazer, un débardeur sous un cardigan. Elle se pose contre la pièce qu'elle double, jamais ailleurs.
 */
export type RoleFlatLay = "hero" | "secondaire" | "couche" | "bas" | "chaussures" | "sac" | "accessoire";

export interface PieceFlatLay {
  id: number;
  cat: CategoryKey;
  /** Largeur / hauteur de la partie visible de l'image (1 si inconnue) — celle de l'objectBounds, ou son repli. */
  ratio: number;
  /** Facultatifs (08/10/2026) : le catalogue actuel ne les porte pas, des valeurs par défaut s'appliquent. */
  /** Multiplie la taille calculée (défaut 1). */
  visualScale?: number;
  /** Inclinaison préférée, en degrés, bornée par la plage du rôle (défaut : celle du gabarit). */
  preferredRotation?: number;
  /** false : la pièce n'entre pas dans un flat lay (défaut true). */
  flatLayCompatible?: boolean;
  /** Sous-type d'un accessoire (« Collants »…), quand le catalogue le porte. */
  accessoireType?: string;
  /**
   * true : le visuel de la pièce est une photo brute (non détourée) de l'utilisatrice — un rectangle avec son fond, parfois une personne
   * qui porte la pièce. Le moteur ne sait pas le dire : il le sait seulement par le type d'image (resolveItemImage → « photo »).
   * Sur un contexte qui limite le nombre de pièces (hero-home), ces pièces passent après celles dont le visuel est un produit isolé.
   */
  photoBrute?: boolean;
}

export interface PlacementFlatLay {
  id: number;
  cat: CategoryKey;
  role: RoleFlatLay;
  /** L'échelle visuelle appliquée à cause de la catégorie (cf. PART_VISUELLE) — 1 pour la pièce de référence du rôle. */
  visualScale: number;
  /** Centre de la pièce, en unités de la zone (100 de large). */
  x: number;
  y: number;
  /** Largeur et hauteur de la partie visible, en unités de la zone. */
  l: number;
  h: number;
  /** Degrés. */
  angle: number;
  z: number;
  /** Une couche porte l'id de la pièce qu'elle double (elle forme un groupe avec elle). */
  groupeAvec?: number;
}

const ROBES: CategoryKey[] = ["robe", "combinaison"];
const DESSUS: CategoryKey[] = ["manteau", "veste"];
const BAS: CategoryKey[] = ["pantalon", "jean", "jupe", "short"];
const HAUTS: CategoryKey[] = ["haut", "pull"];

/**
 * La pièce héro : robe, puis manteau, veste / blazer, ensemble (combinaison), pantalon / jupe, top — l'ordre du brief.
 * Une robe et une combinaison comptent pour une robe (l'ensemble d'une pièce).
 */
export function attribuerRoles<T extends { id: number; cat: CategoryKey }>(pieces: T[]): { piece: T; role: RoleFlatLay }[] {
  const reste = [...pieces];
  const prendre = (cats: CategoryKey[]) => {
    const i = reste.findIndex((p) => cats.includes(p.cat));
    return i < 0 ? undefined : reste.splice(i, 1)[0];
  };
  const robe = prendre(ROBES);
  const manteau = robe ? undefined : prendre(["manteau"]);
  const veste = robe || manteau ? undefined : prendre(["veste"]);
  const bas = robe ? undefined : prendre(BAS);
  // Le haut du second plan est la couche EXTÉRIEURE : un pull ou un cardigan avant un t-shirt, qui devient sa couche.
  const haut = robe ? undefined : (prendre(["pull"]) ?? prendre(["haut"]));
  const dessusRestant = prendre(DESSUS);
  const hero = robe ?? manteau ?? veste ?? bas ?? haut ?? dessusRestant;
  const sortie: { piece: T; role: RoleFlatLay }[] = [];
  if (!hero) return sortie;
  sortie.push({ piece: hero, role: "hero" });
  // Le second plan : le haut sous une veste ou un manteau, la surcouche d'une robe, sinon le haut d'un bas héro.
  const second = [haut, dessusRestant, veste, manteau].find((p) => p && p !== hero);
  if (second) sortie.push({ piece: second, role: "secondaire" });
  if (bas && bas !== hero) sortie.push({ piece: bas, role: "bas" });
  const chaussures = prendre(["chaussures"]);
  if (chaussures) sortie.push({ piece: chaussures, role: "chaussures" });
  const sac = prendre(["sac"]);
  if (sac) sortie.push({ piece: sac, role: "sac" });
  // Un second haut (t-shirt, chemise, débardeur) est la COUCHE du premier : il se pose contre lui. Une seule couche ; sous une robe,
  // un haut de plus reste un surnombre.
  if (!robe) {
    const couche = reste.find((p) => HAUTS.includes(p.cat));
    if (couche) sortie.push({ piece: couche, role: "couche" });
    // Une seconde veste ou un second manteau (09/10/2026, « la veste oversize est trop petite » : un manteau héro, un bomber en
    // surnombre) n'est pas un accessoire : posé comme tel, dans un coin de 16 unités, il rapetissait. Il prend la place de la couche
    // quand le haut n'en a pas — une pièce qu'on enfile par-dessus le haut, posée contre lui.
    else {
      const dejaPose = new Set(sortie.map((x) => x.piece));
      const dessusEnPlus = [dessusRestant, ...reste.filter((p) => DESSUS.includes(p.cat))].find((p) => p && !dejaPose.has(p));
      if (dessusEnPlus) sortie.push({ piece: dessusEnPlus, role: "couche" });
    }
  }
  // Tout le reste — bijoux, accessoires, pièces en surnombre (une seconde veste, un second bas…) — se pose en accessoire.
  const casees = new Set(sortie.map((x) => x.piece));
  for (const p of pieces) if (!casees.has(p)) sortie.push({ piece: p, role: "accessoire" });
  return sortie;
}

/**
 * LA TAILLE VISUELLE PAR CATÉGORIE (08/10/2026, « standard image flat lay ») : la part d'un canevas carré que doit occuper chaque
 * type de pièce pour que toutes semblent photographiées ensemble — milieu des plages du standard (T-shirt, chemise, pull
 * 75–80 ; blazer, veste 80–85 ; manteau, robe 85–90 ; pantalon 80–90 ; jupe 70–80 ; short 65–75 ; sac, chaussures 65–75 ;
 * accessoire 50–75). Le moteur ne dépend pas du canevas des fichiers : il lit la boîte RÉELLE de l'objet (objectBounds) et
 * en déduit sa taille ; ce tableau ne sert qu'à RAPPORTER la taille d'une pièce à celle de la pièce de référence de son rôle
 * (visualScale) — une jupe en bas est un peu plus petite qu'un pantalon, un manteau un peu plus grand qu'un blazer.
 */
export const PART_VISUELLE: Record<CategoryKey, number> = {
  haut: 77.5,
  pull: 77.5,
  veste: 82.5,
  manteau: 87.5,
  robe: 87.5,
  combinaison: 87.5,
  pantalon: 85,
  jean: 85,
  jupe: 75,
  short: 70,
  sac: 70,
  chaussures: 70,
  bijou: 62.5,
  accessoire: 62.5,
};
/** La part visuelle de la pièce de référence de chaque rôle (celle sur laquelle les largeurs de REF ont été réglées). */
const PART_REF: Record<RoleFlatLay, number> = { hero: 82.5, secondaire: 77.5, couche: 77.5, bas: 85, chaussures: 70, sac: 70, accessoire: 62.5 };

/** L'échelle visuelle d'une pièce dans son rôle : bornée, pour qu'une catégorie rare ne déséquilibre jamais la planche. */
export function echelleVisuelle(role: RoleFlatLay, cat: CategoryKey): number {
  return Math.min(1.12, Math.max(0.82, (PART_VISUELLE[cat] ?? PART_REF[role]) / PART_REF[role]));
}

/**
 * LES CONTEXTES (08/10/2026, « système flat lay ») : une MÊME image de pièce sert partout ; seul le moteur s'adapte — taille,
 * position, rotation, profondeur, composition — au contexte. `hauteur` est celle de la zone en unités de largeur (100).
 *
 *   hero-home    ≈ 180 × 250 px sur 390 px : compact, plutôt horizontal ; la maquette validée (REF), angles de la maquette.
 *   look-detail  ≈ 300 × 390 px : la tenue au centre de l'écran Tenue du jour ; la pièce héro bien plus grande ; angles du
 *                brief (héro ±4°, second plan ±5°, chaussures ±8°, sac ±6°, accessoires ±10°). Une robe est centrée,
 *                sac et chaussures dessous.
 *   capsule, dressing, packing : carte carrée, gabarit du hero de l'accueil ; branchés au moteur sans écran concerné pour
 *                l'instant (le périmètre de cette tâche est la présentation, pas ces écrans).
 */
interface Ref {
  x: number;
  y: number;
  l: number;
  angle: number;
}
interface ConfigContexte {
  hauteur: number;
  marge: number;
  /** Réserve en haut de la zone (unités de zone), défaut = `marge` : l'écran y pose du texte par-dessus (badges de la Tenue du jour). */
  margeHaute?: number;
  /** Combien d'accessoires au plus, quand la tenue compte moins de 6 pièces / 6 et plus. */
  maxAccessoires: [number, number];
  /** Écart maximal (unités de zone) entre un accessoire et la pièce la plus proche : au-delà il est isolé. */
  ecartAccessoireMax: number;
  refs: Record<RoleFlatLay, Ref>;
  /** Gabarit d'une robe ou d'une combinaison héro (sinon `refs`). */
  refsRobe?: Partial<Record<RoleFlatLay, Ref>>;
  /** Gabarit d'une veste ou d'un manteau héro (sinon `refs`) — hero-home : la composition ciblée du 08/10/2026. */
  refsDessus?: Partial<Record<RoleFlatLay, Ref>>;
  /** true : la couche (t-shirt sous un pull…) reste dans la tenue mais n'est pas posée dans cette planche (hero-home). */
  masquerCouche?: boolean;
  /** Sous-types d'accessoire qui restent dans la tenue mais ne sont pas posées dans cette planche (hero-home : les collants, dont le visuel à plat ne se lit pas — 08/10/2026). */
  accessoiresMasques?: string[];
  /** true : jamais de planche en miroir (hero-home : « haut en haut à gauche, pantalon à droite » est une règle, pas un tirage). */
  sansMiroir?: boolean;
  /** Au plus ce nombre de pièces dans la planche (hero-home : 4, « 3 à 4 pièces bien lisibles ») ; les autres restent dans la tenue, jamais dans la planche. */
  maxPieces?: number;
  /** Combien l'ajustement à la zone peut AGRANDIR la composition (défaut 1,1) : un contexte compact la laisse remplir sa zone. */
  agrandissementMax?: number;
  /** Seuils de chevauchement propres au contexte (sinon CHEVAUCHEMENT_MAX / MASQUE_MAX). */
  chevauchementMax?: number;
  masqueMax?: number;
  /** Gabarit d'un bas héro AVEC une couche (pull + t-shirt à gauche, bas à droite, chaussures dessous, sac contre le bas). */
  refsGroupe?: Partial<Record<RoleFlatLay, Ref>>;
  slotsAccessoires: Ref[];
}

const REF_HOME: Record<RoleFlatLay, Ref> = {
  hero: { x: 70, y: 33, l: 58, angle: 4 },
  secondaire: { x: 27, y: 27, l: 49, angle: -5 },
  bas: { x: 50, y: 62, l: 42, angle: -5 },
  chaussures: { x: 80, y: 82, l: 36, angle: -8 },
  sac: { x: 17, y: 71, l: 33, angle: -2 },
  // La couche se pose contre sa pièce (cf. composerFlatLay) : seule son inclinaison compte ici.
  couche: { x: 0, y: 0, l: 0, angle: -3 },
  accessoire: { x: 8, y: 8, l: 16, angle: 10 },
};
const SLOTS_HOME: Ref[] = [
  { x: 8, y: 10, l: 17, angle: 10 },
  { x: 52, y: 92, l: 18, angle: -8 },
  { x: 92, y: 52, l: 15, angle: 9 },
];

/**
 * LA COMPOSITION DE L'ACCUEIL, REPRISE LE 09/10/2026 (brief « Optimisation du flat lay sur la homepage »). Elle remplace celle du 08/10 :
 * 3 à 4 pièces lisibles au lieu de 5 serrées, des chevauchements faibles (≤ 18 %) au lieu de 60 %, aucun bas devant la moitié d'une veste.
 * Positions en parts de la zone de 100 × 112 unités (centre de la pièce), `y` converti comme plus haut :
 *
 *   haut + bas + sac + chaussures   haut en haut à gauche, bas au centre droit, sac en bas à gauche, chaussures en bas à droite (le brief) ;
 *   veste / manteau + haut + bas    le haut à gauche, la veste à droite, le bas au centre sous les deux, chaussures en bas à droite ;
 *   robe                            la robe à droite, la surcouche en haut à gauche, le sac dessous, les chaussures en bas.
 *
 * Seed-miroir : un bas héro peut être posé en miroir (déterministe, tiré de la graine du look) ; une veste ou un manteau héro, jamais.
 */
const yH = (y112: number) => +(y112 - 6).toFixed(1);
const HOME_BAS: Partial<Record<RoleFlatLay, Ref>> = {
  hero: { x: 71, y: yH(50), l: 38, angle: 3 },
  secondaire: { x: 27, y: yH(27), l: 44, angle: -4 },
  chaussures: { x: 72, y: yH(100), l: 34, angle: -6 },
  sac: { x: 24, y: yH(74), l: 30, angle: -3 },
};
const HOME_DESSUS: Partial<Record<RoleFlatLay, Ref>> = {
  // Le haut et la veste côte à côte (ils se portent ensemble, 09/10/2026), le bas dessous, plus bas et plus étroit : il ne couvre ni l'un ni l'autre.
  secondaire: { x: 30, y: yH(25), l: 42, angle: -3 },
  hero: { x: 69, y: yH(27), l: 40, angle: 3 },
  bas: { x: 46, y: yH(74), l: 33, angle: -3 },
  chaussures: { x: 78, y: yH(99), l: 30, angle: -6 },
  sac: { x: 20, y: yH(90), l: 28, angle: -4 },
};
const HOME_ROBE: Partial<Record<RoleFlatLay, Ref>> = {
  hero: { x: 67, y: yH(48), l: 40, angle: 3 },
  secondaire: { x: 27, y: yH(28), l: 40, angle: -3 },
  sac: { x: 24, y: yH(64), l: 28, angle: -3 },
  chaussures: { x: 72, y: yH(98), l: 34, angle: -6 },
};

export const CONTEXTES: Record<ContexteFlatLay, ConfigContexte> = {
  "hero-home": {
    hauteur: 112,
    // « Dans le flat lay de la homepage c'est encore vraiment petit » (08/10/2026) : la marge passe de 7,4 unités (12 px minimum) à 3
    // (environ 6 px), la planche peut s'agrandir de 30 % au lieu de 10, et l'écran étire la zone dans le remplissage de la card
    // (HomeScreen). Les pièces restent à 10 px au moins du bord de la card.
    marge: 3,
    agrandissementMax: 1.3,
    // 4 pièces au plus (09/10/2026) : le haut, le bas ou la robe, les chaussures et le sac se lisent ; un accessoire seulement s'il reste de la place.
    maxPieces: 4,
    sansMiroir: true,
    maxAccessoires: [1, 0],
    ecartAccessoireMax: 12,
    refs: { ...REF_HOME, ...HOME_BAS },
    refsGroupe: HOME_BAS,
    refsDessus: HOME_DESSUS,
    refsRobe: HOME_ROBE,
    masquerCouche: true,
    accessoiresMasques: ["Collants"],
    slotsAccessoires: SLOTS_HOME,
  },
  "look-detail": {
    hauteur: 126,
    marge: 5,
    // 28 px sur les 278 px de large de la planche : la ligne de badges se pose par-dessus la zone, jamais sur une pièce.
    margeHaute: 10,
    // Deux accessoires au plus dans le flat lay principal (calibrage du 08/10/2026).
    maxAccessoires: [2, 2],
    ecartAccessoireMax: 14,
    refs: {
      hero: { x: 64, y: 34, l: 58, angle: 3 },
      secondaire: { x: 28, y: 27, l: 50, angle: -4 },
      bas: { x: 50, y: 68, l: 44, angle: -5 },
      chaussures: { x: 80, y: 100, l: 36, angle: -7 },
      sac: { x: 20, y: 98, l: 36, angle: -4 },
      couche: { x: 0, y: 0, l: 0, angle: -3 },
      accessoire: { x: 10, y: 8, l: 18, angle: 9 },
    },
    // Un bas héro avec une couche : le groupe des hauts à gauche, le bas à droite, boots sous le groupe, sac contre le bas.
    refsGroupe: {
      secondaire: { x: 27, y: 31, l: 44, angle: -3 },
      hero: { x: 71, y: 50, l: 46, angle: 3 },
      chaussures: { x: 25, y: 101, l: 36, angle: -6 },
      sac: { x: 75, y: 104, l: 33, angle: 4 },
    },
    // Une robe : centrée, la surcouche derrière à droite, sac et chaussures dessous de part et d'autre.
    refsRobe: {
      hero: { x: 46, y: 46, l: 58, angle: 3 },
      secondaire: { x: 76, y: 30, l: 46, angle: 4 },
      sac: { x: 20, y: 100, l: 36, angle: -4 },
      chaussures: { x: 74, y: 104, l: 36, angle: -6 },
    },
    slotsAccessoires: [
      { x: 90, y: 66, l: 18, angle: 8 },
      { x: 10, y: 12, l: 18, angle: -8 },
      { x: 50, y: 118, l: 20, angle: 6 },
    ],
  },
  capsule: { hauteur: 100, marge: 4, maxAccessoires: [1, 1], ecartAccessoireMax: 12, refs: REF_HOME, slotsAccessoires: SLOTS_HOME },
  dressing: { hauteur: 100, marge: 4, maxAccessoires: [1, 1], ecartAccessoireMax: 12, refs: REF_HOME, slotsAccessoires: SLOTS_HOME },
  packing: { hauteur: 100, marge: 4, maxAccessoires: [2, 1], ecartAccessoireMax: 12, refs: REF_HOME, slotsAccessoires: SLOTS_HOME },
};

/** La hauteur de la zone d'un contexte, en unités de largeur : la zone d'affichage garde cette proportion. */
export function hauteurDuContexte(contexte: ContexteFlatLay): number {
  return CONTEXTES[contexte].hauteur;
}

/**
 * Profondeur (08/10/2026, demandé : « le manteau ou la veste doivent être derrière ») : la veste et le manteau sont
 * TOUJOURS au fond, héros ou non ; le bas et la robe viennent ensuite, le haut par-dessus (il rentre dans le bas),
 * puis chaussures, sac et accessoires.
 */
function profondeur(role: RoleFlatLay, cat: CategoryKey): number {
  if (DESSUS.includes(cat)) return 10;
  if (role === "chaussures") return 40;
  if (role === "sac") return 50;
  if (role === "accessoire") return 60;
  // La couche est derrière le haut qu'elle double (« sous / légèrement derrière le pull »), devant le bas.
  if (role === "couche") return 25;
  return HAUTS.includes(cat) ? 30 : 20;
}

/** Une graine d'identité de look → un générateur pseudo-aléatoire stable (FNV-1a, puis mulberry32). */
export function generateur(graine: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Marge de sécurité par défaut (celle du hero de l'accueil) : autour de la composition, en unités de zone. */
export const MARGE_SECURITE = 4;

/**
 * Les limites d'inclinaison du brief « calibrage final » (08/10/2026), par rôle, en degrés : héro ±4, pièces secondaires ±5
 * (le bas en est une), chaussures ±8, sac ±6, accessoires ±10. Elles bornent TOUT angle — celui du gabarit, son jitter, le
 * miroir et l'inclinaison préférée d'une pièce. Elles remplacent les 8° / −12° de la maquette du 07/10, plus marqués.
 */
export const LIMITE_INCLINAISON: Record<RoleFlatLay, number> = { hero: 4, secondaire: 5, couche: 5, bas: 5, chaussures: 8, sac: 6, accessoire: 10 };

/** Chevauchement maximal entre deux pièces (part de la plus petite) et part maximale d'une pièce masquée par celles du dessus. */
export const CHEVAUCHEMENT_MAX = 0.18;
export const MASQUE_MAX = 0.2;
/** Largeur maximale de la pièce héro, en part de la largeur de la zone. */
export const LARGEUR_HERO_MAX = 58;
/** Un accessoire plus étroit que cette part de la zone n'apporte rien à la planche principale. */
export const LARGEUR_ACCESSOIRE_MIN = 8;

type Boite = { x0: number; x1: number; y0: number; y1: number };
const boiteTournee = (p: { x: number; y: number; l: number; h: number; angle: number }): Boite => {
  const r = (Math.abs(p.angle) * Math.PI) / 180;
  const w = p.l * Math.cos(r) + p.h * Math.sin(r);
  const hh = p.l * Math.sin(r) + p.h * Math.cos(r);
  return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - hh / 2, y1: p.y + hh / 2 };
};
const ecart = (a: Boite, b: Boite) => Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1), Math.max(a.y0 - b.y1, b.y0 - a.y1));
const aire = (b: Boite) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const recouvrement = (a: Boite, b: Boite) => aire({ x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) });

/** Le rang d'importance d'un accessoire : un accessoire de tenue (ceinture, foulard) passe avant un bijou, trop petit pour une planche. */
const rangAccessoire = (cat: CategoryKey) => (cat === "accessoire" ? 0 : 1);

/** L'importance d'une pièce quand il faut en écarter une : la plus importante ne bouge pas. */
const IMPORTANCE: Record<RoleFlatLay, number> = { hero: 5, couche: 4.5, bas: 4, secondaire: 3, chaussures: 2, sac: 2, accessoire: 1 };

/**
 * CHEVAUCHEMENTS (calibrage du 08/10/2026) : deux pièces ne se recouvrent pas de plus de 18 % de la plus petite, et une pièce
 * n'est jamais masquée à plus de 20 % par celles qui sont au-dessus. Mesuré sur la boîte tournée de chaque pièce — une mesure
 * prudente : la silhouette réelle (un pull, un pantalon) laisse du vide dans sa boîte. La pièce la moins importante s'écarte,
 * de proche en proche, par l'axe où elle pénètre le moins ; la composition est ensuite ajustée à la zone comme d'habitude.
 */
function desserrer<T extends { id: number; x: number; y: number; l: number; h: number; angle: number; z: number; role: RoleFlatLay; groupeAvec?: number }>(pieces: T[], chevauchementMax = CHEVAUCHEMENT_MAX, masqueMax = MASQUE_MAX): void {
  for (let tour = 0; tour < 120; tour++) {
    let bouge = false;
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i];
        const b = pieces[j];
        // Une couche et la pièce qu'elle double se chevauchent à dessein (≤ 18 %, réglé à la pose) : on ne les sépare pas.
        if (a.groupeAvec === b.id || b.groupeAvec === a.id) continue;
        const ba = boiteTournee(a);
        const bb = boiteTournee(b);
        const commun = recouvrement(ba, bb);
        if (commun <= 0) continue;
        const part = commun / Math.min(aire(ba), aire(bb));
        const dessus = a.z > b.z ? a : b;
        const dessous = dessus === a ? b : a;
        // Le masquage se cumule : une veste cachée à 14 % par le haut et à 13 % par le bas l'est à 27 %.
        const bd = boiteTournee(dessous);
        const masque = pieces.filter((o) => o.z > dessous.z).reduce((s, o) => s + recouvrement(bd, boiteTournee(o)), 0) / aire(bd);
        if (part <= chevauchementMax && masque <= masqueMax) continue;
        const [fixe, mobile] = IMPORTANCE[a.role] >= IMPORTANCE[b.role] ? [a, b] : [b, a];
        const bf = boiteTournee(fixe);
        const bm = boiteTournee(mobile);
        const penX = Math.min(bf.x1, bm.x1) - Math.max(bf.x0, bm.x0);
        const penY = Math.min(bf.y1, bm.y1) - Math.max(bf.y0, bm.y0);
        if (penX <= penY) mobile.x += mobile.x >= fixe.x ? 1 : -1;
        else mobile.y += mobile.y >= fixe.y ? 1 : -1;
        bouge = true;
      }
    }
    if (!bouge) break;
  }
}

export interface OptionsFlatLay {
  contexte?: ContexteFlatLay;
  /** true : jamais de planche en miroir (la silhouette de chargement, qui ignore la graine du look à venir). */
  sansMiroir?: boolean;
}

/**
 * LES PIÈCES REPRÉSENTATIVES (09/10/2026, hero-home : « 3 à 4 pièces bien lisibles ») : quand la tenue en compte plus que le contexte n'en
 * pose, on garde celles qui disent la tenue — la robe, le manteau ou la veste, le bas, le haut, puis les chaussures et le sac. Un second haut
 * ou une seconde veste pèse moins que le premier. Une pièce dont le visuel est une photo brute (`photoBrute`) passe après les visuels
 * produit : elle est écartée de la planche tant qu'il reste au moins 3 autres pièces. Jamais la tenue réelle : seul l'aperçu change.
 */
const POIDS_REPRESENTATIF: Partial<Record<CategoryKey, number>> = {
  robe: 5, combinaison: 5, manteau: 4.6, pantalon: 4.5, jean: 4.5, jupe: 4.5, short: 4.3, haut: 4.4, pull: 4.4, veste: 4.2, chaussures: 3, sac: 2.5, accessoire: 1, bijou: 0.5,
};
export function pieceRepresentatives<T extends { id: number; cat: CategoryKey; photoBrute?: boolean }>(pieces: T[], max: number): { gardees: T[]; ecartees: T[] } {
  const proprement = pieces.filter((q) => !q.photoBrute);
  // Au moins trois pièces dans la planche : sans assez de visuels produit, les photos brutes restent.
  const candidates = proprement.length >= Math.min(3, pieces.length) ? proprement : pieces;
  if (candidates.length <= max) return { gardees: candidates, ecartees: pieces.filter((q) => !candidates.includes(q)) };
  const famille = (c: CategoryKey) => (["haut", "pull"].includes(c) ? "haut" : ["veste", "manteau"].includes(c) ? "dessus" : c);
  const deja = new Map<string, number>();
  const note = new Map<T, number>();
  for (const q of [...candidates].sort((a, b) => (POIDS_REPRESENTATIF[b.cat] ?? 1) - (POIDS_REPRESENTATIF[a.cat] ?? 1))) {
    const f = famille(q.cat);
    const n = deja.get(f) ?? 0;
    deja.set(f, n + 1);
    // Le second d'une même famille (un autre haut, une autre veste) vaut 60 % du premier.
    note.set(q, (POIDS_REPRESENTATIF[q.cat] ?? 1) * (n === 0 ? 1 : 0.6));
  }
  const gardees = [...candidates].sort((a, b) => note.get(b)! - note.get(a)!).slice(0, max);
  return { gardees: candidates.filter((q) => gardees.includes(q)), ecartees: pieces.filter((q) => !gardees.includes(q)) };
}

/** `masquees` : les pièces de la tenue que le contexte ne pose pas dans la planche (le t-shirt de l'accueil) — elles restent dans le look. */
export function composerFlatLay(
  pieces: PieceFlatLay[],
  graine: string,
  options: OptionsFlatLay = {}
): { pieces: PlacementFlatLay[]; ecartees: number[]; masquees: number[] } {
  const config = CONTEXTES[options.contexte ?? "hero-home"];
  const hauteurZone = config.hauteur;
  const retirees = pieces.filter((p) => !!p.accessoireType && !!config.accessoiresMasques?.includes(p.accessoireType));
  const compatibles = pieces.filter((p) => p.flatLayCompatible !== false && !retirees.includes(p));
  // Un contexte qui limite le nombre de pièces (hero-home) ne pose que les plus représentatives ; les autres restent dans la tenue.
  const choix = config.maxPieces ? pieceRepresentatives(compatibles, config.maxPieces) : { gardees: compatibles, ecartees: [] as PieceFlatLay[] };
  const tous = attribuerRoles(choix.gardees);
  // Le groupe stylistique se décide sur TOUTE la tenue : un t-shirt masqué (hero-home) ne défait pas le gabarit pull + pantalon.
  // Seule une couche de haut (t-shirt sous un pull) fait un groupe et se masque sur l'accueil : une veste en plus reste dans la planche.
  const coucheHaut = (r: { piece: { cat: CategoryKey }; role: RoleFlatLay }) => r.role === "couche" && HAUTS.includes(r.piece.cat);
  const avecCouche = tous.some(coucheHaut);
  const masquees = [
    ...(config.masquerCouche ? tous.filter(coucheHaut).map((r) => r.piece.id) : []),
    ...retirees.map((p) => p.id),
    ...choix.ecartees.map((p) => p.id),
  ];
  const roles = config.masquerCouche ? tous.filter((r) => !coucheHaut(r)) : tous;
  if (!roles.length) return { pieces: [], ecartees: [], masquees };
  const alea = generateur(graine);
  const dans = (min: number, max: number) => min + (max - min) * alea();
  // La veste ou le manteau héros se pose toujours à DROITE (maquette) : pas de miroir. Sinon le sens est tiré par la graine.
  const heroDessus = DESSUS.includes(roles[0].piece.cat);
  const heroRobe = ROBES.includes(roles[0].piece.cat);
  // Un bas héro avec une couche : le groupe des hauts à gauche, le bas à droite — jamais en miroir (la couche reste lisible).
  const groupe = !heroRobe && !heroDessus && BAS.includes(roles[0].piece.cat) && avecCouche;
  const miroir = !heroDessus && !groupe && !options.sansMiroir && !config.sansMiroir && alea() < 0.5;
  const nb = roles.length;
  // 2–3 pièces : composition plus ouverte (un peu plus grandes). 6 et plus : on réduit le secondaire et on limite les accessoires.
  const echelleGlobale = nb <= 3 ? 1.1 : 1;
  const refDe = (role: RoleFlatLay): Ref => (heroRobe && config.refsRobe?.[role]) || (heroDessus && config.refsDessus?.[role]) || (groupe && config.refsGroupe?.[role]) || config.refs[role];

  // Les accessoires : on garde les plus utiles, en nombre limité par le contexte et le nombre de pièces.
  const accessoires = roles.filter((r) => r.role === "accessoire").sort((a, b) => rangAccessoire(a.piece.cat) - rangAccessoire(b.piece.cat));
  const plafond = config.maxAccessoires[nb >= 6 ? 1 : 0];
  const gardes = new Set(accessoires.slice(0, plafond).map((r) => r.piece));
  const ecartees: number[] = accessoires.filter((r) => !gardes.has(r.piece)).map((r) => r.piece.id);

  const placer = (piece: PieceFlatLay, role: RoleFlatLay, ref: Ref) => {
    const visualScale = echelleVisuelle(role, piece.cat) * (piece.visualScale && piece.visualScale > 0 ? piece.visualScale : 1);
    let l = ref.l * visualScale * dans(0.97, 1.03) * echelleGlobale;
    if (nb >= 6 && (role === "secondaire" || role === "accessoire")) l *= 0.88;
    const ratio = piece.ratio > 0 ? piece.ratio : 1;
    // Une pièce haute ne dépasse pas 78 % de la hauteur de la zone.
    const hMax = hauteurZone * 0.78;
    if (l / ratio > hMax) l = hMax * ratio;
    let cx = ref.x + dans(-2, 2);
    const cy = ref.y + dans(-2, 2) + (hauteurZone - 100) / 2;
    const lim = LIMITE_INCLINAISON[role];
    let angle = ref.angle + dans(-1.5, 1.5);
    if (typeof piece.preferredRotation === "number") angle = piece.preferredRotation;
    if (miroir) {
      cx = 100 - cx;
      angle = -angle;
    }
    angle = Math.max(-lim, Math.min(lim, angle));
    return { id: piece.id, cat: piece.cat, role, visualScale, x: cx, y: cy, l, h: l / ratio, angle, z: profondeur(role, piece.cat) };
  };

  const brut: PlacementFlatLay[] = roles
    .filter((r) => r.role !== "accessoire" && r.role !== "couche")
    .map(({ piece, role }) => placer(piece, role, refDe(role)));

  desserrer(brut, config.chevauchementMax, config.masqueMax);

  // LA COUCHE (« regroupement stylistique », 08/10/2026) : posée contre la pièce qu'elle double — le haut du second plan, sinon le héro —,
  // juste dessous et légèrement derrière, vers le centre de la planche. Elle recouvre de 14 % de sa hauteur au plus (sous les 18 %) et ne
  // s'éloigne jamais : deux couches d'une même tenue ne sont jamais dans deux coins opposés.
  const coucheRole = roles.find((r) => r.role === "couche");
  const ancre = brut.find((q) => q.role === "secondaire") ?? brut.find((q) => q.role === "hero");
  if (coucheRole && ancre) {
    // Une veste en plus se lit plus grande qu'un t-shirt sous un pull : 100 % de son ancre au lieu de 62 %.
    const c = placer(coucheRole.piece, "couche", { ...refDe("couche"), l: ancre.l * (DESSUS.includes(coucheRole.piece.cat) ? 1 : 0.62) });
    const bAncre = boiteTournee(ancre);
    c.x = ancre.x + (ancre.x < 50 ? 1 : -1) * 0.05 * ancre.l;
    c.y = bAncre.y1 - 0.14 * c.h + c.h / 2;
    // Une veste en plus (et non un t-shirt) se pose à côté du bas, du côté de son ancre, en le recouvrant de 15 % au plus : juste sous le
    // haut, elle se retrouvait en grande partie cachée derrière le pantalon (09/10/2026).
    const bas = brut.find((q) => q.role === "bas");
    if (bas && DESSUS.includes(coucheRole.piece.cat)) {
      const bBas = boiteTournee(bas);
      c.x = ancre.x < 50 ? bBas.x0 + 0.15 * c.l - c.l / 2 : bBas.x1 - 0.15 * c.l + c.l / 2;
    }
    brut.push({ ...c, groupeAvec: ancre.id });
  }
  desserrer(brut, config.chevauchementMax, config.masqueMax);

  // Chaque accessoire garde le premier emplacement qui le colle à la composition SANS couvrir une pièce importante ; sinon il est
  // écarté : un petit objet isolé ou posé sur le héro ne sert pas la planche (« 08/10/2026 : un accessoire noir seul sous la robe »).
  const structure = () => brut.map(boiteTournee);
  for (const { piece } of accessoires.filter((r) => gardes.has(r.piece))) {
    let meilleur: ReturnType<typeof placer> | null = null;
    let meilleurEcart = Infinity;
    for (const slot of config.slotsAccessoires) {
      const candidat = placer(piece, "accessoire", slot);
      // Un accessoire de moins de 8 % de la largeur de la zone ne se lit pas : il n'entre pas dans la planche principale.
      if (candidat.l < LARGEUR_ACCESSOIRE_MIN) continue;
      const bc = boiteTournee(candidat);
      const autres = structure();
      const gap = Math.min(...autres.map((b) => ecart(bc, b)));
      const couvre = autres.some((b) => recouvrement(bc, b) > aire(bc) * 0.12);
      if (!couvre && gap < meilleurEcart) {
        meilleur = candidat;
        meilleurEcart = gap;
      }
    }
    if (meilleur && meilleurEcart <= config.ecartAccessoireMax) brut.push(meilleur);
    else ecartees.push(piece.id);
  }

  const bornes = brut.map(boiteTournee);
  const x0 = Math.min(...bornes.map((b) => b.x0));
  const x1 = Math.max(...bornes.map((b) => b.x1));
  const y0 = Math.min(...bornes.map((b) => b.y0));
  const y1 = Math.max(...bornes.map((b) => b.y1));
  // Ajuster l'ensemble à la zone de sécurité : réduit s'il déborde, agrandi d'au plus 10 % s'il reste de la place.
  const largeurUtile = 100 - 2 * config.marge;
  const haut = config.margeHaute ?? config.marge;
  const hauteurUtile = hauteurZone - haut - config.marge;
  const k = Math.min(largeurUtile / (x1 - x0), hauteurUtile / (y1 - y0), config.agrandissementMax ?? 1.1);
  const cxEns = (x0 + x1) / 2;
  const cyEns = (y0 + y1) / 2;
  // Le centre de la zone utile : au milieu de la zone quand les deux marges sont égales, plus bas sinon.
  const cyZone = (haut + hauteurZone - config.marge) / 2;
  return {
    pieces: brut.map((p) => {
      const l = p.l * k;
      // La pièce héro reste dominante sans écraser la planche : 58 % de la largeur de la zone au plus (elle rétrécit sur place).
      const c = p.role === "hero" && l > LARGEUR_HERO_MAX ? LARGEUR_HERO_MAX / l : 1;
      return {
        ...p,
        x: 50 + (p.x - cxEns) * k,
        y: cyZone + (p.y - cyEns) * k,
        l: l * c,
        h: p.h * k * c,
      };
    }),
    ecartees,
    masquees,
  };
}
