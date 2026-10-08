import { CHALEUR_HORS_SAISON, representativeWeatherFor, saisonCalendairePour, weatherForDay } from "./capsule";
import type { Weather } from "./data";
import { HORIZON_PREVISION_JOURS, type MeteoMoment } from "./prevision";

/**
 * LA MÉTÉO QUE REÇOIT LE MOTEUR POUR UNE TENUE PLANIFIÉE (08/10/2026, demandé : « il faut absolument tenir compte de la météo de la date
 * planifiée »). La saison est toujours celle de la DATE.
 *   · une prévision pour le créneau : sa température et son ciel ;
 *   · au-delà de l'horizon de la prévision, aucune mesure n'existe : la TEMPÉRATURE HABITUELLE de la saison de la date (jamais affichée
 *     comme une prévision) — et non les 11° d'aujourd'hui pour une tenue d'été ;
 *   · dans l'horizon mais sans réponse (lieu introuvable, quota) : la météo d'aujourd'hui, la mesure la plus proche ;
 *   · pas de date : la météo d'aujourd'hui, telle quelle.
 */
export function meteoPourLaDate(p: { date: Date | null; jour: number | null; creneau: MeteoMoment | null; aujourdhui: Weather }): Weather {
  if (!p.date) return p.aujourdhui;
  const saison = saisonCalendairePour(p.date);
  if (p.creneau) return weatherForDay(p.creneau.temp, p.creneau.label, saison, CHALEUR_HORS_SAISON);
  if (p.jour != null && p.jour > HORIZON_PREVISION_JOURS) {
    const habituelle = representativeWeatherFor(saison);
    return weatherForDay(habituelle.temp, habituelle.label, saison, CHALEUR_HORS_SAISON);
  }
  return weatherForDay(p.aujourdhui.temp, p.aujourdhui.label, saison, CHALEUR_HORS_SAISON);
}
