// Importer une tenue (10/10/2026) — la partie PURE de l'Edge Function importer-tenue : le prompt de lecture d'une tenue entière, la
// vérification de ce que le modèle répond (jamais confiance aveugle : une valeur hors liste est ignorée), et le recadrage d'un objet
// sur l'image à plat. Aucun secret, aucun réseau : de quoi tout tester.
//
// POURQUOI UNE LECTURE À PART. analyze-dressing-photo lit UNE pièce par photo. Ici la photo est une tenue mise à plat : plusieurs
// pièces posées sur un fond uni (robe, sac, sandales, bracelets, montre). Le modèle rend chaque objet avec sa BOÎTE dans l'image,
// en fractions de la largeur et de la hauteur ; le serveur recadre chaque boîte sur l'image détourée pour en faire la photo d'une pièce.
//
// Rien n'est inventé : un objet sans catégorie reconnue, trop petit, ou qui en recouvre presque un autre, n'est pas proposé.

import {
  ACCESSOIRE_TYPES,
  BIJOU_TYPES,
  CATEGORY_KEYS,
  MATIERES,
  nearestPaletteColor,
  PALETTE,
  PALETTE_BIJOU,
  SAC_TYPES,
  SHOE_TYPES,
  SUBTYPES,
  type CategoryKey,
} from "./enumsPiece.ts";

/** Au plus ce nombre de pièces proposées pour une photo : les plus grandes sont gardées. */
export const OBJETS_MAX = 8;

/** Un objet dont la boîte couvre moins de cette part de l'image n'est pas proposé : il ne se lirait pas. */
export const SURFACE_MIN = 0.0015;

/** Deux boîtes qui se recouvrent à plus de cette part (union) sont le même objet lu deux fois. */
export const RECOUVREMENT_DOUBLON = 0.6;

/** Catégories dont la longueur de manches se renseigne — synchronisée avec CATEGORIES_A_MANCHES (src/lib/manches.ts, app-side). */
const CATEGORIES_A_MANCHES: readonly CategoryKey[] = ["haut", "pull", "robe", "combinaison", "veste", "manteau"];
const MANCHES = ["sans", "courtes", "trois_quarts", "longues"] as const;
export type Manches = (typeof MANCHES)[number];

/** Une boîte en fractions de l'image : (x, y) = coin haut-gauche, (l, h) = largeur et hauteur, tout entre 0 et 1. */
export interface BoiteNormalisee {
  x: number;
  y: number;
  l: number;
  h: number;
}

export interface ObjetTenue {
  nom: string;
  cat: CategoryKey;
  sousType?: string;
  shoeType?: string;
  sacType?: string;
  bijouType?: string;
  accessoireType?: string;
  couleur: { nom: string; hex: string };
  /** false : le modèle n'a pas rendu de couleur lisible, `couleur` est la teinte par défaut — à ne pas présenter comme détectée. */
  couleurLue: boolean;
  matiere?: string;
  manches?: Manches;
  boite: BoiteNormalisee;
}

