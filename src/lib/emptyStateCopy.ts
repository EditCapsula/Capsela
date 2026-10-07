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

/**
 * L'ÉTAT « SANS TENUE » DE PLANIFIER (07/10/2026) — trois états distincts, jamais « Ta tenue est prête » quand rien n'a été composé :
 *
 *   vide     le dressing n'a AUCUNE pièce et l'utilisatrice a choisi « uniquement mon dressing » : rien ne peut être composé
 *            tant qu'elle n'en ajoute pas. Sans ce choix, la capsule complète le pool : ce n'est pas un dressing vide qui
 *            bloque, on retombe sur la raison du moteur.
 *   manque   des pièces existent mais une pièce nécessaire manque (`missing_required_category`) ou le niveau d'habillé
 *            demandé n'est pas atteignable (`formality_gap`) : ajouter une pièce débloque.
 *   occasion `no_match` : les pièces existent et la structure est là, c'est la combinaison pour CETTE occasion qui manque.
 *            Ajouter une pièce n'est pas la réponse annoncée par le moteur : on garde son texte, sans action d'ajout.
 *
 * La raison reste celle de `generateOutfitWithFallback`, seulement mise en mots (cf. plus haut).
 */
export type EtatSansTenue = "vide" | "manque" | "occasion";

export interface SansTenueCopy {
  etat: EtatSansTenue;
  /** Les deux temps du titre d'écran (le second en italique terracotta). */
  titreA: string;
  titreB: string;
  titre: string;
  body: string;
  /** Phrase d'appel, seulement pour le dressing vide. */
  suite: string | null;
  /** « Ajouter des pièces » est proposé. */
  peutAjouter: boolean;
}

export function sansTenueCopy(nbPiecesDressing: number, dressingSeul: boolean, reason: OutfitFailureReason | undefined, sourceLabel: string): SansTenueCopy {
  if (nbPiecesDressing === 0 && dressingSeul) {
    return {
      etat: "vide",
      titreA: "Ton dressing est",
      titreB: "encore vide",
      titre: "Commençons par ton dressing",
      body: "Ajoute quelques pièces pour que Capsela puisse composer une tenue à partir de ce que tu possèdes.",
      suite: "Plus ton dressing s’enrichit, plus Capsela pourra créer des tenues qui te ressemblent.",
      peutAjouter: true,
    };
  }
  if (reason === "missing_required_category" || reason === "formality_gap") {
    return {
      etat: "manque",
      titreA: "Il manque",
      titreB: "quelques pièces",
      titre: "Il manque quelques pièces",
      body: "Capsela n’a pas trouvé dans ton dressing tout ce qu’il faut pour composer cette tenue.",
      suite: null,
      peutAjouter: true,
    };
  }
  const c = emptyStateCopy(reason ?? "no_match", sourceLabel);
  return { etat: "occasion", titreA: "Pas encore de", titreB: "tenue", titre: c.title, body: c.body, suite: null, peutAjouter: false };
}
