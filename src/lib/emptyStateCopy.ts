import type { OutfitFailureReason } from "./types";

/**
 * ÉTATS VIDES — mise en mots des trois raisons d'échec du moteur.
 *
 * Corrigé le 31/08/2026. Les libellés précédents portaient un jugement sur
 * l'utilisatrice au lieu de décrire l'état de la génération :
 *
 *   « Dressing insuffisant » / « Capsule insuffisante »
 *   « Tes pièces actuelles ne permettent pas encore de composer une tenue
 *     suffisamment habillée pour cette occasion. »
 *
 * La règle éditoriale de Capsela interdit de dire que le vestiaire est
 * insuffisant. La distinction à tenir n'est pas de supprimer l'information du
 * manque — elle est vraie et utile ici, puisqu'AUCUNE tenue n'existe — mais de
 * la formuler comme une indisponibilité : « une solution n'est pas
 * disponible », jamais « tu n'as pas assez de vêtements ».
 *
 * Ce module ne contient que de la PRÉSENTATION. Les conditions de
 * déclenchement des trois états sont inchangées : `OutfitFailureReason` est
 * calculé par `generateOutfitWithFallback` (logic.ts) et seulement mis en mots
 * ici, jamais recalculé ni réinterprété.
 */

export interface EmptyStateCopy {
  title: string;
  body: string;
  /** null = cet état n'offre pas d'action ; le composant n'affiche alors aucun bouton. */
  ctaLabel: string | null;
}

/**
 * @param sourceLabel Désignation du pool, telle que l'écran la calcule déjà
 *   (« ton dressing » quand l'utilisatrice a de vraies pièces, « cette
 *   capsule » sinon). Le brief de wording disait « ta capsule » dans les trois
 *   textes ; ce serait faux pour une utilisatrice qui a un dressing réel, et
 *   l'écran distingue déjà les deux cas. On réutilise sa variable existante
 *   plutôt que d'inventer une désignation ou une règle de plus.
 */
export function emptyStateCopy(reason: OutfitFailureReason, sourceLabel: string): EmptyStateCopy {
  switch (reason) {
    case "formality_gap":
      // Le moteur a établi cette raison en sondant la formalité 0 avec succès :
      // le seul obstacle est le plancher de formalité de CETTE occasion. « Pour
      // cette occasion » est donc exact ici.
      return {
        title: "Une tenue plus habillée n'est pas disponible",
        body: `Pour cette occasion, aucune tenue ne correspond au niveau de formalité demandé avec les pièces de ${sourceLabel}.`,
        ctaLabel: "Ajouter une pièce plus habillée →",
      };

    case "missing_required_category":
      // Deux écarts assumés avec le wording proposé, tous deux imposés par ce
      // que le moteur garantit réellement (logic.ts) :
      //
      //   hasStructuralOption = (hasAnyTop && hasAnyBottom) || hasAnyOnepiece
      //
      // 1. « une catégorie » serait trompeur. La raison se déclenche aussi
      //    quand le haut ET le bas manquent, et le moteur ne transporte pas
      //    laquelle. On s'en tient donc à « une pièce nécessaire », qui reste
      //    vrai dans tous les cas. Aucune logique n'a été ajoutée pour compter
      //    les catégories absentes.
      // 2. « Pour cette occasion » serait FAUX. hasStructuralOption est
      //    calculé sur le pool brut, sans aucun filtre d'occasion : changer
      //    d'occasion ne peut pas débloquer cet état. La phrase le dit, comme
      //    le faisait déjà le texte d'origine.
      return {
        title: "Une pièce nécessaire n'est pas disponible",
        body: `Une pièce nécessaire n'est pas disponible dans ${sourceLabel} pour composer une tenue, quelle que soit l'occasion.`,
        ctaLabel: "Ajouter des pièces →",
      };

    case "no_match":
      // Décrit l'état de la génération, jamais le vestiaire. Le titre ne
      // mentionne pas la source : il vaut donc pour les deux cas, là où le
      // texte d'origine dupliquait deux variantes.
      return {
        title: "Aucune tenue ne correspond à cette occasion",
        body: `On ne trouve pas encore de combinaison adaptée à cette occasion avec les pièces de ${sourceLabel}.`,
        ctaLabel: null,
      };
  }
}
