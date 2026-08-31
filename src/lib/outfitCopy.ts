/**
 * SUGGESTION DE COMPLÉMENT — mise en mots des catégories que le moteur signale
 * comme absentes de la tenue affichée (`outfitMissingCats`).
 *
 * Corrigé le 31/08/2026. Le texte précédent était :
 *
 *   « Il te manque un haut et des chaussures pour compléter cette tenue. »
 *
 * « Il te manque », à la deuxième personne, attribue le manque à
 * l'utilisatrice — la tournure même que le chantier des états vides vient de
 * retirer partout ailleurs. Elle s'affiche de surcroît sur une tenue COMPLÈTE
 * ET VALIDE : la carte est une suggestion d'enrichissement, jamais un
 * diagnostic d'échec.
 *
 * L'information est intégralement conservée — les mêmes catégories sont
 * nommées, dans le même ordre. Seule la personne grammaticale change : la
 * phrase décrit ce qu'un ajout apporterait, au lieu de constater ce que
 * l'utilisatrice n'a pas. C'est la voix déjà employée par R-S14
 * (« N'hésite pas à compléter cette tenue avec une veste... »).
 *
 * Extrait de TenuesScreen pour être testable hors rendu React — l'accord du
 * verbe dépend du nombre de catégories ET du fait que « des chaussures » est
 * déjà pluriel à lui seul, ce qu'aucun test statique ne saurait vérifier.
 */
export const MISSING_LABELS: Record<string, string> = {
  haut: "un haut",
  bas: "un bas",
  chaussures: "des chaussures",
  accessoire: "un accessoire",
  sac: "un sac",
  bijou: "un bijou",
  // R-B18 : une pièce de la tenue est sous son seuil de température et
  // aucun gilet/cardigan/veste compatible n'a été trouvé pour compenser.
  chaud: "une pièce plus chaude",
};

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function missingSuggestionText(missingCats: string[]): string {
  // "moins_habille" n'est pas une catégorie manquante mais un repli de
  // formalité sur des pièces déjà présentes (cf. bannière dédiée
  // formalityDowngraded dans TenuesScreen) — jamais mélangé à cette phrase,
  // qui suppose une catégorie vide.
  const words = Array.from(
    new Set(missingCats.filter((k) => k !== "moins_habille").map((k) => MISSING_LABELS[k]).filter(Boolean))
  );
  if (words.length === 0) return "";

  // Accord du verbe : plusieurs catégories, ou une seule déjà pluriel
  // (« des chaussures » est le seul libellé dans ce cas aujourd'hui, mais la
  // règle est écrite sur la forme, pas sur la valeur).
  const pluriel = words.length > 1 || words[0].startsWith("des ");
  const verbe = pluriel ? "compléteraient" : "compléterait";

  if (words.length === 1) return `${majuscule(words[0])} ${verbe} cette tenue.`;
  const last = words[words.length - 1];
  const head = words.slice(0, -1).join(", ");
  return `${majuscule(head)} et ${last} ${verbe} cette tenue.`;
}
