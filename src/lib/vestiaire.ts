import { getSupabase, isSupabaseConfigured } from "./supabase";
import { detectAccessoireType, detectBijouType, detectMatiere, detectSacType } from "./attributes";
import type { CatalogItem } from "./catalog";
import { FALLBACK_HEX } from "./data";
import type { CategoryKey, Coupe, ImageSource, ImageStatus, IntensiteCouleur, Matiere, OccasionKey, Season, ShoeType, Tons } from "./types";

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
 * - `niveau_formalite` / `role_piece` / `genre` / `tons` / `intensite` /
 *   `coupe` / `metal_dominant` / `role_couleur_palette` : valeurs des
 *   contraintes CHECK posées dans les migrations 0003, 0005 et 0006.
 * - `matiere` : lecture souple — les données réelles utilisent des
 *   descriptions plus riches qu'un enum strict (ex. "Maille fine", "lin,
 *   jean" pour un tissu qui existe dans les deux) ; valeur exacte connue en
 *   priorité, sinon même détection par mots-clés que la saisie manuelle
 *   (detectMatiere), jamais bloquant. Colonne sans contrainte CHECK depuis
 *   la migration 0006.
 * - `saison_capsule` : liste libre séparée par virgule (ex. "Automne,
 *   Hiver, Printemps") — mappée sur le bucket météo (Printemps/Été vs
 *   Automne/Hiver) s'il n'y a qu'un seul des deux couvert, sinon "Toutes
 *   saisons" (y compris si les deux buckets sont couverts à la fois).
 * - `tons` (chauds/froids/les_deux) et `intensite` (douce/intense/lumineuse/
 *   melange) alimentent le rapprochement avec la palette personnelle du
 *   profil (affinité/intensité, recette 12/08/2026) dans la capsule par
 *   défaut — cf. paletteFit dans capsule.ts. Une valeur absente est déduite
 *   du hex (cf. tonsOf/intensiteOf dans attributes.ts), jamais bloquant.
 * - `lien_affiliation` : mappé sur Item.affLink, active le bouton "Acheter"
 *   sur l'écran Capsule quand présent.
 * - `role_couleur_palette` (base/neutre/accent) : lu et stocké
 *   (Item.paletteRole) mais pas encore consommé par le moteur de sélection
 *   de capsule — en attente de décision sur son usage exact.
 * - `necessite_soleil` (boolean) : mappé sur Item.necessiteSoleil — R-B15
 *   exclut la pièce des tenues générées tant que la météo du jour n'est pas
 *   ensoleillée (label contenant "soleil").
 * - `meteo_min_temp`/`meteo_max_temp` : mappés sur Item.meteoMinTemp/
 *   meteoMaxTemp — exclut la pièce des tenues générées si la température du
 *   jour est hors de cette plage (toutes catégories, contrairement à R-B3
 *   qui ne concerne que le vêtement). Absent = jamais filtré sur ce critère.
 * - `resiste_pluie` (boolean) : mappé sur Item.resistePluie — R-B16 (recette
 *   20/08/2026), préférence molle jamais exclusive pour une veste/un manteau
 *   qui y résiste quand la météo du jour est pluvieuse (label contenant
 *   "pluie" ou "orage").
 * - `occasions` (recette 20/08/2026) : liste libre séparée par virgule,
 *   point-virgule ou barre verticale, valeurs attendues parmi les slugs
 *   internes d'OccasionKey (quotidien, travail_formel, entretien, date,
 *   soiree, festive, sport, cocooning, voyage, evenement_perso — jamais
 *   "all"). Mappée sur Item.occasion, lu par declaredOccasionOk (logic.ts) :
 *   filtre DUR dès qu'au moins une valeur est reconnue — l'article ne peut
 *   plus apparaître pour une occasion absente de cette liste, quelle que
 *   soit sa formalité/saison par ailleurs. Vide/non reconnu = aucune
 *   restriction (comportement historique, inchangé).
 * - `couleur_secondaire` : pas encore exploité côté app — lu mais ignoré.
 * - `url_image` : mappé sur Item.imageUrl — photo produit du catalogue
 *   (posée manuellement ou générée automatiquement, cf. image_source),
 *   jamais pour une pièce du dressing réel. `image_status`/`image_source`/
 *   `image_prompt`/`image_generated_at`/`image_version` pilotent son cycle
 *   de vie (recette 18/08/2026, gestion automatique des images produit) ;
 *   `affiliate_image_url` (vraie photo produit affilié) prime dessus.
 */
export const VESTIAIRE_ID_OFFSET = 100000;

/** true si l'id correspond à une ligne réelle de vestiaire_universel (pas au catalogue statique de secours, ids 1001+ sans ligne en base). */
export function isVestiaireId(id: number): boolean {
  return id >= VESTIAIRE_ID_OFFSET;
}

