#!/usr/bin/env node
// Génération des 14 visuels définitifs de l'étape Style de l'onboarding
// (recette 20/08/2026 — plan validé en chat le 20/08/2026, qualité "medium").
//
// ⚠️ INDÉPENDANT DU PIPELINE CATALOGUE (vestiaire_universel) — n'appelle
// jamais l'Edge Function generate-catalog-image, ne lit/écrit jamais
// visual_assets ni visual_key, n'écrit jamais dans image_generation_logs
// (donc aucun impact sur MAX_IMAGE_GENERATIONS_PER_DAY, qui ne lit que
// cette table). Appelle l'API OpenAI Images directement, upload directement
// dans Supabase Storage. Réutilise le bucket `catalog-images` existant
// (public en lecture, écriture service_role — migration 0010, policies au
// niveau du bucket donc déjà valables pour un nouveau préfixe), sous un
// préfixe dédié `style-visuals/`, jamais mélangé aux chemins du catalogue.
//
// Ces 14 images sont des assets permanents, générés une seule fois. Aucun
// appel OpenAI Images ne doit avoir lieu à l'ouverture de l'onboarding —
// seulement via ce script, en amont.
//
// ⚠️ Régénérer un seul visuel plusieurs mois après les autres produira
// presque sûrement une pièce qui ne s'accorde plus à la collection
// (fond/lumière/échelle non déterministes d'un appel à l'autre, limite du
// modèle). La fonction existe (--gender/--style ciblés) mais impose de
// recontrôler l'harmonie de la grille entière après coup.
//
// Flux en 2 temps (revue humaine obligatoire, aucun contrôle automatique ne
// peut vérifier qu'un flat lay représente bien tel style plutôt qu'un
// autre) :
//   1. génération : 3 candidats PNG par visuel, uploadés dans un préfixe
//      TEMPORAIRE public `style-visuals/_staging/` (mêmes policies que le
//      reste du bucket) — pas de zip à télécharger, les URLs s'ouvrent
//      directement au navigateur.
//   2. promotion : une fois un candidat choisi (visuellement, par toi ou
//      par moi), il est reconverti en .webp et copié vers le chemin final
//      `style-visuals/{genre}/{slug}.webp` ; les 3 candidats de ce visuel
//      sont ensuite supprimés du préfixe temporaire.
//
// Usage (Node 20+, via GitHub Actions workflow_dispatch — jamais de terminal
// local dans ce projet) :
//   node scripts/generate-style-visuals.mjs --mode=generate --gender=femme --style=romantique
//   node scripts/generate-style-visuals.mjs --mode=generate --all
//   node scripts/generate-style-visuals.mjs --mode=promote --gender=femme --style=romantique --candidate=2
//
// Env requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
// (secret GitHub Actions dédié — n'existe nulle part ailleurs dans ce
// projet, à ajouter dans Settings → Secrets and variables → Actions).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BUCKET = "catalog-images";
const MODEL = "gpt-image-1";
const QUALITY = "medium"; // décidé en chat le 20/08/2026 — assets permanents, visibles dès le premier écran.
// 3 par défaut (permet de choisir le meilleur — un même prompt peut donner
// des fonds/échelles/lumières différents d'un appel à l'autre, limite du
// modèle). Réglable via --candidates=N : 1 suffit en phase d'itération sur
// le wording des prompts, avant le passage en revue final à 3.
let CANDIDATES_PER_VISUAL = 3;
const DELAY_MS = 1500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gabarit commun (plan validé en chat, section 8 du prompt d'origine, avec
// deux ajustements : pas de "background: transparent" — ces visuels sont
// des photos autonomes avec un vrai fond ivoire peint par le modèle, pas
// des éléments à recomposer sur l'UI ; pas de phrase "same treatment as the
// other images" — sans effet, le modèle n'a aucune mémoire d'un appel à
// l'autre, la cohérence vient de la description exhaustive du fond/lumière/
// cadrage, complétée par la normalisation post-sélection.
function buildPrompt(gender, styleLabel, items, extra) {
  return `Premium contemporary fashion editorial flat lay created specifically for a mobile personal styling application.

A complete and coherent ${gender} wardrobe look clearly representing the ${styleLabel} fashion aesthetic.

Curated coordinated garments, shoes and accessories: ${items}.
${extra ? extra + "\n" : ""}
This image must communicate a permanent personal fashion style, not a specific occasion, event or activity.

Contemporary 2026 fashion with current but durable silhouettes.

Top-down flat lay photography.
Clean warm ivory cream background.
Soft diffused professional studio lighting.
Extremely subtle realistic shadows.
Photorealistic premium fashion editorial photography.

Four to six visually significant items.
Clear visual hierarchy between main garments and accessories.
Balanced, slightly asymmetrical composition.
Main garments fully visible.
Controlled negative space.
The outfit occupies approximately 75 to 85 percent of the useful composition.

Optimized to remain immediately understandable inside a small two-column mobile card.

No person. No model. No mannequin. No body parts. No hands. No face.
No text. No typography. No style name. No letters. No logo.
No visible brand. No watermark. No UI elements. No card. No card border.`;
}

// Slugs de fichier — identiques à ceux déjà utilisés par les placeholders
// SVG actuels (STYLE_CONFIG, src/lib/profile.ts), jamais réinventés.
const SLUG = {
  minimaliste: "minimaliste",
  casual_chic: "casual-chic",
  classique_chic: "classique-chic",
  romantique: "romantique",
  boheme: "boheme",
  streetwear: "streetwear",
  preppy: "preppy",
  glamour: "glamour",
};

// 14 visuels — 8 femme, 6 homme (pas de Romantique/Glamour côté homme,
// décision arrêtée le 20/08/2026, jamais un id supplémentaire).
const VISUALS = [
  {
    gender: "femme",
    style: "minimaliste",
    label: "Minimaliste",
    items: "a premium white t-shirt or structured top, straight-leg tailored trousers in black or beige, one sculptural minimal outer layer with clean architectural lines, minimalist white sneakers, one geometric structured bag, at most one very discreet piece of jewelry",
    extra: "Color palette: white, cream, beige, black, grey — monochrome or near-monochrome. Architectural, sculptural silhouette with sharp clean lines and geometric shapes, almost design-object quality. Extreme restraint: no patterns, no layering complexity, no denim, no relaxed or casual styling — distinctly more austere and precise than Casual chic.",
  },
  {
    gender: "femme",
    style: "casual_chic",
    label: "Casual chic",
    items: "a white or light blue shirt, contemporary straight-leg jeans, a fine knit or an elegant striped top, premium loafers or sneakers, a leather bag, discreet jewelry",
    extra: "An evident mix of one casual piece and one more elevated piece.",
  },
  {
    gender: "femme",
    style: "classique_chic",
    label: "Classique chic",
    items: "a sharply structured blazer with a defined shoulder, a crisp white shirt or blouse, precisely tailored trousers, refined loafers or pumps, a structured bag, classic polished accessories",
    extra: "Color palette: navy, white, beige, black, camel. Sharp, structured tailoring: crisp fabrics, defined shoulder line, precise clean seams, polished and formal. Distinctly more tailored and buttoned-up than Preppy — no collegiate stripes, no varsity or sport-heritage references. Distinctly more restrained and matte than Glamour — no satin sheen, no statement jewelry.",
  },
  {
    gender: "femme",
    style: "romantique",
    label: "Romantique",
    items: "a flowing blouse with soft draping, a midi skirt, an optional light cardigan, ballet flats or slingback shoes, a small bag, fine delicate jewelry",
    extra: "Color palette: cream, nude, powder pink, soft blue — pale, delicate tones only. Extremely soft, fluid, feminine draping with visible fabric movement; a hint of delicate lace or sheer trim. Distinctly softer and more pastel than Bohème — avoid earthy tones, avoid raw natural textures, avoid ethnic-inspired prints. No childish styling, no accumulated floral prints, no excessive pink.",
  },
  {
    gender: "femme",
    style: "boheme",
    label: "Bohème",
    items: "a flowing linen blouse with a subtle crochet trim detail, wide-leg linen or cotton trousers or a flowing skirt, a light natural-fiber knit layer, natural leather sandals, a woven straw or natural leather bag, one organic-shaped jewelry piece as a focal point",
    extra: "Color palette: ecru as the dominant base tone, with terracotta and olive as clear accent colors — avoid an all-beige, all-camel, all-brown monochrome look, the palette must read as ecru + terracotta + olive, not a single earth tone. Emphasize linen texture, a touch of crochet detail, natural leather grain, and one organic-shaped jewelry piece as a clear focal point. A tactile, contemporary bohemian feel — modern and fresh, not overly rustic. Distinctly warmer and more textured than Romantique — no pastel tones, no lace, no delicate sheer fabrics. No festival styling, no caricatural hippie look, no accumulated fringe.",
  },
  {
    gender: "femme",
    style: "streetwear",
    label: "Streetwear",
    items: "a deliberately oversized premium hoodie or sweatshirt, a t-shirt, loose or cargo jeans, chunky contemporary sneakers as the visual anchor, a crossbody bag, an optional cap",
    extra: "Strongly oversized, urban streetwear silhouette — deliberately boxy and voluminous, not fitted. Chunky sneakers as the dominant visual element. Utility-inspired details (pockets, drawstrings). Bold, confident urban attitude. A fashion streetwear aesthetic, emphatically NOT athletic or gym clothing — no performance fabric sheen, no sport branding cues, no leggings, no tracksuit.",
  },
  {
    gender: "femme",
    style: "preppy",
    label: "Preppy",
    // Deuxième révision (retour candidats 1/2) — la première révision
    // nommait encore "argyle"/"tartan" dans une consigne négative ("avoid
    // an argyle pattern"), et le modèle les a rendus quand même : nommer un
    // motif, même pour le proscrire, tend à le faire apparaître. Cette
    // version ne mentionne plus jamais ces deux mots, positif ou négatif —
    // uniquement une description positive de tenue solide et unie.
    items: "a light blue Oxford shirt, a plain cream cardigan or a twisted-stitch knit sweater in a single solid color, beige chino trousers or raw straight-leg jeans, chocolate brown loafers, a structured bag",
    extra: "Color palette: sky blue, cream, beige, chocolate brown, navy. Adult, sophisticated, everyday-wearable preppy for 2026 — polished and chic, built around exactly one clear preppy signature (the Oxford shirt collar), everything else kept clean, solid-colored and unpatterned. Contemporary modern adult fashion — avoid any schoolwear or uniform styling, avoid a teenage aesthetic.",
  },
  {
    gender: "femme",
    style: "glamour",
    label: "Glamour",
    items: "a fluid satin top or dress with visible sheen, elegant trousers or a sophisticated skirt, a sharply tailored blazer, heeled shoes, an elegant clutch, one bold statement jewelry piece as a focal point",
    extra: "Color palette: black, cream, chocolate, burgundy, with deliberate metallic gold or bronze accents. Bold, confident, statement-driven styling: visible satin sheen, a strong tailored shoulder, one striking piece of jewelry as a clear focal point. Distinctly more daring and materially rich than Classique chic — visible shine, richer texture, more assertive silhouette. A fashion wardrobe, not an occasion outfit — do not generate only an evening event look. Avoid excessive sequins, avoid a provocative rendering.",
  },
  {
    gender: "homme",
    style: "minimaliste",
    label: "Minimaliste",
    items: "a premium white t-shirt, straight-leg trousers in black, beige or grey, an optional clean minimal overshirt, minimalist white sneakers, a sober watch",
    extra: "Color palette: white, cream, beige, grey, black.",
  },
  {
    gender: "homme",
    style: "casual_chic",
    label: "Casual chic",
    items: "an Oxford shirt, straight-leg jeans or chinos, a fine knit, leather sneakers or loafers, a watch, a sober belt",
    extra: "",
  },
  {
    gender: "homme",
    style: "classique_chic",
    label: "Classique chic",
    items: "a navy blazer, a white shirt, dress trousers, loafers or derby shoes, a leather belt, a classic watch",
    extra: "Color palette: navy, white, beige, grey, brown.",
  },
  {
    gender: "homme",
    style: "boheme",
    label: "Bohème",
    items: "a linen shirt, loose or soft chino trousers, a textured overshirt, soft leather shoes, discreet natural accessories",
    extra: "Color palette: ecru, camel, olive, brown, sand. Natural, fluid fabrics and volumes, more organic than the other styles. Avoid festival or caricatural hippie styling.",
  },
  {
    gender: "homme",
    style: "streetwear",
    label: "Streetwear",
    items: "a premium hoodie or sweatshirt, a t-shirt, cargo trousers or loose jeans, contemporary sneakers, a crossbody bag, an optional cap",
    extra: "Urban volumes, sneakers more prominent — must not resemble athletic sportswear.",
  },
  {
    gender: "homme",
    style: "preppy",
    label: "Preppy",
    items: "an Oxford shirt, a polo shirt, a knit sweater, chinos or tailored trousers, loafers, a classic watch and belt",
    extra: "Color palette: navy, cream, camel, burgundy, sky blue. Avoid a uniform-like schoolwear effect.",
  },
];

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

async function callImageApi(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    // Pas de background/output_format transparent (contrairement au pipeline
    // catalogue) : ces visuels ont un vrai fond ivoire peint par le modèle.
    body: JSON.stringify({ model: MODEL, prompt, size: "1024x1024", quality: QUALITY, n: 1 }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échec génération image (${res.status}) : ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Réponse OpenAI sans image (b64_json manquant).");
  return Buffer.from(b64, "base64");
}

async function uploadPng(path, bytes) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Échec upload Storage (${path}) : ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function generateOne(visual) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante (secret GitHub Actions à ajouter).");
  const prompt = buildPrompt(visual.gender, visual.label, visual.items, visual.extra);
  console.log(`\n[${visual.gender}/${visual.style}] génération de ${CANDIDATES_PER_VISUAL} candidats…`);
  const urls = [];
  for (let n = 1; n <= CANDIDATES_PER_VISUAL; n++) {
    const bytes = await callImageApi(prompt);
    const path = `style-visuals/_staging/${visual.gender}-${visual.style}-${n}.png`;
    const url = await uploadPng(path, bytes);
    urls.push(url);
    console.log(`  candidat ${n} : ${url}`);
    await sleep(DELAY_MS);
  }
  return urls;
}

async function promoteOne(gender, style, candidate) {
  const slug = SLUG[style];
  if (!slug) throw new Error(`Style inconnu : "${style}".`);
  const stagingPath = `style-visuals/_staging/${gender}-${style}-${candidate}.png`;
  const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET).download(stagingPath);
  if (downloadError || !fileData) throw new Error(`Candidat introuvable en Storage : ${stagingPath} (${downloadError?.message || ""})`);
  const pngBytes = Buffer.from(await fileData.arrayBuffer());

  const { bytes: webpBytes, contentType, ext } = await toWebp(pngBytes);
  const finalPath = `style-visuals/${gender}/${slug}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(finalPath, webpBytes, { contentType, upsert: true });
  if (uploadError) throw new Error(`Échec upload final (${finalPath}) : ${uploadError.message}`);
  const finalUrl = supabase.storage.from(BUCKET).getPublicUrl(finalPath).data.publicUrl;
  console.log(`Promu : ${finalUrl}`);

  // Nettoyage des 3 candidats temporaires de ce visuel (le choisi comme les écartés).
  const stalePaths = Array.from({ length: CANDIDATES_PER_VISUAL }, (_, i) => `style-visuals/_staging/${gender}-${style}-${i + 1}.png`);
  await supabase.storage.from(BUCKET).remove(stalePaths);
  console.log(`Candidats temporaires supprimés.`);
  return finalUrl;
}

/** Conversion WebP via sharp (devDependency ajoutée pour ce script — plus fiable que le convertisseur WASM best-effort du pipeline catalogue). Repli sur PNG si sharp est indisponible. */
async function toWebp(pngBytes) {
  try {
    const sharp = (await import("sharp")).default;
    const webpBuffer = await sharp(pngBytes).webp({ quality: 82 }).toBuffer();
    return { bytes: webpBuffer, contentType: "image/webp", ext: "webp" };
  } catch (err) {
    console.error("Conversion WebP indisponible, repli sur PNG brut :", err instanceof Error ? err.message : err);
    return { bytes: pngBytes, contentType: "image/png", ext: "png" };
  }
}

async function main() {
  const args = parseArgs();
  const mode = args.mode || (args.promote ? "promote" : "generate");
  if (args.candidates) {
    const n = Number(args.candidates);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      console.error("--candidates doit être un entier entre 1 et 5.");
      process.exit(1);
    }
    CANDIDATES_PER_VISUAL = n;
  }

  if (mode === "generate") {
    // --style accepte aussi une liste séparée par des virgules (ex.
    // "minimaliste,classique_chic,romantique") pour relancer plusieurs
    // styles d'un même genre en un seul run, sans tout régénérer via --all.
    const styleList = String(args.style || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const targets = args.all
      ? VISUALS
      : VISUALS.filter((v) => v.gender === args.gender && styleList.includes(v.style));
    if (!targets.length) {
      console.error(
        'Aucune cible. Utilise --all, ou --gender=femme --style=romantique (un id, ex. "casual_chic"), ou --gender=femme --style=minimaliste,classique_chic,... (plusieurs ids séparés par des virgules).'
      );
      process.exit(1);
    }
    for (const visual of targets) {
      await generateOne(visual);
    }
    console.log(`\n${targets.length} visuel(s) généré(s) — ${targets.length * CANDIDATES_PER_VISUAL} candidats au total, à revoir avant promotion.`);
    return;
  }

  if (mode === "promote") {
    // Promotion groupée (--items="style:candidat,style:candidat,...") pour
    // valider plusieurs styles d'un même genre en un seul run, plutôt qu'un
    // run par style. --style/--candidate simples restent supportés pour un
    // seul style à la fois.
    if (args.items) {
      if (!args.gender) {
        console.error('--gender requis avec --items (ex. --gender=femme --items="minimaliste:1,classique_chic:1")');
        process.exit(1);
      }
      const entries = String(args.items)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
          const [style, candidate] = entry.split(":").map((s) => s.trim());
          return { style, candidate: Number(candidate) };
        });
      for (const { style, candidate } of entries) {
        if (!style || !candidate) {
          console.error(`Entrée invalide dans --items : "${style}:${candidate}" — attendu "style:candidat".`);
          process.exit(1);
        }
        await promoteOne(args.gender, style, candidate);
      }
      console.log(`\n${entries.length} visuel(s) promu(s).`);
      return;
    }
    if (!args.gender || !args.style || !args.candidate) {
      console.error(
        'Requis pour --mode=promote : --gender=femme --style=romantique --candidate=1|2|3, ou --gender=femme --items="minimaliste:1,classique_chic:1,romantique:2" pour plusieurs styles d\'un coup.'
      );
      process.exit(1);
    }
    await promoteOne(args.gender, args.style, Number(args.candidate));
    return;
  }

  console.error(`Mode inconnu : "${mode}". Utilise --mode=generate ou --mode=promote.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Erreur :", err instanceof Error ? err.message : err);
  process.exit(1);
});
