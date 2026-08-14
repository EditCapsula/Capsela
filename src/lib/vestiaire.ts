import { getSupabase, isSupabaseConfigured } from "./supabase";
import { detectAccessoireType, detectBijouType, detectSacType } from "./attributes";
import type { CatalogItem } from "./catalog";
import type { CategoryKey, Coupe, IntensiteCouleur, Matiere, Season, ShoeType, Tons } from "./types";

/**
 * Lecture de la table vestiaire_universel (Supabase) — source des 4 capsules
 * saisonnières (specs du 12/08/2026). Ids décalés de VESTIAIRE_ID_OFFSET
 * pour ne jamais entrer en collision avec le catalogue statique de secours
 * (ids 1001+, cf. catalog.ts) ni avec les pièces réelles (ids Date.now()).
 *
 * ⚠️ Le format exact de plusieurs colonnes (styles, morphologies, category)
 * n'a pas pu être confirmé sur des données réelles — cette lecture applique
 * une interprétation raisonnable, documentée ci-dessous, à corriger une fois
 * le format réel connu :
 * - `category` : essaie d'abord une valeur déjà au format interne (haut,
 *   pull...), sinon la taxonomie du brief (hauts, pulls_gilets...).
 * - `styles` / `morphologies` : liste libre séparée par virgule, point-virgule
 *   ou barre verticale.
 * - `niveau_formalite` / `role_piece` / `genre` / `matiere` / `tons` /
 *   `intensite` : valeurs des contraintes CHECK posées dans les migrations
 *   0003 et 0005.
 * - `tons` (chauds/froids/les_deux) et `intensite` (douce/intense/lumineuse/
 *   melange) alimentent le rapprochement avec la palette personnelle du
 *   profil (affinité/intensité, recette 12/08/2026) dans la capsule par
 *   défaut — cf. paletteFit dans capsule.ts. Une valeur absente est déduite
 *   du hex (cf. tonsOf/intensiteOf dans attributes.ts), jamais bloquant.
 * - `meteo_min_temp`/`meteo_max_temp`, `resiste_pluie` : pas encore exploités
 *   (aucun signal météo temps réel côté app actuellement) — lus mais ignorés
 *   pour l'instant.
 */
export const VESTIAIRE_ID_OFFSET = 100000;

interface VestiaireRow {
  id: number;
  category: string | null;
  url_image: string | null;
  styles: string | null;
  morphologies: string | null;
  meteo_min_temp: number | null;
  meteo_max_temp: number | null;
  resiste_pluie: boolean | null;
  saison_capsule: string | null;
  est_basique_capsule: boolean | null;
  name: string | null;
  sous_type: string | null;
  niveau_formalite: string | null;
  role_piece: string | null;
  couleur_dominante: string | null;
  hex: string | null;
  genre: string | null;
  matiere: string | null;
  tons: string | null;
  intensite: string | null;
}

const CATEGORY_MAP: Record<string, CategoryKey> = {
  // Taxonomie du brief (hauts, pulls_gilets...)
  hauts: "haut",
  pulls_gilets: "pull",
  pantalons: "pantalon",
  jeans: "jean",
  jupes: "jupe",
  shorts: "short",
  robes: "robe",
  combinaisons: "combinaison",
  vestes_blazers: "veste",
  manteaux_exterieurs: "manteau",
  chaussures: "chaussures",
  sacs: "sac",
  bijoux: "bijou",
  accessoires: "accessoire",
  // Valeurs déjà au format interne (au cas où)
  haut: "haut",
  pull: "pull",
  pantalon: "pantalon",
  jean: "jean",
  jupe: "jupe",
  short: "short",
  robe: "robe",
  combinaison: "combinaison",
  veste: "veste",
  manteau: "manteau",
  sac: "sac",
  bijou: "bijou",
  accessoire: "accessoire",
};

function mapCategory(raw: string | null): CategoryKey | null {
  if (!raw) return null;
  return CATEGORY_MAP[raw.trim().toLowerCase()] ?? null;
}

const FORMALITE_MAP: Record<string, number> = {
  sport: 0,
  decontracte: 1,
  "décontracté": 1,
  business_casual: 3,
  "business casual": 3,
  habille: 4,
  "habillé": 4,
};

