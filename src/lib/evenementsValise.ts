import { elementProgramme } from "./programmeValise";
import type { OccasionKey } from "./types";
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

/**
 * Le moment d'un événement. « jour » (Journée) et « soir » (Soirée) depuis le 22/10/2026 ; « matin » et « journee_entiere » (Toute la
 * journée) ajoutés le 30/10/2026 (brief « Fluidification du parcours ») — valeurs EN PLUS, les valises déjà gardées restent valides. Le
 * planning n'a que deux créneaux : matin, journée et toute la journée prennent celui de la JOURNÉE ; toute la journée occupe aussi la
 * soirée, que les activités évitent alors (creneauDuMoment, planningValise.ts).
 */
export type MomentEvenement = "matin" | "jour" | "soir" | "journee_entiere";

export const MOMENTS_EVENEMENT: { id: MomentEvenement; libelle: string }[] = [
  { id: "matin", libelle: "Matin" },
  { id: "jour", libelle: "Journée" },
  { id: "soir", libelle: "Soirée" },
  { id: "journee_entiere", libelle: "Toute la journée" },
];
export const libelleMoment = (m: MomentEvenement): string => MOMENTS_EVENEMENT.find((x) => x.id === m)?.libelle ?? "Journée";
/** Le créneau du planning qu'un moment occupe : la soirée pour « soir », la journée pour les trois autres. */
export const creneauDuMoment = (m: MomentEvenement): "jour" | "soir" => (m === "soir" ? "soir" : "jour");
const ORDRE_MOMENT: Record<MomentEvenement, number> = { matin: 0, journee_entiere: 1, jour: 2, soir: 3 };

export interface EvenementValise {
  id: string;
  /** L'entrée du programme dont il prend l'occasion mère (« ceremonie », « diner »…). */
  type: string;
  /** AAAA-MM-JJ, un jour du séjour. */
  jour: string;
  moment: MomentEvenement;
  /** Le nom que la personne lui donne (« Mariage de Léa ») ; facultatif. */
  nom?: string;
  /**
   * L'occasion lue dans le NOM d'un événement « Autre » (22/10/2026, lectureEvenement.ts) : elle remplace celle du type, qui ne dit rien.
   * Absente sans nom, hors ligne ou sur une lecture douteuse.
   */
  occasionLue?: OccasionKey;
}

/**
 * Les types, dans l'ordre du brief du 30/10/2026 (libellés courts : « Mariage », « Réunion »). Trois types ajoutés ce jour-là renvoient à
 * des entrées du programme qui existent déjà — aucune règle nouvelle : Visite → visites (marche), Activité sportive → sport, Sortie en
 * bateau → excursion (marche : des chaussures plates). Le rattachement de la sortie en bateau est un ARBITRAGE ÉDITORIAL.
 */
export const TYPES_EVENEMENT: { id: string; libelle: string; moment: MomentEvenement }[] = [
  { id: "diner", libelle: "Dîner", moment: "soir" },
  { id: "soiree", libelle: "Soirée", moment: "soir" },
  { id: "ceremonie", libelle: "Mariage", moment: "journee_entiere" },
  { id: "travail_reunion", libelle: "Réunion", moment: "jour" },
  { id: "date", libelle: "Rendez-vous", moment: "soir" },
  { id: "excursion", libelle: "Sortie en bateau", moment: "jour" },
  { id: "visites", libelle: "Visite", moment: "jour" },
  { id: "sport", libelle: "Activité sportive", moment: "matin" },
  // « Autre » (22/10/2026, brief de refonte de l'étape 4) : un événement que les autres types ne décrivent pas. Il prend l'occasion
  // Quotidien, la plus neutre — ARBITRAGE ÉDITORIAL : sans savoir ce qu'il est, Capsela n'habille ni trop ni trop peu ; le nom donné
  // par la personne ne change pas la tenue (le moteur ne lit pas de texte libre).
  { id: "quotidien", libelle: "Autre", moment: "jour" },
  // Depuis le même jour, le NOM d'un événement « Autre » est lu (occasionLue, lectureEvenement.ts) : Quotidien n'est plus qu'un repli.
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

/** Les événements qui tombent dans le séjour, dans l'ordre du séjour (jour, puis matin, toute la journée, journée, soirée). */
export function evenementsDuSejour(evenements: readonly EvenementValise[] | undefined, jours: readonly string[]): EvenementValise[] {
  return (evenements ?? [])
    .filter((e) => jours.includes(e.jour) && !!elementProgramme(e.type))
    .sort((a, b) => a.jour.localeCompare(b.jour) || (ORDRE_MOMENT[a.moment] ?? 2) - (ORDRE_MOMENT[b.moment] ?? 2));
}

/** Le type « Autre » : le seul dont le nom est lu (son occasion par défaut ne dit rien de l'événement). */
export const TYPE_AUTRE = "quotidien";

/** L'occasion que le moteur reçoit pour un événement : celle lue dans le nom d'un « Autre », sinon celle de son type. */
export function occasionDeLEvenement(e: Pick<EvenementValise, "type" | "occasionLue">): OccasionKey | null {
  if (e.type === TYPE_AUTRE && e.occasionLue) return e.occasionLue;
  return elementProgramme(e.type)?.mere ?? null;
}

/** Une situation par événement du séjour : son occasion mère, la météo de son jour, ce seul jour. Ajoutées APRÈS celles du programme. */
export function situationsDesEvenements(evenements: readonly EvenementValise[] | undefined, meteos: readonly MeteoJour[]): SituationValise[] {
  const jours = meteos.map((m) => m.jour);
  return evenementsDuSejour(evenements, jours).flatMap((e): SituationValise[] => {
    const element = elementProgramme(e.type);
    const occasion = occasionDeLEvenement(e);
    const m = meteos.find((x) => x.jour === e.jour);
    if (!element || !occasion || !m) return [];
    const [groupe] = groupesMeteo([m]);
    return [{ occasion, meteo: groupe.meteo, jours: [e.jour], ...(element.contrainte ? { contrainte: element.contrainte } : {}), sousIds: [sousIdEvenement(e)] }];
  });
}
