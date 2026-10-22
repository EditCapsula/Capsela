import { elementProgramme } from "./programmeValise";
import { groupesMeteo, type MeteoJour, type SituationValise } from "./valise";

/*
 * LES ÉVÉNEMENTS DATÉS D'UNE VALISE (22/10/2026, demandé : « il manque une étape d'événements dans la planification de valises »).
 *
 * Les activités disent l'esprit du séjour, réparti sur les jours sans date précise. Un événement, lui, a SON jour et SON moment : le
 * mariage samedi soir, la réunion jeudi en journée. Module pur.
 *
 *   · Chaque événement est une SITUATION à lui (son occasion mère, la météo de son jour, ce seul jour) : la valise compose donc un look
 *     qui lui répond, comme pour toute situation — le moteur de tenues reçoit l'occasion mère, rien d'autre (aucun second moteur).
 *   · Le planning jour par jour le place à sa date et à son moment, AVANT d'étaler les activités, qui évitent alors ce créneau.
 *   · La tenue du jour pendant le séjour le reprend par le planning (valiseDuJour.ts) : rien à ajouter de ce côté.
 *
 * Gardés dans `ValiseGardee.evenements`, dans le jsonb `calcul` : aucune migration. Un événement hors des dates du séjour (les dates ont
 * changé depuis) est ignoré, jamais déplacé.
 *
 * Les types proposés renvoient à des entrées du programme qui existent déjà (sous-occasions du voyage ou occasions de Capsela) : ils
 * héritent de leur occasion mère et de ses règles. Le moment par défaut de chaque type est un ARBITRAGE ÉDITORIAL du 22/10/2026 ; la
 * personne le change d'un tap.
 */

export type MomentEvenement = "jour" | "soir";

export interface EvenementValise {
  id: string;
  /** L'entrée du programme dont il prend l'occasion mère (« ceremonie », « diner »…). */
  type: string;
  /** AAAA-MM-JJ, un jour du séjour. */
  jour: string;
  moment: MomentEvenement;
  /** Le nom que la personne lui donne (« Mariage de Léa ») ; facultatif. */
  nom?: string;
}

export const TYPES_EVENEMENT: { id: string; libelle: string; moment: MomentEvenement }[] = [
  { id: "ceremonie", libelle: "Mariage · cérémonie", moment: "jour" },
  { id: "diner", libelle: "Dîner", moment: "soir" },
  { id: "soiree", libelle: "Soirée", moment: "soir" },
  { id: "date", libelle: "Rendez-vous", moment: "soir" },
  { id: "travail_reunion", libelle: "Réunion · travail", moment: "jour" },
];

export const NOM_EVENEMENT_MAX = 40;

/** Le sous-identifiant d'un événement dans les situations et le planning : jamais celui d'une entrée du programme. */
export const PREFIXE_EVENEMENT = "evt:";
export const sousIdEvenement = (e: Pick<EvenementValise, "id">): string => `${PREFIXE_EVENEMENT}${e.id}`;
export const estSousIdEvenement = (sousId: string): boolean => sousId.startsWith(PREFIXE_EVENEMENT);

/** Ce que l'écran dit d'un événement : son nom s'il en a un, sinon son type. */
export function libelleEvenement(e: Pick<EvenementValise, "type" | "nom">): string {
  const nom = e.nom?.trim();
  if (nom) return nom;
  return TYPES_EVENEMENT.find((t) => t.id === e.type)?.libelle ?? elementProgramme(e.type)?.libelle ?? "Événement";
}

/** Les événements qui tombent dans le séjour, dans l'ordre du séjour (jour, puis journée avant soirée). */
export function evenementsDuSejour(evenements: readonly EvenementValise[] | undefined, jours: readonly string[]): EvenementValise[] {
  return (evenements ?? [])
    .filter((e) => jours.includes(e.jour) && !!elementProgramme(e.type))
    .sort((a, b) => a.jour.localeCompare(b.jour) || (a.moment === b.moment ? 0 : a.moment === "jour" ? -1 : 1));
}

/** Une situation par événement du séjour : son occasion mère, la météo de son jour, ce seul jour. Ajoutées APRÈS celles du programme. */
export function situationsDesEvenements(evenements: readonly EvenementValise[] | undefined, meteos: readonly MeteoJour[]): SituationValise[] {
  const jours = meteos.map((m) => m.jour);
  return evenementsDuSejour(evenements, jours).flatMap((e): SituationValise[] => {
    const element = elementProgramme(e.type);
    const m = meteos.find((x) => x.jour === e.jour);
    if (!element || !m) return [];
    const [groupe] = groupesMeteo([m]);
    return [{ occasion: element.mere, meteo: groupe.meteo, jours: [e.jour], ...(element.contrainte ? { contrainte: element.contrainte } : {}), sousIds: [sousIdEvenement(e)] }];
  });
}