export interface VestiaireRow {
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
  statement: boolean | null;
  role_couleur_palette: string | null;
  coupe: string | null;
  couleur_secondaire: string | null;
  metal_dominant: string | null;
  lien_affiliation: string | null;
  necessite_soleil: boolean | null;
  image_source: string | null;
  image_prompt: string | null;
  image_status: string | null;
  image_generated_at: string | null;
  image_version: number | null;
  affiliate_image_url: string | null;
  niveau_tendance: string | null;
  silhouette_mode: string | null;
  details_mode: string | null;
  prompt_image_override: string | null;
  occasions: string | null;
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

function mapGenre(raw: string | null): "femme" | "homme" | "unisexe" {
  const v = (raw || "").trim().toLowerCase();
  if (v === "femme") return "femme";
  if (v === "homme") return "homme";
  return "unisexe";
}

const MATIERES: Matiere[] = ["Coton", "Lin", "Laine", "Soie", "Cuir", "Denim", "Synthétique"];
function mapMatiere(raw: string | null): Matiere | undefined {
  if (!raw) return undefined;
  const exact = MATIERES.find((m) => m.toLowerCase() === raw.trim().toLowerCase());
  if (exact) return exact;
  return detectMatiere(raw) || undefined;
}

function mapCoupe(raw: string | null): Coupe | undefined {
  const v = (raw || "").trim();
  if (v === "Serré" || v === "Ajusté" || v === "Ample") return v;
  return undefined;
}

function mapStatement(raw: boolean | null): boolean | undefined {
  return raw ?? undefined;
}

function mapMetalDominant(raw: string | null): "or" | "argent" | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "or" || v === "argent") return v;
  return undefined;
}

function mapPaletteRole(raw: string | null): "base" | "neutre" | "accent" | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "base" || v === "neutre" || v === "accent") return v;
  return undefined;
}

function mapNecessiteSoleil(raw: boolean | null): boolean | undefined {
  return raw ?? undefined;
}

function mapImageSource(raw: string | null): ImageSource | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "generated" || v === "manual" || v === "affiliate" || v === "user") return v;
  return undefined;
}

function mapImageStatus(raw: string | null): ImageStatus {
  const v = (raw || "").trim().toLowerCase();
  if (v === "generating" || v === "ready" || v === "error" || v === "invalid") return v;
  return "missing";
}

function mapNiveauTendance(raw: string | null): "intemporel" | "contemporain" | "tendance" | undefined {
  const v = (raw || "").trim().toLowerCase();
  if (v === "intemporel" || v === "contemporain" || v === "tendance") return v;
  return undefined;
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
  if (!raw) return "Toutes saisons";
  const tokens = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hasPrintempsEte = tokens.some((t) => t === "printemps" || t === "été" || t === "ete");
  const hasAutomneHiver = tokens.some((t) => t === "automne" || t === "hiver");
  if (hasPrintempsEte && hasAutomneHiver) return "Toutes saisons";
  if (hasPrintempsEte) return "Printemps / Été";
  if (hasAutomneHiver) return "Automne / Hiver";
  return "Toutes saisons";
}

const VALID_OCCASIONS = new Set<OccasionKey>([
  "quotidien",
  "travail_formel",
  "entretien",
  "date",
  "soiree",
  "festive",
  "sport",
  "cocooning",
  "voyage",
  "evenement_perso",
]);

/** Filtre discret, jamais bloquant : un token qui ne correspond à aucune occasion connue est simplement ignoré (recette 20/08/2026). */
function mapOccasions(raw: string | null): OccasionKey[] | undefined {
  const tokens = splitTags(raw);
  if (!tokens) return undefined;
  const valid = tokens.map((t) => t.trim().toLowerCase()).filter((t): t is OccasionKey => VALID_OCCASIONS.has(t as OccasionKey));
  return valid.length ? valid : undefined;
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
  "sandales à talons": "Sandales à talons",
  espadrilles: "Espadrilles",
  mocassins: "Mocassins",
  ballerines: "Ballerines",
  "chaussures d'intérieur": "Chaussures d'intérieur",
};

export function rowToCatalogItem(row: VestiaireRow): CatalogItem | null {
  const cat = mapCategory(row.category);
  if (!cat) return null;
  const name = (row.name || "").trim();
  if (!name) return null;
  const hex = row.hex || FALLBACK_HEX;
  const color = row.couleur_dominante || "";

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
    coupe: mapCoupe(row.coupe),
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
    statement: mapStatement(row.statement),
    metalDominant: mapMetalDominant(row.metal_dominant),
    paletteRole: mapPaletteRole(row.role_couleur_palette),
    affLink: row.lien_affiliation || undefined,
    necessiteSoleil: mapNecessiteSoleil(row.necessite_soleil),
    resistePluie: row.resiste_pluie ?? undefined,
    occasion: mapOccasions(row.occasions),
    meteoMinTemp: row.meteo_min_temp ?? undefined,
    meteoMaxTemp: row.meteo_max_temp ?? undefined,
    imageUrl: row.url_image || undefined,
    // Le status stocké fait foi (recette 18/08/2026 — correctif) : une image
    // invalidée (image_status='invalid'/'error') ne doit jamais rester
    // affichée simplement parce que url_image n'a pas été vidé côté base.
    // Seul repli : une ligne avec url_image mais sans image_status renseigné
    // (posée manuellement avant ce système) compte comme "ready".
    imageStatus: row.image_status ? mapImageStatus(row.image_status) : row.url_image ? "ready" : "missing",
    imageSource: mapImageSource(row.image_source),
    imagePrompt: row.image_prompt || undefined,
    imageGeneratedAt: row.image_generated_at || undefined,
    imageVersion: row.image_version ?? undefined,
    affiliateImageUrl: row.affiliate_image_url || undefined,
    niveauTendance: mapNiveauTendance(row.niveau_tendance),
    silhouetteMode: row.silhouette_mode || undefined,
    detailsMode: row.details_mode || undefined,
    promptImageOverride: row.prompt_image_override || undefined,
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
