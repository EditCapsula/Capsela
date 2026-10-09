// Edge Function analyze-dressing-photo (recette 22/08/2026) — pré-remplit le
// formulaire d'ajout d'une pièce réelle (couleur, catégorie, sous-type,
// matière...) à partir de sa photo, réutilisant le même compte/les mêmes
// crédits OpenAI que generate-catalog-image (secret OPENAI_API_KEY déjà
// configuré) — endpoint différent (classification vision, pas génération),
// jamais de nouveau fournisseur.
//
// Depuis le 01/10/2026 elle importe ../_shared/ (protection.ts, adminKey.ts) :
// elle ne se colle plus dans l'éditeur du tableau de bord, elle se déploie par
// le workflow « Déployer les fonctions Supabase » ou la CLI.
//
// Entrée : { photo_url: string } — URL signée du bucket dressing-photos (privé depuis le 30/09/2026 ; publique avant),
// déjà obtenue par uploadDressingPhoto AVANT l'appel (jamais une blob: URL,
// inaccessible côté serveur).
//
// Sortie : une suggestion, jamais imposée — le client (store.tsx,
// uploadAddPhoto) ne l'applique qu'aux champs que l'utilisatrice n'a pas
// déjà modifiés elle-même (mêmes drapeaux *Touched que la détection par nom,
// cf. detectSubtype/detectSacType...). Un échec ou une réponse partielle
// n'empêche jamais d'ajouter la pièce manuellement — cette fonction ne fait
// que suggérer.
//
// Sécurité : OPENAI_API_KEY lue uniquement côté serveur (secret Supabase),
// jamais transmise au frontend.
//
// Déploiement SANS la CLI Supabase (dashboard) :
//   1. Dashboard Supabase → Edge Functions → "Deploy a new function".
//   2. Nom de la fonction : analyze-dressing-photo (exactement ce nom).
//   3. Coller l'intégralité de ce fichier dans l'éditeur, puis Deploy.
//   4. Aucun secret à ajouter : OPENAI_API_KEY existe déjà (utilisée par
//      generate-catalog-image). PHOTO_ANALYSIS_MODEL est optionnel (défaut
//      ci-dessous) — à ajouter dans Edge Functions → Secrets seulement si
//      besoin de changer de modèle plus tard.
//
// Déploiement avec la CLI (équivalent) :
//   supabase functions deploy analyze-dressing-photo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import {
  authentifier,
  consommerQuota,
  estAppelantAdmin,
  jetonDepuisEntete,
  limiteDepuisEnv,
  urlPhotoAutorisee,
} from "../_shared/protection.ts";

// Plafond d'analyses par compte et par jour (01/10/2026) : une analyse est un
// appel OpenAI vision payant. Modifiable par le secret
// MAX_PHOTO_ANALYSES_PER_USER_PER_DAY ; une valeur absente ou illisible ne
// retire jamais le plafond.
const DEFAULT_DAILY_LIMIT_PER_USER = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL = "gpt-4.1-mini";

const CATEGORY_KEYS = [
  "haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison",
  "veste", "manteau", "chaussures", "sac", "bijou", "accessoire",
] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const SUBTYPES: Partial<Record<CategoryKey, string[]>> = {
  haut: ["T-shirt", "Top", "Débardeur", "Chemise", "Chemisier", "Blouse", "Polo", "Sweat"],
  pull: ["Pull", "Gilet", "Cardigan", "Col roulé"],
  pantalon: ["Pantalon", "Tailleur", "Cargo", "Legging", "Jogging"],
  jean: ["Droit", "Slim", "Skinny", "Mom", "Boyfriend", "Wide leg", "Flare"],
  jupe: ["Mini", "Midi", "Longue", "Crayon", "Plissée"],
  short: ["Short", "Bermuda"],
  robe: ["Courte", "Midi", "Longue", "Chemise", "Portefeuille", "Pull"],
  combinaison: ["Combinaison", "Combishort", "Salopette"],
  veste: ["Blazer", "Veste légère", "Perfecto", "Veste en jean", "Surchemise"],
  manteau: ["Manteau", "Trench", "Caban", "Doudoune", "Parka", "Imperméable"],
};

