import { MONTHS_FR, OCC_LABELS, occasionShortLabel } from "./data";
import { isCatalogId } from "./catalog";
import { occasionsOf } from "./capsule";
import type { CategoryKey, HistoryEntry, Item, OccasionKey, SavedLook, Season } from "./types";

/**
 * "Wishlist" (Mes looks, recette 23/08/2026) n'est pas une 3ᵉ façon
 * d'enregistrer un look : c'est un filtre calculé sur les looks existants
 * (Enregistrés ou Créés par moi) qui contiennent encore au moins une pièce
 * suggérée pas encore possédée.
 */
export function isWishlistLook(look: SavedLook): boolean {
  return look.pieceIds.some((id) => isCatalogId(id));
}

/** Nombre de fois où la combinaison exacte d'un look a été portée (même jeu de pièces dans l'historique), jamais un compteur séparé et désynchronisable. */
export function lookWornCount(look: SavedLook, history: HistoryEntry[]): number {
  const key = [...look.pieceIds].sort((a, b) => a - b).join(",");
  return history.filter((h) => [...h.pieceIds].sort((a, b) => a - b).join(",") === key).length;
}

export function neverWornItems(pool: Item[]): Item[] {
  return pool.filter((i) => i.worn == null);
}

/**
 * Pièces de la capsule active jamais portées (recette 20/08/2026, "À
 * redécouvrir" du Journal) — distinct de neverWornItems (dressing réel
 * uniquement) : porte sur le pool effectif affiché (réel + suggestions),
 * jamais présentes dans l'historique des tenues portées.
 */
export function neverWornInPool(pool: Item[], history: HistoryEntry[]): Item[] {
  return pool.filter((i) => !wornFromHistory(history, i.id));
}

const MONTHS = MONTHS_FR;
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** "Porté récemment" est déclaré uniquement via l'action explicite "marquer comme porté" (Journal), jamais déduit d'une simple suggestion ou tenue générée. */
export function wornFromHistory(history: HistoryEntry[], id: number): boolean {
  return history.some((h) => h.pieceIds.includes(id));
}

