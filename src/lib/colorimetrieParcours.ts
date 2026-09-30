import { QUESTIONS_COLORIMETRIE, saisonDuQuestionnaire, type SaisonCle } from "./colorimetrie";

/*
 * LE PARCOURS COLORIMÉTRIE DE L'ONBOARDING (30/09/2026, brief « Refonte UX/UI
 * du parcours colorimétrie ») — la machine à états, pure et testée.
 *
 *   présentation → question 1…4 → analyse → résultat (étape suivante)
 *                                         ↘ pas de saison nette
 *
 * Elle vit dans ProfileSetupScreen et non dans l'écran de l'étape : le bouton
 * RETOUR de l'en-tête doit remonter d'une question (le brief retire « Question
 * précédente » et « Revenir à la présentation »), et le bouton principal du
 * pied d'écran dit « Continuer » ou « Voir mon résultat ». Les deux sont
 * dessinés par l'onboarding ; ils ont besoin de l'état.
 *
 * Une réponse se CHOISIT, puis on continue : plus d'avance automatique au
 * toucher, qui ne laissait pas voir ce qu'on venait de choisir.
 */

export type VueColorimetrie = "presentation" | "question" | "analyse" | "indecis";

export interface ParcoursColorimetrie {
  vue: VueColorimetrie;
  /** Index de la question affichée (vue "question"). */
  question: number;
  /** Un indice de réponse par question, dans l'ordre de QUESTIONS_COLORIMETRIE. */
  reponses: (number | null)[];
}

export const NB_QUESTIONS = QUESTIONS_COLORIMETRIE.length;

export function parcoursInitial(reponses: (number | null)[] = QUESTIONS_COLORIMETRIE.map(() => null)): ParcoursColorimetrie {
  return { vue: "presentation", question: 0, reponses: [...reponses] };
}

/** « Commencer » : première question, en gardant les réponses déjà données (reprise d'un questionnaire). */
export function commencer(p: ParcoursColorimetrie): ParcoursColorimetrie {
  return { ...p, vue: "question", question: 0 };
}

/** « Refaire le questionnaire » : tout recommence, réponses comprises. */
export function recommencer(): ParcoursColorimetrie {
  return { ...parcoursInitial(), vue: "question" };
}

export function choisir(p: ParcoursColorimetrie, indice: number): ParcoursColorimetrie {
  if (p.vue !== "question" || !QUESTIONS_COLORIMETRIE[p.question]?.reponses[indice]) return p;
  return { ...p, reponses: p.reponses.map((r, i) => (i === p.question ? indice : r)) };
}

export const peutContinuer = (p: ParcoursColorimetrie) => p.vue === "question" && p.reponses[p.question] != null;
export const derniereQuestion = (p: ParcoursColorimetrie) => p.question >= NB_QUESTIONS - 1;

/** « Continuer » / « Voir mon résultat ». Sans réponse à la question affichée, rien ne bouge. */
export function continuer(p: ParcoursColorimetrie): ParcoursColorimetrie {
  if (!peutContinuer(p)) return p;
  return derniereQuestion(p) ? { ...p, vue: "analyse" } : { ...p, question: p.question + 1 };
}

/**
 * Le bouton retour de l'en-tête. Rend l'état précédent DANS l'étape, ou null
 * quand il faut quitter l'étape (depuis la présentation). Pendant l'analyse,
 * aucun retour : l'écran dure moins de deux secondes et ne montre pas le bouton.
 */
export function retour(p: ParcoursColorimetrie): ParcoursColorimetrie | null {
  switch (p.vue) {
    case "question":
      return p.question > 0 ? { ...p, question: p.question - 1 } : { ...p, vue: "presentation" };
    case "indecis":
      return { ...p, vue: "question", question: NB_QUESTIONS - 1 };
    case "analyse":
      return p;
    default:
      return null;
  }
}

/**
 * Fin de l'analyse. Une saison : l'onboarding passe au résultat, et l'étape
 * se replace sur la dernière question — un retour depuis le résultat y
 * ramène, réponses intactes. Pas de saison : « Pas de saison nette ».
 */
export function conclure(p: ParcoursColorimetrie): { parcours: ParcoursColorimetrie; saison: SaisonCle | null } {
  const saison = saisonDuQuestionnaire(p.reponses);
  return saison
    ? { parcours: { ...p, vue: "question", question: NB_QUESTIONS - 1 }, saison }
    : { parcours: { ...p, vue: "indecis" }, saison: null };
}
