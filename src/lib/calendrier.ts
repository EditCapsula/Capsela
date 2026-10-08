import { dateDuJour } from "./jourConsulte";
import { jourLocal } from "./outfitFeedback";
import { plansDuJour, type TenuePlanifiee } from "./planifier";
import { tenuePassee } from "./retro";
import type { HistoryEntry, OccasionKey } from "./types";

/*
 * LE CALENDRIER DES TENUES (05/10/2026, brief « Calendrier Capsela ») — la mémoire et le planning vestimentaire : ce que
 * j'ai porté, ce que je porte aujourd'hui, ce que j'ai prévu. Pur : tout se dérive de l'historique (state.history, le
 * Journal), des tenues planifiées (planned_outfits) et de la tenue proposée aujourd'hui ; rien n'est stocké, aucune donnée
 * n'est ajoutée au schéma.
 *
 * RÈGLE DU BRIEF : « ne pas déduire qu'une tenue a été portée simplement parce qu'elle existait ». Un jour PASSÉ n'est
 * « porté » que s'il a une entrée d'historique (une tenue validée avec « Porter cette tenue ») ; une tenue planifiée sans
 * trace de port reste « planifiée ». Le jour même est « du jour » : la tenue planifiée si elle existe, sinon celle que
 * Capsela propose. Un jour futur n'a que ses plans.
 */

export type StatutJour = "porte" | "planifiee" | "du_jour";

export interface TenueDuCalendrier {
  jour: string;
  statut: StatutJour;
  pieceIds: number[];
  occasion: OccasionKey;
  /** La tenue planifiée correspondante, quand il y en a une (pour l'ouvrir, la modifier). */
  plan: TenuePlanifiee | null;
  /** Météo enregistrée (porté, planifié) — jamais une météo de repli. */
  temp: number | null;
  weatherLabel: string | null;
}

/** La tenue proposée aujourd'hui par Capsela (state.outfit et son occasion) — facultative. */
export interface TenuePropose {
  pieceIds: number[];
  occasion: OccasionKey;
  temp?: number | null;
  weatherLabel?: string | null;
}

export function tenueDuCalendrier(
  jour: string,
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null
): TenueDuCalendrier | null {
  if (jour < aujourdhui) {
    const t = tenuePassee(history, plans, jour);
    return t ? { jour, statut: t.source === "porte" ? "porte" : "planifiee", pieceIds: t.pieceIds, occasion: t.occasion, plan: t.plan, temp: t.temp, weatherLabel: t.weatherLabel } : null;
  }
  const plan = plansDuJour(plans, jour).find((p) => p.pieceIds.length > 0) ?? null;
  if (plan) {
    return { jour, statut: jour === aujourdhui ? "du_jour" : "planifiee", pieceIds: plan.pieceIds, occasion: plan.occasion, plan, temp: plan.temp, weatherLabel: plan.weatherLabel };
  }
  if (jour === aujourdhui && proposee && proposee.pieceIds.length > 0) {
    return { jour, statut: "du_jour", pieceIds: proposee.pieceIds, occasion: proposee.occasion, plan: null, temp: proposee.temp ?? null, weatherLabel: proposee.weatherLabel ?? null };
  }
  return null;
}

// ── Les grilles ──────────────────────────────────────────────────────────

const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);

/** Le lundi de la semaine d'un jour, en date locale. */
export function lundiDe(jour: string): string {
  const d = dateDe(jour);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return jourLocal(d);
}

/** Les sept jours (lundi → dimanche) de la semaine qui contient `jour`. */
export function joursDeLaSemaine(jour: string): string[] {
  const l = dateDe(lundiDe(jour));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(l);
    d.setDate(l.getDate() + i);
    return jourLocal(d);
  });
}