/** Nombre de ports par pièce, dérivé exclusivement de l'historique réel. */
export function wearCounts(history: HistoryEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  history.forEach((h) => h.pieceIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  return counts;
}

/**
 * Jours écoulés depuis le dernier port réel d'une pièce, dérivé de la date
 * de la plus récente entrée d'historique qui la contient — jamais du champ
 * Item.worn stocké (correctif 25/08/2026, signalé : "Aujourd'hui" restait
 * affiché indéfiniment). worn n'est mis à jour QUE par une action "porter"
 * explicite (wearPieceToday/wearOutfitToday/wearLookToday, store.tsx), qui
 * le fige à 0 — rien ne le fait ensuite "vieillir" jour après jour tant
 * qu'aucune nouvelle action n'est déclenchée : une pièce portée il y a 3
 * semaines restait donc affichée "Porté aujourd'hui" jusqu'à son prochain
 * port réel. null si la pièce n'apparaît dans aucune entrée d'historique
 * (jamais porté).
 */
export function daysSinceWorn(history: HistoryEntry[], itemId: number): number | null {
  let latestTs: number | null = null;
  for (const h of history) {
    if (h.pieceIds.includes(itemId) && (latestTs == null || h.ts > latestTs)) latestTs = h.ts;
  }
  if (latestTs == null) return null;
  return Math.max(0, Math.floor((Date.now() - latestTs) / 86400000));
}

/**
 * Durée minimale de présence dans le dressing au cours d'une saison (ou en
 * continu pour "Toutes saisons") pour qu'elle "compte" comme une vraie
 * occasion manquée (recette 25/08/2026, "Jamais portées") — une pièce
 * ajoutée en toute fin de saison n'a pas eu de chance réelle d'être
 * portée pendant celle-ci (ex. ajoutée le 25 août : l'été qui se termine
 * ne doit pas jouer contre elle). Même durée que l'ancien seuil continu
 * ad hoc de PieceScreen, désormais remplacé par inactivityInfo — un seul
 * repère dans toute l'app.
 */
const MIN_SEASON_PRESENCE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fenêtre calendaire la plus récente déjà entièrement écoulée pour le
 * bucket saisonnier d'une pièce. Item.season ne distingue que 2 buckets
 * (Printemps / Été combinés, Automne / Hiver combinés) — jamais les 4
 * saisons individuelles : une pièce du dressing réel n'a pas de
 * granularité plus fine (capsuleSeasons, source vestiaire_universel
 * uniquement, n'existe jamais pour elle, cf. son commentaire dans
 * types.ts). "Toutes saisons" n'a pas de fenêtre calendaire : gérée à
 * part par un seuil continu (cf. inactivityInfo).
 */
function lastCompletedSeasonWindow(season: Season, now: number): { start: number; end: number } | null {
  if (season === "Toutes saisons") return null;
  const isWarm = season === "Printemps / Été";
  const windowFor = (y: number) =>
    isWarm
      ? { start: new Date(y, 2, 1).getTime(), end: new Date(y, 8, 1).getTime() } // 1 mars → 1 sept
      : { start: new Date(y, 8, 1).getTime(), end: new Date(y + 1, 2, 1).getTime() }; // 1 sept → 1 mars
  let year = new Date(now).getFullYear();
  let w = windowFor(year);
  while (w.end > now) {
    year -= 1;
    w = windowFor(year);
  }
  return w;
}

export interface InactivityInfo {
  /** true seulement si une fenêtre saisonnière pertinente (ou le seuil continu pour "Toutes saisons") est déjà entièrement écoulée sans port, ET que la pièce était présente assez longtemps pendant celle-ci. */
  inactive: boolean;
  /** Libellé de la période concernée pour un message contextualisé (ex. "le printemps/été dernier") — null si "Toutes saisons" (seuil continu, aucune saison à nommer) ou si inactive est false. */
  periodLabel: string | null;
}

const INACTIVE_NONE: InactivityInfo = { inactive: false, periodLabel: null };

/**
 * Détecte une pièce "candidate à la réactivation" (recette 25/08/2026,
 * brief "Jamais portées") — distinct de "jamais portée" (aucun port
 * enregistré, un simple fait) : ici, une saison pertinente entière (ou le
 * seuil continu pour "Toutes saisons") s'est écoulée sans port ALORS que
 * la pièce était déjà présente assez longtemps pour avoir eu sa chance.
 * Jamais calculé sur la seule ancienneté en mois, sans tenir compte de la
 * saison de la pièce (une pièce Été qui n'a pas été portée cet hiver
 * n'est jamais inactive pour cette raison — ce n'est pas sa saison).
 * Ne fait jamais rien pour une pièce déjà portée au moins une fois (worn
 * != null) : ce module ne concerne que le cas "jamais portée".
 */
export function inactivityInfo(item: Item): InactivityInfo {
  if (item.worn != null) return INACTIVE_NONE;
  if (item.createdAt == null) return INACTIVE_NONE;
  const now = Date.now();

  if (item.season === "Toutes saisons") {
    return now - item.createdAt >= MIN_SEASON_PRESENCE_MS ? { inactive: true, periodLabel: null } : INACTIVE_NONE;
  }

  const w = lastCompletedSeasonWindow(item.season, now);
  if (!w) return INACTIVE_NONE;
  const presenceStart = Math.max(item.createdAt, w.start);
  if (w.end - presenceStart < MIN_SEASON_PRESENCE_MS) return INACTIVE_NONE;
  const periodLabel = item.season === "Printemps / Été" ? "le printemps/été dernier" : "l'automne/hiver dernier";
  return { inactive: true, periodLabel };
}

/**
 * La saison la plus récente déjà entièrement écoulée, quel que soit son type
 * (printemps/été OU automne/hiver) — celle des deux fenêtres de
 * lastCompletedSeasonWindow qui s'est terminée le plus tard. Sert de
 * "dernière saison" à une pièce "Toutes saisons", qui n'en a pas de propre.
 */
function lastCompletedAnyWindow(now: number): { start: number; end: number } {
  const chaude = lastCompletedSeasonWindow("Printemps / Été", now)!;
  const froide = lastCompletedSeasonWindow("Automne / Hiver", now)!;
  return chaude.end > froide.end ? chaude : froide;
}

/**
 * Les deux saisons écoulées les plus récentes, bout à bout — soit une année
 * pleine, jamais une durée fixe de 365 jours : même découpage au 1er mars et
 * au 1er septembre que lastCompletedSeasonWindow. `ancienneFin` est la fin de
 * la plus ancienne des deux, pour vérifier la présence minimale.
 */
function deuxDernieresSaisons(now: number): { start: number; end: number; ancienneFin: number } {
  const chaude = lastCompletedSeasonWindow("Printemps / Été", now)!;
  const froide = lastCompletedSeasonWindow("Automne / Hiver", now)!;
  const ancienne = chaude.start < froide.start ? chaude : froide;
  return { start: ancienne.start, end: Math.max(chaude.end, froide.end), ancienneFin: ancienne.end };
}

const MS_PAR_MOIS = 30.4375 * 24 * 60 * 60 * 1000;

/**
 * Où en est une pièce dans sa vie portée (refonte du Journal, 25/09/2026).
 * Les quatre cas du brief, §7 :
 *
 * - "jamais"    : aucune entrée d'historique ne la contient ;
 * - "recente"   : portée pendant sa dernière saison écoulée, ou depuis ;
 * - "delaissee" : pas portée de toute sa dernière saison écoulée, alors
 *                 qu'elle était déjà là — « À sortir du placard » ;
 * - "a_vendre"  : pas portée des deux dernières saisons écoulées, bout à
 *                 bout (une année pleine) — « à envisager de vendre ».
 *
 * AUCUN SEUIL NOUVEAU. Règle arbitrée le 25/09/2026 (« Règle existante, par
 * saison ») : on reprend les fenêtres de inactivityInfo (1er mars / 1er
 * septembre, jamais une ancienneté brute en mois) et son seuil de présence
 * MIN_SEASON_PRESENCE_MS. inactivityInfo reste inchangée : elle ne parle que
 * des pièces jamais portées, et deux écrans en dépendent (Jamais portées,
 * fiche pièce). Cette fonction-ci couvre en plus les pièces portées il y a
 * longtemps, qu'elle ignorait.
 *
 * Une pièce d'été non portée cet hiver n'est jamais "délaissée" pour ça : on
 * compare au printemps/été écoulé. Une pièce "Toutes saisons" est comparée à
 * la plus récente saison écoulée, quelle qu'elle soit.
 *
 * "a_vendre" n'est rendu que pour une pièce du dressing réel (createdAt
 * connu) : une suggestion du catalogue ne s'achète pas, elle ne se revend
 * donc pas. Pour une pièce jamais portée, la même exigence de présence
 * s'applique : ajoutée il y a trois semaines, elle n'est candidate à rien.
 *
 * Le dernier port est lu dans l'historique réel (comme daysSinceWorn),
 * jamais dans Item.worn, figé par la dernière action « porter ».
 */
export type EtatPort = "jamais" | "recente" | "delaissee" | "a_vendre";

export interface EtatDePort {
  etat: EtatPort;
  /** Horodatage du dernier port réel, null si jamais portée. */
  dernierPort: number | null;
  /** Mois pleins écoulés depuis le dernier port, null si jamais portée. */
  moisSansPort: number | null;
}

export function etatDePort(item: Item, history: HistoryEntry[], now: number = Date.now()): EtatDePort {
  let dernier: number | null = null;
  let premier: number | null = null;
  for (const h of history) {
    if (!h.pieceIds.includes(item.id)) continue;
    if (dernier == null || h.ts > dernier) dernier = h.ts;
    if (premier == null || h.ts < premier) premier = h.ts;
  }
  const annee = deuxDernieresSaisons(now);
  // Présente depuis quand : son ajout au dressing, ou à défaut son premier
  // port (on ne porte pas une pièce qu'on n'a pas encore).
  const presenceDepuis = Math.min(item.createdAt ?? Infinity, premier ?? Infinity);
  const presenteToutLAnnee =
    item.createdAt != null && annee.ancienneFin - Math.max(presenceDepuis, annee.start) >= MIN_SEASON_PRESENCE_MS;

  if (dernier == null) {
    return { etat: presenteToutLAnnee ? "a_vendre" : "jamais", dernierPort: null, moisSansPort: null };
  }

  const moisSansPort = moisDepuis(dernier, now);
  const saison = item.season === "Toutes saisons" ? lastCompletedAnyWindow(now) : lastCompletedSeasonWindow(item.season, now)!;
  if (dernier >= saison.start) return { etat: "recente", dernierPort: dernier, moisSansPort };

  if (dernier < annee.start && presenteToutLAnnee) return { etat: "a_vendre", dernierPort: dernier, moisSansPort };
  const presenceSaison = saison.end - Math.max(presenceDepuis, saison.start);
  return { etat: presenceSaison >= MIN_SEASON_PRESENCE_MS ? "delaissee" : "recente", dernierPort: dernier, moisSansPort };
}

/** Mois pleins écoulés depuis un horodatage — même mesure pour « sans port » et « dans ton dressing depuis ». */
export function moisDepuis(ts: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - ts) / MS_PAR_MOIS));
}

