import type { Screen } from "./types";

/**
 * LE MENU D'ACTIONS FLOTTANT (12/11/2026, brief « Speed Dial »). Un seul bouton « + », posé par App.tsx (jamais par un écran), qui
 * ouvre les quatre parcours existants : ajouter une pièce, planifier une tenue, préparer une valise, demander l'avis de styliste.
 *
 * Il ne vit que sur les PAGES PRINCIPALES, celles de la barre du bas et leurs vues directes. Pas sur les parcours (Valise, Ajouter, et
 * les étapes de Planifier : leur bouton d'action occupe ce coin) — l'accueil de Planifier l'a (12/11/2026, demandé), ses étapes le
 * masquent (PlanifierScreen, masquerMenuActions), ni sur les écrans de détail qui posent leur propre barre d'actions sur le menu
 * (fiche d'une pièce, création d'un look, avis partagé). Il remplace le « + » propre au Dressing et à « Dernières pièces » (même
 * place, même forme) : deux boutons « + » au même endroit ne se seraient pas distingués.
 */
export const ECRANS_MENU_ACTIONS: ReadonlySet<Screen> = new Set<Screen>(["home", "tenues", "wardrobe", "dernieresPieces", "capsule", "history", "looks", "calendrier", "planifier"]);

/**
 * Un écran peut le masquer le temps d'un état qui occupe le bas de l'écran — la sélection du Dressing et sa barre « Retirer ».
 * Un petit magasin externe (useSyncExternalStore) plutôt qu'un état du store : seul le menu se re-rend quand il change.
 */
const masques = new Set<string>();
const abonnes = new Set<() => void>();
let instantane = 0;

export function masquerMenuActions(raison: string, masque: boolean): void {
  const avant = masques.has(raison);
  if (masque === avant) return;
  if (masque) masques.add(raison);
  else masques.delete(raison);
  instantane++;
  abonnes.forEach((f) => f());
}

export const abonnerMenuActions = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};
export const instantaneMenuActions = () => instantane;
export const menuActionsMasque = () => masques.size > 0;

/** Le menu est-il proposé ? Sur une page principale, sans état qui le masque, sans clavier ouvert. */
export function menuActionsVisible(p: { screen: Screen; masque: boolean; clavier: boolean }): boolean {
  return ECRANS_MENU_ACTIONS.has(p.screen) && !p.masque && !p.clavier;
}
