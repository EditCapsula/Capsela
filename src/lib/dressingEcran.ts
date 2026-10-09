import type { Gender } from "./profile";
import type { EtatPremium } from "./premium";
import { LIMITE_DRESSING_GRATUIT } from "./premium";
import { resolveItemImage } from "./catalogImages";
import type { CategoryKey, Item } from "./types";

/*
 * DÉRIVÉS D'AFFICHAGE DE L'ÉCRAN DRESSING — refonte du 25/09/2026.
 *
 * Fonctions pures, testées : rien ici ne modifie une règle métier. La limite
 * du dressing gratuit reste `premium.ts` (LIMITE_DRESSING_GRATUIT,
 * peutAjouter, placesRestantes) ; ce module ne fait que la dire.
 */

// ── CATÉGORIES DU VESTIAIRE ────────────────────────────────────────────

/**
 * Regroupements D'AFFICHAGE des cartes « Mon vestiaire », par profil.
 *
 * CONFIGURATION LOCALE ET NON DESTRUCTIVE (arbitrage du 25/09/2026, « impact
 * minimal ») : elle ne sert qu'à construire les cartes de cette section. Les
 * 14 catégories techniques de `CATS` (data.ts) restent ce qu'elles sont
 * partout ailleurs — « haut » reste « haut », « pull » reste « pull » —, sans
 * renommage ni migration. Une carte ne fait que les additionner, et son clic
 * filtre « Mes pièces » sur ces mêmes catégories techniques.
 *
 * Ajouter « Cravates » ou « Maillots de bain » plus tard = une ligne ici (et
 * un visuel), sans toucher à l'écran.
 *
 * LES VISUELS sont les visuels éditoriaux livrés le 25/09/2026
 * (public/images/categories/<profil>_<id>.webp, 480×640).
 */
export interface GroupeDressing {
  id: string;
  label: string;
  categories: CategoryKey[];
}

const ROBES: GroupeDressing = { id: "robes-combinaisons", label: "Robes & combinaisons", categories: ["robe", "combinaison"] };
const HAUTS: GroupeDressing = { id: "hauts", label: "Hauts & mailles", categories: ["haut", "pull"] };
const JUPES: GroupeDressing = { id: "jupes", label: "Jupes", categories: ["jupe"] };
const BAS: GroupeDressing = { id: "pantalons-jeans-shorts", label: "Pantalons, jeans & shorts", categories: ["pantalon", "jean", "short"] };
const VESTES: GroupeDressing = { id: "vestes-manteaux", label: "Vestes & manteaux", categories: ["veste", "manteau"] };
const CHAUSSURES: GroupeDressing = { id: "chaussures", label: "Chaussures", categories: ["chaussures"] };
const SACS: GroupeDressing = { id: "sacs", label: "Sacs", categories: ["sac"] };
const BIJOUX: GroupeDressing = { id: "bijoux-accessoires", label: "Bijoux & accessoires", categories: ["bijou", "accessoire"] };

export const DRESSING_GROUPS: Record<Gender, GroupeDressing[]> = {
  femme: [ROBES, HAUTS, JUPES, BAS, VESTES, CHAUSSURES, SACS, BIJOUX],
  homme: [HAUTS, BAS, VESTES, CHAUSSURES, SACS, BIJOUX],
};

export interface GroupeAffiche {
  id: string;
  libelle: string;
  visuel: string;
  nbPieces: number;
  /** Catégories techniques additionnées — et filtre de « Mes pièces ». */
  categories: CategoryKey[];
  /** Pièces propres du dressing qui illustrent la carte ; vide = visuel éditorial. */
  propres: PieceVisuelCategorie[];
}

/**
 * Cartes à afficher : SEULEMENT les groupes où l'utilisatrice possède des
 * pièces (brief du 25/09/2026, point 6), dans l'ordre de la configuration ;
 * le compteur est la somme des pièces de leurs catégories techniques.
 *
 * AUCUNE PIÈCE SANS CARTE. La configuration homme ne prévoit ni robes, ni
 * combinaisons, ni jupes ; si une telle pièce est pourtant saisie, sa carte
 * « femme » s'affiche en fin de liste (avec son visuel) plutôt que de laisser
 * la pièce hors du vestiaire. Sans profil renseigné : configuration femme,
 * la seule qui couvre les 14 catégories.
 */
