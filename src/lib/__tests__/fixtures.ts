import { rowToCatalogItem, type VestiaireRow } from "../vestiaire";
import type { CatalogItem } from "../catalog";
import type { Weather } from "../data";

/**
 * Fabrique de lignes vestiaire_universel pour les tests — tous les champs
 * de VestiaireRow à null par défaut, seuls ceux qui comptent pour le cas
 * testé sont renseignés. Volontairement synthétique : aucun test du moteur
 * ne doit dépendre du contenu réel de la base, qui évolue à chaque capsule.
 */
export function row(over: Partial<VestiaireRow> & Pick<VestiaireRow, "id" | "category" | "name">): VestiaireRow {
  return {
    url_image: null,
    styles: null,
    morphologies: null,
    meteo_min_temp: null,
    meteo_max_temp: null,
    resiste_pluie: null,
    saison_capsule: "Toutes saisons",
    est_basique_capsule: null,
    sous_type: null,
    niveau_formalite: null,
    role_piece: null,
    couleur_dominante: "Noir",
    hex: "#2A2724",
    genre: "femme",
    matiere: null,
    tons: null,
    intensite: null,
    statement: null,
    role_couleur_palette: null,
    coupe: null,
    couleur_secondaire: null,
    metal_dominant: null,
    lien_affiliation: null,
    necessite_soleil: null,
    image_source: null,
    image_prompt: null,
    image_status: null,
    image_generated_at: null,
    image_version: null,
    affiliate_image_url: null,
    niveau_tendance: null,
    silhouette_mode: null,
    details_mode: null,
    prompt_image_override: null,
    occasions: null,
    ...over,
  };
}

/** Même fabrique, mappée en CatalogItem — jette si la ligne est invalide, ce qui signalerait un test mal écrit. */
export function item(over: Partial<VestiaireRow> & Pick<VestiaireRow, "id" | "category" | "name">): CatalogItem {
  const mapped = rowToCatalogItem(row(over));
  if (!mapped) throw new Error(`Ligne de test non mappable : ${over.name} (${over.category})`);
  return mapped;
}

export const COLD: Weather = { season: "Automne / Hiver", temp: 4, label: "Froid", seasons: ["Automne / Hiver", "Toutes saisons"] };
export const MILD: Weather = { season: "Printemps / Été", temp: 16, label: "Doux", seasons: ["Printemps / Été", "Toutes saisons"] };
export const HOT: Weather = { season: "Printemps / Été", temp: 26, label: "Chaud", seasons: ["Printemps / Été", "Toutes saisons"] };

/** Weather arbitraire — pour les cas où seule la température compte. */
export function at(temp: number, season: Weather["season"] = "Automne / Hiver"): Weather {
  return {
    season,
    temp,
    label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud",
    seasons: [season, "Toutes saisons"],
  };
}
