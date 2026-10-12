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
  aUnMotif,
  BIJOU_TYPES,
  CATEGORY_KEYS,
  MATIERES,
  MOTIFS,
  nearestPaletteColor,
  PALETTE,
  PALETTE_BIJOU,
  SAC_TYPES,
  SHOE_TYPES,
  SUBTYPES,
  type CategoryKey,
  type Motif,
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
  /** Le motif lu (11/10/2026), jamais pour un bijou ; absent quand le modèle n'est pas sûr. */
  motif?: Motif;
  /** Les saisons suggérées par la lecture (12/10/2026) : une ou plusieurs de la liste, dans l'ordre de l'année ; absentes quand le modèle n'est pas sûr. */
  saisons?: string[];
  boite: BoiteNormalisee;
}

export function promptTenue(): string {
  const sousTypes = JSON.stringify(SUBTYPES);
  return [
    "Tu lis la photo d'une tenue de mode (portée, posée à plat ou sur cintre) pour une app de garde-robe. Repère chaque article distinct : vêtement, chaussures, sac, bijou, accessoire.",
    `Pour chaque article, indique cat EXACTEMENT parmi : ${CATEGORY_KEYS.join(", ")}.`,
    `Selon la catégorie, indique sous_type EXACTEMENT parmi la liste associée (JSON, clé = catégorie) : ${sousTypes}. Ignore les catégories sans liste.`,
    `cat = "chaussures" : shoe_type EXACTEMENT parmi : ${SHOE_TYPES.join(", ")}.`,
    `cat = "sac" : sac_type EXACTEMENT parmi : ${SAC_TYPES.join(", ")}.`,
    `cat = "bijou" : bijou_type EXACTEMENT parmi : ${BIJOU_TYPES.join(", ")}.`,
    `cat = "accessoire" : accessoire_type EXACTEMENT parmi : ${ACCESSOIRE_TYPES.join(", ")}.`,
    `Si tu distingues la matière principale : matiere EXACTEMENT parmi : ${MATIERES.join(", ")}, sinon null.`,
    `Pour ${CATEGORIES_A_MANCHES.join(", ")} : manches EXACTEMENT parmi sans, courtes, trois_quarts, longues (sans = sans manches ou bretelles, courtes = jusqu'au coude, trois_quarts = jusqu'à mi-avant-bras, longues = jusqu'au poignet ou au-delà), sinon null. Pour toute autre catégorie : null.`,
    `Sauf pour un bijou, indique motif EXACTEMENT parmi ${MOTIFS.join(", ")} (uni = une seule couleur ; graphique = formes, lettres, logos ou dessin abstrait), sinon null : ne donne un motif que s'il est net. color_hex reste la teinte DOMINANTE de l'objet.`,
    "saisons : la liste des saisons où cet article se porte, parmi Printemps, Été, Automne, Hiver (une ou plusieurs ; ex. un manteau en laine : Automne, Hiver ; un débardeur en lin : Printemps, Été), d'après la matière, l'épaisseur et la coupe visibles ; si tu n'es pas raisonnablement sûr, saisons = null.",
    "color_hex : ta meilleure estimation de la couleur dominante de L'ARTICLE, en hex #RRGGBB.",
    "nom : un nom court en français (ex. « Robe longue fleurie », « Sac en raphia »).",
    "boite : [x, y, l, h] — la boîte la plus SERRÉE qui contient TOUT l'article visible, de son bord le plus haut à son bord le plus bas et de son bord gauche à son bord droit (un pantalon : de la ceinture jusqu'à l'ourlet ; des chaussures : les deux chaussures), en fractions de la largeur et de la hauteur de l'image (0 à 1), (x, y) étant le coin haut-gauche. Vérifie que la boîte ne contient AUCUN autre article en grande partie, et ne coupe jamais l'article.",
    "Règles : une paire de chaussures est UN article (une boîte autour des deux) ; plusieurs bracelets posés ensemble sont UN article ; ne liste jamais une partie du corps ni un décor ; ne devine pas un article caché ou coupé. Au plus 8 articles. Si tu n'es pas raisonnablement sûr d'un champ, mets null plutôt que de deviner.",
    'Réponds UNIQUEMENT en JSON strict : {"objets":[{"nom":string,"cat":string,"sous_type":string|null,"shoe_type":string|null,"sac_type":string|null,"bijou_type":string|null,"accessoire_type":string|null,"matiere":string|null,"manches":string|null,"motif":string|null,"saisons":string[]|null,"color_hex":string|null,"boite":[number,number,number,number]}]}.',
  ].join("\n");
}

