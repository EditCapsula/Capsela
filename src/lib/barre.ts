/*
 * LE « / » NE S'AFFICHE PAS (18/10/2026, demandé : « pour les occasions mets un point médian au lieu de / », puis les choix d'occasion et
 * les noms de pièces). Une seule règle, lue partout : une barre ENTRE DEUX APPELLATIONS — entourée d'espaces (« Babies / Mary Jane »)
 * ou collée entre deux lettres (« Panier/Sac ») — devient un point médian. Jamais entre deux chiffres : « 50/50 » est une composition,
 * pas deux noms. Seulement à l'affichage et à la lecture des noms : les valeurs enregistrées (DateContext, `sous_choix`) ne changent pas.
 */
const BARRE = /\s+\/\s+|(?<=[^\d\s])\/(?=[^\d\s])/g;

/** « Restaurant / date romantique » → « Restaurant · date romantique ». */
export function sansBarre(valeur: string): string {
  return valeur.replace(BARRE, " · ");
}

/** La première appellation d'un nom à deux appellations (« Babies · Mary Jane », « Babies / Mary Jane » → « Babies »). */
export function premiereAppellation(nom: string): string {
  return sansBarre(nom).split(" · ")[0].trim();
}
