/*
 * OÙ EN EST LA TENUE DU JOUR (27/09/2026, parcours « Compléter la tenue »).
 *
 * Aucune règle de complétude nouvelle : trois états lus sur ce que le moteur
 * sait déjà.
 *   · « À compléter » — la tenue ne remplit pas la structure minimale du
 *     moteur (isCompleteOutfit : haut + bas ou robe, et des chaussures), le
 *     moteur a signalé une catégorie manquante (outfitMissingCats), ou une
 *     veste est portée sans rien dessous (R-B9).
 *   · « N ajouts conseillés » — la tenue est complète, mais une suggestion
 *     du moteur (computeLookScore.proactives) propose une pièce précise :
 *     la veste d'une soirée fraîche (R-S14), une touche de couleur (R-S13).
 *     Une suggestion, pas un manque : « Porter cette tenue » reste l'action
 *     principale.
 *   · « Tenue complète » — rien ne manque et rien n'est conseillé ; juste
 *     après un ajout, « Tenue complétée ».
 * Deux pièces ne font donc jamais à elles seules une tenue « à compléter ».
 */

export type CleStatutTenue = "a_completer" | "ajout_conseille" | "complete";

export interface StatutTenue {
  cle: CleStatutTenue;
  libelle: string;
}

export function statutTenue(args: {
  nbPieces: number;
  /** Structure minimale du moteur, sans manque signalé ni veste sans dessous. */
  complete: boolean;
  /** Suggestions du moteur actives (non ignorées) qui proposent une pièce précise. */
  ajoutsConseilles: number;
  /** Une pièce suggérée vient d'être ajoutée. */
  vientDEtreCompletee?: boolean;
}): StatutTenue {
  const { nbPieces, complete, ajoutsConseilles } = args;
  const pieces = `${nbPieces} ${nbPieces > 1 ? "pièces" : "pièce"}`;
  if (!complete) return { cle: "a_completer", libelle: "À compléter" };
  if (ajoutsConseilles > 0)
    return { cle: "ajout_conseille", libelle: `${pieces} · ${ajoutsConseilles} ${ajoutsConseilles > 1 ? "ajouts conseillés" : "ajout conseillé"}` };
  return { cle: "complete", libelle: `${args.vientDEtreCompletee ? "Tenue complétée" : "Tenue complète"} · ${pieces}` };
}

/**
 * Le surtitre d'une suggestion du moteur, par sa clé : il dit POURQUOI avant
 * le texte du moteur, qui dit quoi. Clé inconnue : « Conseil Capsela ».
 */
export function surtitreSuggestion(cle: string): string {
  if (cle === "veste_soir") return "À prévoir";
  if (cle === "color") return "Une touche de couleur";
  if (cle === "layer") return "Pour compléter";
  return "Conseil Capsela";
}