// Liste élargie (recette 24/08/2026, signalé : liste trop courte pour que
// l'analyse retienne la bonne matière sur des pièces réelles) — doit rester
// synchronisée avec MATIERES (src/lib/attributes.ts, app-side).
const MATIERES = [
  "Coton", "Lin", "Laine", "Cachemire", "Soie", "Viscose",
  "Cuir", "Daim", "Denim", "Velours", "Polyester", "Nylon", "Synthétique",
] as const;
const SHOE_TYPES = [
  "Baskets", "Bottines", "Bottes", "Escarpins", "Sandales", "Sandales à talons",
  "Espadrilles", "Mocassins", "Ballerines", "Chaussures d'intérieur",
] as const;
const SAC_TYPES = ["Sac à main", "Cabas", "Bandoulière", "Pochette", "Sac à dos", "Sac de sport"] as const;
const BIJOU_TYPES = ["Collier", "Boucles d'oreilles", "Bracelet", "Bague", "Montre"] as const;
const ACCESSOIRE_TYPES = [
  "Ceinture", "Foulard", "Écharpe", "Chapeau", "Casquette", "Lunettes",
  "Collants", "Chaussettes hautes", "Gourde",
] as const;

const PALETTE: [string, string][] = [
  ["Blanc", "#F7F4EE"], ["Blanc cassé", "#EDE4D6"], ["Crème", "#E7DCC8"], ["Sable", "#D9C9B2"],
  ["Camel", "#C08A5E"], ["Caramel", "#B4835A"], ["Terracotta", "#B4735A"], ["Rouille", "#A9613F"],
  ["Brique", "#9E5A3C"], ["Chocolat", "#7C5436"], ["Moutarde", "#C39A50"], ["Kaki", "#8A8560"],
  ["Vert sauge", "#9AA389"], ["Vert bouteille", "#3F5342"], ["Taupe", "#A8967C"], ["Beige rosé", "#D8C3B4"],
  ["Rose poudré", "#D3AE9F"], ["Corail", "#C9846A"], ["Gris clair", "#C7C2B9"], ["Gris", "#9B968F"],
  ["Gris anthracite", "#4B4A47"], ["Bleu ciel", "#A9BFCB"], ["Denim", "#5E6E7C"], ["Marine", "#3A4152"],
  ["Prune", "#5B3A4A"], ["Bordeaux", "#6E3B3A"], ["Noir", "#2A2724"],
  // Ajouts du 02/10/2026 — COPIE de src/lib/data.ts (PALETTE) ; le test miroir exige l'identique.
  ["Rouge", "#933B33"], ["Bleu", "#4A6280"], ["Beige", "#CDBBA2"], ["Marron", "#964B00"],
  ["Cognac", "#9A5B34"], ["Rouge cerise", "#A32B33"], ["Vieux rose", "#C08A85"], ["Rose pâle", "#EBCFCB"],
  ["Fuchsia", "#B83B78"], ["Jaune", "#E0BE3C"], ["Orange", "#D9772B"], ["Abricot", "#E8A97E"],
  ["Vert olive", "#6B6E4A"], ["Vert forêt", "#2F4A38"], ["Émeraude", "#1F6B58"], ["Menthe", "#B7D3C1"],
  ["Bleu nuit", "#2B3350"], ["Bleu cobalt", "#1E4FA3"], ["Turquoise", "#3A9A9E"], ["Lavande", "#A99BC4"],
  ["Ivoire", "#F0EAE0"], ["Champagne", "#E8D9B5"], ["Nude", "#D9BBA0"], ["Gris perle", "#D3D0CB"],
];
const PALETTE_BIJOU: [string, string][] = [
  ["Doré", "#C9A24B"], ["Argenté", "#B9BEC4"], ["Cuivré", "#B8734A"], ["Or rose", "#D4A995"],
  ["Bronze", "#8C6A3F"], ["Perle", "#EDE6DA"], ["Noir mat", "#2A2724"],
];