/** « octobre 2025 » — le mois et l'année d'un dernier port, sans le jour : à cette distance, le jour ne dit plus rien. */
export function moisAnnee(ts: number): string {
  const d = new Date(ts);
  return MONTHS[d.getMonth()] + " " + d.getFullYear();
}

/**
 * LA BASE UNIQUE DES CHIFFRES DU JOURNAL (audit du 25/09/2026).
 *
 * L'incohérence corrigée : « 1 pièce utilisée » et « 33 % de ta capsule
 * portée » venaient de journalStats — pièces du DRESSING RÉEL seulement, via
 * le champ figé Item.worn — pendant que « 17 pièces attendent », les pièces
 * fétiches et la timeline lisaient l'HISTORIQUE sur le pool affiché (dressing
 * réel + suggestions de la capsule). Une utilisatrice qui porte surtout des
 * pièces de sa capsule voyait donc 1 pièce utilisée à côté de 17 pièces
 * non portées et de trois pièces fétiches.
 *
 * Une seule base désormais, pour toutes les métriques du Journal : le pool
 * affiché (la capsule telle qu'elle la voit), et l'historique réel.
 *   portees + jamais === total,  pourcentage = portees / total.
 * journalStats reste inchangée : « Mes pièces » et « Jamais portées »
 * continuent de compter le dressing réel, ce qui est leur périmètre.
 */
