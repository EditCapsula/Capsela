import { estDeSaison, type ContexteSaisonnier } from "./capsule";
import { occasionShortLabel } from "./data";
import { MIN_PIECES_DRESSING_ASSOCIATION, associationsNouvelles, categoriesManquantes } from "./dressingEcran";
import { getOutfitsForItem } from "./logic";
import { resolveItemImage } from "./catalogImages";
import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import type { Weather } from "./data";
import { clePieces } from "./outfitFeedback";
import { inactivityInfo } from "./selectors";
import type { Gender } from "./profile";
import type { CategoryKey, HistoryEntry, Item, OccasionKey, SavedLook } from "./types";

/*
 * LES SECTIONS DE L'ÉCRAN DRESSING, V6 (08/10/2026) — des fonctions pures, testées ; l'écran ne fait que les afficher.
 * Aucune donnée inventée : une section sans donnée ne s'affiche pas (les fonctions rendent alors une liste vide).
 */

// ── INTRO ────────────────────────────────────────────────────────────

/** « 12 pièces · 5 catégories » — jamais de places restantes (retirées le 08/10/2026). */
export function ligneDressing(nbPieces: number, nbCategories: number): string {
  return `${nbPieces} ${nbPieces <= 1 ? "pièce" : "pièces"} · ${nbCategories} ${nbCategories <= 1 ? "catégorie" : "catégories"}`;
}

// ── AJOUTÉES RÉCEMMENT ───────────────────────────────────────────────

/**
 * LES DERNIÈRES PIÈCES = LES 30 DERNIERS JOURS (08/10/2026, décidé) : découverte et inspiration. Le Dressing, lui, est tout le
 * vestiaire — gestion et exploration. Une pièce plus ancienne n'est jamais « récente », même si c'est la dernière ajoutée.
 */
export const JOURS_DERNIERES_PIECES = 30;

/** Les pièces ajoutées ces 30 derniers jours, par date d'ajout décroissante, et rien d'autre : ni saison, ni usage. Une pièce sans date d'ajout n'y figure pas. */
export function piecesRecentes(items: Item[], max = 8, maintenant: number = Date.now()): Item[] {
  const limite = debutDeJour(maintenant) - JOURS_DERNIERES_PIECES * 86_400_000;
  return items
    .filter((i): i is Item & { createdAt: number } => typeof i.createdAt === "number" && i.createdAt >= limite)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
}

const debutDeJour = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** « Ajoutée aujourd'hui », « Ajoutée hier », « Ajoutée il y a N jours » (au-delà de 30 jours : en mois). Jours calendaires, pas multiples de 24 h. */
export function dateRelativeAjout(createdAt: number, maintenant: number = Date.now()): string {
  const jours = Math.max(0, Math.round((debutDeJour(maintenant) - debutDeJour(createdAt)) / 86_400_000));
  if (jours === 0) return "Ajoutée aujourd'hui";
  if (jours === 1) return "Ajoutée hier";
  if (jours <= 30) return `Ajoutée il y a ${jours} jours`;
  return `Ajoutée il y a ${Math.round(jours / 30)} mois`;
}

// ── À REDÉCOUVRIR ────────────────────────────────────────────────────

/** Au-delà de ce nombre de ports, une pièce n'est plus « à redécouvrir ». ARBITRAGE ÉDITORIAL du 08/10/2026 : « peu porté » = deux fois au plus. */
export const PORTS_MAX_A_REDECOUVRIR = 2;

export type EtiquettePortee = "Jamais porté" | "Peu porté" | "Porté 1 fois" | "À réinventer";

/**
 * Le nombre de ports d'une pièce : celui de l'historique, et au moins 1 quand `worn` dit qu'elle a déjà été portée (un historique
 * tronqué ne la fait jamais passer pour « jamais portée »).
 */
export function portsDe(item: Item, parPiece: Map<number, number>): number {
  return Math.max(parPiece.get(item.id) ?? 0, item.worn != null ? 1 : 0);
}

export function etiquettePortee(item: Item, ports: number): EtiquettePortee {
  if (ports === 0) return inactivityInfo(item).inactive ? "À réinventer" : "Jamais porté";
  return ports === 1 ? "Porté 1 fois" : "Peu porté";
}

/**
 * Les pièces du dressing à remettre en jeu : DE SAISON (la saison courante de la météo, la règle du moteur — `estDeSaison`), et
 * portées deux fois au plus. Jamais une pièce hors saison. Les moins portées d'abord, puis celles qui n'ont pas servi pendant leur
 * dernière saison, puis les plus anciennes. L'appelant retire celles qui n'ont aucun look possible (le moteur décide, pas ici).
 */
