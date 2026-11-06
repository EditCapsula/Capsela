import { MONTHS_FR } from "./data";
import type { ValiseGardee } from "./valises";

/*
 * LES RAPPELS CONTEXTUELS DES VALISES (06/11/2026, brief « Évolution UX – Rappels contextuels des valises dans Capsela »).
 *
 * Une seule source pour tous les points de contact : la carte « Ton prochain départ » de l'accueil, le point terracotta sur
 * l'icône du calendrier et sur l'onglet Planifier, le pictogramme valise du planning. Tout se calcule à l'affichage depuis les
 * valises enregistrées (state.valises) et la date du jour : une valise supprimée ou des dates modifiées changent les rappels
 * d'elles-mêmes, rien n'est stocké, rien n'est simulé.
 *
 *   · rappel : le départ est dans 1 à FENETRE_RAPPEL_JOURS jours (J-7 à J-1). Le jour du départ, l'accueil passe en mode séjour
 *     (valiseDuJour.ts) : plus de rappel. Un voyage lointain, en cours ou terminé n'en a pas ;
 *   · plusieurs voyages : le départ le plus proche seulement ;
 *   · le planning montre chaque départ à sa date, rappel ou non.
 */

export const FENETRE_RAPPEL_JOURS = 7;

const dateDe = (jour: string) => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, m - 1, j);
};

/** Le nombre de jours du jour donné au départ (négatif : départ passé). Dates locales AAAA-MM-JJ : arrondi, sûr au changement d'heure. */
export function joursAvantDepart(depart: string, aujourdhui: string): number {
  return Math.round((dateDe(depart).getTime() - dateDe(aujourdhui).getTime()) / 86_400_000);
}

/**
 * L'état de la valise tel que la valise elle-même l'enregistre : « a_completer » quand elle porte des pièces suggérées à ajouter
 * (suggestionIds), « prete » quand elle a des tenues, rien à ajouter et aucune situation sans tenue ; sinon inconnu (null) — on ne
 * l'affirme pas.
 */
export function etatDeLaValise(v: Pick<ValiseGardee, "suggestionIds" | "situationsSansLook" | "looks">): "prete" | "a_completer" | null {
  if (v.suggestionIds?.length) return "a_completer";
  if (v.looks.length > 0 && !v.situationsSansLook?.length) return "prete";
  return null;
}

/** « du 11 au 20 novembre », « du 28 novembre au 3 décembre », « le 11 novembre ». */
export function periodeEnLettres(depart: string, retour: string): string {
  const a = dateDe(depart);
  const b = dateDe(retour);
  if (depart === retour) return `le ${a.getDate()} ${MONTHS_FR[a.getMonth()]}`;
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `du ${a.getDate()} au ${b.getDate()} ${MONTHS_FR[b.getMonth()]}`
    : `du ${a.getDate()} ${MONTHS_FR[a.getMonth()]} au ${b.getDate()} ${MONTHS_FR[b.getMonth()]}`;
}

/** « Demain », « Dans 5 jours ». */
export const compteARebours = (jours: number): string => (jours <= 1 ? "Demain" : `Dans ${jours} jours`);

/** Le message d'échéance (J-7, J-3, J-1). À J-1, la question « Ta valise est prête ? » seulement quand son état n'est pas connu. */
export function messageDEcheance(jours: number, etat: "prete" | "a_completer" | null): string {
  if (jours <= 1) return etat ? "Demain, c'est le départ." : "Demain, c'est le départ. Ta valise est prête ?";
  if (jours <= 3) return `Plus que ${jours} jours avant le départ !`;
  return "Ton départ approche, ta valise t'attend.";
}

export const MESSAGE_ETAT: Record<"prete" | "a_completer", string> = {
  prete: "Ta valise est prête pour le départ !",
  a_completer: "Il te reste quelques pièces à ajouter à ta valise.",
};

export interface RappelValise {
  valise: ValiseGardee;
  jours: number;
  message: string;
  /** La phrase sur l'état de la valise ; null quand il n'est pas connu. */
  etat: string | null;
  /** « Sénégal · du 11 au 20 novembre ». */
  voyage: string;
  /** « Dans 5 jours ». */
  badge: string;
}

/** Le rappel à montrer aujourd'hui : le départ le plus proche dans la fenêtre J-7 à J-1, ou null. */
export function prochainRappel(valises: readonly ValiseGardee[], aujourdhui: string): RappelValise | null {
  let meilleur: { v: ValiseGardee; jours: number } | null = null;
  for (const v of valises) {
    const jours = joursAvantDepart(v.depart, aujourdhui);
    if (jours < 1 || jours > FENETRE_RAPPEL_JOURS) continue;
    if (!meilleur || jours < meilleur.jours) meilleur = { v, jours };
  }
  if (!meilleur) return null;
  const { v, jours } = meilleur;
  const etat = etatDeLaValise(v);
  return {
    valise: v,
    jours,
    message: messageDEcheance(jours, etat),
    etat: etat ? MESSAGE_ETAT[etat] : null,
    voyage: `${v.destination} · ${periodeEnLettres(v.depart, v.retour)}`,
    badge: compteARebours(jours),
  };
}

/** Les départs du planning, jour par jour (chaque voyage à sa date ; plusieurs le même jour restent distincts). */
export function departsParJour(valises: readonly ValiseGardee[]): Map<string, ValiseGardee[]> {
  const m = new Map<string, ValiseGardee[]>();
  for (const v of valises) m.set(v.depart, [...(m.get(v.depart) ?? []), v]);
  return m;
}