/** Distance euclidienne RGB — trouve la teinte de palette existante la plus proche d'un hex libre, jamais une couleur hors palette. */
function nearestPaletteColor(hex: string, palette: [string, string][]): [string, string] {
  const [r, g, b] = hexToRgb(hex);
  let best = palette[0];
  let bestDist = Infinity;
  for (const entry of palette) {
    const [pr, pg, pb] = hexToRgb(entry[1]);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface AnalysisRaw {
  cat?: string | null;
  color_hex?: string | null;
  matiere?: string | null;
  subtype?: string | null;
  shoe_type?: string | null;
  sac_type?: string | null;
  bijou_type?: string | null;
  accessoire_type?: string | null;
  photo_type?: string | null;
  manches?: string | null;
  saisons?: string[] | null;
}

/** Catégories dont la longueur de manches se renseigne — synchronisée avec CATEGORIES_A_MANCHES (src/lib/manches.ts, app-side). */
const CATEGORIES_A_MANCHES = ["haut", "pull", "robe", "combinaison", "veste", "manteau"] as const;

const SAISONS = ["Printemps", "Été", "Automne", "Hiver"] as const;

/** Ce que montre la photo : l'article seul, porté par une personne, ou plusieurs articles (une tenue entière). */
const CADRAGES = ["seule", "portee", "plusieurs"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("PHOTO_ANALYSIS_MODEL") || DEFAULT_MODEL;
  if (!openaiKey) return jsonError("Configuration serveur incomplète (OPENAI_API_KEY).", 500);

  // Protection (01/10/2026, cf. _shared/protection.ts) : une utilisatrice
  // connectée, jamais la clé `anon` seule ; une photo qui est la SIENNE ; un
  // plafond par compte et par jour. L'administration (la clé privilégiée)
  // passe, sans quota, pour les essais et la maintenance.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return jsonError(ADMIN_KEY_MISSING, 500);
  const admin = createClient(supabaseUrl, cleAdmin);
  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!estAdmin && !utilisatrice) return jsonError("Non authentifié.", 401);

  let photoUrl: string;
  try {
    const body = await req.json();
    photoUrl = String(body.photo_url || "");
    if (!photoUrl.startsWith("http")) throw new Error("photo_url invalide");
  } catch {
    return jsonError("photo_url manquante ou invalide.", 400);
  }
  if (utilisatrice && !urlPhotoAutorisee(photoUrl, supabaseUrl, utilisatrice.id)) {
    return jsonError("Cette photo n'est pas une photo de ton dressing.", 403);
  }
  if (utilisatrice) {
    const limite = limiteDepuisEnv(Deno.env.get("MAX_PHOTO_ANALYSES_PER_USER_PER_DAY"), DEFAULT_DAILY_LIMIT_PER_USER);
    const quota = await consommerQuota(admin, utilisatrice.id, "analyze-dressing-photo", limite);
    if (quota === "limite") return jsonError("Limite quotidienne d'analyses atteinte.", 429);
    if (quota === "indisponible") return jsonError("Service momentanément indisponible.", 503);
  }

  try {
    const prompt = buildPrompt();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        // Journalisation explicitement refusée (28/08/2026). Le réglage
        // « API call logging » de l'organisation OpenAI est sur « Enabled per
        // call » : c'est donc l'appel qui tranche, et sans ce paramètre on
        // s'en remettrait à un comportement par défaut non garanti. Cet appel
        // transporte la photo de dressing d'une utilisatrice — elle n'a rien
        // à faire dans un journal consultable, fût-il le nôtre.
        store: false,
        response_format: { type: "json_object" },
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Échec appel OpenAI (${res.status}) : ${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse OpenAI sans contenu.");
    const raw = JSON.parse(content) as AnalysisRaw;
    return jsonOk(sanitize(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    console.error(JSON.stringify({ photo_url: photoUrl, error: message }));
    // Jamais une 500 dure ici — le client traite une analyse manquante comme
    // "rien à suggérer", jamais comme un blocage de l'ajout.
    return jsonOk({});
  }
});

function buildPrompt(): string {
  const subtypesJson = JSON.stringify(SUBTYPES);
  return [
    "Tu analyses la photo d'un article de mode (vêtement, chaussure, sac, bijou ou accessoire) pour une app de garde-robe.",
    `Détermine sa catégorie EXACTEMENT parmi : ${CATEGORY_KEYS.join(", ")}.`,
    `Selon la catégorie choisie, tu peux aussi remplir un sous-type EXACTEMENT parmi la liste associée à cette catégorie ici (JSON, clé = catégorie) : ${subtypesJson}. Ignore les catégories qui n'ont pas de liste.`,
    `Si cat = "chaussures", indique aussi shoe_type EXACTEMENT parmi : ${SHOE_TYPES.join(", ")}.`,
    `Si cat = "sac", indique aussi sac_type EXACTEMENT parmi : ${SAC_TYPES.join(", ")}.`,
    `Si cat = "bijou", indique aussi bijou_type EXACTEMENT parmi : ${BIJOU_TYPES.join(", ")}.`,
    `Si cat = "accessoire", indique aussi accessoire_type EXACTEMENT parmi : ${ACCESSOIRE_TYPES.join(", ")}.`,
    `Si tu peux distinguer la matière principale, indique matiere EXACTEMENT parmi : ${MATIERES.join(", ")}, sinon null.`,
    "Indique aussi color_hex : ta meilleure estimation de la couleur dominante de L'ARTICLE (pas du fond ni de la peau/cheveux si une personne le porte), en hex #RRGGBB.",
    "Si l'article est porté par une personne, concentre-toi uniquement sur l'article lui-même, jamais sur la personne ou le décor.",
    `Si cat est l'une de : ${CATEGORIES_A_MANCHES.join(", ")}, indique aussi manches EXACTEMENT parmi : sans, courtes, longues (sans = sans manches ou bretelles, courtes = jusqu'au coude, longues = jusqu'au poignet ou au-delà), sinon null. Pour toute autre catégorie, manches = null.`,
    "Indique aussi saisons : la liste des saisons où cet article se porte, parmi Printemps, Été, Automne, Hiver (une ou plusieurs ; ex. un manteau en laine : Automne, Hiver ; un débardeur en lin : Printemps, Été), d'après la matière, l'épaisseur et la coupe visibles. Si tu n'es pas raisonnablement sûr, saisons = null.",
    "Indique aussi photo_type : \"seule\" si la photo montre UN SEUL article, posé à plat, sur un cintre ou en gros plan, sans personne ; \"portee\" si une personne le porte ; \"plusieurs\" si la photo montre plusieurs articles ou une tenue entière. Null si tu n'es pas sûr.",
    "Si tu n'es pas raisonnablement sûr d'un champ, mets null plutôt que de deviner au hasard — une suggestion fausse est pire qu'aucune suggestion.",
    'Réponds UNIQUEMENT en JSON strict, un seul objet, avec exactement ces clés : {"cat": string|null, "color_hex": string|null, "matiere": string|null, "subtype": string|null, "shoe_type": string|null, "sac_type": string|null, "bijou_type": string|null, "accessoire_type": string|null, "photo_type": string|null, "manches": string|null, "saisons": string[]|null}.',
  ].join("\n");
}

/** Ne fait jamais confiance aveuglément à la sortie du modèle — toute valeur hors des enums exacts, ou incohérente avec la catégorie résolue, est ignorée plutôt que transmise telle quelle. */
function sanitize(raw: AnalysisRaw): Record<string, unknown> {
  const cat = CATEGORY_KEYS.includes(raw.cat as CategoryKey) ? (raw.cat as CategoryKey) : null;
  const out: Record<string, unknown> = { cat };

  if (raw.color_hex && /^#?[0-9a-fA-F]{3,6}$/.test(raw.color_hex.trim())) {
    const hex = raw.color_hex.trim().startsWith("#") ? raw.color_hex.trim() : `#${raw.color_hex.trim()}`;
    const palette = cat === "bijou" ? PALETTE_BIJOU : PALETTE;
    const [name, snappedHex] = nearestPaletteColor(hex, palette);
    out.colorName = name;
    out.colorHex = snappedHex;
  }

  // Ce que montre la photo : indépendant de la catégorie, ignoré s'il est hors liste.
  if (raw.photo_type && (CADRAGES as readonly string[]).includes(raw.photo_type)) out.photoType = raw.photo_type;

  if (cat && raw.matiere && (MATIERES as readonly string[]).includes(raw.matiere)) out.matiere = raw.matiere;

  // Les manches : seulement pour une catégorie qui en a, et dans la liste.
  if (cat && (CATEGORIES_A_MANCHES as readonly string[]).includes(cat) && raw.manches && ["sans", "courtes", "longues"].includes(raw.manches)) {
    out.manches = raw.manches;
  }

  // Les saisons : seulement celles de la liste, sans doublon, dans l'ordre de l'année.
  if (Array.isArray(raw.saisons)) {
    const saisons = SAISONS.filter((s) => (raw.saisons as unknown[]).includes(s));
    if (saisons.length) out.saisons = saisons;
  }

  const subtypeOptions = cat ? SUBTYPES[cat] : undefined;
  if (subtypeOptions && raw.subtype && subtypeOptions.includes(raw.subtype)) out.subtype = raw.subtype;

  if (cat === "chaussures" && raw.shoe_type && (SHOE_TYPES as readonly string[]).includes(raw.shoe_type)) {
    out.shoeType = raw.shoe_type;
  }
  if (cat === "sac" && raw.sac_type && (SAC_TYPES as readonly string[]).includes(raw.sac_type)) {
    out.sacType = raw.sac_type;
  }
  if (cat === "bijou" && raw.bijou_type && (BIJOU_TYPES as readonly string[]).includes(raw.bijou_type)) {
    out.bijouType = raw.bijou_type;
  }
  if (cat === "accessoire" && raw.accessoire_type && (ACCESSOIRE_TYPES as readonly string[]).includes(raw.accessoire_type)) {
    out.accessoireType = raw.accessoire_type;
  }

  return out;
}

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
