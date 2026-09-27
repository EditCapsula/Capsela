import { DAYS_FR, MONTHS_FR } from "./data";
import type { ProfilePrefs } from "./profile";
import { HORIZON_PREVISION_JOURS } from "./prevision";
import type { OccasionKey } from "./types";

/*
 * LE JOUR CONSULTÉ (27/09/2026, navigation par date — docs/navigation-par-date.md).
 *
 * Un seul état dans le store, `jourDecalage` : 0 pour aujourd'hui, 1 pour
 * demain… jusqu'à HORIZON_PREVISION_JOURS, l'étendue de la prévision météo.
 * Au-delà, la tenue ne pourrait plus suivre la météo du jour : la navigation
 * s'arrête là plutôt que d'annoncer une météo qu'elle n'a pas. L'Accueil et
 * Tenue lisent le même état ; ce module ne porte que les dérivés purs —
 * dates, libellés, occasion par défaut —, testés.
 */

export const JOUR_MAX = HORIZON_PREVISION_JOURS;

export const borneJour = (n: number) => Math.max(0, Math.min(JOUR_MAX, Math.round(n)));

/** La date consultée, à minuit local. */
export function dateDuJour(decalage: number, maintenant: Date = new Date()): Date {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  d.setDate(d.getDate() + decalage);
  return d;
}

const jourSemaine = (d: Date) => DAYS_FR[d.getDay()].toLowerCase();

/** « Aujourd'hui · dimanche 27 », « Demain · lundi 28 », « Mardi 29 septembre ». */
export function libelleJour(decalage: number, d: Date): string {
  if (decalage === 0) return `Aujourd'hui · ${jourSemaine(d)} ${d.getDate()}`;
  if (decalage === 1) return `Demain · ${jourSemaine(d)} ${d.getDate()}`;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const JOURS_ABREGES = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

/** Libellé court, sur la ligne de la localisation : « Aujourd'hui », « Demain », « Mar. 29 ». */
export function libelleJourCourt(decalage: number, d: Date): string {
  if (decalage === 0) return "Aujourd'hui";
  if (decalage === 1) return "Demain";
  return `${JOURS_ABREGES[d.getDay()]} ${d.getDate()}`;
}

/** Le second temps du titre de Tenue : « du jour », « de demain », « du mardi 29 ». */
export function complementTenue(decalage: number, d: Date): string {
  if (decalage === 0) return "du jour";
  if (decalage === 1) return "de demain";
  return `du ${jourSemaine(d)} ${d.getDate()}`;
}

/** Pour une phrase : « aujourd'hui », « demain », « mardi ». */
export function quandPhrase(decalage: number, d: Date): string {
  if (decalage === 0) return "aujourd'hui";
  if (decalage === 1) return "demain";
  return jourSemaine(d);
}

/** Le jour J dans le message d'avis d'un proche : « pour demain », « pour mardi 29 ». Aujourd'hui : rien. */
export function momentMessage(decalage: number, d: Date): string | undefined {
  if (decalage === 0) return undefined;
  if (decalage === 1) return "pour demain";
  return `pour ${jourSemaine(d)} ${d.getDate()}`;
}

const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * L'occasion par défaut d'une date : la règle existante de « Mon rythme »
 * (13/08/2026), jusque-là réservée au jour même — en congés, cocooning ;
 * un jour travaillé, travail ; sinon quotidien. Seule la date change.
 */
export function occasionParDefaut(prefs: ProfilePrefs, d: Date = new Date()): OccasionKey {
  if (prefs.onVacation) return "cocooning";
  return prefs.workDays.includes(JOURS_COURTS[d.getDay()]) ? "travail_formel" : "quotidien";
}
