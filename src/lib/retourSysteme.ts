import type { Screen } from "./types";

/*
 * LE RETOUR ANDROID (bouton ou geste, 22/10/2026, brief « Harmonisation UX de la navigation »). Constat de l'audit : l'app n'écoutait
 * pas l'événement `backButton` de Capacitor, et sans routage par URL la WebView n'a pas d'historique — le retour Android FERMAIT
 * l'application depuis n'importe quel écran, feuille ouverte comprise.
 *
 * Il suit désormais ce que l'écran propose déjà, dans cet ordre, sans second mécanisme de navigation :
 *   1. une feuille, une fiche en feuille ou un document ouvert par-dessus se ferme (le même chemin que la touche Échap) ;
 *   2. sinon, le bouton Retour visible de l'écran (BoutonRetour, celui du bandeau compris) est touché — même destination qu'au doigt ;
 *   3. sinon, un écran de la barre du bas revient à l'accueil, l'onboarding revient à son étape précédente ;
 *   4. sinon (l'accueil, l'écran d'avant-connexion) : l'app se ferme, comme le veut la plateforme.
 */

export type DecisionRetour = "fermer" | "bouton" | "accueil" | "etapePrecedente" | "quitter";

const ECRANS_DE_LA_BARRE: readonly Screen[] = ["wardrobe", "capsule", "planifier", "history", "calendrier", "tenues"];

export function decisionRetour(c: { superposition: boolean; bouton: boolean; ecran: Screen }): DecisionRetour {
  if (c.superposition) return "fermer";
  if (c.bouton) return "bouton";
  if (ECRANS_DE_LA_BARRE.includes(c.ecran)) return "accueil";
  if (c.ecran === "onboarding") return "etapePrecedente";
  return "quitter";
}

/** L'attribut que porte tout bouton Retour d'écran (BoutonRetour) : le retour Android le touche. */
export const ATTRIBUT_RETOUR = "data-retour-ecran";

// getClientRects et non offsetParent : celui-ci vaut null pour un élément en position fixe, comme le voile d'une feuille.
const visible = (e: Element) => e.getClientRects().length > 0 && !e.closest("[aria-hidden='true'], [inert]");

/** Ce que la page affiche : une superposition modale, et le bouton Retour de l'écran (le premier visible, celui du haut). */
export function lirePage(doc: Document): { superposition: Element | null; bouton: HTMLElement | null } {
  const superposition = [...doc.querySelectorAll("[role='dialog']")].find(visible) ?? null;
  const bouton = ([...doc.querySelectorAll(`[${ATTRIBUT_RETOUR}]`)].find(visible) as HTMLElement | undefined) ?? null;
  return { superposition, bouton };
}
