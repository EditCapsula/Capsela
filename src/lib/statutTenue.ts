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
  /**
   * Les pièces de structure qui manquent (haut, bas, chaussures — `piecesStructurellesManquantes`), pour le ratio « 4/5 pièces »
   * (14/10/2026). 0 ou absent : pas de ratio, « À compléter » seul (une veste sans rien dessous, un manque de chaleur).
   */
  piecesManquantes?: number;
  /** Structure minimale du moteur, sans manque signalé ni veste sans dessous. */
  complete: boolean;
  /** Suggestions du moteur actives (non ignorées) qui proposent une pièce précise. */
  ajoutsConseilles: number;
  /** Une pièce suggérée vient d'être ajoutée. */
  vientDEtreCompletee?: boolean;
}): StatutTenue {
  const { nbPieces, complete, ajoutsConseilles } = args;
  const pieces = `${nbPieces} ${nbPieces > 1 ? "pièces" : "pièce"}`;
  if (!complete) {
    const manquantes = args.piecesManquantes ?? 0;
    return { cle: "a_completer", libelle: manquantes > 0 ? `À compléter · ${nbPieces}/${nbPieces + manquantes} pièces` : "À compléter" };
  }
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

/** Les manques que la tenue peut combler par une pièce : la structure minimale du moteur (cf. categoriesManquantes, logic.ts). */
const STRUCTURE = ["haut", "bas", "chaussures"] as const;
export type ManqueStructurel = (typeof STRUCTURE)[number];

/**
 * CE QUI MANQUE ENCORE (14/10/2026). Les manques signalés par le tirage (`outfitMissingCats`) ne sont pas relus après un ajout : une
 * tenue complétée à la main (chaussures choisies dans « Compléter la tenue ») restait « À compléter ». Un manque de structure (haut,
 * bas, chaussures) ne vaut que s'il manque toujours aux pièces affichées (`encoreManquantes`, la règle d'isCompleteOutfit) ; les autres
 * (« chaud ») restent ceux du tirage, inchangés. Sans signalement du tirage : les manques de structure des pièces affichées.
 */
export function manquesActuels(signales: readonly string[] | null | undefined, encoreManquantes: readonly ManqueStructurel[], nbPieces: number): string[] {
  if (signales?.length) return signales.filter((k) => !(STRUCTURE as readonly string[]).includes(k) || encoreManquantes.includes(k as ManqueStructurel));
  return nbPieces > 0 ? [...encoreManquantes] : [];
}

/** Le nombre de pièces de structure qui manquent — le dénominateur du ratio n'est jamais calculé autrement. */
export function piecesStructurellesManquantes(manques: readonly string[]): number {
  return manques.filter((k) => (STRUCTURE as readonly string[]).includes(k)).length;
}
