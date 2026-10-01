import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import { isRainy, type Weather } from "./data";
import { computeLookScore, generateOutfitWithFallback, type GeneratedOutfitWithFallback } from "./logic";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "./types";
import type { HistoryEntry } from "./types";
import type { TenuePlanifiee } from "./planifier";

/*
 * DIVERSIFICATION DES TENUES SUR CINQ JOURS (01/10/2026).
 *
 * LA CAUSE. « Tenue du jour » tirait chaque jour UN look indépendamment, sans
 * mémoire de ce qu'elle avait proposé les jours précédents : seule `worn`
 * (jours depuis le dernier PORTER validé, R-S15) pesait dans le tirage, d'un
 * facteur 1 à 4, et jamais ce qui avait été RECOMMANDÉ sans être validé. Sur un
 * dressing modeste, la même chemise et le même jean ressortaient donc d'un jour
 * à l'autre.
 *
 * LA COUCHE. Elle vient APRÈS les contraintes, jamais à leur place :
 *   1. la météo, l'occasion, la saison, les règles de composition filtrent
 *      déjà ce que le moteur peut produire (generateOutfit, intact) ;
 *   2. on tire plusieurs tenues de ce moteur — toutes éligibles, par construction ;
 *   3. on garde les assez pertinentes (score d'origine, computeLookScore, à
 *      MARGE_PERTINENCE du meilleur) ;
 *   4. parmi elles, on retient celle qui maximise  score − pénalité de répétition.
 * La diversité ne peut donc rendre éligible aucune tenue que la météo écartait :
 * elle ne départage que des tenues déjà compatibles. Aucun aléa n'est ajouté :
 * le choix est une fonction des candidats et de l'historique.
 *
 * LA PÉNALITÉ dépend de ce qui se répète (pièces structurantes lourdes,
 * chaussures et vestes légères), de l'ancienneté (hier pèse plus qu'il y a
 * cinq jours) ET DE LA MÉTÉO de ce jour-là : une pièce répétée par un temps très
 * différent n'est pas une redite, c'est la météo qui change la tenue.
 */

/** Fenêtre glissante : J-1 à J-5. L'écart 0 est la tenue actuellement affichée (« Autre tenue »). */
export const FENETRE_JOURS = 5;
/** Tenues tirées dans le moteur à chaque génération quand il existe un historique. */
export const CANDIDATS_DIVERSITE = 16;
/** Une tenue plus faible que la meilleure de plus de ce nombre de points n'est jamais retenue pour sa nouveauté. */
export const MARGE_PERTINENCE = 12;
/** La pénalité totale ne dépasse jamais l'échelle du score (0-100). */
export const PENALITE_MAX = 100;

export type Niveau = 1 | 2 | 3;

const STRUCTURANTES: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
const LEGERES: CategoryKey[] = ["chaussures", "veste", "manteau"];

/** 1 : pièces qui font la tenue ; 2 : accessoires, sac, bijoux ; 3 : chaussures et vestes, réutilisables. */
export function niveauPiece(cat: CategoryKey): Niveau {
  if (STRUCTURANTES.includes(cat)) return 1;
  if (LEGERES.includes(cat)) return 3;
  return 2;
}

/** Pénalité d'une pièce répétée, par niveau puis par écart en jours (0 = tenue affichée, 1 = hier…). */
export const POIDS_PIECE: Record<Niveau, Record<number, number>> = {
  1: { 0: 30, 1: 24, 2: 16, 3: 10, 4: 5, 5: 3 },
  2: { 0: 8, 1: 6, 2: 4, 3: 2, 4: 1, 5: 1 },
  3: { 0: 4, 1: 3, 2: 1, 3: 0, 4: 0, 5: 0 },
};

/** Le look, au niveau de la tenue : multiplié par la récence. */
export const POIDS_LOOK = { exact: 60, principales: 40, uneSeulePrincipale: 15 } as const;
export const MULTIPLICATEUR_RECENCE: Record<number, number> = { 0: 1.2, 1: 1, 2: 0.8, 3: 0.6, 4: 0.4, 5: 0.3 };

export interface LookRecent {
  /** 0 : la tenue affichée ; 1 à 5 : il y a N jours. */
  ecart: number;
  ids: number[];
  /** La météo de ce jour-là, quand on la connaît. Inconnue : aucune réduction n'est appliquée. */
  temp: number | null;
  label: string | null;
}

/**
 * Dans quelle mesure deux journées ont-elles la même météo ? 1 : identique, la
 * répétition compte en entier ; vers 0 : la météo seule explique le changement.
 * Une météo inconnue ne réduit rien (on ne prétend pas une différence qu'on ne voit pas).
 */
