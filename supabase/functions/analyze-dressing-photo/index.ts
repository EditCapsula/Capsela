// Edge Function analyze-dressing-photo (recette 22/08/2026) — pré-remplit le
// formulaire d'ajout d'une pièce réelle (couleur, catégorie, sous-type,
// matière...) à partir de sa photo, réutilisant le même compte/les mêmes
// crédits OpenAI que generate-catalog-image (secret OPENAI_API_KEY déjà
// configuré) — endpoint différent (classification vision, pas génération),
// jamais de nouveau fournisseur.
//
// Entrée : { photo_url: string } — URL publique du bucket dressing-photos,
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
// jamais transmise au frontend. Déployer avec :
//   supabase functions deploy analyze-dressing-photo
//   supabase secrets set OPENAI_API_KEY=sk-...   (déjà fait pour generate-catalog-image)
//   supabase secrets set PHOTO_ANALYSIS_MODEL=gpt-4.1-mini   (optionnel, défaut ci-dessous)

import { corsHeaders } from "../_shared/cors.ts";
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
} from "../_shared/dressingEnums.ts";

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("PHOTO_ANALYSIS_MODEL") || DEFAULT_MODEL;
  if (!openaiKey) return jsonError("Configuration serveur incomplète (OPENAI_API_KEY).", 500);

  let photoUrl: string;
  try {
    const body = await req.json();
    photoUrl = String(body.photo_url || "");
    if (!photoUrl.startsWith("http")) throw new Error("photo_url invalide");
  } catch {
    return jsonError("photo_url manquante ou invalide.", 400);
  }

  try {
    const prompt = buildPrompt();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
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
    "Si tu n'es pas raisonnablement sûr d'un champ, mets null plutôt que de deviner au hasard — une suggestion fausse est pire qu'aucune suggestion.",
    'Réponds UNIQUEMENT en JSON strict, un seul objet, avec exactement ces clés : {"cat": string|null, "color_hex": string|null, "matiere": string|null, "subtype": string|null, "shoe_type": string|null, "sac_type": string|null, "bijou_type": string|null, "accessoire_type": string|null}.',
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

  if (cat && raw.matiere && (MATIERES as readonly string[]).includes(raw.matiere)) out.matiere = raw.matiere;

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
