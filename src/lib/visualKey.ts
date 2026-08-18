import type { CatalogItem } from "./catalog";

/** Slug ASCII simple (minuscules, sans accents, mots séparés par _) — pour composer une clé stable et lisible. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Clé visuelle d'une pièce du catalogue — deux articles avec la même clé
 * peuvent réutiliser exactement le même visuel (recette 18/08/2026, gestion
 * automatique des images produit). Composée de genre_category_sousType_
 * couleurDominante_matiere, ex. "femme_chaussures_ballerines_beige_cuir".
 *
 * `color` porte déjà la couleur dominante pour les pièces issues de
 * vestiaire_universel (colonne couleur_dominante, généralement un mot déjà
 * générique comme "beige") ; pour le catalogue statique de secours (noms
 * plus précis, ex. "Rose poudré"), la clé reste simplement un peu plus
 * fine — sans conséquence, ce fallback n'a pas vocation à être illustré par
 * des visuels générés en production.
 */
export function computeVisualKey(item: CatalogItem): string {
  const parts = [
    item.genre,
    item.cat,
    item.subtype || item.shoeType || item.sacType || item.bijouType || item.accessoireType || "",
    item.color,
    item.matiere || "",
  ];
  return parts.map(slug).filter(Boolean).join("_");
}

/** Deux pièces peuvent partager le même visuel — évite de générer une image en double pour des articles visuellement équivalents. */
export function sameVisualKey(a: CatalogItem, b: CatalogItem): boolean {
  return computeVisualKey(a) === computeVisualKey(b);
}

/**
 * Cherche dans le pool une pièce déjà pourvue d'une image prête partageant
 * la même clé visuelle — permet de réutiliser ce visuel plutôt que d'en
 * générer un nouveau pour un article strictement équivalent.
 */
export function findReusableImage(item: CatalogItem, pool: CatalogItem[]): string | undefined {
  const key = computeVisualKey(item);
  const match = pool.find(
    (it) => it.id !== item.id && it.imageStatus === "ready" && it.imageUrl && computeVisualKey(it) === key
  );
  return match?.imageUrl;
}