export function groupesDuVestiaire(items: Item[], gender: Gender | null): GroupeAffiche[] {
  const profil: Gender = gender ?? "femme";
  const propres = DRESSING_GROUPS[profil];
  const couvertes = new Set(propres.flatMap((g) => g.categories));
  const replis = DRESSING_GROUPS.femme.filter((g) => g.categories.every((c) => !couvertes.has(c)));
  return [
    ...propres.map((g) => ({ g, visuel: profil })),
    ...replis.map((g) => ({ g, visuel: "femme" as Gender })),
  ]
    .map(({ g, visuel }) => ({
      id: g.id,
      libelle: g.label,
      visuel: `/images/categories/${visuel}_${g.id}.webp`,
      nbPieces: items.filter((i) => g.categories.includes(i.cat)).length,
      categories: g.categories,
      propres: piecesPourVisuelCategorie(items, g.categories),
    }))
    .filter((g) => g.nbPieces > 0);
}

// ── VISUEL DES CARTES « PAR CATÉGORIE » ────────────────────────────────

/** Cases (en % de la tuile) selon le nombre de pièces ; tout reste au-dessus de la pastille de libellé (~25 % du bas). */
const CASES_VISUEL: Record<1 | 2 | 3, { l: number; t: number; w: number; h: number }[]> = {
  1: [{ l: 12, t: 8, w: 76, h: 62 }],
  2: [{ l: 4, t: 14, w: 50, h: 56 }, { l: 46, t: 10, w: 50, h: 56 }],
  3: [{ l: 6, t: 6, w: 46, h: 44 }, { l: 48, t: 6, w: 46, h: 44 }, { l: 27, t: 36, w: 46, h: 40 }],
};

export interface PieceVisuelCategorie {
  id: number;
  url: string;
  l: number;
  t: number;
  w: number;
  h: number;
}

/**
 * Pièces PROPRES du dressing qui illustrent une carte de catégorie (09/10/2026, demandé : les pièces détourées / mises à plat
 * remplacent les visuels éditoriaux). Une photo brute n'illustre pas (fond, personne) ; une pièce sans image non plus. Les
 * plus récentes d'abord, 3 au plus. Liste vide : la carte garde son visuel éditorial.
 */
export function piecesPourVisuelCategorie(items: Item[], categories: CategoryKey[], max = 3): PieceVisuelCategorie[] {
  const propres = items
    .filter((i) => categories.includes(i.cat))
    .map((i) => ({ id: i.id, image: resolveItemImage(i) }))
    .filter((p): p is { id: number; image: { kind: "detouree" | "affiliate" | "generated"; url: string } } =>
      !!p.image.url && (p.image.kind === "detouree" || p.image.kind === "affiliate" || p.image.kind === "generated"))
    .sort((a, b) => b.id - a.id)
    .slice(0, Math.min(max, 3));
  if (propres.length === 0) return [];
  const cases = CASES_VISUEL[propres.length as 1 | 2 | 3];
  return propres.map((p, k) => ({ id: p.id, url: p.image.url, ...cases[k] }));
}

// ── SYNTHÈSE DE L'EN-TÊTE ──────────────────────────────────────────────

const pieces = (n: number) => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
const categories = (n: number) => `${n} ${n <= 1 ? "catégorie" : "catégories"}`;

/**
 * « X / 20 pièces · Y catégories ».
 *
 * « / 20 » N'APPARAÎT QUE LORSQUE LA LIMITE S'APPLIQUE, c'est-à-dire en
 * gratuit vérifié — même règle que `placesRestantes` : jamais en Premium,
 * jamais tant que le droit n'a pas pu être vérifié (un paywall échoue en
 * ouvrant, premium.ts). Un dressing déjà au-delà de 20 (pièces saisies avant
 * la limite) ne lit pas « 23 / 20 » : il lit « 23 pièces », complet.
 */
export function syntheseDressing(
  etat: EtatPremium,
  nbPieces: number,
  nbCategories: number
): { texte: string; complet: boolean } {
  const limite = etat === "gratuit";
  const complet = limite && nbPieces >= LIMITE_DRESSING_GRATUIT;
  const compte =
    limite && nbPieces <= LIMITE_DRESSING_GRATUIT
      ? `${nbPieces} / ${LIMITE_DRESSING_GRATUIT} pièces`
      : pieces(nbPieces);
  return { texte: nbPieces === 0 ? compte : `${compte} · ${categories(nbCategories)}`, complet };
}