export interface CapsuleJournal {
  total: number;
  /** Pièces uniques du pool présentes dans au moins une tenue portée. */
  portees: number;
  /** Pièces du pool absentes de tout l'historique. */
  jamais: number;
  pourcentage: number;
}

export function capsuleJournal(pool: Item[], history: HistoryEntry[]): CapsuleJournal {
  const portesIds = new Set(history.flatMap((h) => h.pieceIds));
  const ids = new Set(pool.map((i) => i.id));
  const total = ids.size;
  const portees = [...ids].filter((id) => portesIds.has(id)).length;
  return { total, portees, jamais: total - portees, pourcentage: total ? Math.round((portees / total) * 100) : 0 };
}

export interface JournalStats {
  total: number;
  worn: number;
  never: number;
  pctWorn: number;
  hasItems: boolean;
  wornThisWeek: number;
  /** Rotation réelle du dressing (recette 23/08/2026) — remplace la mise en avant du seul "% déjà porté", qui perd tout intérêt une fois à 100 %. */
  wornOften: number;
  wornRarely: number;
}

/**
 * Statistiques du Journal : part du dressing réel déjà portée (au moins une
 * fois), rotation (souvent/peu portées), et tenues portées cette semaine.
 *
 * Correctif 26/08/2026 (signalé : "1 pièce pas encore portée" dans le
 * Journal alors que "Mes pièces"/"Jamais portées" en comptaient 2) —
 * `never`/`worn`/`pctWorn` dérivaient d'une présence dans l'historique
 * (wearCounts), un second repère qui pouvait diverger du champ Item.worn
 * (ex. une pièce "Corrigée" après un port par erreur : worn revient à null,
 * mais l'entrée d'historique correspondante, elle, n'est jamais retirée).
 * Utilise désormais neverWornItems (même source que Mes pièces/Jamais
 * portées, item.worn === null) : un seul repère "jamais portée" dans toute
 * l'app, jamais deux calculs qui peuvent se contredire. wornOften/wornRarely
 * restent basés sur les comptes réels de l'historique (fréquence de port,
 * pas simple présence/absence).
 */
