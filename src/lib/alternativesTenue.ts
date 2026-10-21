import { varieSubstantiellement } from "./logic";
import type { Item } from "./types";

/*
 * LES AUTRES TENUES D'UN MOMENT PLANIFIÉ (20/10/2026, signalé : des idées presque identiques — même robe, mêmes mocassins, même sac, un
 * accessoire en plus — et « Voir d'autres idées » toujours affiché, même quand il n'y en a plus).
 *
 * Une idée n'est retenue que si elle est une AUTRE tenue que toutes celles déjà montrées — la proposition actuelle, les idées de cette
 * série et celles des séries précédentes — au sens du moteur (`varieSubstantiellement` : un autre socle, ou au moins deux pièces
 * principales changées). Un accessoire de plus ne fait pas une nouvelle idée. Le moteur compose ; ce module ne fait que trier.
 *
 * `epuise` : la série n'a pas trouvé ses `n` idées en `essais` tirages — le dressing n'en a plus d'assez différentes. L'écran retire
 * alors « Voir d'autres idées » au lieu de le laisser promettre ce qu'il ne trouvera pas.
 */
export function autresIdees(
  tirer: () => number[] | null,
  dejaVues: readonly number[][],
  pool: Item[],
  n = 3,
  essais = 80
): { idees: number[][]; epuise: boolean } {
  const vues = [...dejaVues];
  const idees: number[][] = [];
  for (let i = 0; i < essais && idees.length < n; i++) {
    const ids = tirer();
    if (!ids?.length) continue;
    if (!vues.every((v) => varieSubstantiellement(v, ids, pool))) continue;
    vues.push(ids);
    idees.push(ids);
  }
  return { idees, epuise: idees.length < n };
}
