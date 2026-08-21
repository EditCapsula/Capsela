// Miroir Deno de src/lib/imagePrompt.ts — dupliqué volontairement : les
// Edge Functions Supabase tournent dans un runtime Deno séparé du bundle
// Next.js et ne peuvent pas importer directement depuis src/lib. Les deux
// fichiers doivent être tenus synchronisés si les dictionnaires évoluent.
//
// Correctif 18/08/2026 (mapping incorrect constaté : un pantalon affichait
// une veste/chemise) : le sujet de l'image ne doit JAMAIS être interprété
// depuis `name` en texte libre. Priorité stricte sous_type > category >
// name (name n'apparaît plus du tout dans le prompt). Composition et
// exclusions spécifiques par catégorie pour empêcher structurellement
// OpenAI de produire un autre type de vêtement, + validation de cohérence
// avant tout appel API (buildImagePrompt.ok).
//
// Évolution 19/08/2026 (image générées visuellement datées) : le "sujet"
// (noun/canonCategory, priorité sous_type > category, jamais name) reste
// l'ancrage structurel inchangé — ce qui change, c'est l'habillage
// stylistique du prompt, construit selon un ordre de priorité strict :
// prompt_image_override > silhouette_mode/details_mode de l'article >
// règle tendances_mode correspondante > caractéristiques standards
// (dictionnaires ci-dessous, comme avant). Une tendance ne peut jamais
// changer la nature du produit — seule la partie "design" du prompt en
// dépend, jamais canonCategory/noun/ok qui restent calculés uniquement
// depuis sous_type/category, indépendamment du niveau de tendance.

export interface VestiaireRow {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  matiere: string | null;
  genre: string | null;
  coupe: string | null;
  niveau_tendance?: string | null;
  silhouette_mode?: string | null;
  details_mode?: string | null;
  prompt_image_override?: string | null;
}

/** Une règle de tendances_mode déjà résolue par l'appelant (matching en base, cf. findTrendRule côté Edge Function — cette fonction reste pure/synchrone). */
export interface TrendRule {
  silhouette?: string | null;
  coupes?: string | null;
  matieres?: string | null;
  details?: string | null;
  elements_a_eviter?: string | null;
}