const SAISONS_LUES = ["Printemps", "Été", "Automne", "Hiver"] as const;
/** Seulement les saisons de la liste, sans doublon, dans l'ordre de l'année ; rien si le modèle n'en a pas rendu. */
export function saisonsLues(brut: unknown): string[] | undefined {
  if (!Array.isArray(brut)) return undefined;
  const l = SAISONS_LUES.filter((s) => brut.includes(s));
  return l.length ? l : undefined;
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
      motif: aUnMotif(cat) ? (dans(MOTIFS, o.motif) as Motif | undefined) : undefined,
      saisons: saisonsLues(o.saisons),
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

/**
 * Le rectangle qui entoure ce que le détourage a GARDÉ (pixels dont l'alpha dépasse `seuil`), élargi d'une petite marge et borné à l'image
 * (11/10/2026, demandé : « la photo de la pièce retenue doit être cadrée sur la pièce »). Le recadrage d'une boîte laisse une grande part
 * transparente autour de la pièce ; la pièce se montre alors petite dans sa tuile. Rend null quand rien n'a été gardé (détourage vide) :
 * l'objet n'est pas proposé, jamais une image transparente.
 */
export function rectangleOpaque(data: Uint8ClampedArray | Uint8Array, largeur: number, hauteur: number, seuil = 16, marge = 0.03): Rectangle | null {
  let x0 = largeur;
  let y0 = hauteur;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (data[(y * largeur + x) * 4 + 3] > seuil) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = Math.round(Math.max(x1 - x0 + 1, y1 - y0 + 1) * marge);
  const gx0 = Math.max(0, x0 - m);
  const gy0 = Math.max(0, y0 - m);
  const gx1 = Math.min(largeur, x1 + 1 + m);
  const gy1 = Math.min(hauteur, y1 + 1 + m);
  return { x: gx0, y: gy0, l: gx1 - gx0, h: gy1 - gy0 };
}

/**
 * LA VÉRIFICATION D'UN RECADRAGE (12/10/2026, signalé : une « veste » qui montrait la personne entière, un « sac » qui montrait un pantalon,
 * des « chaussures » qui montraient du sol). Une boîte lue sur toute la photo est imprécise ; le même modèle regarde de plus près le
 * RECADRAGE de l'article : il dit s'il y est vraiment, et où, dans ce recadrage. Absent : la pièce n'est pas proposée (et aucun détourage
 * payant n'est lancé). Présent : on recadre plus serré avant de détourer.
 */
export function promptVerificationRecadrage(o: { nom: string; cat: string }): string {
  return [
    `Cette image est le recadrage d'une photo de mode. Elle devrait montrer UN seul article : « ${o.nom} » (catégorie : ${o.cat}).`,
    "present : true seulement si cet article est clairement visible dans l'image, entier ou en grande partie ; false s'il est absent, à peine visible, ou si l'image montre surtout autre chose (un autre article, le sol, le décor, la personne).",
    "boite : [x, y, l, h] — la boîte la plus SERRÉE qui contient TOUT cet article visible dans CETTE image, en fractions de sa largeur et de sa hauteur (0 à 1), (x, y) étant le coin haut-gauche. Ne cadre jamais la personne entière ni un autre article ; null si present = false.",
    'Réponds UNIQUEMENT en JSON strict : {"present": boolean, "boite": [number, number, number, number] | null}.',
  ].join("\n");
}

export interface VerificationRecadrage {
  present: boolean;
  boite: BoiteNormalisee | null;
}

/** La réponse du modèle, vérifiée : une valeur invalide donne null (l'appelant garde alors son recadrage, il ne rejette rien sur une réponse illisible). */
export function assainerVerification(brut: unknown): VerificationRecadrage | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  if (typeof o.present !== "boolean") return null;
  if (!o.present) return { present: false, boite: null };
  return { present: true, boite: boiteValide(o.boite) };
}

