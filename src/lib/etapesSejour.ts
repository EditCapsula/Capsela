/*
 * LES ÉTAPES D'UN ROAD TRIP (30/10/2026, demandé : « donner la possibilité d'ajouter plusieurs destinations dans le cas d'un roadtrip » ;
 * arbitré par la propriétaire le même jour : des dates PAR ÉTAPE). Module pur.
 *
 * Le séjour garde ses dates de départ et de retour. La première destination commence au départ ; chaque autre destination dit son JOUR
 * D'ARRIVÉE, et dure jusqu'à l'arrivée de la suivante (ou jusqu'au retour). Chaque jour du séjour appartient donc à une seule étape : sa
 * météo est celle de cette ville (ValiseScreen, calculer), la tenue du jour pendant le séjour y est rattachée (valiseDuJour.ts). Le
 * moteur de tenues ne change pas : il reçoit, comme avant, une météo par jour.
 *
 * Gardées avec la valise dans `calcul` (jsonb) : aucune migration. Une valise d'une seule destination n'a pas d'étapes, et se lit comme
 * avant.
 */

export interface EtapeSejour {
  destination: string;
  /** Le jour où l'on arrive dans cette ville (AAAA-MM-JJ) ; pour la première, le départ. */
  arrivee: string;
  /** Les coordonnées de la ville quand elle a été choisie dans la liste : la climatologie s'en sert. */
  lat?: number;
  lon?: number;
}

export const ETAPES_MAX = 6;
export const SEPARATEUR_ITINERAIRE = " → ";

/**
 * Les étapes retenues : la première au départ, puis les autres dans l'ordre de leur arrivée, chacune strictement après le départ et au
 * plus tard au retour. Deux arrivées le même jour : la dernière ajoutée l'emporte (on ne dort pas dans deux villes). Une étape sans nom,
 * ou hors du séjour (les dates ont changé depuis), est écartée — jamais déplacée.
 */
export function etapesRetenues(premiere: Omit<EtapeSejour, "arrivee">, autres: readonly EtapeSejour[], depart: string, retour: string): EtapeSejour[] {
  const parJour = new Map<string, EtapeSejour>();
  for (const e of autres) {
    if (!e.destination.trim() || !(e.arrivee > depart && e.arrivee <= retour)) continue;
    parJour.set(e.arrivee, e);
  }
  const suivantes = [...parJour.values()].sort((a, b) => a.arrivee.localeCompare(b.arrivee)).slice(0, ETAPES_MAX - 1);
  return [{ ...premiere, arrivee: depart }, ...suivantes];
}

/** L'étape d'un jour : la dernière dont l'arrivée est passée ou du jour même (le jour du trajet appartient à la ville d'arrivée). */
export function etapeDuJour<E extends Pick<EtapeSejour, "arrivee">>(etapes: readonly E[], jour: string): E | null {
  let trouvee: E | null = null;
  for (const e of etapes) if (e.arrivee <= jour) trouvee = e;
  return trouvee ?? etapes[0] ?? null;
}

/** Les jours du séjour regroupés par étape, dans l'ordre ; une étape sans jour n'apparaît pas. */
export function joursParEtape<E extends Pick<EtapeSejour, "arrivee">>(etapes: readonly E[], jours: readonly string[]): { etape: E; jours: string[] }[] {
  const out: { etape: E; jours: string[] }[] = [];
  for (const j of jours) {
    const e = etapeDuJour(etapes, j);
    if (!e) continue;
    const dernier = out[out.length - 1];
    if (dernier && dernier.etape === e) dernier.jours.push(j);
    else out.push({ etape: e, jours: [j] });
  }
  return out;
}

/** « Lisbonne → Porto → Faro » ; une seule étape : son nom. */
export const libelleItineraire = (etapes: readonly Pick<EtapeSejour, "destination">[]): string =>
  etapes.map((e) => e.destination.trim()).filter(Boolean).join(SEPARATEUR_ITINERAIRE);

/** La ville d'un jour pour une valise : celle de son étape, sinon sa destination (une valise d'une seule ville). */
export function destinationDuJour(v: { destination: string; etapes?: readonly EtapeSejour[] }, jour: string): string {
  return (v.etapes?.length ? etapeDuJour(v.etapes, jour)?.destination : null) ?? v.destination;
}