export const CATEGORY_CANON: Record<string, string> = {
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

/** Les 14 catégories officielles du catalogue, utilisées comme noms de dossier Storage (genre/{dossier}/...). */
export const CATEGORY_FOLDER: Record<string, string> = {
  haut: "hauts",
  pull: "pulls-gilets",
  pantalon: "pantalons",
  jean: "jeans",
  jupe: "jupes",
  short: "shorts",
  robe: "robes",
  combinaison: "combinaisons",
  veste: "vestes-blazers",
  manteau: "manteaux-exterieurs",
  chaussures: "chaussures",
  sac: "sacs",
  bijou: "bijoux",
  accessoire: "accessoires",
};

/** Nom du produit en anglais — utilisé UNIQUEMENT comme repli quand sous_type ne correspond à rien de connu (jamais depuis `name`). */
const CATEGORY_EN: Record<string, string> = {
  haut: "top",
  pull: "sweater",
  pantalon: "trousers",
  jean: "jeans",
  jupe: "skirt",
  short: "shorts",
  robe: "dress",
  combinaison: "jumpsuit",
  veste: "jacket",
  manteau: "coat",
  chaussures: "shoes",
  sac: "bag",
  bijou: "jewelry piece",
  accessoire: "accessory",
};

/** Sous-types reconnus comme nom complet du produit (correspondance exacte du sous_type entier). */
const SUBTYPE_EN: Record<string, string> = {
  // Chaussures
  baskets: "sneakers",
  "sneakers rétro": "low-top retro-style sneakers",
  "sneakers chunky": "chunky platform sneakers",
  "sneakers montantes": "high-top sneakers",
  bottines: "ankle boots",
  bottes: "boots",
  escarpins: "pumps",
  sandales: "sandals",
  "sandales à talons": "heeled sandals",
  espadrilles: "espadrille wedge sandals",
  mules: "backless mule shoes",
  "tropéziennes": "strappy flat sandals",
  mocassins: "loafers",
  ballerines: "ballet flats",
  "chaussures d'intérieur": "house slippers",
  // Sacs
  "sac à main": "handbag",
  cabas: "tote bag",
  bandoulière: "crossbody bag",
  pochette: "clutch bag",
  "sac à dos": "backpack",
  panier: "woven basket bag",
  // Robes
  "slip dress": "silk slip dress",
  // Bijoux
  collier: "necklace",
  "boucles d'oreilles": "earrings",
  bracelet: "bracelet",
  bague: "ring",
  bagues: "rings",
  montre: "watch",
  // Accessoires
  ceinture: "belt",
  foulard: "scarf",
  écharpe: "scarf",
  chapeau: "hat",
  casquette: "cap",
  lunettes: "sunglasses",
  collants: "tights",
  "chaussettes hautes": "knee-high socks",
  // Hauts / pulls
  "t-shirt": "t-shirt",
  chemise: "shirt",
  chemisier: "blouse",
  blouse: "blouse",
  débardeur: "tank top",
  top: "top",
  polo: "polo shirt",
  sweat: "sweatshirt",
  gilet: "cardigan",
  "gilet sans manches": "sleeveless vest",
  cardigan: "cardigan",
  // Vestes / manteaux
  blazer: "blazer",
  trench: "trench coat",
  parka: "parka",
  doudoune: "puffer jacket",
  caban: "pea coat",
  imperméable: "raincoat",
  perfecto: "leather jacket",
  // Bas
  legging: "leggings",
  jogging: "jogging pants",
  bermuda: "bermuda shorts",
  // Robes / combinaisons
  combishort: "playsuit",
  salopette: "dungarees",
};

/** Mots-clés de coupe/style repérés DANS sous_type (jamais dans name) — ajoutés comme modificateurs, ne changent jamais le type de produit. */
const MODIFIER_EN: Record<string, string> = {
  fluide: "flowy",
  fluides: "flowy",
  ample: "wide-leg",
  amples: "wide-leg",
  large: "loose",
  larges: "loose",
  droit: "straight-leg",
  droite: "straight",
  slim: "slim-fit",
  skinny: "skinny",
  moulant: "fitted",
  moulante: "fitted",
  oversize: "oversized",
  "plissé": "pleated",
  "plissée": "pleated",
  crayon: "pencil",
  midi: "midi-length",
  mini: "mini",
  long: "long",
  longue: "long",
  court: "short",
  courte: "short",
  "évasé": "flared",
  "évasée": "flared",
  cargo: "cargo-style",
  bootcut: "bootcut",
  flare: "flared",
  mom: "mom-fit",
  boyfriend: "boyfriend-fit",
  portefeuille: "wrap",
  "croisée": "wrap",
  tailleur: "tailored",
  pinces: "pleated-front",
  bretelles: "with thin straps",
  bustier: "strapless bustier",
  sport: "athletic",
  capuche: "hooded",
  "zippé": "zip-up",
  "zippée": "zip-up",
  plates: "flat",
  plate: "flat",
  plat: "flat",
  talons: "high-heeled",
  talon: "high-heeled",
  "compensées": "wedge",
  "compensée": "wedge",
  "compensés": "wedge",
  "compensé": "wedge",
  transparent: "sheer",
  transparente: "sheer",
  transparents: "sheer",
  transparentes: "sheer",
  "semi-opaque": "semi-opaque",
  "semi-opaques": "semi-opaque",
  opaque: "opaque",
  opaques: "opaque",
  // Motifs/imprimés (correctif 21/08/2026, signalé : blouse "imprimée
  // paisley" générée sans le motif, faute de vocabulaire reconnu).
  paisley: "paisley print",
  fleuri: "floral print",
  fleurie: "floral print",
  floral: "floral print",
  "rayé": "striped",
  "rayée": "striped",
};

/** Cols/encolures reconnus en bigramme (2 mots consécutifs) n'importe où dans sous_type. */
const NECKLINE_EN: Record<string, string> = {
  "col v": "v-neck",
  "col rond": "crew neck",
  "col roulé": "turtleneck",
  "col bateau": "boat neck",
  "col claudine": "peter pan collar",
  "col chemise": "collared",
  "col cheminée": "funnel neck",
  "robe chemise": "shirt-style",
  "sans manches": "sleeveless",
  "manches courtes": "short-sleeved",
  "manches longues": "long-sleeved",
  "dos nu": "backless",
};

const COLOR_EN: Record<string, string> = {
  blanc: "white",
  "blanc cassé": "off-white",
  crème: "cream",
  ivoire: "ivory",
  sable: "sand beige",
  beige: "beige",
  "beige rosé": "dusty pink beige",
  camel: "camel",
  caramel: "caramel",
  terracotta: "terracotta",
  rouille: "rust",
  brique: "brick red",
  chocolat: "chocolate brown",
  marron: "brown",
  moutarde: "mustard yellow",
  kaki: "khaki",
  "vert sauge": "sage green",
  "vert bouteille": "bottle green",
  vert: "green",
  taupe: "taupe",
  "rose poudré": "dusty pink",
  rose: "pink",
  corail: "coral",
  "gris clair": "light grey",
  gris: "grey",
  "gris anthracite": "charcoal grey",
  "bleu ciel": "sky blue",
  denim: "denim blue",
  bleu: "blue",
  marine: "navy blue",
  prune: "plum purple",
  violet: "purple",
  bordeaux: "burgundy",
  rouge: "red",
  jaune: "yellow",
  orange: "orange",
  noir: "black",
  doré: "gold",
  argenté: "silver",
  cuivré: "copper",
  "or rose": "rose gold",
  bronze: "bronze",
  perle: "pearl white",
};

/** Coupe structurée (champ dédié `coupe`, distinct du texte libre de sous_type) — recette 18/08/2026. */
const COUPE_EN: Record<string, string> = {
  "Serré": "fitted",
  "Ajusté": "tailored",
  "Ample": "loose-fitting",
};

/** Toutes les matières (contrairement à la clé visuelle, qui n'en retient qu'une partie pour la déduplication) — décrire fidèlement le tissu aide la génération, même sans dédupliquer dessus. */
const MATIERE_EN: Record<string, string> = {
  coton: "cotton",
  lin: "linen",
  laine: "wool",
  soie: "silk",
  cuir: "leather",
  denim: "denim",
  "synthétique": "synthetic fabric",
};

/** Composition spécifique par catégorie — empêche structurellement une confusion de type de vêtement (ex. veste générée pour un pantalon). */
const CATEGORY_COMPOSITION: Record<string, string> = {
  pantalon: "Complete pair of trousers, visible from waistband to hem. Both legs clearly visible.",
  jean: "Complete pair of jeans, visible from waistband to hem. Both legs clearly visible.",
  short: "Complete shorts, waistband to hem visible.",
  haut: "Complete top, front view.",
  pull: "Complete sweater, front view.",
  robe: "Complete dress, full length visible, from shoulders to hem.",
  jupe: "Complete skirt, waistband to hem visible.",
  combinaison: "Complete jumpsuit, full length visible.",
  chaussures: "Pair of shoes, both shoes visible.",
  sac: "Single handbag, fully visible.",
  bijou: "Single jewelry item, centered.",
  veste: "Complete blazer or jacket, front view.",
  manteau: "Complete coat, front view.",
  accessoire: "Single accessory item, centered.",
};

/**
 * Catégories verticalement hautes (recette 19/08/2026, correctif images
 * coupées) : dans un cadre carré, un vêtement long a besoin d'être réduit
 * davantage pour ne jamais toucher le haut ou le bas du cadre.
 */
const TALL_CATEGORIES = new Set(["robe", "manteau", "combinaison", "pantalon", "jean"]);

/** Exclusions spécifiques par catégorie (garde-fou supplémentaire contre la confusion de type). */
const CATEGORY_EXCLUDE: Record<string, string[]> = {
  pantalon: ["shirt", "jacket", "blazer", "shoes", "dress"],
  jean: ["shirt", "jacket", "blazer", "shoes", "dress"],
  short: ["shirt", "jacket", "shoes"],
  haut: ["jacket", "trousers", "dress", "skirt"],
  pull: ["jacket", "trousers", "dress"],
  robe: ["trousers", "jacket", "shirt"],
  jupe: ["trousers", "shirt", "jacket"],
  combinaison: ["jacket", "shirt", "dress"],
  veste: ["shirt", "trousers", "dress"],
  manteau: ["shirt", "trousers", "dress"],
  chaussures: ["bag", "clothing item"],
  sac: ["shoes", "clothing item"],
  bijou: ["clothing item", "shoes", "bag"],
  accessoire: ["clothing item", "shoes"],
};

/** Mots attendus dans le nom du produit pour chaque catégorie — sert à la validation de cohérence avant l'appel API. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  haut: ["top", "shirt", "blouse", "tank top", "turtleneck", "polo", "sweatshirt"],
  pull: ["sweater", "cardigan", "sweatshirt"],
  pantalon: ["trousers", "pants", "leggings"],
  jean: ["jeans"],
  jupe: ["skirt"],
  short: ["shorts"],
  robe: ["dress"],
  combinaison: ["jumpsuit", "playsuit", "dungarees"],
  veste: ["jacket", "blazer"],
  manteau: ["coat", "parka", "puffer jacket", "raincoat"],
  chaussures: ["shoes", "sneakers", "boots", "flats", "sandals", "loafers", "pumps", "slippers"],
  sac: ["bag", "handbag", "tote", "backpack", "clutch"],
  bijou: ["necklace", "earrings", "bracelet", "ring", "watch", "jewelry"],
  accessoire: ["belt", "scarf", "hat", "cap", "sunglasses", "tights", "socks", "accessory"],
};

function translate(dict: Record<string, string>, raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return dict[raw.trim().toLowerCase()];
}

/** Majuscule initiale + point final (sauf ponctuation finale déjà présente) — pour les phrases de style libre (silhouette_mode, tendances_mode, override...). */
function capSentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** Éclate un texte libre (souvent saisi en liste séparée par virgules) en une ligne par élément, chacune capitalisée. */
function toLines(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capSentence);
}