export function journalStats(items: Item[], history: HistoryEntry[]): JournalStats {
  const total = items.length;
  const counts = wearCounts(history);
  const never = neverWornItems(items).length;
  const worn = total - never;
  const pctWorn = total ? Math.round((worn / total) * 100) : 0;
  const wornOften = items.filter((i) => (counts.get(i.id) || 0) >= 3).length;
  const wornRarely = items.filter((i) => {
    const c = counts.get(i.id) || 0;
    return c >= 1 && c <= 2;
  }).length;
  const wornThisWeek = history.filter((h) => {
    const diffDays = (Date.now() - h.ts) / 86400000;
    return diffDays >= 0 && diffDays < 7;
  }).length;
  return { total, worn, never, pctWorn, hasItems: total > 0, wornThisWeek, wornOften, wornRarely };
}

export interface JournalInsights {
  wornThisMonth: number;
  distinctPiecesWornThisMonth: number;
  /** Occasion dominante du mois, null si moins de 3 tenues ce mois-ci — la clé, pour qu'un écran puisse en tirer sa propre phrase. */
  topOccasion: OccasionKey | null;
  /** Libellé court de l'occasion dominante du mois (ex. "Quotidien"), null si moins de 3 tenues ce mois-ci. */
  topOccasionShort: string | null;
  /** Part (0-100) des tenues du mois relevant de l'occasion dominante. */
  topOccasionShare: number | null;
}

/**
 * "Ton mois en chiffres" (recette 23/08/2026) — toutes les statistiques de
 * ce bloc partagent la même période de référence (mois civil en cours),
 * dérivées exclusivement de l'historique réellement enregistré, jamais de
 * chiffre inventé. topOccasionShort est null s'il n'y a pas assez de
 * données pour dégager une tendance (moins de 3 tenues ce mois-ci).
 */
