import { DATE_CONTEXTS, isRainy, labelPrecipitation, type Weather } from "./data";
import { CHAUSSURES_OUVERTES } from "./logic";
import type { TenuePlanifiee } from "./planifier";
import type { MomentJournee } from "./prevision";
import type { DateContext, Item, WorkMode } from "./types";

/*
 * LA TENUE PLANIFIÉE DEVIENT LA TENUE DU JOUR — SELON LE MOMENT
 * (arbitrage de la propriétaire, 30/09/2026, option C).
 *
 * Deux sources se contredisaient : Notion (décision du 14/09) « la tenue
 * planifiée devient automatiquement la tenue du jour », et le code du 27/09,
 * qui ne la rappelait qu'en tête d'écran — parce qu'une journée peut avoir
 * une tenue de travail le jour et un dîner le soir. L'arbitrage garde les deux :
 *
 *   · « Toute la journée », « Matin », « Après-midi » : la tenue planifiée
 *     DEVIENT la tenue du jour, étiquetée « Ta tenue planifiée », avec
 *     « Voir une autre proposition » pour revenir à la proposition de Capsela ;
 *   · « Soirée » : elle reste un rappel (« Ce soir ») sous la ligne du jour,
 *     et la tenue du jour reste celle de « Mon rythme ».
 *
 * Deux garde-fous :
 *   · une pièce qui a quitté le dressing rend le plan incomplet : il n'est pas
 *     imposé (une tenue à trou n'est pas une tenue), la proposition reprend
 *     et le rappel le dit ;
 *   · la tenue a été choisie sur une PRÉVISION : si la météo du jour la
 *     contredit, une ligne le signale — la tenue n'est jamais changée d'office.
 */

/*
 * RÉVISÉ LE 04/10/2026 (hero dynamique de l'Accueil, demandé) : « Soirée » rejoint les moments qui font la tenue du jour.
 * L'arbitrage du 30/09 laissait la soirée en simple rappel « Ce soir » au-dessus du hero — une seconde carte qui répétait
 * le hero. Un plan de soirée est désormais le hero (« Look du jour · Ta tenue est prête pour ce soir »), comme les autres,
 * dans l'ordre de la journée : un plan de jour passe avant lui, et la soirée reste alors un rappel. « Voir une autre
 * proposition » et l'alerte météo s'appliquent à lui comme aux autres.
 */
export const MOMENTS_TENUE_DU_JOUR: readonly MomentJournee[] = ["Toute la journée", "Matin", "Après-midi", "Soirée"];

export type PlanDuJour =
  | { etat: "applicable"; plan: TenuePlanifiee }
  | { etat: "incomplet"; plan: TenuePlanifiee; manquantes: number };

/**
 * Le plan qui fait la tenue du jour, parmi les plans du jour (déjà dans
 * l'ordre de la journée, cf. plansDuJour) : le premier dont le moment couvre
 * la journée et que l'utilisatrice n'a pas écarté (« Voir une autre
 * proposition »). null quand aucun ne s'y prête.
 */
export function planPourTenueDuJour(
  plans: readonly TenuePlanifiee[],
  resolution: readonly Pick<Item, "id">[],
  ecartes: readonly string[]
): PlanDuJour | null {
  const plan = plans.find((p) => MOMENTS_TENUE_DU_JOUR.includes(p.moment) && !ecartes.includes(p.id));
  if (!plan) return null;
  const manquantes = plan.pieceIds.filter((id) => !resolution.some((p) => p.id === id)).length;
  if (!plan.pieceIds.length || manquantes) return { etat: "incomplet", plan, manquantes: Math.max(1, manquantes) };
  return { etat: "applicable", plan };
}

const WORK_MODES: readonly WorkMode[] = ["Présentiel", "Télétravail"];

/** Le sous-choix du plan, rendu à la tenue du jour : mode de travail ou contexte de date, s'il est valide. */
export function sousChoixDuPlan(plan: Pick<TenuePlanifiee, "occasion" | "sousChoix">): { workMode?: WorkMode; dateContext?: DateContext } {
  const s = plan.sousChoix;
  if (!s) return {};
  if (plan.occasion === "travail_formel" && (WORK_MODES as readonly string[]).includes(s)) return { workMode: s as WorkMode };
  if (plan.occasion === "date" && DATE_CONTEXTS.some(([k]) => k === s)) return { dateContext: s as DateContext };
  return {};
}

/**
 * LA MÉTÉO DU JOUR CONTREDIT-ELLE LA TENUE PLANIFIÉE ? Une phrase, ou null.
 * Seulement des constats vérifiables sur les pièces : chaussures ouvertes
 * sous la pluie, pièce hors de ses bornes de température déclarées. Rien
 * d'autre n'est deviné.
 */
export function alerteMeteoPlan(pieces: readonly Item[], meteo: Pick<Weather, "temp" | "label">): string | null {
  if (isRainy(meteo) && pieces.some((p) => p.cat === "chaussures" && p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType))) {
    return "De la pluie est annoncée : des chaussures fermées seraient plus sûres.";
  }
  if (pieces.some((p) => p.meteoMinTemp != null && meteo.temp < p.meteoMinTemp)) {
    return `Il fera ${Math.round(meteo.temp)}° : plus frais que ce que certaines pièces de cette tenue supportent.`;
  }
  if (pieces.some((p) => p.meteoMaxTemp != null && meteo.temp > p.meteoMaxTemp)) {
    return `Il fera ${Math.round(meteo.temp)}° : plus chaud que ce que certaines pièces de cette tenue supportent.`;
  }
  return null;
}

/**
 * LA PRÉVISION D'AUJOURD'HUI A-T-ELLE CHANGÉ DEPUIS LA PLANIFICATION ? (04/10/2026, « la tenue planifiée devait se
 * mettre à jour » : la fiche d'un plan redemande la prévision du lieu du plan et la compare à celle ENREGISTRÉE.)
 * Oui quand la température diffère d'au moins 3° — l'écart que le moteur ne confond pas avec du bruit — ou quand la
 * pluie apparaît ou disparaît. Sans prévision enregistrée, il n'y a rien à comparer : false. Un constat, jamais un
 * changement de tenue : la tenue planifiée garde ses pièces.
 */
export const ECART_TEMPERATURE_SIGNIFICATIF = 3;

export function previsionAChange(
  avant: { temp: number | null; weatherLabel: string | null },
  apres: { temp: number; label: string }
): boolean {
  if (avant.temp == null) return false;
  if (Math.abs(apres.temp - avant.temp) >= ECART_TEMPERATURE_SIGNIFICATIF) return true;
  const pluieAvant = avant.weatherLabel ? labelPrecipitation(avant.weatherLabel) : false;
  return pluieAvant !== labelPrecipitation(apres.label);
}
