import { morphologieOrienteLaSelection, silhouetteOrienteLaCapsule } from "./capsule";
import { BONUS_SILHOUETTE_RONDE_EN_PRODUCTION, estSilhouetteRonde } from "./silhouetteRonde";
import { colorimetrieUtilisable, type Colorimetrie } from "./colorimetrie";

/*
 * LA SYNTHÈSE DU PROFIL, ÉTAPE 6/7 DE L'ONBOARDING (15/11/2026, brief « Refonte UX/UI – Étape 6/7 : Synthèse du profil »).
 * Les règles pures de l'écran (SyntheseProfil.tsx) : la phrase de la première capsule, et le compte à rebours vers la création du
 * dressing. Aucune règle métier n'est réécrite ici : la saison de la capsule est celle de l'écran Capsule, la morphologie et la
 * colorimétrie sont lues avec les fonctions du moteur.
 */

/**
 * CE QUE LA PREMIÈRE CAPSULE PREND EN COMPTE, dit seulement quand c'est vrai (règle du projet : une phrase qui affirme qu'une donnée
 * sert à quelque chose doit l'être dans le code). Le style, toujours ; la silhouette, seulement si elle oriente la sélection de la
 * capsule (`silhouetteOrienteLaCapsule`, capsule.ts — les silhouettes en A et en V, et la silhouette ronde depuis le 15/11/2026) ; les couleurs préférées si elles
 * sont choisies ; la colorimétrie si le questionnaire a donné une saison — la capsule la lit depuis le 15/11/2026, juste après les
 * couleurs préférées (SelectionStrategy.colorimetrieCapsule « hierarchie », capsule.ts). Avant cette date elle ne la lisait pas, et la
 * phrase ne la citait pas.
 */
export function phraseCapsule(p: { morphology: string | null | undefined; nbCouleurs: number; colorimetrie?: Colorimetrie | null }): string {
  const parts = ["ton style"];
  if (silhouetteOrienteLaCapsule(p.morphology)) parts.push("ta silhouette");
  if (p.nbCouleurs > 0) parts.push("tes couleurs préférées");
  if (colorimetrieUtilisable(p.colorimetrie)) parts.push("ta colorimétrie");
  const liste = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
  return `Nous allons composer une sélection de pièces adaptées à ${liste}.`;
}

/**
 * CE QUE LA SILHOUETTE CHANGE, dit seulement quand c'est vrai. CORRIGÉ LE 15/11/2026 : la version du matin promettait « dans tes
 * tenues » aux silhouettes que le modèle sait décrire (zonesRequises) — faux, le score des tenues n'a plus de terme morphologique
 * depuis le 29/08/2026 (R-S9 retirée). Ce qui est vrai :
 *   · silhouette ronde : la capsule (rang silhouetteRonde) ET les tenues (bonus R-S20, meilleur tirage) ;
 *   · silhouettes en A et en V : la capsule (direction morphologique) ;
 *   · les autres : rien n'est orienté, la phrase ne le prétend pas.
 */
export function phraseSilhouette(morphology: string): string {
  if (BONUS_SILHOUETTE_RONDE_EN_PRODUCTION && silhouetteOrienteLaCapsule(morphology) && estSilhouetteRonde(morphology))
    return "Des coupes, volumes et proportions accordés à ta silhouette, dans ta capsule comme dans tes tenues.";
  if (morphologieOrienteLaSelection(morphology)) return "Des coupes, volumes et proportions accordés à ta silhouette dans ta capsule.";
  return "Elle est gardée dans ton profil, et tu peux la changer à tout moment.";
}

/**
 * LE COMPTE À REBOURS VERS LA CRÉATION DU DRESSING — une proposition d'expérience, à éprouver en tests. Réglable sans toucher à
 * l'écran : cette valeur, en secondes ; 0 le désactive. Pour un test sur un appareil, `localStorage["capsela.decompteSynthese"]`
 * la remplace (« 0 » pour le couper, « 12 » pour l'allonger) sans nouvelle version.
 */
export const DECOMPTE_SYNTHESE_S = 8;
const CLE_REGLAGE = "capsela.decompteSynthese";

export function dureeDecompteSynthese(reglage: string | null = lireReglage()): number {
  if (reglage != null && reglage.trim() !== "") {
    const n = Number(reglage);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return DECOMPTE_SYNTHESE_S;
}

function lireReglage(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(CLE_REGLAGE);
  } catch {
    return null;
  }
}

/** « dans 8 secondes », « dans 1 seconde ». */
export function libelleDecompte(restant: number): string {
  return `On t'emmène à la création de ton dressing dans ${restant} ${restant > 1 ? "secondes" : "seconde"}…`;
}
