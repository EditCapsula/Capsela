import { occasionShortLabel } from "./data";
import { jourLocal } from "./outfitFeedback";
import { villeDuLieu, type TenuePlanifiee } from "./planifier";

/*
 * LES TEXTES DU HERO DE L'ACCUEIL QUAND UNE TENUE EST PLANIFIÉE (04/10/2026, « hero dynamique selon le statut d'un
 * look planifié »). Quatre états, dont trois portent un plan :
 *   · à venir  — le jour consulté est un jour futur qui a un plan : « Look planifié », « prêt pour dimanche » ;
 *   · le jour J — « Look du jour », « Ta tenue est prête pour ce soir » ;
 *   · passé    — hier : « Ton look d'hier », « Comment était ta tenue ? » ;
 *   · sans plan — le hero d'avant, inchangé.
 * Pur et testé : aucun texte ne dépend d'autre chose que du plan et de la date.
 */

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** « Dimanche 4 oct. » */
export const jourCourtLong = (jour: string): string => {
  const d = dateDe(jour);
  return `${majuscule(JOURS[d.getDay()])} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};

/** « Sortie festive · Gagny » — l'occasion, puis le lieu s'il y en a un. */
export const titreDuPlan = (plan: Pick<TenuePlanifiee, "occasion" | "lieu">): string => {
  const ville = villeDuLieu(plan.lieu);
  return ville ? `${occasionShortLabel(plan.occasion)} · ${ville}` : occasionShortLabel(plan.occasion);
};

export type EtatPlan = "avenir" | "jourJ" | "passe";

export function etatDuPlan(plan: Pick<TenuePlanifiee, "jour">, aujourdhui: string = jourLocal()): EtatPlan {
  return plan.jour > aujourdhui ? "avenir" : plan.jour === aujourdhui ? "jourJ" : "passe";
}

const POUR_LE_MOMENT: Record<TenuePlanifiee["moment"], string> = {
  Matin: "pour ce matin",
  "Après-midi": "pour cet après-midi",
  Soirée: "pour ce soir",
  "Toute la journée": "pour aujourd'hui",
};

export interface TexteHeroPlan {
  surtitre: string;
  sousTitre: string;
  badge: string;
}

/** Les textes du hero pour un plan à venir ou du jour. Un plan passé a ses propres textes (texteHeroHier). */
export function texteHeroPlan(plan: Pick<TenuePlanifiee, "jour" | "moment">, aujourdhui: string = jourLocal()): TexteHeroPlan {
  if (etatDuPlan(plan, aujourdhui) === "jourJ") {
    return { surtitre: "Look du jour", sousTitre: `Ta tenue est prête ${POUR_LE_MOMENT[plan.moment]}.`, badge: `Aujourd'hui · ${plan.moment}` };
  }
  const demain = (() => {
    const d = dateDe(aujourdhui);
    d.setDate(d.getDate() + 1);
    return jourLocal(d);
  })();
  const quand = plan.jour === demain ? "demain" : JOURS[dateDe(plan.jour).getDay()];
  return { surtitre: "Look planifié", sousTitre: `Ton look est prêt pour ${quand}.`, badge: `${jourCourtLong(plan.jour)} · ${plan.moment}` };
}

/** Le hero du lendemain : la question, puis un mot adapté au moment. */
export function texteHeroHier(plan: Pick<TenuePlanifiee, "moment">): { surtitre: string; question: string; mot: string; badge: string } {
  return {
    surtitre: "Ton look d'hier",
    question: "Comment était ta tenue ?",
    mot: plan.moment === "Soirée" ? "On espère que tu as passé une belle soirée." : "On espère que tout s'est bien passé.",
    badge: plan.moment, // « Hier » est déjà dans le surtitre : le badge ne dit que le moment
  };
}

/** Le jour d'hier, en date locale. */
export const jourDHier = (d: Date = new Date()): string => {
  const h = new Date(d);
  h.setDate(h.getDate() - 1);
  return jourLocal(h);
};
