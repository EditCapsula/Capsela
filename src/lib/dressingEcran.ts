import type { Gender } from "./profile";
import type { EtatPremium } from "./premium";
import { LIMITE_DRESSING_GRATUIT } from "./premium";
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
 * Regroupements d'affichage des 14 catégories de `CATS` (data.ts).
 *
 * UNE CONFIGURATION, PAS UN TEST DE GENRE DANS L'ÉCRAN. Chaque groupe dit
 * quelles catégories il couvre, sous quel libellé et avec quel visuel selon
 * le profil. Ajouter « Cravates » ou « Maillots de bain » plus tard = une
 * ligne ici (et un visuel), sans toucher à l'écran.
 *
 * POURQUOI PAS « CHEMISES » NI « COSTUMES » (arbitrage recommandé, retenu le
 * 25/09/2026) : les données ne les distinguent pas. « Haut » couvre T-shirts,
 * chemises et blouses, dont le sous-type est facultatif ; aucune catégorie
 * « costume » n'existe. Un rangement fondé sur un champ facultatif mettrait
 * une chemise sans sous-type dans « Hauts » et sa voisine dans « Chemises ».
 *
 * LES VISUELS sont les visuels éditoriaux livrés le 25/09/2026
 * (public/images/categories/, 480×640, réduits depuis 900×1200). Le profil
 * homme n'en a pas pour Robes ni Jupes : le visuel femme sert de repli, pour
 * qu'une pièce possédée ne soit jamais présentée sans image.
 *
 * Toutes les catégories de CATS sont couvertes : aucune pièce du dressing
 * ne peut tomber hors d'un groupe (vérifié par les tests).
 */
export interface GroupeVestiaire {
  id: string;
  cats: CategoryKey[];
  libelle: string;
  /** Libellé propre à un profil, quand il diffère. */
  libelleProfil?: Partial<Record<Gender, string>>;
  /** Profils pour lesquels un visuel existe, dans l'ordre de repli. */
  visuels: Gender[];
}

export const GROUPES_VESTIAIRE: GroupeVestiaire[] = [
  { id: "robes-combinaisons", cats: ["robe", "combinaison"], libelle: "Robes & combinaisons", visuels: ["femme"] },
  { id: "hauts", cats: ["haut", "pull"], libelle: "Hauts", visuels: ["femme", "homme"] },
  { id: "jupes", cats: ["jupe"], libelle: "Jupes", visuels: ["femme"] },
  { id: "pantalons-jeans-shorts", cats: ["pantalon", "jean", "short"], libelle: "Pantalons & jeans", visuels: ["femme", "homme"] },
  { id: "vestes-manteaux", cats: ["veste", "manteau"], libelle: "Vestes & manteaux", visuels: ["femme", "homme"] },
  { id: "chaussures", cats: ["chaussures"], libelle: "Chaussures", visuels: ["femme", "homme"] },
  { id: "sacs", cats: ["sac"], libelle: "Sacs", visuels: ["femme", "homme"] },
  {
    id: "bijoux-accessoires",
    cats: ["accessoire", "bijou"],
    libelle: "Accessoires & bijoux",
    libelleProfil: { homme: "Accessoires" },
    visuels: ["femme", "homme"],
  },
];

export interface GroupeAffiche {
  id: string;
  libelle: string;
  visuel: string;
  nbPieces: number;
  /** Catégories couvertes — pour filtrer l'écran « Mes pièces ». */
  cats: CategoryKey[];
}

export function libelleGroupe(g: GroupeVestiaire, gender: Gender | null): string {
  return (gender && g.libelleProfil?.[gender]) || g.libelle;
}

/** Visuel du groupe pour ce profil ; repli sur le premier visuel existant. */
export function visuelGroupe(g: GroupeVestiaire, gender: Gender | null): string {
  const profil = gender && g.visuels.includes(gender) ? gender : g.visuels[0];
  return `/images/categories/${profil}_${g.id}.webp`;
}

/**
 * Groupes à afficher : SEULEMENT ceux où l'utilisatrice possède des pièces
 * (brief du 25/09/2026, point 6 — un vestiaire personnel, pas un formulaire
 * à remplir). Ordre de la configuration.
 */
export function groupesDuVestiaire(items: Item[], gender: Gender | null): GroupeAffiche[] {
  return GROUPES_VESTIAIRE.map((g) => ({
    id: g.id,
    libelle: libelleGroupe(g, gender),
    visuel: visuelGroupe(g, gender),
    nbPieces: items.filter((i) => g.cats.includes(i.cat)).length,
    cats: g.cats,
  })).filter((g) => g.nbPieces > 0);
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
