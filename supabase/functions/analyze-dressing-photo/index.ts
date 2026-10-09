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

import {
  ACCESSOIRE_TYPES,
  BIJOU_TYPES,
  CATEGORY_KEYS,
  MATIERES,
  nearestPaletteColor,
  PALETTE,
  PALETTE_BIJOU,
  SAC_TYPES,
  SHOE_TYPES,
  SUBTYPES,
  type CategoryKey,
} from "../_shared/enumsPiece.ts";

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
    `Si cat est l'une de : ${CATEGORIES_A_MANCHES.join(", ")}, indique aussi manches EXACTEMENT parmi : sans, courtes, trois_quarts, longues (sans = sans manches ou bretelles, courtes = jusqu'au coude, trois_quarts = jusqu'à mi-avant-bras, longues = jusqu'au poignet ou au-delà), sinon null. Pour toute autre catégorie, manches = null.`,
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
  if (cat && (CATEGORIES_A_MANCHES as readonly string[]).includes(cat) && raw.manches && ["sans", "courtes", "trois_quarts", "longues"].includes(raw.manches)) {
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