/** Un mois en semaines de sept cases, lundi d'abord ; null pour les cases hors du mois. `mois` : 0 à 11. */
export function grilleDuMois(annee: number, mois: number): (string | null)[][] {
  const premier = new Date(annee, mois, 1, 12);
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;
  const cases: (string | null)[] = Array(decalage).fill(null);
  for (let j = 1; j <= nbJours; j++) cases.push(jourLocal(new Date(annee, mois, j, 12)));
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines: (string | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

/** Le mois d'un jour (« AAAA-MM-JJ ») décalé de `delta` mois : le premier du mois visé, pour y naviguer. */
export function moisDecale(jour: string, delta: number): string {
  const d = dateDe(jour);
  return jourLocal(new Date(d.getFullYear(), d.getMonth() + delta, 1, 12));
}

// ── La liste ─────────────────────────────────────────────────────────────

/** Fenêtre de la liste des tenues passées : au plus 60 jours en arrière (l'historique complet est le Journal). */
export const LISTE_PASSE_JOURS = 60;

/**
 * La liste : « à venir » (aujourd'hui compris, du plus proche au plus lointain) puis « passées » (de la plus récente à la
 * plus ancienne). Seuls les jours où il y a une tenue.
 */
export function listeDuCalendrier(
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null,
  maintenant: Date = new Date()
): { avenir: TenueDuCalendrier[]; passees: TenueDuCalendrier[] } {
  const avenirJours = new Set<string>();
  if (proposee) avenirJours.add(aujourdhui);
  for (const p of plans) if (p.jour >= aujourdhui && p.pieceIds.length > 0) avenirJours.add(p.jour);
  const avenir = [...avenirJours]
    .sort()
    .map((j) => tenueDuCalendrier(j, aujourdhui, history, plans, proposee))
    .filter((t): t is TenueDuCalendrier => t !== null);
  const passees: TenueDuCalendrier[] = [];
  for (let k = 1; k <= LISTE_PASSE_JOURS; k++) {
    const t = tenueDuCalendrier(jourLocal(dateDuJour(-k, maintenant)), aujourdhui, history, plans, null);
    if (t) passees.push(t);
  }
  return { avenir, passees };
}

// ── Mon planning : mois complet, semaine en cours, noms courts (08/10/2026) ────────────────────────────────────────────

export interface CaseDuMois {
  jour: string;
  /** true pour un jour du mois précédent ou suivant, rendu estompé (il complète la première et la dernière semaine). */
  horsMois: boolean;
}

/** Comme grilleDuMois, mais les cases hors du mois portent leur vraie date (28 29 30, puis 1) : la maquette les montre estompées. */
export function grilleDuMoisComplete(annee: number, mois: number): CaseDuMois[][] {
  const premier = new Date(annee, mois, 1, 12);
  const decalage = (premier.getDay() + 6) % 7;
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const total = Math.ceil((decalage + nbJours) / 7) * 7;
  const semaines: CaseDuMois[][] = [];
  for (let i = 0; i < total; i += 7) {
    semaines.push(
      Array.from({ length: 7 }, (_, k) => {
        const d = new Date(annee, mois, 1 - decalage + i + k, 12);
        return { jour: jourLocal(d), horsMois: d.getMonth() !== mois };
      })
    );
  }
  return semaines;
}

/** Les jours de la semaine en cours qu'il reste à vivre : d'aujourd'hui au dimanche inclus. Les jours déjà passés n'en font pas partie. */
export function joursRestantsDeLaSemaine(aujourdhui: string): string[] {
  return joursDeLaSemaine(aujourdhui).filter((j) => j >= aujourdhui);
}

export interface JourDeLaListe {
  jour: string;
  tenue: TenueDuCalendrier | null;
}

/**
 * « CETTE SEMAINE » de la liste : chaque jour d'aujourd'hui au dimanche, avec sa tenue ou sans. Un jour à venir sans tenue
 * reste dans la liste (il propose de planifier) ; un jour PASSÉ sans tenue n'y est jamais — il est masqué, comme sur la maquette.
 */
export function listeDeLaSemaine(
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null
): JourDeLaListe[] {
  return joursRestantsDeLaSemaine(aujourdhui).map((jour) => ({ jour, tenue: tenueDuCalendrier(jour, aujourdhui, history, plans, proposee) }));
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « Mer. 7 oct. » — la date de gauche d'une ligne de la liste. */
export function dateCourte(jour: string): string {
  const d = dateDe(jour);
  const j = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."][d.getDay()];
  return `${j} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

/** « Lun », « Mar »… — l'abréviation à trois lettres d'une tuile de la vue Semaine. */
export function jourAbrege(jour: string): string {
  return ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][dateDe(jour).getDay()];
}

/**
 * Le numéro de semaine « simple » du jour « AAAA-MM-JJ » (demandé le 08/10/2026, à la place de la norme ISO 8601) : les semaines vont
 * du lundi au dimanche, et la semaine qui contient le 1er janvier est la semaine 1, même si elle n'a que quelques jours dans l'année.
 * Une semaine à cheval sur deux années compte pour la NOUVELLE (celle de son dimanche) : du lundi 28 décembre 2026 au dimanche
 * 3 janvier 2027, c'est la semaine 1 — la 40e commence le 28 septembre, la 41e le 5 octobre. Elle ne diffère de l'ISO que
 * autour du Nouvel An.
 */
export function numeroDeSemaine(jour: string): number {
  const lundiDeLaSemaine = (d: Date) => {
    const l = new Date(d);
    l.setUTCDate(l.getUTCDate() - ((l.getUTCDay() + 6) % 7));
    return l;
  };
  const [a, m, j] = jour.split("-").map(Number);
  const lundi = lundiDeLaSemaine(new Date(Date.UTC(a, m - 1, j)));
  const dimanche = new Date(lundi);
  dimanche.setUTCDate(lundi.getUTCDate() + 6);
  const premiere = lundiDeLaSemaine(new Date(Date.UTC(dimanche.getUTCFullYear(), 0, 1)));
  return 1 + Math.round((lundi.getTime() - premiere.getTime()) / (7 * 86_400_000));
}

// ── La vue Liste : courte, et l'historique complet à part (08/10/2026) ─────────────────────────────────────────────────

/** « À VENIR » ne regarde que les jours qui viennent : aujourd'hui compris, dix jours au plus — le Mois sert à naviguer plus loin. */
export const AVENIR_JOURS = 10;
/** Au plus six tenues à venir, quatre récentes : une dizaine de lignes avant toute interaction. */
export const AVENIR_MAX = 6;
export const RECENTES_MAX = 4;

export interface VueListe {
  /** Les prochaines tenues (aujourd'hui compris) dans les dix jours, du plus proche au plus lointain. Un jour sans tenue n'y est pas. */
  avenir: TenueDuCalendrier[];
  /** Les dernières tenues passées, de la plus récente à la plus ancienne. */
  recentes: TenueDuCalendrier[];
  /** Combien de tenues passées existent en tout (l'historique complet). */
  nbPassees: number;
}

/**
 * Le jour « AAAA-MM-JJ » de chaque tenue passée connue — portée (historique) ou planifiée —, du plus récent au plus ancien. On part des
 * jours qui ont une trace, jamais d'une boucle sur toute l'année : l'historique peut remonter loin.
 */
export function joursPassesAvecTenue(aujourdhui: string, history: readonly HistoryEntry[], plans: readonly TenuePlanifiee[]): string[] {
  const jours = new Set<string>();
  for (const h of history) if (h.pieceIds.length > 0) jours.add(jourLocal(new Date(h.ts)));
  for (const p of plans) if (p.pieceIds.length > 0) jours.add(p.jour);
  return [...jours].filter((j) => j < aujourdhui).sort().reverse();
}

export function vueListe(
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null
): VueListe {
  const avenir: TenueDuCalendrier[] = [];
  const base = dateDe(aujourdhui);
  for (let k = 0; k < AVENIR_JOURS && avenir.length < AVENIR_MAX; k++) {
    const d = new Date(base);
    d.setDate(base.getDate() + k);
    const t = tenueDuCalendrier(jourLocal(d), aujourdhui, history, plans, proposee);
    if (t) avenir.push(t);
  }
  const passes = joursPassesAvecTenue(aujourdhui, history, plans)
    .map((j) => tenueDuCalendrier(j, aujourdhui, history, plans, null))
    .filter((t): t is TenueDuCalendrier => t !== null);
  return { avenir, recentes: passes.slice(0, RECENTES_MAX), nbPassees: passes.length };
}

export type FiltreHistorique = "toutes" | "portees" | "planifiees";

export interface MoisHistorique {
  /** « 2026-10 » */
  cle: string;
  /** « Octobre 2026 » */
  libelle: string;
  tenues: TenueDuCalendrier[];
}

/** L'historique complet des tenues passées, regroupé par mois (le plus récent d'abord), filtrable : portées ou planifiées. */
export function historiqueParMois(
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  filtre: FiltreHistorique = "toutes"
): MoisHistorique[] {
  const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const groupes = new Map<string, MoisHistorique>();
  for (const j of joursPassesAvecTenue(aujourdhui, history, plans)) {
    const t = tenueDuCalendrier(j, aujourdhui, history, plans, null);
    if (!t) continue;
    if (filtre === "portees" && t.statut !== "porte") continue;
    if (filtre === "planifiees" && t.statut !== "planifiee") continue;
    const cle = j.slice(0, 7);
    const g = groupes.get(cle) ?? { cle, libelle: `${MOIS[Number(j.slice(5, 7)) - 1]} ${j.slice(0, 4)}`, tenues: [] };
    g.tenues.push(t);
    groupes.set(cle, g);
  }
  return [...groupes.values()];
}

/** « Mer. 7 octobre » — la date d'une ligne de la liste (trois lettres pour le jour, le mois en toutes lettres). */
export function dateMoyenne(jour: string): string {
  const d = dateDe(jour);
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][d.getMonth()];
  return `${["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."][d.getDay()]} ${d.getDate()} ${mois}`;
}