const NIVEAUX_TENDANCE = new Set(["intemporel", "contemporain", "tendance"]);

function normalizeNiveauTendance(raw: string | null | undefined): "intemporel" | "contemporain" | "tendance" {
  const v = (raw || "").trim().toLowerCase();
  return NIVEAUX_TENDANCE.has(v) ? (v as "intemporel" | "contemporain" | "tendance") : "contemporain";
}

export interface BuiltPrompt {
  prompt: string;
  ok: boolean;
  noun: string;
  canonCategory: string;
}

/**
 * Construit le prompt anglais et valide sa cohérence avec la catégorie —
 * cf. src/lib/imagePrompt.ts pour la version app (source de vérité, à
 * garder synchronisée). `ok: false` signale un sujet incompatible avec la
 * catégorie : l'appelant ne doit JAMAIS appeler l'API de génération dans ce cas.
 *
 * `trend` est déjà résolu par l'appelant (matching en base sur
 * categorie/sous_type/genre/année, cf. findTrendRule côté Edge Function) —
 * cette fonction reste pure/synchrone et ne touche jamais la base.
 *
 * Ordre de priorité pour la partie "design" du prompt (recette 19/08/2026) :
 * 1. row.prompt_image_override, si renseigné (remplace tout le bloc design)
 * 2. row.silhouette_mode / row.details_mode
 * 3. trend.silhouette / trend.details (ignoré si niveau_tendance = intemporel)
 * 4. caractéristiques standards (dictionnaires ci-dessus, comme avant)
 * Le sujet structurel (noun/canonCategory/ok) ne dépend JAMAIS de cet ordre —
 * une tendance ne peut jamais changer la nature du produit.
 */
