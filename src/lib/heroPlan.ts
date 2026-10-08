import { occasionShortLabel } from "./data";
import { jourLocal } from "./outfitFeedback";
import { villeDuLieu, type TenuePlanifiee } from "./planifier";

/*
 * LES TEXTES DU HERO DE L'ACCUEIL QUAND UNE TENUE EST PLANIFIÉE (04/10/2026, « hero dynamique selon le statut d'un
 * look planifié »). Trois états :
 *   · à venir  — le jour consulté est un jour futur qui a un plan : « Look planifié », « prêt pour dimanche » ;
 *   · le jour J — « Ton look du jour », « Ta silhouette pour ce soir est prête » ;
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

/** « Soirée · Gagny » — l'occasion, puis le lieu s'il y en a un. */
export const titreDuPlan = (plan: Pick<TenuePlanifiee, "occasion" | "lieu">): string => {
  const ville = villeDuLieu(plan.lieu);
  return ville ? `${occasionShortLabel(plan.occasion)} · ${ville}` : occasionShortLabel(plan.occasion);
};

export type EtatPlan = "avenir" | "jourJ" | "passe";

export function etatDuPlan(plan: Pick<TenuePlanifiee, "jour">, aujourdhui: string = jourLocal()): EtatPlan {
  return plan.jour > aujourdhui ? "avenir" : plan.jour === aujourdhui ? "jourJ" : "passe";
}

const CE_MOMENT: Record<TenuePlanifiee["moment"], string> = {
  Matin: "Ce matin",
  "Après-midi": "Cet après-midi",
  Soirée: "Ce soir",
  "Toute la journée": "Aujourd'hui",
};

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
    // Textes arrêtés le 04/10/2026 (brief de rédaction de l'Accueil) : « Ton look du jour », « Ta silhouette pour ce soir est
    // prête. », badge « Ce soir · Soirée ». Le premier mot du badge suit le moment, comme la phrase.
    return { surtitre: "Ton look du jour", sousTitre: `Ta silhouette ${POUR_LE_MOMENT[plan.moment]} est prête.`, badge: `${CE_MOMENT[plan.moment]} · ${plan.moment}` };
  }
  const demain = (() => {
    const d = dateDe(aujourdhui);
    d.setDate(d.getDate() + 1);
    return jourLocal(d);
  })();
  const quand = plan.jour === demain ? "demain" : JOURS[dateDe(plan.jour).getDay()];
  return { surtitre: "Look planifié", sousTitre: `Ton look est prêt pour ${quand}.`, badge: `${jourCourtLong(plan.jour)} · ${plan.moment}` };
}