export function facteurMeteo(jour: { temp: number; label: string }, recent: { temp: number | null; label: string | null }): number {
  if (recent.temp == null || recent.label == null) return 1;
  if (isRainy(jour) !== isRainy({ label: recent.label })) return 0.25;
  const ecartTemp = Math.abs(jour.temp - recent.temp);
  if (ecartTemp <= 3) return 1;
  if (ecartTemp <= 6) return 0.6;
  if (ecartTemp <= 10) return 0.3;
  return 0.1;
}

const catDe = (id: number, pool: Item[]): CategoryKey | null => pool.find((p) => p.id === id)?.cat ?? null;
const memes = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/** Les pièces structurantes d'une tenue : la signature qui ignore chaussures, vestes et accessoires. */
export function piecesPrincipales(ids: number[], pool: Item[]): number[] {
  return ids.filter((id) => STRUCTURANTES.includes(catDe(id, pool) as CategoryKey)).sort((a, b) => a - b);
}

export interface DetailPenalite {
  total: number;
  /** Détail par jour récent, pour expliquer un choix. */
  parJour: { ecart: number; facteurMeteo: number; pieces: number; look: number; points: number }[];
}

/**
 * La pénalité de répétition d'une tenue candidate, au regard des tenues récentes
 * et de la météo du jour. Pure et explicable.
 */
export function penaliteDiversite(candidatIds: number[], recents: LookRecent[], pool: Item[], meteo: { temp: number; label: string }): DetailPenalite {
  const principalesCandidat = piecesPrincipales(candidatIds, pool);
  const parJour: DetailPenalite["parJour"] = [];
  let total = 0;
  for (const r of recents) {
    const mult = MULTIPLICATEUR_RECENCE[r.ecart] ?? 0;
    const poids = (n: Niveau) => POIDS_PIECE[n][r.ecart] ?? 0;
    // Les pièces répétées, chacune à son niveau.
    let pieces = 0;
    for (const id of candidatIds) {
      if (!r.ids.includes(id)) continue;
      const cat = catDe(id, pool);
      if (cat) pieces += poids(niveauPiece(cat));
    }
    // Le look dans son ensemble : identique, mêmes pièces principales, ou une seule des deux.
    let look = 0;
    const principalesRecent = piecesPrincipales(r.ids, pool);
    if (candidatIds.length && memes(candidatIds, r.ids)) look += POIDS_LOOK.exact * mult;
    if (principalesCandidat.length && memes(principalesCandidat, principalesRecent)) look += POIDS_LOOK.principales * mult;
    else if (principalesCandidat.length > 1 && principalesCandidat.some((id) => principalesRecent.includes(id))) {
      look += POIDS_LOOK.uneSeulePrincipale * mult;
    }
    const f = facteurMeteo(meteo, r);
    const points = (pieces + look) * f;
    parJour.push({ ecart: r.ecart, facteurMeteo: f, pieces, look, points });
    total += points;
  }
  return { total: Math.min(PENALITE_MAX, Math.round(total * 10) / 10), parJour };
}

export interface CandidatNote {
  ids: number[];
  /** Score d'origine du look (computeLookScore), 0-100. */
  score: number;
}

export interface ChoixDiversifie {
  /** Index du candidat retenu dans la liste fournie. */
  index: number;
  penalite: number;
  scoreFinal: number;
  /** Combien de candidats étaient assez pertinents pour être départagés. */
  eligibles: number;
}

/**
 * Parmi des candidats TOUS compatibles (la météo, l'occasion, la saison ont déjà
 * joué), retient celui de meilleur  score − pénalité, entre les assez pertinents.
 * Égalité : le premier généré. Sans historique, ou si aucune pénalité ne
 * s'applique : le premier candidat, c'est-à-dire le tirage d'origine, inchangé.
 */
export function choisirParDiversite(candidats: CandidatNote[], recents: LookRecent[], pool: Item[], meteo: { temp: number; label: string }): ChoixDiversifie {
  if (!candidats.length) return { index: -1, penalite: 0, scoreFinal: 0, eligibles: 0 };
  const penalites = candidats.map((c) => penaliteDiversite(c.ids, recents, pool, meteo).total);
  if (!recents.length || penalites.every((p) => p === 0)) return { index: 0, penalite: 0, scoreFinal: candidats[0].score, eligibles: candidats.length };
  const meilleur = Math.max(...candidats.map((c) => c.score));
  let index = -1;
  let scoreFinal = -Infinity;
  let eligibles = 0;
  candidats.forEach((c, i) => {
    if (c.score < meilleur - MARGE_PERTINENCE) return;
    eligibles++;
    const final = c.score - penalites[i];
    if (final > scoreFinal) {
      scoreFinal = final;
      index = i;
    }
  });
  return { index, penalite: penalites[index], scoreFinal, eligibles };
}