export function buildImagePrompt(row: VestiaireRow, trend?: TrendRule | null): BuiltPrompt {
  const canonCategory = CATEGORY_CANON[(row.category || "").trim().toLowerCase()] || "accessoire";
  const genreRaw = (row.genre || "").trim().toLowerCase();
  const genreEn = genreRaw === "femme" ? "women's" : genreRaw === "homme" ? "men's" : "unisex";
  const colorRaw = row.couleur_dominante || "";
  const colorEn = translate(COLOR_EN, colorRaw) || (colorRaw ? colorRaw.toLowerCase() : "");
  const matiereEn = translate(MATIERE_EN, row.matiere);

  // Sujet du produit : sous_type > category > (jamais name). Phrase entière
  // reconnue d'abord (garde les entrées composées comme "sac à main"), puis
  // mot par mot si la phrase entière ne matche rien (correctif 19/08/2026 :
  // "sandales plates" ne matchait pas "sandales" en recherche de phrase
  // exacte et retombait à tort sur le terme générique de la catégorie) —
  // jamais interprété librement depuis le nom de la pièce.
  const sousTypeRaw = (row.sous_type || "").trim().toLowerCase();
  const sousTypeTokens = sousTypeRaw.split(/[\s/]+/).filter(Boolean);
  const noun =
    translate(SUBTYPE_EN, sousTypeRaw) ||
    sousTypeTokens.map((w) => SUBTYPE_EN[w]).find((w): w is string => Boolean(w)) ||
    CATEGORY_EN[canonCategory] ||
    "item";

  // Modificateurs de coupe/style : mots-clés repérés dans sous_type (en mot
  // seul ou en bigramme pour les cols/encolures, ex. "col v"), plus le champ
  // structuré `coupe` (Serré/Ajusté/Ample) quand renseigné.
  const sousTypeBigrams = sousTypeTokens.slice(0, -1).map((w, i) => `${w} ${sousTypeTokens[i + 1]}`);
  const modifiers = Array.from(
    new Set(
      [
        ...sousTypeTokens.map((w) => MODIFIER_EN[w]),
        ...sousTypeBigrams.map((b) => NECKLINE_EN[b]),
        row.coupe ? COUPE_EN[row.coupe] : undefined,
      ].filter((w): w is string => Boolean(w))
    )
  );

  const productDescription = [genreEn, colorEn, ...modifiers, matiereEn, noun].filter(Boolean).join(" ");

  // Sujet structurel — jamais affecté par override/tendance (garde-fou
  // "un blazer doit rester un blazer" du brief 19/08/2026).
  const ok = (CATEGORY_KEYWORDS[canonCategory] || []).some((kw) => noun.includes(kw));
  const composition = CATEGORY_COMPOSITION[canonCategory] || "Single fashion item, fully visible.";
  const excludeLines = (CATEGORY_EXCLUDE[canonCategory] || []).map((w) => `No ${w}.`);

  const niveauTendance = normalizeNiveauTendance(row.niveau_tendance);
  // intemporel = jamais de micro-tendance : la table tendances_mode n'est
  // jamais consultée pour ce niveau (mais un silhouette_mode/details_mode
  // saisi explicitement par un-e admin sur l'article, lui, reste respecté —
  // ce n'est pas une "micro-tendance" mais une description éditoriale).
  const effectiveTrend = niveauTendance === "intemporel" ? null : trend || null;

  const overrideText = row.prompt_image_override?.trim() || "";
  let designBlock: string;

  if (overrideText) {
    designBlock = overrideText;
  } else {
    const productLine = capSentence([...modifiers, noun].filter(Boolean).join(" ") || noun);
    const silhouetteText = row.silhouette_mode?.trim() || effectiveTrend?.silhouette?.trim() || "";
    const detailsText = row.details_mode?.trim() || effectiveTrend?.details?.trim() || "";

    const blocks: string[] = [`Product:\n${productLine}`];
    if (colorEn) blocks.push(`Color:\n${capSentence(colorEn)}`);
    if (silhouetteText) blocks.push(`Silhouette:\n${capSentence(silhouetteText)}`);
    if (detailsText) blocks.push(`Details:\n${toLines(detailsText).join("\n")}`);

    if (niveauTendance === "intemporel") {
      blocks.push(
        [
          "Timeless design direction:",
          "Sober, refined, and understated design.",
          "Visually durable — not tied to a passing micro-trend.",
          "Versatile and easy to wear across seasons.",
          "Premium quality feel.",
          "Current without being marked by a specific fashion moment.",
        ].join("\n")
      );
    } else {
      const directionLines = [
        "Current fashion direction:",
        "Contemporary fashion aesthetic appropriate to the current year.",
        "The garment must look current and commercially relevant for the contemporary European fashion market.",
        "Use current proportions and construction appropriate to this exact garment category.",
        "Avoid dated cuts, outdated proportions, obsolete detailing and generic old-fashioned styling.",
        "The result should feel like a real ready-to-wear item currently sold by a contemporary premium fashion retailer.",
        "Prioritize a timeless foundation combined with current fashion proportions and refined contemporary detailing.",
      ];
      // "tendance" seulement : va davantage chercher dans tendances_mode (brief 19/08/2026 point 4) —
      // "contemporain" reste aux codes actuels génériques ci-dessus, sans micro-tendance spécifique.
      if (niveauTendance === "tendance" && effectiveTrend?.coupes?.trim()) {
        directionLines.push(`Cut direction: ${capSentence(effectiveTrend.coupes)}`);
      }
      if (niveauTendance === "tendance" && effectiveTrend?.matieres?.trim()) {
        directionLines.push(`Fabric direction: ${capSentence(effectiveTrend.matieres)}`);
      }
      blocks.push(directionLines.join("\n"));
    }

    if (effectiveTrend?.elements_a_eviter?.trim()) {
      blocks.push(`Avoid:\n${toLines(effectiveTrend.elements_a_eviter).join("\n")}`);
    }

    designBlock = blocks.join("\n\n");
  }

  // Template visuel Capsela commun à toutes les générations (brief
  // 19/08/2026 point 6) — composition/excludeLines spécifiques à la
  // catégorie et marge anti-crop des catégories hautes (recette 19/08/2026,
  // correctif images coupées) conservées comme garde-fous structurels
  // existants, insérées au fil du template commun plutôt qu'en doublon.
  const commonTemplate = [
    "Single fashion item only.",
    "Complete garment or product fully visible.",
    composition,
    "Entire product must remain inside the frame with no cropped part.",
    "Generous empty margin on all four sides.",
    ...(TALL_CATEGORIES.has(canonCategory)
      ? [
          "This is a visually tall/long garment: scale it down further than usual so the very top and the very bottom both sit well within the frame, with clear empty space above and below — never let the top or bottom edge touch or extend past the image border.",
        ]
      : []),
    "Perfectly centered.",
    "Front view or very slight three-quarter view.",
    "No person.",
    "No model.",
    "No mannequin.",
    "No visible body.",
    "No body parts.",
    "No hanger.",
    "No furniture.",
    "No props.",
    "No text.",
    "No logo.",
    "No brand.",
    "No additional clothing unless structurally part of the product.",
    ...excludeLines,
    "Clean isolated product presentation.",
    "Realistic premium material texture.",
    "Natural construction and folds.",
    "Soft diffused studio lighting.",
    "Very soft subtle shadow.",
    "Transparent background if supported.",
    "Otherwise use a clean uniform neutral or white background.",
    "Photorealistic.",
    "High detail.",
    "Sharp clean product edges.",
    "Designed to remain immediately recognizable when displayed as a small mobile ecommerce thumbnail in the Capsela application.",
  ].join("\n");

  const prompt = [`Premium ecommerce cutout product image of ${productDescription}.`, "", designBlock, "", commonTemplate].join("\n");

  return { prompt, ok, noun, canonCategory };
}
