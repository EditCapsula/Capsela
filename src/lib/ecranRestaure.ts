import type { Screen } from "./types";

/**
 * L'ÉCRAN À RETROUVER APRÈS UN RECHARGEMENT (08/10/2026, signalé : sur le web, recharger une page ramenait toujours à
 * l'accueil). L'app n'a pas de routage par URL (la navigation est un état du store) : l'écran courant est donc gardé dans
 * le stockage de SESSION de l'onglet — il survit au rechargement, pas à la fermeture de l'onglet, et n'est jamais partagé
 * entre deux onglets.
 *
 * Seuls les écrans de premier niveau se restaurent : ils vivent de l'état déjà rechargé (dressing, tenue, historique).
 * Un écran de détail ou de parcours (une pièce, un look, l'ajout, Premium, un avis…) dépend d'un contexte perdu au
 * rechargement : on retombe sur l'accueil, comme avant.
 */
export const ECRANS_RESTAURABLES: ReadonlySet<Screen> = new Set<Screen>(["home", "wardrobe", "capsule", "history", "tenues", "calendrier", "planifier"]);

const CLE = "capsela.dernierEcran";

type Stockage = Pick<Storage, "getItem" | "setItem">;

function stockageSession(): Stockage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Retient l'écran s'il est restaurable ; ne fait rien d'un autre (l'écran d'accueil de l'app, un détail, un parcours). */
export function memoriserEcran(ecran: Screen, stockage: Stockage | null = stockageSession()): void {
  if (!stockage || !ECRANS_RESTAURABLES.has(ecran)) return;
  try {
    stockage.setItem(CLE, ecran);
  } catch {
    // Stockage plein ou refusé : on repartira de l'accueil.
  }
}

/** L'écran à rouvrir, ou null (rien de retenu, valeur inconnue, stockage indisponible). */
export function ecranARestaurer(stockage: Stockage | null = stockageSession()): Screen | null {
  if (!stockage) return null;
  try {
    const v = stockage.getItem(CLE) as Screen | null;
    return v && ECRANS_RESTAURABLES.has(v) ? v : null;
  } catch {
    return null;
  }
}
