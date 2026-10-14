import type { DateContext, OccasionKey, TravelMode, WorkMode } from "./types";

/*
 * PHRASE ÉDITORIALE DU SÉLECTEUR D'OCCASION (brief du 14/10/2026, options 2e et 2d).
 *
 * Données de présentation, et rien d'autre : elles ne créent aucune occasion ni sous-occasion, elles mettent en mots les valeurs
 * existantes (OCCASIONS, WORK_MODES, DATE_CONTEXTS, TravelMode) sous les onglets de Tenue. Le produit n'avait pas de telles phrases :
 * ARBITRAGE ÉDITORIAL du 14/10/2026, à revoir par la propriétaire. Une clé ajoutée aux unions sans phrase ici casse le typage, pas l'écran.
 *
 * Deux parties : `debut` en romain, `fin` en italique terracotta. Aucune ne nomme le jour : la ligne vaut pour le jour consulté.
 */
export type PhraseOccasion = { debut: string; fin: string };

const TRAVAIL: Record<WorkMode, PhraseOccasion> = {
  "Présentiel": { debut: "Une journée", fin: "au bureau" },
  "Télétravail": { debut: "Une journée", fin: "en télétravail" },
  "Entretien": { debut: "Une journée", fin: "avec un entretien" },
};

const DATE: Record<DateContext, PhraseOccasion> = {
  "Restaurant / date romantique": { debut: "Un dîner", fin: "en tête-à-tête" },
  "Verre": { debut: "Un rendez-vous", fin: "autour d'un verre" },
  "Cinéma / balade": { debut: "Un rendez-vous", fin: "ciné ou balade" },
  "Activité": { debut: "Un rendez-vous", fin: "autour d'une activité" },
  "Soirée festive": { debut: "Une soirée", fin: "festive à deux" },
};

const VOYAGE: Record<TravelMode, PhraseOccasion> = {
  "Court trajet": { debut: "Un trajet", fin: "court" },
  "Longue distance": { debut: "Un trajet", fin: "longue distance" },
};

const SANS_SOUS_CHOIX: Record<Exclude<OccasionKey, "all" | "travail_formel" | "date" | "voyage">, PhraseOccasion> = {
  quotidien: { debut: "Une journée", fin: "décontractée" },
  soiree: { debut: "Une sortie", fin: "en soirée" },
  sport: { debut: "Une séance", fin: "de sport" },
  cocooning: { debut: "Une journée", fin: "à la maison" },
  evenement_perso: { debut: "Un événement", fin: "à célébrer" },
};

/** La phrase de l'occasion et de sa sous-occasion ; `null` tant qu'aucune occasion n'est choisie ("all") — la ligne reste vide, à hauteur constante. */
export function phraseOccasion(
  occasion: OccasionKey,
  sous: { workMode: WorkMode; dateContext: DateContext; travelMode: TravelMode },
): PhraseOccasion | null {
  switch (occasion) {
    case "all":
      return null;
    case "travail_formel":
      return TRAVAIL[sous.workMode];
    case "date":
      return DATE[sous.dateContext];
    case "voyage":
      return VOYAGE[sous.travelMode];
    default:
      return SANS_SOUS_CHOIX[occasion];
  }
}

/** Libellé du déclencheur : la première partie d'un libellé composé (« Restaurant / date romantique » → « Restaurant »), sinon le libellé entier. */
export function libelleDeclencheur(valeur: string): string {
  return valeur.split(" / ")[0];
}