export function journalInsights(history: HistoryEntry[]): JournalInsights {
  const now = new Date();
  const monthHistory = history.filter((h) => {
    const d = new Date(h.ts);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const wornThisMonth = monthHistory.length;
  const distinctPiecesWornThisMonth = new Set(monthHistory.flatMap((h) => h.pieceIds)).size;

  const occCounts = new Map<OccasionKey, number>();
  monthHistory.forEach((h) => {
    if (!h.occasion || h.occasion === "all") return;
    occCounts.set(h.occasion, (occCounts.get(h.occasion) || 0) + 1);
  });
  let topOccasion: OccasionKey | null = null;
  let topOccasionShort: string | null = null;
  let topOccasionShare: number | null = null;
  if (occCounts.size > 0 && monthHistory.length >= 3) {
    const [topKey, topCount] = [...occCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    topOccasion = topKey;
    topOccasionShort = occasionShortLabel(topKey);
    topOccasionShare = Math.round((topCount / monthHistory.length) * 100);
  }

  return { wornThisMonth, distinctPiecesWornThisMonth, topOccasion, topOccasionShort, topOccasionShare };
}

/** Nouveaux looks enregistrés (Créer un look) ce mois-ci — distinct des tenues portées : ne compte que les looks explicitement sauvegardés. */
export function newLooksThisMonth(savedLooks: SavedLook[]): number {
  const now = new Date();
  return savedLooks.filter((l) => {
    const d = new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

/** Nombre de tenues portées par jour sur les `days` derniers jours (aujourd'hui inclus), du plus ancien au plus récent — pour un sparkline d'activité réelle, jamais de série inventée. */
export function dailyActivity(history: HistoryEntry[], days = 10): number[] {
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const counts = new Array(days).fill(0);
  history.forEach((h) => {
    const d = new Date(h.ts);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((todayMid.getTime() - d.getTime()) / 864e5);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  });
  return counts;
}

export interface MostWornPiece {
  item: Item;
  count: number;
}

/** Top des pièces les plus portées (recette 23/08/2026, Top 3) — classées par fréquence réelle depuis l'historique, sans seuil minimum : sur une capsule jeune, exiger 2 ports laissait le Top vide ou clairsemé. */
export function mostWornPieces(history: HistoryEntry[], pool: Item[], limit = 3): MostWornPiece[] {
  const counts = wearCounts(history);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const item = pool.find((i) => i.id === id);
      return item ? { item, count } : null;
    })
    .filter((x): x is MostWornPiece => Boolean(x));
}

export type JournalPeriod = "today" | "yesterday" | "week" | "earlier";

export interface JournalEntry {
  id: string;
  ts: number;
  /** « 25 septembre », avec l'année si ce n'est pas l'année en cours. */
  jour: string;
  rel: string;
  period: JournalPeriod;
  hasOccasion: boolean;
  occLabel: string;
  occasion: OccasionKey;
  summary: string;
  swatches: Item[];
  pieceIds: number[];
}

/**
 * Liste plate des tenues portées, la plus récente en premier, groupable par
 * période (today/yesterday/week/earlier — recette 23/08/2026). Les entrées
 * dont aucune pièce ne se résout dans le pool (données incomplètes, ex.
 * pièce supprimée depuis) sont exclues plutôt que d'occuper une card vide.
 */
export function journalEntries(history: HistoryEntry[], pool: Item[]): JournalEntry[] {
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  return [...history]
    .sort((a, b) => b.ts - a.ts)
    .map((h) => {
      const d = new Date(h.ts);
      const dMid = new Date(d);
      dMid.setHours(0, 0, 0, 0);
      const diff = Math.round((todayMid.getTime() - dMid.getTime()) / 864e5);
      const rel = diff <= 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : DAYS_SHORT[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      const period: JournalPeriod = diff <= 0 ? "today" : diff === 1 ? "yesterday" : diff <= 6 ? "week" : "earlier";
      const pcs = h.pieceIds.map((id) => pool.find((i) => i.id === id)).filter(Boolean) as Item[];
      const jour = d.getDate() + " " + MONTHS[d.getMonth()] + (d.getFullYear() !== todayMid.getFullYear() ? " " + d.getFullYear() : "");
      const occ = h.occasion && h.occasion !== "all" ? OCC_LABELS[h.occasion] : "";
      return {
        id: h.id,
        ts: h.ts,
        jour,
        rel,
        period,
        hasOccasion: !!occ,
        occLabel: occ,
        occasion: h.occasion || "all",
        summary: pcs.map((p) => p.name).join(" · "),
        swatches: pcs,
        pieceIds: [...h.pieceIds],
      };
    })
    .filter((e) => e.swatches.length > 0);
}

/**
 * Le pool de génération : ce que le moteur a le droit de proposer aujourd'hui.
 *
 * RÈGLE DE BASE, inchangée — les vraies affaires priment. Catégorie par
 * catégorie : dès que l'utilisatrice possède au moins une pièce, ce sont les
 * siennes qui servent, et les suggestions du catalogue s'effacent. Une femme
 * qui a rentré cinq hauts ne veut pas qu'on lui propose un sixième haut
 * qu'elle n'a pas.
 *
 * LE DÉFAUT QUE CETTE FONCTION CORRIGE (mesuré le 10/09/2026, signalé :
 * « pourquoi je n'ai pas de tenues de sport »). Cette règle est TOUT OU RIEN.
 * Posséder un seul haut écarte tous les hauts du catalogue, y compris le seul
 * qui servait une occasion que l'utilisatrice ne couvre pas encore. Croisé
 * avec `FORMALITY_FALLBACK_CHAIN`, où le sport est la seule occasion sans
 * repli, l'effet mesuré est net : sur les dix occasions, neuf restent à 100 %
 * de tenue et le sport tombe de 100 % à 0 %. Pas dégradé — perdu, et perdu
 * au moment précis où l'app devient la sienne.
 *
 * LA COMPLÉTION. Quand `completerPourOccasion` est fourni, une catégorie dont
 * AUCUNE pièce réelle ne déclare cette occasion se voit rendre les pièces du
 * catalogue qui, elles, la déclarent. Trois limites tiennent le correctif
 * étroit :
 *
 *   · par catégorie — celles que les vraies pièces savent servir ne changent
 *     pas d'un iota ;
 *   · pour cette occasion seulement — on n'ajoute jamais une pièce qui ne la
 *     déclare pas ;
 *   · en complément, jamais en remplacement — les pièces réelles restent
 *     toutes dans le pool et gardent leurs chances au tirage.
 *
 * Sans le paramètre, le comportement est exactement celui d'avant : c'est ce
 * qui permet de mesurer les deux bras dans une même exécution, sur le même
 * pool, sans dupliquer le pipeline (règle d'audit, AGENTS.md).
 */
export function composeWardrobePool(
  items: Item[],
  capsule: Item[],
  cats: readonly CategoryKey[],
  options?: { completerPourOccasion?: OccasionKey | null }
): Item[] {
  const occasion = options?.completerPourOccasion ?? null;
  return cats.flatMap((cat) => {
    const reelles = items.filter((i) => i.cat === cat);
    if (!reelles.length) return capsule.filter((i) => i.cat === cat);
    if (!occasion) return reelles;
    if (reelles.some((i) => occasionsOf(i).includes(occasion))) return reelles;
    const secours = capsule.filter(
      (i) => i.cat === cat && !reelles.some((r) => r.id === i.id) && occasionsOf(i).includes(occasion)
    );
    return [...reelles, ...secours];
  });
}

/**
 * MESSAGE ENVOYÉ À UN PROCHE pour lui demander son avis sur la tenue du jour
 * (23/09/2026) — les quatre déclarations qui suivent en forment le tout.
 *
 * Écrit ici, pas dans l'écran, pour une raison précise : c'est
 * la seule chose de cette fonctionnalité qui soit testable hors rendu, et
 * c'est aussi la seule qui puisse être FAUSSE sans que rien ne plante — un
 * message qui décrirait une autre tenue que celle affichée.
 *
 * Construit depuis les pièces réellement composées, jamais depuis un
 * libellé recopié. Chaque partie est omise si sa donnée manque plutôt que
 * remplacée par un défaut : une météo inventée dans un message envoyé à
 * quelqu'un est pire qu'une météo absente.
 *
 * Aucune mention de provenance dressing/capsule : le proche n'a pas à savoir
 * ce que l'utilisatrice possède déjà, et la question posée est vestimentaire,
 * pas patrimoniale.
 */
export interface OpinionMessageParts {
  /** Première ligne : « Ma tenue du jour », suivie du contexte s'il existe. */
  titre: string;
  /** Un nom de pièce par entrée, SANS la puce — elle appartient au rendu. */
  pieces: string[];
  /** La question ferme le message, toujours. */
  question: string;
}

/**
 * Les PARTIES du message, avant mise en forme.
 *
 * Ajoutées le 23/09/2026 avec la maquette « Demander un avis » : l'écran y
 * affiche le message en lecture sous forme composée — titre en gras, pièces
 * à puces terracotta, question en serif italique — et non plus dans une
 * zone de texte brute.
 *
 * POURQUOI LES PARTIES ET PAS UN DÉCOUPAGE DU TEXTE. Le risque de cet écran
 * n'est pas qu'il soit laid, c'est qu'il affiche autre chose que ce qu'il
 * envoie. Un composant qui re-fendrait la chaîne sur "\n" et retirerait les
 * puces à la main serait une SECONDE implémentation du format, libre de
 * dériver. Ici la chaîne est construite À PARTIR des parties : les deux ne
 * peuvent pas diverger, puisqu'il n'y a qu'une source.
 */
export function buildOpinionMessageParts(args: {
  pieces: Item[];
  occasion: OccasionKey;
  temp: number | null | undefined;
  conditionMeteo: string | null | undefined;
}): OpinionMessageParts {
  const { pieces, occasion, temp, conditionMeteo } = args;

  const contexte: string[] = [];
  if (occasion !== "all" && OCC_LABELS[occasion]) contexte.push(OCC_LABELS[occasion]);
  if (temp != null && Number.isFinite(temp)) {
    contexte.push(conditionMeteo ? `${Math.round(temp)}° · ${conditionMeteo}` : `${Math.round(temp)}°`);
  }

  return {
    titre: contexte.length ? `Ma tenue du jour — ${contexte.join(" · ")}` : "Ma tenue du jour",
    pieces: pieces.map((p) => p.name),
    question: "Qu'est-ce que tu en penses ?",
  };
}

/** Le message tel qu'il PART — assemblé depuis les parties, jamais à côté d'elles. */
export function formatOpinionMessage(parts: OpinionMessageParts): string {
  return [parts.titre, "", ...parts.pieces.map((n) => `• ${n}`), "", parts.question].join("\n");
}

/** Le message complet, en une fois — forme d'appel historique, conservée. */
export function buildOpinionMessage(args: {
  pieces: Item[];
  occasion: OccasionKey;
  temp: number | null | undefined;
  conditionMeteo: string | null | undefined;
}): string {
  return formatOpinionMessage(buildOpinionMessageParts(args));
}