// ── L'historique ────────────────────────────────────────────────────────────

/** AAAA-MM-JJ moins `n` jours, en date locale (midi, pour ne pas dépendre de l'heure d'été). */
export function jourMoins(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(a, m - 1, j - n, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RecommandationJour {
  ids: number[];
  temp: number | null;
  label: string | null;
}

const jourDe = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Les tenues des cinq jours qui précèdent `jour`, depuis les sources que l'app
 * garde déjà : ce qui a été PORTÉ (historique validé), ce qui a été PLANIFIÉ, et
 * ce qui a été RECOMMANDÉ puis affiché (recommandationsRecentes.ts — la seule
 * source ajoutée, parce que rien ne gardait une recommandation non validée). La
 * tenue affichée aujourd'hui (`actuelle`) entre à l'écart 0.
 */
export function recentsDuJour(e: {
  jour: string;
  portees: HistoryEntry[];
  planifiees: TenuePlanifiee[];
  recommandees: Record<string, RecommandationJour>;
  actuelle?: RecommandationJour | null;
}): LookRecent[] {
  const out: LookRecent[] = [];
  const ajoute = (ecart: number, l: RecommandationJour) => {
    if (!l.ids.length || out.some((o) => o.ecart === ecart && memes(o.ids, l.ids))) return;
    out.push({ ecart, ids: [...l.ids], temp: l.temp, label: l.label });
  };
  if (e.actuelle) ajoute(0, e.actuelle);
  for (let ecart = 1; ecart <= FENETRE_JOURS; ecart++) {
    const j = jourMoins(e.jour, ecart);
    for (const h of e.portees) if (jourDe(h.ts) === j) ajoute(ecart, { ids: h.pieceIds, temp: h.temp ?? null, label: h.weatherLabel ?? null });
    for (const p of e.planifiees) if (p.jour === j) ajoute(ecart, { ids: p.pieceIds, temp: p.temp, label: p.weatherLabel });
    const r = e.recommandees[j];
    if (r) ajoute(ecart, r);
  }
  return out;
}

// ── Le moteur, avec la couche ───────────────────────────────────────────────

export interface ParametresDiversifies {
  pool: Item[];
  weather: Weather;
  occasion: OccasionKey;
  workMode: WorkMode;
  dateContext: DateContext;
  preferredHexes: string[];
  gender: "femme" | "homme" | null;
  morphology: string | null;
  colorimetrie?: ColorimetrieMoteur | null;
  recents: LookRecent[];
}

export interface TenueDiversifiee extends GeneratedOutfitWithFallback {
  diversite: { applique: boolean; candidats: number; eligibles: number; penalite: number };
}

/**
 * La tenue du jour AVEC la mémoire des cinq jours précédents. Sans historique,
 * strictement le moteur d'origine (un tirage). Avec : `CANDIDATS_DIVERSITE`
 * tirages du même moteur — donc tous compatibles avec la météo, l'occasion et
 * les règles —, notés par computeLookScore, puis départagés par la pénalité.
 */
export function genererTenueDiversifiee(p: ParametresDiversifies): TenueDiversifiee {
  const tirer = () =>
    generateOutfitWithFallback(p.pool, p.weather, p.occasion, p.workMode, p.dateContext, p.preferredHexes, p.gender, undefined, undefined, p.colorimetrie);
  const premier = tirer();
  const sansEffet = { applique: false, candidats: 1, eligibles: 1, penalite: 0 };
  if (!p.recents.length || premier.noCompleteOutfit) return { ...premier, diversite: sansEffet };

  const resultats: GeneratedOutfitWithFallback[] = [premier];
  for (let i = 1; i < CANDIDATS_DIVERSITE; i++) {
    const r = tirer();
    if (!r.noCompleteOutfit && !resultats.some((x) => memes(x.ids, r.ids))) resultats.push(r);
  }
  const notes: CandidatNote[] = resultats.map((r) => {
    const pieces = r.ids.map((id) => p.pool.find((x) => x.id === id)).filter((x): x is Item => Boolean(x));
    const { score } = computeLookScore(pieces, p.occasion, p.preferredHexes, p.morphology, new Set(), p.weather, p.workMode, p.dateContext, p.pool, p.colorimetrie);
    return { ids: r.ids, score };
  });
  const choix = choisirParDiversite(notes, p.recents, p.pool, p.weather);
  const retenu = resultats[Math.max(0, choix.index)];
  return { ...retenu, diversite: { applique: true, candidats: resultats.length, eligibles: choix.eligibles, penalite: choix.penalite } };
}
