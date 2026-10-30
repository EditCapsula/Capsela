import type { CreneauPlanning } from "./planningValise";
import { GROUPES_VALISE, type LookValise } from "./valise";
import type { Item } from "./types";

/*
 * LES VÊTEMENTS DE LA VALISE (30/10/2026, brief « Refonte UX de l'écran Ma valise »). Module pur, lu par l'écran Valise.
 *
 * Une valise garde ses pièces (`pieceIds`) et ses tenues (`looks`, chacune avec ses `ids`). Ce module en tire, SANS RIEN MODIFIER :
 *   · les vêtements UNIQUES à emporter — par identifiant, jamais par nom ni par catégorie : un pull porté dans trois tenues est UNE
 *     pièce, qui garde la référence de ses trois tenues ;
 *   · leur provenance, en deux statuts (arbitré par la propriétaire le 30/10/2026) : « Dans ton dressing » pour une pièce qu'elle
 *     possède, « À ajouter » pour une suggestion de la capsule (`suggestionIds`, ce que la valise garde déjà). Pas de « Dans ta
 *     capsule » : dans l'app, la capsule est une sélection du catalogue, elle ne contient pas les pièces de la personne en tant que telles ;
 *   · les suggestions à part : elles restent dans les tenues que le moteur a composées (aucune tenue n'est modifiée), mais ne sont ni
 *     rangées avec les vêtements à emporter, ni comptées parmi eux — « À compléter » les présente, avec la tenue qui les demande.
 */

export interface VetementDeLaValise {
  item: Item;
  /** Les tenues (indices dans `looks`) qui la portent ; vide pour une pièce qu'aucune tenue n'utilise encore. */
  tenues: number[];
}

export interface VetementsDeLaValise {
  /** Les pièces possédées, uniques, dans l'ordre de la valise. */
  aEmporter: VetementDeLaValise[];
  /** Les suggestions de la capsule portées par des tenues : à ajouter au dressing, jamais comptées comme disponibles. */
  aAjouter: VetementDeLaValise[];
}

export function vetementsDeLaValise(
  pieceIds: readonly number[],
  looks: readonly Pick<LookValise, "ids">[],
  suggestionIds: readonly number[] | undefined,
  resoudre: (id: number) => Item | undefined
): VetementsDeLaValise {
  const suggestions = new Set(suggestionIds ?? []);
  const vues = new Set<number>();
  const aEmporter: VetementDeLaValise[] = [];
  const aAjouter: VetementDeLaValise[] = [];
  for (const id of pieceIds) {
    if (vues.has(id)) continue;
    vues.add(id);
    const item = resoudre(id);
    if (!item) continue;
    const tenues = looks.flatMap((l, i) => (l.ids.includes(id) ? [i] : []));
    (suggestions.has(id) ? aAjouter : aEmporter).push({ item, tenues });
  }
  return { aEmporter, aAjouter };
}

/** Les vêtements à emporter rangés par grande famille (GROUPES_VALISE), chaque famille avec son nombre de pièces uniques ; les vides omises. */
export function vetementsParFamille(aEmporter: readonly VetementDeLaValise[]): { titre: string; vetements: VetementDeLaValise[] }[] {
  return GROUPES_VALISE.flatMap(([titre, cats]) => {
    const vetements = aEmporter.filter((v) => cats.includes(v.item.cat));
    return vetements.length ? [{ titre, vetements }] : [];
  });
}

/**
 * La raison d'une suggestion, tirée du planning : les créneaux dont la tenue la porte (« Pour ta tenue Dîner du ven. 6 nov. »). Sans
 * planning (valise d'avant le planning jour par jour), null : l'écran dit alors seulement dans combien de tenues elle entre.
 */
export function creneauxDeLaPiece(planning: readonly CreneauPlanning[], looks: readonly Pick<LookValise, "ids">[], id: number): CreneauPlanning[] {
  return planning.filter((c) => c.look != null && looks[c.look]?.ids.includes(id));
}
