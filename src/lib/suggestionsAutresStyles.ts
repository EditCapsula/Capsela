import { estDeSaison } from "./capsule";
import { STYLE_ID_TO_CATALOG_LABEL, styleLabel, type Gender, type StyleId } from "./profile";
import type { Weather } from "./data";
import type { CategoryKey, Item } from "./types";

/*
 * PIÈCES D'AUTRES STYLES POUR COMPLÉTER UNE TENUE (14/10/2026, demandé : « dans la strate de suggestion, suggérer des pièces d'autres
 * styles en respectant le genre de l'utilisateur »).
 *
 * La capsule ne tire que dans les styles du profil ; quand elle n'a pas de paire qui va, la rangée « Compléter la tenue » restait
 * courte ou vide. Ces fonctions ouvrent le reste du catalogue (vestiaire_universel, déjà chargé : aucune requête), sans rien relâcher
 * de ce qui protège l'utilisatrice : jamais une pièce de l'autre genre (sans le repli « ≥ 16 pièces » de la capsule — ici, rien ne
 * risque de se vider), jamais une pièce écartée (« Je ne suis pas intéressée »), jamais hors saison. Les règles de la tenue
 * (occasion, formalité, météo, accord) s'appliquent ensuite, par candidatsDeRemplacement, comme pour les autres suggestions.
 */

/** Les pièces du catalogue que la capsule ne propose pas, de la catégorie voulue, du genre de l'utilisatrice et de saison. */
export function piecesDAutresStyles(
  catalogue: readonly Item[],
  cat: CategoryKey,
  args: { gender: Gender | null; dejaProposees: ReadonlySet<number>; exclues: readonly number[]; meteo: Weather },
): Item[] {
  const genreOppose = args.gender === "homme" ? "femme" : args.gender === "femme" ? "homme" : null;
  return catalogue.filter(
    (it) =>
      it.cat === cat &&
      !args.dejaProposees.has(it.id) &&
      !args.exclues.includes(it.id) &&
      (genreOppose == null || (it as Item & { genre?: string }).genre !== genreOppose) &&
      estDeSaison(it, args.meteo),
  );
}

const STYLE_DU_LIBELLE = Object.fromEntries(Object.entries(STYLE_ID_TO_CATALOG_LABEL).map(([id, libelle]) => [libelle, id])) as Record<string, StyleId>;

/**
 * Le style à nommer sur la vignette : le premier style déclaré de la pièce qui n'est pas celui du profil, avec le libellé du genre
 * de l'utilisatrice (« Créatif » côté homme pour romantique…). Aucun style déclaré lisible : « Autre style » — jamais deviné.
 */
export function styleAffiche(it: Pick<Item, "styleTags">, stylesDuProfil: readonly string[], gender: Gender | null): string {
  const id = (it.styleTags ?? []).map((t) => STYLE_DU_LIBELLE[t]).find((s) => s && !stylesDuProfil.includes(s));
  return (id && styleLabel(id, gender)) || "Autre style";
}