export function candidatsARedecouvrir(
  items: Item[],
  contexte: ContexteSaisonnier,
  parPiece: Map<number, number>,
  max = 12
): { piece: Item; etiquette: EtiquettePortee; ports: number }[] {
  return items
    .filter((i) => estDeSaison(i, contexte))
    .map((piece) => ({ piece, ports: portsDe(piece, parPiece) }))
    .filter(({ ports }) => ports <= PORTS_MAX_A_REDECOUVRIR)
    .map(({ piece, ports }) => ({ piece, ports, etiquette: etiquettePortee(piece, ports) }))
    .sort(
      (a, b) =>
        a.ports - b.ports ||
        Number(b.etiquette === "À réinventer") - Number(a.etiquette === "À réinventer") ||
        (a.piece.createdAt ?? 0) - (b.piece.createdAt ?? 0)
    )
    .slice(0, max);
}

const ARTICLE_PAR_CAT: Partial<Record<CategoryKey, "ton" | "ta" | "tes">> = {
  haut: "ton",
  pull: "ton",
  pantalon: "ton",
  jean: "ton",
  jupe: "ta",
  short: "ton",
  robe: "ta",
  combinaison: "ta",
  veste: "ta",
  manteau: "ton",
  chaussures: "tes",
  sac: "ton",
};

const PARTENAIRES: Partial<Record<CategoryKey, CategoryKey[]>> = {
  haut: ["pantalon", "jean", "jupe", "short"],
  pull: ["pantalon", "jean", "jupe", "short"],
  pantalon: ["haut", "pull"],
  jean: ["haut", "pull"],
  jupe: ["haut", "pull"],
  short: ["haut", "pull"],
  robe: ["veste", "chaussures"],
  combinaison: ["veste", "chaussures"],
  veste: ["haut", "pull", "robe"],
  manteau: ["pull", "haut", "pantalon"],
  chaussures: ["pantalon", "jean", "jupe", "robe"],
  sac: ["pantalon", "jean", "jupe", "robe"],
};

/**
 * « Avec ton pantalon tailleur » : une pièce DU DRESSING que le moteur a réellement associée à celle-ci (`tenues` = les ids de ses
 * tenues). Rien quand aucune tenue ne la porte avec une autre pièce du dressing — la phrase ne dit jamais plus que le moteur.
 */
export function pisteAssociation(pivot: Item, tenues: number[][], items: Item[]): string | null {
  const parId = new Map(items.map((i) => [i.id, i]));
  const voulues = PARTENAIRES[pivot.cat] ?? [];
  let repli: Item | null = null;
  for (const ids of tenues) {
    const autres = ids.filter((id) => id !== pivot.id).map((id) => parId.get(id)).filter((p): p is Item => !!p);
    for (const cat of voulues) {
      const trouve = autres.find((p) => p.cat === cat);
      if (trouve) return phrasePiste(trouve);
    }
    repli ??= autres[0] ?? null;
  }
  return repli ? phrasePiste(repli) : null;
}

export function phrasePiste(p: Item): string {
  const nom = p.name.trim();
  const article = ARTICLE_PAR_CAT[p.cat];
  return article ? `Avec ${article} ${nom.charAt(0).toLowerCase()}${nom.slice(1)}` : `Avec ${nom}`;
}

// ── TES LOOKS ────────────────────────────────────────────────────────

export function saisonDeLaDate(ts: number): "Printemps" | "Été" | "Automne" | "Hiver" {
  const m = new Date(ts).getMonth() + 1;
  if (m >= 3 && m <= 5) return "Printemps";
  if (m >= 6 && m <= 8) return "Été";
  if (m >= 9 && m <= 11) return "Automne";
  return "Hiver";
}

