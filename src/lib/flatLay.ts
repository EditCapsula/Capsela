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
 * Les tailles et positions viennent du gabarit de référence REF (maquette validée du 08/10/2026), pas de plages libres.
 */
export type RoleFlatLay = "hero" | "secondaire" | "bas" | "chaussures" | "sac" | "accessoire";

export interface PieceFlatLay {
  id: number;
  cat: CategoryKey;
  /** Largeur / hauteur de la partie visible de l'image (1 si inconnue). */
  ratio: number;
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
  const haut = robe ? undefined : prendre(HAUTS);
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
  // Tout le reste — bijoux, accessoires, pièces en surnombre (une seconde veste, un second bas…) — se pose en accessoire.
  const casees = new Set(sortie.map((x) => x.piece));
  for (const p of pieces) if (!casees.has(p)) sortie.push({ piece: p, role: "accessoire" });
  return sortie;
}

/**
 * LE GABARIT DE RÉFÉRENCE (08/10/2026, maquette validée « voici exactement ce que je veux ») : une planche à peu près CARRÉE
 * (100 × 100), mesurée sur la maquette — le blazer héro en haut à droite, incliné de +8° et au fond ; le T-shirt en haut à
 * gauche, incliné de −8° ; le pantalon en diagonale (−12°) qui passe sous le T-shirt et sur le blazer ; le sac en bas à
 * gauche ; les baskets en bas à droite. Centres (x, y) et largeurs (l) en unités de la planche, angles en degrés.
 *
 * Les rôles sont ceux de attribuerRoles : ce gabarit vaut pour toute tenue (le héro prend la place du blazer). La graine ne
 * fait varier que de petits écarts (±2 de position, ±3 % de taille, ±1,5° d'angle) et, hors veste héro, le miroir : le
 * regard va du T-shirt au blazer, au pantalon, aux baskets — le sac fait contrepoids.
 */
const REF: Record<RoleFlatLay, { x: number; y: number; l: number; angle: number }> = {
  hero: { x: 70, y: 33, l: 58, angle: 8 },
  secondaire: { x: 27, y: 27, l: 49, angle: -8 },
  bas: { x: 50, y: 62, l: 42, angle: -12 },
  chaussures: { x: 80, y: 82, l: 36, angle: -10 },
  sac: { x: 17, y: 71, l: 33, angle: -2 },
  accessoire: { x: 8, y: 8, l: 16, angle: 10 },
};
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
const PART_REF: Record<RoleFlatLay, number> = { hero: 82.5, secondaire: 77.5, bas: 85, chaussures: 70, sac: 70, accessoire: 62.5 };

/** L'échelle visuelle d'une pièce dans son rôle : bornée, pour qu'une catégorie rare ne déséquilibre jamais la planche. */
export function echelleVisuelle(role: RoleFlatLay, cat: CategoryKey): number {
  return Math.min(1.12, Math.max(0.82, (PART_VISUELLE[cat] ?? PART_REF[role]) / PART_REF[role]));
}

const REF_ACCESSOIRES = [
  { x: 8, y: 8, l: 16, angle: 10 },
  { x: 52, y: 94, l: 18, angle: -8 },
  { x: 92, y: 52, l: 14, angle: 12 },
];

/**
 * Profondeur (08/10/2026, demandé : « le manteau ou la veste doivent être derrière ») : la veste et le manteau sont
 * TOUJOURS au fond, héros ou non ; le bas et la robe viennent ensuite, le haut par-dessus (il rentre dans le bas),
 * puis chaussures, sac et accessoires.
 */
function profondeur(role: RoleFlatLay, cat: CategoryKey): number {
  if (DESSUS.includes(cat)) return 1;
  if (role === "chaussures") return 4;
  if (role === "sac") return 5;
  if (role === "accessoire") return 6;
  return HAUTS.includes(cat) ? 3 : 2;
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

/** Marge de sécurité autour de la composition, en unités de zone (4 unités ≈ 7 px sur la colonne de droite à 390 px ; avec le padding de la carte, ≥ 16 px du bord). */
export const MARGE_SECURITE = 4;

export function composerFlatLay(pieces: PieceFlatLay[], graine: string, hauteurZone = 112): { pieces: PlacementFlatLay[] } {
  const roles = attribuerRoles(pieces);
  if (!roles.length) return { pieces: [] };
  const alea = generateur(graine);
  const dans = (min: number, max: number) => min + (max - min) * alea();
  // La veste ou le manteau héros se pose toujours à DROITE (maquette) : pas de miroir. Sinon le sens est tiré par la graine.
  const heroDessus = DESSUS.includes(roles[0].piece.cat);
  const miroir = !heroDessus && alea() < 0.5;
  const nb = roles.length;
  // Peu de pièces : un peu plus grandes. Beaucoup : les secondaires et accessoires se réduisent.
  const echelleGlobale = nb <= 3 ? 1.1 : 1;
  let rangAccessoire = 0;

  const brut = roles.map(({ piece, role }) => {
    const ref = role === "accessoire" ? REF_ACCESSOIRES[rangAccessoire++ % REF_ACCESSOIRES.length] : REF[role];
    const visualScale = echelleVisuelle(role, piece.cat);
    let l = ref.l * visualScale * dans(0.97, 1.03) * echelleGlobale;
    if (nb >= 6 && (role === "secondaire" || role === "accessoire")) l *= 0.88;
    const ratio = piece.ratio > 0 ? piece.ratio : 1;
    // Une pièce haute ne dépasse pas 78 % de la hauteur de la zone.
    const hMax = hauteurZone * 0.78;
    if (l / ratio > hMax) l = hMax * ratio;
    let cx = ref.x + dans(-2, 2);
    const cy = ref.y + dans(-2, 2) + (hauteurZone - 100) / 2;
    let angle = ref.angle + dans(-1.5, 1.5);
    if (miroir) {
      cx = 100 - cx;
      angle = -angle;
    }
    return { id: piece.id, cat: piece.cat, role, visualScale, x: cx, y: cy, l, h: l / ratio, angle, z: profondeur(role, piece.cat) };
  });

  // La boîte de chaque pièce, tournée : son encombrement réel pour la zone de sécurité.
  const boite = (p: { x: number; y: number; l: number; h: number; angle: number }) => {
    const r = (Math.abs(p.angle) * Math.PI) / 180;
    const w = p.l * Math.cos(r) + p.h * Math.sin(r);
    const hh = p.l * Math.sin(r) + p.h * Math.cos(r);
    return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - hh / 2, y1: p.y + hh / 2 };
  };
  const bornes = brut.map(boite);
  const x0 = Math.min(...bornes.map((b) => b.x0));
  const x1 = Math.max(...bornes.map((b) => b.x1));
  const y0 = Math.min(...bornes.map((b) => b.y0));
  const y1 = Math.max(...bornes.map((b) => b.y1));
  // Ajuster l'ensemble à la zone de sécurité : réduit s'il déborde, agrandi d'au plus 12 % s'il reste de la place.
  const largeurUtile = 100 - 2 * MARGE_SECURITE;
  const hauteurUtile = hauteurZone - 2 * MARGE_SECURITE;
  const k = Math.min(largeurUtile / (x1 - x0), hauteurUtile / (y1 - y0), 1.1);
  const cxEns = (x0 + x1) / 2;
  const cyEns = (y0 + y1) / 2;
  return {
    pieces: brut.map((p) => ({
      ...p,
      x: 50 + (p.x - cxEns) * k,
      y: hauteurZone / 2 + (p.y - cyEns) * k,
      l: p.l * k,
      h: p.h * k,
    })),
  };
}