/**
 * L'en-tête du Dressing, en deux lignes (01/10/2026, signalé : « le nombre total
 * de pièces est manquant contrairement à la capsule » — il était là, en petit
 * gris). Ligne forte, comme « 39 pièces sélectionnées pour toi » de la Capsule :
 * « 7 pièces dans ton dressing ». Ligne de détail : les catégories, et — en
 * gratuit vérifié seulement, comme `syntheseDressing` — les places restantes
 * avant la limite. Premium ou droit inconnu : aucune limite annoncée.
 */
export function enteteDressing(etat: EtatPremium, nbPieces: number, nbCategories: number): { titre: string; detail: string } {
  const restantes = etat === "gratuit" ? Math.max(0, LIMITE_DRESSING_GRATUIT - nbPieces) : null;
  const parts = [categories(nbCategories)];
  if (restantes !== null) parts.push(restantes === 0 ? "dressing complet" : `${restantes} ${restantes === 1 ? "place restante" : "places restantes"}`);
  return { titre: `${pieces(nbPieces)} dans ton dressing`, detail: parts.join(" · ") };
}

// ── À DÉCOUVRIR ────────────────────────────────────────────────────────

const cle = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");

/**
 * Tenues composées par le moteur qui sont réellement NOUVELLES : ni un look
 * déjà enregistré, ni une tenue déjà portée, ni un doublon entre elles. C'est
 * ce qui rend vraie la phrase « Capsela a imaginé N nouvelles associations ».
 */
export function associationsNouvelles<T extends { ids: number[] }>(tenues: T[], dejaVues: number[][]): T[] {
  const vues = new Set(dejaVues.map(cle));
  const gardees: T[] = [];
  for (const t of tenues) {
    if (t.ids.length < 2) continue;
    const k = cle(t.ids);
    if (vues.has(k)) continue;
    vues.add(k);
    gardees.push(t);
  }
  return gardees;
}

/**
 * Nombre minimal de pièces DU DRESSING dans une association pour qu'elle se dise
 * « avec tes pièces » (01/10/2026, demandé : une tenue incomplète se complète de
 * suggestions de la capsule). Sous ce seuil, ce serait un look de la capsule
 * habillé de ses pièces : il n'a plus sa place dans « Ton dressing peut déjà
 * faire plus ». ARBITRAGE ÉDITORIAL, à ajuster.
 */
export const MIN_PIECES_DRESSING_ASSOCIATION = 2;

/** L'association contient assez de pièces du dressing — les autres sont des suggestions de la capsule. */
export function assezDuDressing(ids: number[], dressing: Item[], minimum = MIN_PIECES_DRESSING_ASSOCIATION): boolean {
  const miennes = new Set(dressing.map((i) => i.id));
  return ids.filter((id) => miennes.has(id)).length >= minimum;
}

/** Catégories de la capsule calculée dont le dressing n'a encore aucune pièce. */
export function categoriesManquantes(capsule: Item[], items: Item[]): CategoryKey[] {
  const possedees = new Set(items.map((i) => i.cat));
  return [...new Set(capsule.map((c) => c.cat))].filter((c) => !possedees.has(c));
}

/** Seuil à partir duquel on ne pousse plus à ajouter (brief, cas 3) : 18 sur 20. */
export const SEUIL_PROCHE_LIMITE = LIMITE_DRESSING_GRATUIT - 2;

export type ADecouvrir =
  | { cas: "associations"; nombre: number }
  | { cas: "manque" }
  | { cas: "proche_limite"; nbPieces: number }
  | null;

/**
 * Contenu de « ✦ À découvrir », piloté par des données existantes
 * (arbitrage recommandé, retenu le 25/09/2026) :
 *
 *   - proche de la limite gratuite (≥ 18 pièces) : JAMAIS d'incitation à
 *     ajouter — seulement de nouvelles façons de porter ce qu'on a ;
 *   - sinon, des associations nouvelles composées par le moteur avec les
 *     seules pièces du dressing ;
 *   - sinon, une catégorie de la capsule absente du dressing ;
 *   - sinon rien : la section ne s'affiche pas.
 */
export function choisirADecouvrir(p: {
  etat: EtatPremium;
  nbPieces: number;
  nbAssociations: number;
  nbManques: number;
}): ADecouvrir {
  if (p.nbPieces === 0) return null;
  if (p.etat === "gratuit" && p.nbPieces >= SEUIL_PROCHE_LIMITE) return { cas: "proche_limite", nbPieces: p.nbPieces };
  if (p.nbAssociations > 0) return { cas: "associations", nombre: p.nbAssociations };
  if (p.nbManques > 0) return { cas: "manque" };
  return null;
}
