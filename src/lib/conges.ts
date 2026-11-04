/**
 * LES PÉRIODES DE CONGÉS (04/11/2026, retour du test fermé : « possibilité de paramétrer ses dates de congés, pour ne pas avoir à
 * faire une action ; l'occasion de m'envoyer une notification pour me dire qu'il est temps de préparer son dressing retour de
 * vacances » ; arbitré : gardées en base).
 *
 * EN BASE SANS MIGRATION : les périodes vivent dans les préférences du profil (`profiles.prefs`, jsonb, migration 0001), à côté de
 * « Je suis en congés ». Un profil plus ancien n'en a pas : la lecture complète avec `DEFAULT_PREFS` (auth.tsx), donc `[]`.
 *
 * Ce qu'elles changent, et rien d'autre : un jour compris dans une période se lit comme « Je suis en congés » activé —
 * l'occasion par défaut de ce jour est Cocooning (`occasionParDefaut`, jourConsulte.ts), et la notification de la veille de la
 * reprise est programmée (notifications.ts). L'interrupteur reste : il vaut pour une absence non datée.
 *
 * Les dates sont des jours calendaires locaux (« AAAA-MM-JJ », comme le champ date les rend) : jamais d'heure, jamais de fuseau.
 */

export interface PeriodeConges {
  /** Premier jour de congés, inclus. */
  debut: string;
  /** Dernier jour de congés, inclus : on reprend le lendemain. */
  fin: string;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** « AAAA-MM-JJ » du jour local de `d`. */
export function jourLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

/** Une période lisible : deux dates bien formées, la fin au plus tôt le jour du début. */
export function periodeValide(p: unknown): p is PeriodeConges {
  if (!p || typeof p !== "object") return false;
  const { debut, fin } = p as Record<string, unknown>;
  return typeof debut === "string" && typeof fin === "string" && JOUR.test(debut) && JOUR.test(fin) && debut <= fin;
}

/** Les périodes enregistrées, nettoyées (une valeur abîmée en base est ignorée, jamais une erreur) et triées. */
export function periodesDe(brut: unknown): PeriodeConges[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(periodeValide).map(({ debut, fin }) => ({ debut, fin })).sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Ce jour tombe-t-il dans une période de congés ? */
export function dansUnePeriode(periodes: unknown, d: Date): boolean {
  const j = jourLocal(d);
  return periodesDe(periodes).some((p) => p.debut <= j && j <= p.fin);
}

/** Les périodes qui ne sont pas encore finies (aujourd'hui compris) : les seules affichées et les seules qui notifient. */
export function periodesAVenir(periodes: unknown, aujourdhui: Date = new Date()): PeriodeConges[] {
  const j = jourLocal(aujourdhui);
  return periodesDe(periodes).filter((p) => p.fin >= j);
}

/** Ajoute une période, sans doublon exact. */
export function ajouterPeriode(periodes: unknown, p: PeriodeConges): PeriodeConges[] {
  const liste = periodesDe(periodes);
  if (!periodeValide(p) || liste.some((x) => x.debut === p.debut && x.fin === p.fin)) return liste;
  return periodesDe([...liste, p]);
}

export function retirerPeriode(periodes: unknown, p: PeriodeConges): PeriodeConges[] {
  return periodesDe(periodes).filter((x) => !(x.debut === p.debut && x.fin === p.fin));
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateDe = (j: string) => new Date(`${j}T12:00:00`);

/** « 20 déc. → 3 janv. » ; « 14 juil. » pour un seul jour. */
export function libellePeriode(p: PeriodeConges): string {
  const a = dateDe(p.debut);
  const b = dateDe(p.fin);
  const f = (d: Date) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
  return p.debut === p.fin ? f(a) : `${f(a)} → ${f(b)}`;
}

/**
 * Le moment de la notification de reprise : le DERNIER jour de congés, à 18 h — la veille du retour, assez tôt pour préparer sa
 * tenue. null si ce moment est déjà passé.
 */
export function momentRappelReprise(p: PeriodeConges, maintenant: Date = new Date()): Date | null {
  const d = dateDe(p.fin);
  d.setHours(18, 0, 0, 0);
  return d.getTime() > maintenant.getTime() ? d : null;
}