/** « Tenue du 08/10 » — le nom qu'un look enregistré depuis cette carte reçoit aussi (store.tsx, basculerLookDeTenue). */
export function titreTenue(ts: number): string {
  const d = new Date(ts);
  return `Tenue du ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface LookRecent {
  cle: string;
  ids: number[];
  ts: number;
  titre: string;
  /** « {occasion} · {saison} » — chaque morceau seulement s'il est connu. */
  meta: string;
  occasion?: OccasionKey;
  /** Le look enregistré qui porte exactement ces pièces, s'il existe. */
  enregistre: SavedLook | null;
}

/**
 * Les looks récents du Dressing : les tenues PORTÉES (l'historique) et les looks déjà enregistrés, un seul par jeu de pièces, les
 * plus récents d'abord. Une tenue dont moins de deux pièces se retrouvent n'est pas un look à montrer.
 */
export function looksRecents(history: HistoryEntry[], savedLooks: SavedLook[], pool: Item[], max = 2): LookRecent[] {
  const connues = new Set(pool.map((i) => i.id));
  const parCle = new Map<string, LookRecent>();
  const ajouter = (ids: number[], ts: number, occasion: OccasionKey | undefined, titreSaisi: string | null) => {
    if (ids.filter((id) => connues.has(id)).length < 2) return;
    const cle = clePieces(ids).join(",");
    const enregistre = savedLooks.find((l) => clePieces(l.pieceIds).join(",") === cle) ?? null;
    const existant = parCle.get(cle);
    if (existant && existant.ts >= ts) return;
    parCle.set(cle, {
      cle,
      ids,
      ts,
      titre: enregistre?.name ?? titreSaisi ?? titreTenue(ts),
      meta: [occasion && occasion !== "all" ? occasionShortLabel(occasion) : null, saisonDeLaDate(ts)].filter(Boolean).join(" · "),
      occasion,
      enregistre,
    });
  };
  for (const h of history) ajouter(h.pieceIds, h.ts, h.occasion, null);
  for (const l of savedLooks) ajouter(l.pieceIds, l.createdAt, l.occasion, l.name);
  return [...parCle.values()].sort((a, b) => b.ts - a.ts).slice(0, max);
}

// ── RECOMMANDATION ───────────────────────────────────────────────────

/**
 * Une pièce de la capsule dont le dressing n'a encore aucune catégorie, et le nombre d'associations NOUVELLES (ni un look enregistré,
 * ni une tenue déjà portée) que le moteur compose avec elle et au moins deux pièces du dressing. `null` quand rien n'est calculable :
 * la carte n'existe pas. Le nombre n'est jamais estimé.
 */
export function recommandationPiece(p: {
  items: Item[];
  capsule: Item[];
  weather: Weather;
  hexes: string[];
  gender: Gender | null;
  colorimetrie: ColorimetrieMoteur | null;
  dejaVues: number[][];
}): { pivot: Item; nombre: number } | null {
  if (p.items.length === 0) return null;
  const possedees = new Set(p.items.map((i) => i.id));
  for (const cat of categoriesManquantes(p.capsule, p.items)) {
    const delaCat = p.capsule.filter((c) => c.cat === cat);
    const pivot = delaCat.find((c) => resolveItemImage(c).url) ?? delaCat[0];
    if (!pivot) continue;
    const tenues = getOutfitsForItem(pivot.id, [...p.items, pivot], p.weather, p.hexes, { maxPerOccasion: 3, maxTotal: 18 }, p.gender, null, p.colorimetrie);
    const nouvelles = associationsNouvelles(tenues, p.dejaVues).filter((t) => t.ids.filter((id) => possedees.has(id)).length >= MIN_PIECES_DRESSING_ASSOCIATION);
    if (nouvelles.length > 0) return { pivot, nombre: nouvelles.length };
  }
  return null;
}

// ── TES DERNIÈRES PIÈCES (écran « Voir tout », 08/10/2026) ──────────

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** Jusqu'à ce nombre de jours (aujourd'hui compris), une pièce est de « cette semaine ». */
export const JOURS_CETTE_SEMAINE = 6;

const joursDepuis = (ts: number, maintenant: number) => Math.max(0, Math.round((debutDeJour(maintenant) - debutDeJour(ts)) / 86_400_000));

/** « Aujourd'hui », « Hier », « Il y a 3 jours » pour la semaine ; « 22 sept. » au-delà. */
export function libelleDateRecente(ts: number, maintenant: number = Date.now()): string {
  const j = joursDepuis(ts, maintenant);
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return "Hier";
  if (j <= JOURS_CETTE_SEMAINE) return `Il y a ${j} jours`;
  const d = new Date(ts);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

/** Les pièces (déjà triées) séparées en « cette semaine » et « un peu plus tôt ». Une section vide n'existe pas côté écran. */
export function separerParSemaine<T extends { createdAt?: number }>(pieces: T[], maintenant: number = Date.now()): { semaine: T[]; avant: T[] } {
  const semaine: T[] = [];
  const avant: T[] = [];
  for (const p of pieces) (typeof p.createdAt === "number" && joursDepuis(p.createdAt, maintenant) <= JOURS_CETTE_SEMAINE ? semaine : avant).push(p);
  return { semaine, avant };
}

/** « 1 look possible », « 4 looks possibles » — rien quand il n'y en a pas : la ligne ne dit jamais un nombre que le moteur n'a pas trouvé. */
export function libelleLooksPossibles(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? "look possible" : "looks possibles"}` : null;
}

/** Le nombre de looks DISTINCTS (même jeu de pièces = un seul) parmi des idées de plusieurs pièces. */
export function looksDistincts(parPiece: number[][][]): number {
  return new Set(parPiece.flatMap((tenues) => tenues.map((ids) => clePieces(ids).join(",")))).size;
}
