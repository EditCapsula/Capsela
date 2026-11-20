import { isCatalogId } from "./catalog";
import type { OccasionKey } from "./types";
import type { ValiseGardee } from "./valises";

/**
 * AJOUTER UN LOOK À UNE VALISE (20/11/2026, demandé depuis le détail d'un look : « je veux que tu développes le fait de… l'ajouter à une
 * valise »).
 *
 * Une valise compose ses looks elle-même (valise.ts) ; un look ajouté à la main s'y range comme les siens, sans rien recalculer :
 * - ses pièces rejoignent celles de la valise (sans doublon) ; une pièce de la capsule y entre comme suggestion (`suggestionIds`), comme
 *   celles que la composition ajoute quand le dressing ne suffit pas ;
 * - il répond aux occasions de la valise qui sont la sienne (la même occasion) ; aucune occasion inventée quand la valise n'a pas la
 *   sienne, ou quand le look n'en porte pas ;
 * - une occasion qu'il couvre n'est plus « sans look ».
 *
 * Refusé, avec sa raison : un look déjà dans la valise (mêmes pièces), et un look qui contient des pièces de la capsule quand la valise
 * a été faite « uniquement avec mon dressing » (elle n'emporte que des pièces possédées).
 *
 * « Recomposer ma valise » repart du dressing et de la capsule : un look ajouté à la main n'y survit pas (comme les looks de la
 * composition précédente).
 */
export type ResultatAjout =
  | { ok: true; valise: ValiseGardee }
  | { ok: false; raison: "deja" | "dressing_seul" };

const cle = (ids: readonly number[]) => [...ids].sort((a, b) => a - b).join(",");

export function ajouterLookAValise(v: ValiseGardee, ids: readonly number[], occasion: OccasionKey | undefined): ResultatAjout {
  if (v.looks.some((l) => cle(l.ids) === cle(ids))) return { ok: false, raison: "deja" };
  const deLaCapsule = ids.filter((id) => isCatalogId(id));
  if (v.uniquementDressing && deLaCapsule.length) return { ok: false, raison: "dressing_seul" };
  const situations = occasion && occasion !== "all" ? v.situations.flatMap((s, i) => (s.occasion === occasion ? [i] : [])) : [];
  const pieceIds = [...v.pieceIds, ...ids.filter((id) => !v.pieceIds.includes(id))];
  const suggestions = v.suggestionIds ?? [];
  const nouvellesSuggestions = deLaCapsule.filter((id) => !suggestions.includes(id) && !v.pieceIds.includes(id));
  return {
    ok: true,
    valise: {
      ...v,
      pieceIds,
      ...(nouvellesSuggestions.length ? { suggestionIds: [...suggestions, ...nouvellesSuggestions] } : {}),
      looks: [...v.looks, { ids: [...ids], situations, elargie: false }],
      situationsSansLook: v.situationsSansLook.filter((i) => !situations.includes(i)),
    },
  };
}

/** Les valises auxquelles on peut encore ajouter un look : celles dont le retour n'est pas passé, la plus proche d'abord. */
export function valisesAVenir(valises: readonly ValiseGardee[], aujourdhui: string): ValiseGardee[] {
  return valises.filter((v) => v.retour >= aujourdhui).sort((a, b) => a.depart.localeCompare(b.depart));
}
