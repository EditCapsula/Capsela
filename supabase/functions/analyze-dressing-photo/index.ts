// Edge Function analyze-dressing-photo (recette 22/08/2026) — pré-remplit le
// formulaire d'ajout d'une pièce réelle (couleur, catégorie, sous-type,
// matière...) à partir de sa photo, réutilisant le même compte/les mêmes
// crédits OpenAI que generate-catalog-image (secret OPENAI_API_KEY déjà
// configuré) — endpoint différent (classification vision, pas génération),
// jamais de nouveau fournisseur.
//
// Fichier volontairement autonome (aucun import vers ../_shared/*, contrairement
// à generate-catalog-image) : déployable en copiant-collant ce seul fichier
// dans l'éditeur en ligne du dashboard Supabase (Edge Functions → Deploy a
// new function), sans CLI ni structure multi-fichiers.
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