export function promptTenue(): string {
  const sousTypes = JSON.stringify(SUBTYPES);
  return [
    "Tu lis la photo d'une tenue de mode posée à plat sur un fond uni (ou portée) pour une app de garde-robe. Repère chaque article distinct : vêtement, chaussures, sac, bijou, accessoire.",
    `Pour chaque article, indique cat EXACTEMENT parmi : ${CATEGORY_KEYS.join(", ")}.`,
    `Selon la catégorie, indique sous_type EXACTEMENT parmi la liste associée (JSON, clé = catégorie) : ${sousTypes}. Ignore les catégories sans liste.`,
    `cat = "chaussures" : shoe_type EXACTEMENT parmi : ${SHOE_TYPES.join(", ")}.`,
    `cat = "sac" : sac_type EXACTEMENT parmi : ${SAC_TYPES.join(", ")}.`,
    `cat = "bijou" : bijou_type EXACTEMENT parmi : ${BIJOU_TYPES.join(", ")}.`,
    `cat = "accessoire" : accessoire_type EXACTEMENT parmi : ${ACCESSOIRE_TYPES.join(", ")}.`,
    `Si tu distingues la matière principale : matiere EXACTEMENT parmi : ${MATIERES.join(", ")}, sinon null.`,
    `Pour ${CATEGORIES_A_MANCHES.join(", ")} : manches EXACTEMENT parmi sans, courtes, trois_quarts, longues (sans = sans manches ou bretelles, courtes = jusqu'au coude, trois_quarts = jusqu'à mi-avant-bras, longues = jusqu'au poignet ou au-delà), sinon null. Pour toute autre catégorie : null.`,
    "color_hex : ta meilleure estimation de la couleur dominante de L'ARTICLE, en hex #RRGGBB.",
    "nom : un nom court en français (ex. « Robe longue fleurie », « Sac en raphia »).",
    "boite : [x, y, l, h] — la boîte qui contient TOUT l'article visible, en fractions de la largeur et de la hauteur de l'image (0 à 1), (x, y) étant le coin haut-gauche.",
    "Règles : une paire de chaussures est UN article (une boîte autour des deux) ; plusieurs bracelets posés ensemble sont UN article ; ne liste jamais une partie du corps ni un décor ; ne devine pas un article caché ou coupé. Au plus 8 articles. Si tu n'es pas raisonnablement sûr d'un champ, mets null plutôt que de deviner.",
    'Réponds UNIQUEMENT en JSON strict : {"objets":[{"nom":string,"cat":string,"sous_type":string|null,"shoe_type":string|null,"sac_type":string|null,"bijou_type":string|null,"accessoire_type":string|null,"matiere":string|null,"manches":string|null,"color_hex":string|null,"boite":[number,number,number,number]}]}.',
  ].join("\n");
}

const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dans = (liste: readonly string[], v: unknown): string | undefined => (typeof v === "string" && liste.includes(v) ? v : undefined);