function mapFormalite(raw: string | null): number | undefined {
  if (!raw) return undefined;
  return FORMALITE_MAP[raw.trim().toLowerCase()];
}

function mapRolePiece(raw: string | null): "base" | "calque" | "piece_unique" | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "base" || v === "calque" || v === "piece_unique") return v;
  return undefined;
}

function mapGenre(raw: string | null): "femme" | "unisexe" {
  return (raw || "").trim().toLowerCase() === "femme" ? "femme" : "unisexe";
}

const MATIERES: Matiere[] = ["Coton", "Lin", "Laine", "Soie", "Cuir", "Denim", "Synthétique"];
function mapMatiere(raw: string | null): Matiere | undefined {
  return MATIERES.find((m) => m.toLowerCase() === (raw || "").trim().toLowerCase());
}

function mapTons(raw: string | null): Tons | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "chauds" || v === "froids" || v === "les_deux") return v;
  return undefined;
}

function mapIntensite(raw: string | null): IntensiteCouleur | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "douce" || v === "intense" || v === "lumineuse" || v === "melange") return v;
  return undefined;
}

function mapSaisonToSeason(raw: string | null): Season {
  const v = (raw || "").trim().toLowerCase();
  if (v === "printemps" || v === "été" || v === "ete") return "Printemps / Été";
  if (v === "automne" || v === "hiver") return "Automne / Hiver";
  return "Toutes saisons";
}

function splitTags(raw: string | null): string[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SHOE_TYPE_MAP: Record<string, ShoeType> = {
  baskets: "Baskets",
  bottines: "Bottines",
  bottes: "Bottes",
  escarpins: "Escarpins",
  sandales: "Sandales",
  mocassins: "Mocassins",
  ballerines: "Ballerines",
  "chaussures d'intérieur": "Chaussures d'intérieur",
};

function rowToCatalogItem(row: VestiaireRow): CatalogItem | null {
  const cat = mapCategory(row.category);
  if (!cat) return null;
  const name = (row.name || "").trim();
  if (!name) return null;
  const hex = row.hex || "#DCCFBC";
  const color = row.couleur_dominante || "";
  const coupe: Coupe | undefined = undefined; // pas de colonne coupe dédiée pour l'instant, dérivée du nom si besoin

  return {
    id: VESTIAIRE_ID_OFFSET + row.id,
    name,
    cat,
    color,
    hex,
    season: mapSaisonToSeason(row.saison_capsule),
    worn: null,
    shoeType: cat === "chaussures" ? SHOE_TYPE_MAP[(row.sous_type || "").trim().toLowerCase()] : undefined,
    matiere: mapMatiere(row.matiere),
    coupe,
    sacType: cat === "sac" ? detectSacType(name) || undefined : undefined,
    bijouType: cat === "bijou" ? detectBijouType(name) || undefined : undefined,
    accessoireType: cat === "accessoire" ? detectAccessoireType(name) || undefined : undefined,
    subtype: row.sous_type || undefined,
    niveauFormalite: mapFormalite(row.niveau_formalite),
    rolePiece: mapRolePiece(row.role_piece),
    styleTags: splitTags(row.styles),
    morphologyTags: splitTags(row.morphologies),
    estBasiqueCapsule: row.est_basique_capsule ?? undefined,
    genre: mapGenre(row.genre),
    tonsCouleur: mapTons(row.tons),
    intensiteCouleur: mapIntensite(row.intensite),
  };
}

/**
 * Récupère le vestiaire universel depuis Supabase. Retourne un tableau vide
 * en mode démo, si la requête échoue (table/colonnes absentes, migration pas
 * encore jouée) ou si aucune ligne n'est exploitable — l'appelant doit alors
 * se replier sur le catalogue statique (cf. computeDefaultCapsule).
 */
export async function fetchVestiaireUniversel(): Promise<CatalogItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabase().from("vestiaire_universel").select("*");
    if (error || !data) return [];
    return (data as VestiaireRow[])
      .map(rowToCatalogItem)
      .filter((it): it is CatalogItem => it !== null);
  } catch {
    return [];
  }
}
