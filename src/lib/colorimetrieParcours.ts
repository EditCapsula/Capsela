import { QUESTIONS_COLORIMETRIE, saisonDuQuestionnaire, type SaisonCle } from "./colorimetrie";

/*
 * LE PARCOURS COLORIMÉTRIE DE L'ONBOARDING — la machine à états, pure et testée.
 *
 * DEPUIS LE 31/10/2026 (brief « Évolution de l'onboarding », lot 3) : UN SEUL ÉCRAN.
 *
 *   formulaire (cheveux, yeux ; « pour affiner » : bijoux, blanc) → analyse → résultat (étape suivante)
 *                                                                          ↘ pas de saison nette
 *
 * Avant : présentation, puis une question par écran (30/09/2026). Les QUATRE questions sont gardées, leurs réponses et
 * leurs poids aussi (arbitrage du 31/10/2026) : seule la mise en page change. Les règles de saison
 * (saisonDuQuestionnaire) ne sont pas touchées.
 *
 * Cheveux et yeux demandent une réponse (« Je ne sais pas » en est une) ; bijoux et blanc sont facultatifs. Une
 * question sans réponse ne compte pas (saisonDuQuestionnaire l'ignore) : elle ne pénalise rien.
 *
 * Elle vit dans ProfileSetupScreen et non dans l'écran de l'étape : le bouton RETOUR de l'en-tête et le bouton
 * principal du pied d'écran sont dessinés par l'onboarding ; ils ont besoin de l'état.
 */

export type VueColorimetrie = "formulaire" | "analyse" | "indecis";

export interface ParcoursColorimetrie {
  vue: VueColorimetrie;
  /** Un indice de réponse par question, dans l'ordre de QUESTIONS_COLORIMETRIE. */
  reponses: (number | null)[];
}

export const NB_QUESTIONS = QUESTIONS_COLORIMETRIE.length;

const indexDe = (id: string) => QUESTIONS_COLORIMETRIE.findIndex((q) => q.id === id);

/** L'ordre d'affichage : ce qu'on connaît de soi d'abord, puis ce qui affine. Des indices de QUESTIONS_COLORIMETRIE. */
export const QUESTIONS_PRINCIPALES = ["cheveux", "yeux"].map(indexDe);
export const QUESTIONS_POUR_AFFINER = ["bijoux", "blanc"].map(indexDe);

export function parcoursInitial(reponses: (number | null)[] = QUESTIONS_COLORIMETRIE.map(() => null)): ParcoursColorimetrie {
  return { vue: "formulaire", reponses: QUESTIONS_COLORIMETRIE.map((_, i) => reponses[i] ?? null) };
}

/** « Refaire le test » / « Refaire le questionnaire » : tout recommence, réponses comprises. */
export function recommencer(): ParcoursColorimetrie {
  return parcoursInitial();
}

/** Une réponse par question ; toucher la réponse déjà choisie la retire (une question facultative peut rester vide). */
export function choisir(p: ParcoursColorimetrie, question: number, indice: number): ParcoursColorimetrie {
  if (p.vue !== "formulaire" || !QUESTIONS_COLORIMETRIE[question]?.reponses[indice]) return p;
  const valeur = p.reponses[question] === indice ? null : indice;
  return { ...p, reponses: p.reponses.map((r, i) => (i === question ? valeur : r)) };
}

export const peutAnalyser = (p: ParcoursColorimetrie) => p.vue === "formulaire" && QUESTIONS_PRINCIPALES.every((i) => p.reponses[i] != null);

/** « Analyser ma palette ». Sans cheveux ni yeux, rien ne bouge. */
export function analyser(p: ParcoursColorimetrie): ParcoursColorimetrie {
  return peutAnalyser(p) ? { ...p, vue: "analyse" } : p;
}

/**
 * Le bouton retour de l'en-tête. Rend l'état précédent DANS l'étape, ou null quand il faut quitter l'étape (depuis le
 * formulaire). Pendant l'analyse, aucun retour : l'écran dure moins de deux secondes et ne montre pas le bouton.
 */
export function retour(p: ParcoursColorimetrie): ParcoursColorimetrie | null {
  switch (p.vue) {
    case "indecis":
      return { ...p, vue: "formulaire" };
    case "analyse":
      return p;
    default:
      return null;
  }
}

/**
 * Fin de l'analyse. Une saison : l'onboarding passe au résultat, et l'étape revient au formulaire, réponses intactes
 * (un retour depuis le résultat y ramène). Pas de saison : « Pas de saison nette ».
 */
export function conclure(p: ParcoursColorimetrie): { parcours: ParcoursColorimetrie; saison: SaisonCle | null } {
  const saison = saisonDuQuestionnaire(p.reponses);
  return saison ? { parcours: { ...p, vue: "formulaire" }, saison } : { parcours: { ...p, vue: "indecis" }, saison: null };
}