function boiteValide(brut: unknown): BoiteNormalisee | null {
  if (!Array.isArray(brut) || brut.length !== 4 || !brut.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [x0, y0, l0, h0] = brut as number[];
  if (l0 <= 0 || h0 <= 0) return null;
  const x = borne(x0, 0, 1);
  const y = borne(y0, 0, 1);
  // La boîte ne sort pas de l'image : on rogne ce qui dépasse.
  const l = borne(l0, 0, 1 - x);
  const h = borne(h0, 0, 1 - y);
  return l > 0.01 && h > 0.01 ? { x, y, l, h } : null;
}

/** Recouvrement de deux boîtes, en part de leur UNION (0 = disjointes, 1 = identiques). */
export function recouvrementUnion(a: BoiteNormalisee, b: BoiteNormalisee): number {
  const ow = Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x));
  const oh = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ow * oh;
  const union = a.l * a.h + b.l * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Ce que le modèle a répondu, vérifié. Une catégorie hors liste écarte l'objet ; un sous-type, une matière ou des manches hors liste
 * (ou d'une autre catégorie) sont simplement ignorés ; la couleur est ramenée à la teinte la plus proche de la palette de l'app
 * (celle des bijoux pour un bijou) ; une boîte invalide, trop petite ou en doublon écarte l'objet. Les OBJETS_MAX plus grands sont
 * gardés, rendus dans l'ordre de lecture (de haut en bas, puis de gauche à droite).
 */
export function assainerObjets(brut: unknown): ObjetTenue[] {
  const liste = (brut as { objets?: unknown } | null)?.objets;
  if (!Array.isArray(liste)) return [];
  const objets: ObjetTenue[] = [];
  for (const o of liste as Record<string, unknown>[]) {
    if (!o || typeof o !== "object") continue;
    const cat = dans(CATEGORY_KEYS, o.cat) as CategoryKey | undefined;
    const boite = boiteValide(o.boite);
    if (!cat || !boite || boite.l * boite.h < SURFACE_MIN) continue;
    if (objets.some((x) => recouvrementUnion(x.boite, boite) > RECOUVREMENT_DOUBLON)) continue;
    const hex = typeof o.color_hex === "string" && /^#?[0-9a-fA-F]{6}$/.test(o.color_hex.trim()) ? (o.color_hex.trim().startsWith("#") ? o.color_hex.trim() : `#${o.color_hex.trim()}`) : null;
    const [couleurNom, couleurHex] = hex ? nearestPaletteColor(hex, cat === "bijou" ? PALETTE_BIJOU : PALETTE) : (cat === "bijou" ? PALETTE_BIJOU[0] : PALETTE[0]);
    const manches = CATEGORIES_A_MANCHES.includes(cat) ? (dans(MANCHES, o.manches) as Manches | undefined) : undefined;
    const nom = typeof o.nom === "string" ? o.nom.trim().slice(0, 60) : "";
    objets.push({
      nom,
      cat,
      sousType: SUBTYPES[cat] ? dans(SUBTYPES[cat]!, o.sous_type) : undefined,
      shoeType: cat === "chaussures" ? dans(SHOE_TYPES, o.shoe_type) : undefined,
      sacType: cat === "sac" ? dans(SAC_TYPES, o.sac_type) : undefined,
      bijouType: cat === "bijou" ? dans(BIJOU_TYPES, o.bijou_type) : undefined,
      accessoireType: cat === "accessoire" ? dans(ACCESSOIRE_TYPES, o.accessoire_type) : undefined,
      couleur: { nom: couleurNom, hex: couleurHex },
      couleurLue: hex !== null,
      matiere: dans(MATIERES, o.matiere),
      manches,
      boite,
    });
  }
  const gardes = [...objets].sort((a, b) => b.boite.l * b.boite.h - a.boite.l * a.boite.h).slice(0, OBJETS_MAX);
  return gardes.sort((a, b) => (Math.abs(a.boite.y - b.boite.y) > 0.05 ? a.boite.y - b.boite.y : a.boite.x - b.boite.x));
}

export interface Rectangle {
  x: number;
  y: number;
  l: number;
  h: number;
}

/** La boîte d'un objet en pixels, élargie d'une marge (part de la plus grande dimension de la boîte) pour ne pas rogner l'ombre ni un bord, et bornée à l'image. */
export function rectangleDeRecadrage(largeur: number, hauteur: number, boite: BoiteNormalisee, marge = 0.04): Rectangle {
  const m = Math.max(boite.l * largeur, boite.h * hauteur) * marge;
  const x0 = Math.max(0, Math.floor(boite.x * largeur - m));
  const y0 = Math.max(0, Math.floor(boite.y * hauteur - m));
  const x1 = Math.min(largeur, Math.ceil((boite.x + boite.l) * largeur + m));
  const y1 = Math.min(hauteur, Math.ceil((boite.y + boite.h) * hauteur + m));
  return { x: x0, y: y0, l: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Copie un rectangle de pixels RGBA (4 octets par pixel, lignes consécutives) — pur, testable sans image. */
export function recadrerPixels(data: Uint8ClampedArray | Uint8Array, largeur: number, hauteur: number, r: Rectangle): { data: Uint8ClampedArray; width: number; height: number } {
  const sortie = new Uint8ClampedArray(r.l * r.h * 4);
  for (let ligne = 0; ligne < r.h; ligne++) {
    const debut = ((r.y + ligne) * largeur + r.x) * 4;
    sortie.set(data.subarray(debut, debut + r.l * 4), ligne * r.l * 4);
  }
  void hauteur;
  return { data: sortie, width: r.l, height: r.h };
}

/** `{user}/{uuid}.jpg` + 2 devient `{user}/{uuid}.o2.detouree.plat.webp` : même dossier, marque « détourée » et « à plat » (cf. detourage.ts). */
export function cheminObjet(cheminOriginal: string, indice: number, ext: "webp" | "png" = "webp"): string {
  const base = cheminOriginal.replace(/\.[^./]+$/, "");
  return `${base}.o${indice}.detouree.plat.${ext}`;
}

/** L'image à plat de toute la tenue (transparente), pour la montrer à côté de la photo — sans marque « détourée » : ce n'est la photo d'aucune pièce. */
export function cheminTenue(cheminOriginal: string, ext: "webp" | "png" = "webp"): string {
  return `${cheminOriginal.replace(/\.[^./]+$/, "")}.tenue.${ext}`;
}
