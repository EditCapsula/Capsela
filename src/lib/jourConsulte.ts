import { DAYS_FR, MONTHS_FR } from "./data";
import { dansUnePeriode } from "./conges";
import { langue } from "./langue";
import type { ProfilePrefs } from "./profile";
import type { OccasionKey } from "./types";

/*
 * LE JOUR CONSULTÉ (27/09/2026, navigation par date — docs/navigation-par-date.md).
 *
 * Un seul état dans le store, `jourDecalage` : 0 pour aujourd'hui, 1 pour
 * demain… jusqu'à JOUR_MAX.
 * Au-delà, la tenue ne pourrait plus suivre la météo du jour : la navigation
 * s'arrête là plutôt que d'annoncer une météo qu'elle n'a pas. L'Accueil et
 * Tenue lisent le même état ; ce module ne porte que les dérivés purs —
 * dates, libellés, occasion par défaut —, testés.
 */

/**
 * Jours consultables sur l'Accueil et Tenue : 4, comme avant. L'horizon de la prévision est passé à 15 jours (prevision.ts) pour Planifier,
 * Mon planning et la Valise ; la navigation par date de l'Accueil, dessinée pour cinq jours, ne suit pas — décision séparée.
 */
export const JOUR_MAX = 4;

export const borneJour = (n: number) => Math.max(0, Math.min(JOUR_MAX, Math.round(n)));

/** La date consultée, à minuit local. */
export function dateDuJour(decalage: number, maintenant: Date = new Date()): Date {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  d.setDate(d.getDate() + decalage);
  return d;
}

const jourSemaine = (d: Date) => DAYS_FR[d.getDay()].toLowerCase();

// L'anglais (13/11/2026, docs/traduction.md) : les mêmes libellés, dans l'ordre et la grammaire de l'anglais — pas un mot à mot.
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const anglais = () => langue() === "en";

/** « Aujourd'hui · dimanche 27 », « Demain · lundi 28 », « Mardi 29 septembre ». */
export function libelleJour(decalage: number, d: Date): string {
  if (anglais()) {
    const jour = `${DAYS_EN[d.getDay()]} ${d.getDate()}`;
    if (decalage === 0) return `Today · ${jour}`;
    if (decalage === 1) return `Tomorrow · ${jour}`;
    if (decalage === -1) return `Yesterday · ${jour}`;
    return `${jour} ${MONTHS_EN[d.getMonth()]}`;
  }
  if (decalage === 0) return `Aujourd'hui · ${jourSemaine(d)} ${d.getDate()}`;
  if (decalage === 1) return `Demain · ${jourSemaine(d)} ${d.getDate()}`;
  if (decalage === -1) return `Hier · ${jourSemaine(d)} ${d.getDate()}`;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const JOURS_ABREGES = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

/** Libellé court, sur la ligne de la localisation : « Aujourd'hui », « Demain », « Mar. 29 ». */
export function libelleJourCourt(decalage: number, d: Date): string {
  if (anglais()) {
    if (decalage === 0) return "Today";
    if (decalage === 1) return "Tomorrow";
    if (decalage === -1) return "Yesterday";
    return `${DAYS_EN[d.getDay()].slice(0, 3)} ${d.getDate()}`;
  }
  if (decalage === 0) return "Aujourd'hui";
  if (decalage === 1) return "Demain";
  if (decalage === -1) return "Hier";
  return `${JOURS_ABREGES[d.getDay()]} ${d.getDate()}`;
}

/** Le second temps du titre de Tenue : « du jour », « de demain », « du mardi 29 ». */
export function complementTenue(decalage: number, d: Date): string {
  // « My outfit of the day », « My outfit for tomorrow », « My outfit for Tuesday 29 ».
  if (anglais()) return decalage === 0 ? "of the day" : decalage === 1 ? "for tomorrow" : `for ${DAYS_EN[d.getDay()]} ${d.getDate()}`;
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
 * (13/08/2026), jusque-là réservée au jour même — en congés (interrupteur, ou jour d'une période datée), cocooning ;
 * un jour travaillé, travail ; sinon quotidien. Seule la date change.
 */
export function occasionParDefaut(prefs: ProfilePrefs, d: Date = new Date()): OccasionKey {
  // Une période de congés datée (04/11/2026, conges.ts) vaut l'interrupteur « Je suis en congés » pour chacun de ses jours.
  if (prefs.onVacation || dansUnePeriode(prefs.conges, d)) return "cocooning";
  return prefs.workDays.includes(JOURS_COURTS[d.getDay()]) ? "travail_formel" : "quotidien";
}
