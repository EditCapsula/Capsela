import { CHALEUR_HORS_SAISON, representativeWeatherFor, saisonCalendairePour, weatherForDay } from "./capsule";
import type { Weather } from "./data";
import type { MeteoMoment } from "./prevision";
import type { Climat } from "./weather";

/**
 * LA MÉTÉO QUE REÇOIT LE MOTEUR POUR UNE TENUE PLANIFIÉE (08/10/2026, demandé : « il faut absolument tenir compte de la météo de la date
 * planifiée »). La saison est toujours celle de la DATE.
 *   · une prévision pour le créneau : sa température et son ciel ;
 *   · au-delà de ce que la prévision couvre (`auDela`) : les TEMPÉRATURES HABITUELLES du LIEU à cette date (`climat`, moyenne des années
 *     passées), sinon celles de la saison — jamais affichées comme une prévision, et jamais les degrés d'aujourd'hui ;
 *   · dans la couverture mais sans réponse (lieu introuvable, quota) : la météo d'aujourd'hui, la mesure la plus proche ;
 *   · pas de date : la météo d'aujourd'hui, telle quelle.
 */
export function meteoPourLaDate(p: {
  date: Date | null;
  creneau: MeteoMoment | null;
  aujourdhui: Weather;
  /** La date dépasse ce que la prévision couvre (horizon, ou dernier jour réellement rendu). */
  auDela: boolean;
  climat?: Climat | null;
}): Weather {
  if (!p.date) return p.aujourdhui;
  const saison = saisonCalendairePour(p.date);
  if (p.creneau) return weatherForDay(p.creneau.temp, p.creneau.label, saison, CHALEUR_HORS_SAISON);
  if (p.auDela) {
    if (p.climat) {
      const temp = Math.round((p.climat.tempMin + p.climat.tempMax) / 2);
      const label = p.climat.pluie >= 0.6 ? "Pluvieux" : p.climat.tempMax >= 25 ? "Ensoleillé" : "Nuageux";
      return weatherForDay(temp, label, saison, CHALEUR_HORS_SAISON);
    }
    const habituelle = representativeWeatherFor(saison);
    return weatherForDay(habituelle.temp, habituelle.label, saison, CHALEUR_HORS_SAISON);
  }
  return weatherForDay(p.aujourdhui.temp, p.aujourdhui.label, saison, CHALEUR_HORS_SAISON);
}