/** La boîte (en fractions DU RECADRAGE) ramenée dans l'image d'origine, avec une petite marge, bornée à l'image. */
export function rectangleAffine(r: Rectangle, boite: BoiteNormalisee, largeurImage: number, hauteurImage: number, marge = 0.05): Rectangle {
  const sous = rectangleDeRecadrage(r.l, r.h, boite, marge);
  const x0 = Math.max(0, r.x + sous.x);
  const y0 = Math.max(0, r.y + sous.y);
  const x1 = Math.min(largeurImage, r.x + sous.x + sous.l);
  const y1 = Math.min(hauteurImage, r.y + sous.y + sous.h);
  return { x: x0, y: y0, l: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Marges de recadrage d'une boîte (part de sa plus grande dimension) : une première, puis une plus large si la pièce sort du cadre. */
export const MARGES_RECADRAGE = [0.08, 0.22] as const;
/** Part minimale / maximale du recadrage que doit occuper ce que le détourage a gardé, sinon ce n'est pas une pièce isolée. */
export const FRACTION_GARDEE_MIN = 0.05;
export const FRACTION_GARDEE_MAX = 0.92;

export interface AnalyseDecoupe {
  /** Part des pixels gardés (alpha > seuil), de 0 à 1. */
  fraction: number;
  /** Côtés où ce qui a été gardé touche le bord du recadrage : la pièce y est probablement COUPÉE par la boîte. */
  bords: { haut: boolean; bas: boolean; gauche: boolean; droite: boolean };
}

/**
 * Lit le résultat d'un détourage de recadrage (12/10/2026, signalé : un pantalon coupé à la jambe, une carte « Baskets » qui montrait du
 * sol). Deux contrôles que le service ne fait pas : la pièce touche-t-elle le bord du recadrage (boîte trop serrée), et occupe-t-elle une
 * part plausible du recadrage (≈ rien : pas de pièce ; ≈ tout : le fond n'a pas été retiré). Un bord n'est dit touché que si au moins 3 %
 * de sa longueur est gardée : un pixel isolé ne compte pas.
 */
export function analyserDecoupe(data: Uint8ClampedArray | Uint8Array, largeur: number, hauteur: number, seuil = 16): AnalyseDecoupe {
  let gardes = 0;
  const alpha = (x: number, y: number) => data[(y * largeur + x) * 4 + 3];
  for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) if (alpha(x, y) > seuil) gardes++;
  const part = (n: number, sur: number) => n >= Math.max(1, Math.ceil(sur * 0.03));
  let haut = 0, bas = 0, gauche = 0, droite = 0;
  for (let x = 0; x < largeur; x++) {
    if (alpha(x, 0) > seuil) haut++;
    if (alpha(x, hauteur - 1) > seuil) bas++;
  }
  for (let y = 0; y < hauteur; y++) {
    if (alpha(0, y) > seuil) gauche++;
    if (alpha(largeur - 1, y) > seuil) droite++;
  }
  return {
    fraction: gardes / (largeur * hauteur),
    bords: { haut: part(haut, largeur), bas: part(bas, largeur), gauche: part(gauche, hauteur), droite: part(droite, hauteur) },
  };
}

/**
 * Les côtés où la pièce est coupée PAR LA BOÎTE : ceux dont le recadrage n'est pas déjà au bord de l'image (là, la pièce est coupée par la
 * photo elle-même, un recadrage plus large n'y changerait rien).
 */
export function cotesCoupes(a: AnalyseDecoupe, r: Rectangle, largeurImage: number, hauteurImage: number): string[] {
  const l: string[] = [];
  if (a.bords.haut && r.y > 0) l.push("haut");
  if (a.bords.bas && r.y + r.h < hauteurImage) l.push("bas");
  if (a.bords.gauche && r.x > 0) l.push("gauche");
  if (a.bords.droite && r.x + r.l < largeurImage) l.push("droite");
  return l;
}

/**
 * `{user}/{uuid}.jpg` + 2 devient `{user}/{uuid}.o2.webp` : même dossier, SANS la marque « détourée » (12/10/2026) : c'est un recadrage brut,
 * détouré seulement à l'ajout de la pièce (detourer-photo l'écrit alors en `….o2.detouree.webp`, cf. detourage.ts).
 */
export function cheminObjet(cheminOriginal: string, indice: number, ext: "webp" | "png" = "webp"): string {
  const base = cheminOriginal.replace(/\.[^./]+$/, "");
  return `${base}.o${indice}.${ext}`;
}

/** L'image à plat de toute la tenue (transparente), pour la montrer à côté de la photo — sans marque « détourée » : ce n'est la photo d'aucune pièce. */
export function cheminTenue(cheminOriginal: string, ext: "webp" | "png" = "webp"): string {
  return `${cheminOriginal.replace(/\.[^./]+$/, "")}.tenue.${ext}`;
}
