// Edge Function generate-catalog-image (recette 18/08/2026 v2 — architecture
// à déduplication visual_assets).
//
// Entrée : { item_id: number, force_regenerate?: boolean } — item_id est
// l'id BRUT de la ligne vestiaire_universel (pas l'id décalé de
// VESTIAIRE_ID_OFFSET côté app, cf. src/lib/vestiaire.ts). force_regenerate
// réservé à un usage admin futur, jamais envoyé par le client actuel.
//
// Ordre impératif avant tout appel API (objectif économique central : un
// visuel générique généré une seule fois, réutilisé indéfiniment) :
//   1. L'article a-t-il déjà un visual_asset_id prêt ?
//   2. Un asset existe-t-il pour la visual_key exacte ?
//   3. Un asset compatible existe-t-il (genre + sous_type + couleur) ?
//   4. Un asset compatible existe-t-il (sous_type + couleur seuls) ?
//   5. Sinon seulement : génération (verrouillée, 1 retry max, plafond
//      quotidien, jamais deux fois le même visual_key en parallèle).
//
// Sécurité : OPENAI_API_KEY n'est lue que côté serveur (secret Supabase),
// jamais transmise au frontend. Déployer avec :
//   supabase functions deploy generate-catalog-image
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase secrets set IMAGE_GENERATION_MODEL=gpt-image-1   (optionnel, défaut ci-dessous)
//   supabase secrets set IMAGE_GENERATION_QUALITY=low          (optionnel, défaut ci-dessous)
//   supabase secrets set MAX_IMAGE_GENERATIONS_PER_DAY=50      (optionnel, défaut ci-dessous)
//
// ⚠️ Compression WebP (toWebp ci-dessous) : tentée via @jsquash/webp (WASM),
// mais jamais vérifiée en conditions réelles depuis ce sandbox (pas de Deno
// installé, pas d'accès réseau à esm.sh) — repli automatique et silencieux
// sur PNG brut (1024×1024) si la conversion échoue pour une raison
// quelconque, la génération n'est jamais bloquée par cette étape. À
// vérifier en premier après le tout premier appel réel : si le fichier
// dans Storage se termine en .png plutôt qu'en .webp, la conversion n'a
// pas fonctionné (l'affichage reste correct dans les deux cas).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildImagePrompt, CATEGORY_CANON, CATEGORY_FOLDER, type TrendRule, type VestiaireRow } from "../_shared/imagePrompt.ts";
import { computeVisualKey, normalizeVisualColor, normalizeVisualSubtype } from "../_shared/visualKey.ts";

const BUCKET = "catalog-images";
// Catégories où le rendu visuel ne dépend pas vraiment du genre affiché —
// seules celles-ci peuvent bénéficier du repli de cascade sans genre
// (correctif 20/08/2026, cf. step 4 ci-dessous). Tout le reste (vêtements,
// chaussures) a une coupe/silhouette qui diffère réellement selon le genre.
const GENRE_AGNOSTIC_CATEGORIES = new Set(["sac", "bijou", "accessoire"]);
const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_QUALITY = "low";
const DEFAULT_DAILY_CAP = 50;
// Coût approximatif par image (gpt-image-1, qualité basse, 1024x1024) — pour le monitoring uniquement, jamais utilisé pour bloquer/facturer.
const ESTIMATED_COST_USD = 0.02;

interface ArticleRow {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  matiere: string | null;
  genre: string | null;
  coupe: string | null;
  visual_asset_id: number | null;
  niveau_tendance: string | null;
  silhouette_mode: string | null;
  details_mode: string | null;
  prompt_image_override: string | null;
}

interface TrendRuleRow {
  sous_type: string | null;
  genre: string | null;
  annee: number | null;
  silhouette: string | null;
  coupes: string | null;
  matieres: string | null;
  details: string | null;
  elements_a_eviter: string | null;
}

interface AssetRow {
  id: number;
  visual_key: string;
  image_url: string | null;
  image_status: string;
  image_source: string | null;
  prompt: string | null;
  usage_count: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("IMAGE_GENERATION_MODEL") || DEFAULT_MODEL;
  const quality = Deno.env.get("IMAGE_GENERATION_QUALITY") || DEFAULT_QUALITY;
  const dailyCap = Number(Deno.env.get("MAX_IMAGE_GENERATIONS_PER_DAY")) || DEFAULT_DAILY_CAP;

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Configuration serveur incomplète (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).", 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let itemId: number;
  let forceRegenerate = false;
  try {
    const body = await req.json();
    itemId = Number(body.item_id);
    forceRegenerate = body.force_regenerate === true;
    if (!Number.isFinite(itemId)) throw new Error("item_id invalide");
  } catch {
    return jsonError("item_id manquant ou invalide.", 400);
  }

  const { data: article, error: fetchError } = await supabase
    .from("vestiaire_universel")
    .select(
      "id, name, category, sous_type, couleur_dominante, matiere, genre, coupe, visual_asset_id, niveau_tendance, silhouette_mode, details_mode, prompt_image_override"
    )
    .eq("id", itemId)
    .maybeSingle<ArticleRow>();

  if (fetchError || !article) {
    return jsonError("Article introuvable.", 404);
  }

  // 1. L'article a-t-il déjà un asset prêt ? (jamais de régénération auto si ready, sauf force_regenerate admin)
  if (article.visual_asset_id && !forceRegenerate) {
    const { data: existingAsset } = await supabase
      .from("visual_assets")
      .select("id, visual_key, image_url, image_status, image_source, prompt, usage_count")
      .eq("id", article.visual_asset_id)
      .maybeSingle<AssetRow>();

    if (existingAsset?.image_status === "ready" && existingAsset.image_url) {
      await touchAsset(supabase, existingAsset);
      await mirrorToArticle(supabase, article.id, existingAsset);
      return jsonOk({ image_url: existingAsset.image_url });
    }
    if (existingAsset?.image_status === "generating") {
      // Quelqu'un d'autre génère déjà ce même asset — on attend, placeholder côté client.
      return jsonOk({ image_url: null, status: "generating" });
    }
    // 'error' ou 'missing' : retente ci-dessous (cascade + génération), même asset réutilisé.
  }

  // Catégorie strictement mappée — jamais de repli silencieux sur
  // "accessoire" (correctif 18/08/2026 v2) : un article dont la catégorie
  // brute ne correspond à aucune entrée connue de CATEGORY_CANON tombait
  // auparavant dans le seau générique "accessoire", où il pouvait entrer en
  // collision de visual_key (et donc de visuel réutilisé) avec des articles
  // d'une tout autre nature (pantalon de jogging, short, lunettes se
  // partageant la même image). Un repli implicite est toujours plus
  // dangereux ici qu'un échec explicite et loggé.
  const rawCategory = (article.category || "").trim().toLowerCase();
  const canonCategory = CATEGORY_CANON[rawCategory];
  if (!canonCategory) {
    const message = `Catégorie inconnue : "${article.category ?? ""}" (article ${article.id}) ne correspond à aucune entrée de CATEGORY_CANON. Génération annulée avant tout appel API.`;
    console.error(JSON.stringify({ item_id: article.id, name: article.name, raw_category: article.category, error: message }));
    await supabase.from("vestiaire_universel").update({ image_status: "error" }).eq("id", article.id);
    return jsonError(message, 422);
  }

  const genreRaw = (article.genre || "").trim().toLowerCase();
  const genre = genreRaw === "femme" ? "femme" : genreRaw === "homme" ? "homme" : "unisexe";
  const sousTypeNorm = normalizeVisualSubtype(article.sous_type);
  const couleurNorm = normalizeVisualColor(article.couleur_dominante);
  const visualKey = computeVisualKey({
    genre,
    category: canonCategory,
    sousType: article.sous_type,
    couleur: article.couleur_dominante,
    matiere: article.matiere,
    coupe: article.coupe,
  });

  // Design "bespoke" (override ou silhouette/details explicites, recette
  // 19/08/2026) : un asset issu de ces champs est propre à CET article et ne
  // doit jamais être proposé à un autre article via la cascade générique
  // (steps 3/4 ci-dessous, indexés sur genre/sous_type/couleur seuls, pas sur
  // visual_key) — ni l'inverse (cet article ne doit jamais hériter d'un
  // asset générique existant). Un marqueur dans le visual_key (jamais
  // produit par computeVisualKey en temps normal) sert à exclure ces assets
  // de la recherche générique, sans toucher à la clé visuelle standard.
  const bespokeMarker = article.prompt_image_override?.trim()
    ? `~ov~${shortHash(article.prompt_image_override.trim())}`
    : article.silhouette_mode?.trim() || article.details_mode?.trim()
    ? `~bp~${shortHash(`${article.silhouette_mode || ""}|${article.details_mode || ""}`)}`
    : "";
  const isBespoke = Boolean(bespokeMarker);
  const effectiveVisualKey = isBespoke ? `${visualKey}${bespokeMarker}` : visualKey;

  // Niveau de tendance normalisé (recette 20/08/2026, correctif) — sert à
  // exclure de la cascade générique les assets qui ne correspondent pas au
  // niveau demandé, pour qu'un article nouvellement marqué "tendance" (ou
  // "intemporel") ne retombe jamais silencieusement sur un ancien visuel
  // "contemporain" déjà en cache sans jamais rappeler OpenAI.
  const niveauTendanceRaw = (article.niveau_tendance || "").trim().toLowerCase();
  const niveauTendance = niveauTendanceRaw === "tendance" || niveauTendanceRaw === "intemporel" ? niveauTendanceRaw : "contemporain";

  try {
    // 2. Exact visual_key, prêt. category contrainte aussi ici en défense en
    // profondeur (correctif 18/08/2026 v2) : la clé exacte inclut déjà la
    // catégorie par construction, mais si deux clés dégénèrent malgré tout
    // vers la même valeur (données sources incomplètes), ce filtre
    // supplémentaire empêche toute réutilisation cross-catégorie. Clé
    // "bespoke" incluse ici : ne matche que si CET article a déjà généré
    // exactement ce même design par le passé (cache légitime, pas de fuite).
    let reusable = await findReadyAsset(supabase, {
      visual_key: effectiveVisualKey,
      category: canonCategory,
      niveauTendance,
    });
    // 3-4. Cascade générique (genre+sous_type+couleur, puis sous_type+couleur
    // seuls) — jamais pour un article bespoke (recette 19/08/2026) : un
    // design personnalisé (override/silhouette_mode/details_mode) ne doit
    // jamais hériter d'un asset générique existant, ni être proposé à
    // d'autres articles (excludeBespoke exclut symétriquement tout asset
    // bespoke des résultats, y compris pour les recherches génériques
    // futures d'autres articles). niveauTendance (correctif 20/08/2026) :
    // idem pour la tendance — jamais hériter d'un asset "contemporain" déjà
    // en cache quand l'article vient d'être marqué "tendance"/"intemporel".
    if (!reusable && !isBespoke) {
      reusable = await findReadyAsset(supabase, {
        category: canonCategory,
        genre,
        sous_type: sousTypeNorm,
        couleur: couleurNorm,
        excludeBespoke: true,
        niveauTendance,
      });
    }
    // Le repli sans genre (step 4) ne vaut que pour les catégories dont le
    // rendu visuel ne dépend pas vraiment du genre affiché (sac/bijou/
    // accessoire) — correctif 20/08/2026 : sans cette restriction, un
    // article "homme" pouvait silencieusement hériter de la photo d'un
    // article "femme" du même sous-type/couleur (constaté sur une chemise
    // homme récupérant le visuel de la version femme), alors que la coupe
    // d'un vêtement diffère réellement selon le genre.
    if (!reusable && !isBespoke && GENRE_AGNOSTIC_CATEGORIES.has(canonCategory)) {
      reusable = await findReadyAsset(supabase, {
        category: canonCategory,
        sous_type: sousTypeNorm,
        couleur: couleurNorm,
        excludeBespoke: true,
        niveauTendance,
      });
    }
    if (reusable) {
      await touchAsset(supabase, reusable);
      await mirrorToArticle(supabase, article.id, reusable);
      return jsonOk({ image_url: reusable.image_url });
    }

    // 5. Aucune source réutilisable — génération, en dernier recours seulement.
    if (!openaiKey) throw new Error("OPENAI_API_KEY absente des secrets Supabase.");

    // Verrou logique atomique : réutilise une ligne existante pour cette
    // visual_key exacte (statut missing/error) si elle existe déjà, sinon en
    // crée une. `.neq('image_status','generating')` empêche deux requêtes
    // concurrentes de lancer deux générations pour le même visual_key.
    const { data: priorRow } = await supabase
      .from("visual_assets")
      .select("id, image_status")
      .eq("visual_key", effectiveVisualKey)
      .maybeSingle<{ id: number; image_status: string }>();

    let assetId: number;
    if (priorRow) {
      if (priorRow.image_status === "generating") {
        return jsonOk({ image_url: null, status: "generating" });
      }
      const { data: claimed } = await supabase
        .from("visual_assets")
        .update({
          image_status: "generating",
          genre,
          category: canonCategory,
          sous_type: sousTypeNorm,
          couleur: couleurNorm,
          matiere: article.matiere,
          niveau_tendance: niveauTendance,
          generation_model: model,
          generation_quality: quality,
        })
        .eq("id", priorRow.id)
        .neq("image_status", "generating")
        .select("id")
        .maybeSingle<{ id: number }>();
      if (!claimed) return jsonOk({ image_url: null, status: "generating" });
      assetId = claimed.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("visual_assets")
        .insert({
          visual_key: effectiveVisualKey,
          genre,
          category: canonCategory,
          sous_type: sousTypeNorm,
          couleur: couleurNorm,
          matiere: article.matiere,
          niveau_tendance: niveauTendance,
          image_status: "generating",
          generation_model: model,
          generation_quality: quality,
        })
        .select("id")
        .maybeSingle<{ id: number }>();
      if (insertError || !inserted) {
        // Course avec une autre requête concurrente sur le même visual_key (contrainte unique) — laisse cette autre requête générer.
        return jsonOk({ image_url: null, status: "generating" });
      }
      assetId = inserted.id;
    }

    // Plafond quotidien — jamais d'appel API au-delà, jamais de recommandation cassée.
    const sinceMidnight = new Date();
    sinceMidnight.setUTCHours(0, 0, 0, 0);
    const { count: generatedToday } = await supabase
      .from("image_generation_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceMidnight.toISOString());

    if ((generatedToday ?? 0) >= dailyCap) {
      await supabase.from("image_generation_logs").insert({
        visual_key: effectiveVisualKey,
        model,
        quality,
        success: false,
        estimated_cost: 0,
        error: "daily_limit_reached",
      });
      // Repli à 'missing' (pas 'error') : un prochain jour retentera normalement, sans forcer une intervention manuelle.
      await supabase.from("visual_assets").update({ image_status: "missing" }).eq("id", assetId);
      return jsonOk({ image_url: null, status: "missing", error: "daily_limit_reached" });
    }

    // Règle de tendances_mode la plus pertinente (recette 19/08/2026) —
    // seulement si un override total n'est pas déjà présent (celui-ci
    // remplace le bloc design en entier, la tendance ne serait pas utilisée).
    let trend: TrendRule | null = null;
    if (!article.prompt_image_override?.trim()) {
      trend = await findTrendRule(supabase, {
        categorie: canonCategory,
        sousType: article.sous_type,
        genre,
        annee: new Date().getFullYear(),
      });
    }

    const built = buildImagePrompt(
      {
        id: article.id,
        name: article.name,
        category: article.category,
        sous_type: article.sous_type,
        couleur_dominante: article.couleur_dominante,
        matiere: article.matiere,
        genre: article.genre,
        coupe: article.coupe,
        niveau_tendance: article.niveau_tendance,
        silhouette_mode: article.silhouette_mode,
        details_mode: article.details_mode,
        prompt_image_override: article.prompt_image_override,
      } satisfies VestiaireRow,
      trend
    );

    // Logs de debug (correctif 18/08/2026) — visibles dans Supabase Dashboard
    // → Edge Functions → generate-catalog-image → Logs, sans terminal.
    console.log(
      JSON.stringify({
        item_id: article.id,
        name: article.name,
        category: article.category,
        sous_type: article.sous_type,
        genre: article.genre,
        couleur_dominante: article.couleur_dominante,
        matiere: article.matiere,
        visual_key: effectiveVisualKey,
        niveau_tendance: article.niveau_tendance || "contemporain",
        trend_matched: Boolean(trend),
        is_bespoke: isBespoke,
        prompt_noun: built.noun,
        prompt_ok: built.ok,
        storage_path: `${genre}/${CATEGORY_FOLDER[canonCategory] || canonCategory}/${assetId}.webp`,
      })
    );

    // Validation de cohérence catégorie/sujet (correctif 18/08/2026) : si le
    // sujet déterminé pour le prompt n'est pas compatible avec la
    // catégorie de l'article, on n'appelle JAMAIS l'API — mieux vaut
    // aucune image qu'une image du mauvais type de vêtement.
    if (!built.ok) {
      throw new Error(
        `Incohérence catégorie/sujet : category="${canonCategory}" mais sujet déterminé="${built.noun}". Génération annulée avant tout appel API.`
      );
    }
    const prompt = built.prompt;

    // 6-7. Génération avec 1 retry automatique maximum.
    let pngBytes: Uint8Array | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 2 && !pngBytes; attempt++) {
      try {
        pngBytes = await callImageApi(openaiKey, model, quality, prompt);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    if (!pngBytes) throw new Error(lastError || "Échec de génération après 1 tentative supplémentaire.");

    // Compression WebP best-effort — repli silencieux sur PNG brut si indisponible.
    const { bytes, contentType, ext } = await toWebp(pngBytes);

    // 8. Upload Storage — un seul fichier par asset (pas par article).
    const path = `${genre}/${CATEGORY_FOLDER[canonCategory] || canonCategory}/${assetId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw new Error(`Échec upload Storage : ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = publicUrlData.publicUrl;

    // 9. Ligne asset -> ready.
    await supabase
      .from("visual_assets")
      .update({
        image_url: imageUrl,
        image_source: "generated",
        image_status: "ready",
        prompt,
        generation_model: model,
        generation_quality: quality,
        usage_count: 1,
      })
      .eq("id", assetId);

    await supabase.from("image_generation_logs").insert({
      visual_key: effectiveVisualKey,
      model,
      quality,
      success: true,
      estimated_cost: ESTIMATED_COST_USD,
    });

    await mirrorToArticle(supabase, article.id, {
      id: assetId,
      image_url: imageUrl,
      image_status: "ready",
      image_source: "generated",
      prompt,
    });

    return jsonOk({ image_url: imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    await supabase.from("visual_assets").update({ image_status: "error" }).eq("visual_key", effectiveVisualKey);
    await supabase
      .from("vestiaire_universel")
      .update({ image_status: "error" })
      .eq("id", article.id);
    await supabase.from("image_generation_logs").insert({
      visual_key: effectiveVisualKey,
      model,
      quality,
      success: false,
      estimated_cost: 0,
      error: message,
    });
    return jsonError(message, 500);
  }
});

/** Cherche un asset prêt correspondant aux critères donnés (filtre partiel — seuls les champs fournis sont contraints). */
async function findReadyAsset(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  criteria: Partial<Pick<AssetRow, "visual_key">> & {
    category?: string;
    genre?: string;
    sous_type?: string;
    couleur?: string;
    // Exclut les assets "bespoke" (override/silhouette_mode/details_mode,
    // recette 19/08/2026) — leur visual_key porte un marqueur ~ov~/~bp~
    // (cf. bespokeMarker) — de la cascade générique : un design personnalisé
    // pour UN article ne doit jamais être hérité par un autre.
    excludeBespoke?: boolean;
    // Niveau de tendance de L'ARTICLE courant (recette 20/08/2026, correctif) —
    // "contemporain" (par défaut) matche aussi bien les anciens assets jamais
    // renseignés (niveau_tendance NULL) que les nouveaux explicitement
    // "contemporain" : comportement identique à avant l'introduction du
    // système de tendance. "tendance"/"intemporel" ne matche en revanche QUE
    // les assets explicitement au même niveau — jamais un ancien asset
    // générique, pour qu'un article nouvellement marqué régénère vraiment.
    niveauTendance?: string;
  }
): Promise<AssetRow | null> {
  let query = supabase
    .from("visual_assets")
    .select("id, visual_key, image_url, image_status, image_source, prompt, usage_count")
    .eq("image_status", "ready")
    .not("image_url", "is", null);
  if (criteria.visual_key) query = query.eq("visual_key", criteria.visual_key);
  // category n'est jamais optionnelle en dehors de la clé exacte (correctif
  // 18/08/2026) : jamais de réutilisation cross-catégorie (veste -> pantalon,
  // haut -> robe, chaussures -> sac), cohérence du produit avant économie.
  if (criteria.category) query = query.eq("category", criteria.category);
  if (criteria.genre) query = query.eq("genre", criteria.genre);
  if (criteria.sous_type) query = query.eq("sous_type", criteria.sous_type);
  if (criteria.couleur) query = query.eq("couleur", criteria.couleur);
  if (criteria.excludeBespoke) query = query.not("visual_key", "like", "%~ov~%").not("visual_key", "like", "%~bp~%");
  if (criteria.niveauTendance === "tendance" || criteria.niveauTendance === "intemporel") {
    query = query.eq("niveau_tendance", criteria.niveauTendance);
  }
  const { data } = await query.limit(1).maybeSingle();
  return (data as AssetRow | null) ?? null;
}

/** Hash court et déterministe (FNV-1a) — distingue deux designs bespoke différents dans une clé visuelle, jamais un usage cryptographique. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Règle de tendances_mode la plus pertinente pour une famille de vêtement
 * (categorie/sous_type/genre/année, recette 19/08/2026) — matching en code
 * plutôt qu'en SQL complexe (peu de lignes attendues, table volontairement
 * légère). Privilégie une correspondance exacte de sous_type ; à défaut,
 * retombe sur une règle générique de la categorie (sous_type NULL en base).
 * Ne fait jamais échouer la génération : retourne simplement null si rien
 * de pertinent n'est trouvé.
 */
async function findTrendRule(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: { categorie: string; sousType: string | null; genre: string; annee: number }
): Promise<TrendRule | null> {
  const { data } = await supabase
    .from("tendances_mode")
    .select("sous_type, genre, annee, silhouette, coupes, matieres, details, elements_a_eviter")
    .eq("actif", true)
    .eq("categorie", params.categorie);
  const rows = (data as TrendRuleRow[] | null) || [];
  if (!rows.length) return null;

  const genreOk = (g: string | null) => !g || g === params.genre || g === "unisexe";
  const anneeOk = (a: number | null) => a === null || a === undefined || a <= params.annee;
  const candidates = rows.filter((r) => genreOk(r.genre) && anneeOk(r.annee));
  if (!candidates.length) return null;

  // Priorité sous_type exact ; à défaut, règle générique de la catégorie (sous_type NULL en base).
  const sousTypeNorm = (params.sousType || "").trim().toLowerCase();
  const exact = sousTypeNorm ? candidates.filter((r) => (r.sous_type || "").trim().toLowerCase() === sousTypeNorm) : [];
  const pool = exact.length ? exact : candidates.filter((r) => !r.sous_type);
  if (!pool.length) return null;

  // La plus récente d'abord, puis le genre le plus spécifique (femme/homme avant unisexe/générique).
  pool.sort((a, b) => {
    const yearDiff = (b.annee ?? 0) - (a.annee ?? 0);
    if (yearDiff !== 0) return yearDiff;
    const specA = a.genre === params.genre ? 0 : 1;
    const specB = b.genre === params.genre ? 0 : 1;
    return specA - specB;
  });
  return pool[0];
}

/** Incrémente usage_count — chaque réutilisation compte, chaque génération initiale aussi (déjà mise à 1 à la création). */
// deno-lint-ignore no-explicit-any
async function touchAsset(supabase: any, asset: AssetRow): Promise<void> {
  await supabase
    .from("visual_assets")
    .update({ usage_count: (asset.usage_count ?? 0) + 1 })
    .eq("id", asset.id);
}

/** Reflète l'asset résolu sur la ligne article — cache dénormalisé lu directement par le frontend (aucun changement requis côté app). */
async function mirrorToArticle(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  articleId: number,
  asset: Pick<AssetRow, "id" | "image_url" | "image_status" | "image_source" | "prompt">
): Promise<void> {
  await supabase
    .from("vestiaire_universel")
    .update({
      visual_asset_id: asset.id,
      url_image: asset.image_url,
      image_status: asset.image_status,
      image_source: asset.image_source,
      image_prompt: asset.prompt,
      image_generated_at: new Date().toISOString(),
      image_version: 1,
    })
    .eq("id", articleId);
}

async function callImageApi(apiKey: string, model: string, quality: string, prompt: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    // background/output_format : fond transparent si le modèle le permet
    // (gpt-image-1) — préservé en PNG pour que la conversion WebP en aval
    // garde le canal alpha. Repli sur fond ivoire côté frontend si jamais
    // le modèle utilisé ne supporte pas ces deux paramètres (ignorés sans
    // erreur par l'API dans ce cas).
    body: JSON.stringify({ model, prompt, size: "1024x1024", quality, n: 1, background: "transparent", output_format: "png" }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échec génération image (${res.status}) : ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Réponse OpenAI sans image (b64_json manquant).");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Conversion WebP best-effort via @jsquash/webp (WASM) — jamais vérifiée
 * depuis ce sandbox (pas de Deno/réseau ici). Repli automatique et
 * silencieux sur le PNG brut si la conversion échoue pour une raison
 * quelconque : ne bloque jamais la génération.
 */
async function toWebp(pngBytes: Uint8Array): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  try {
    const { default: decode } = await import("https://esm.sh/@jsquash/png@2.1.0/decode.js");
    const { default: encode } = await import("https://esm.sh/@jsquash/webp@1.4.0/encode.js");
    const imageData = await decode(pngBytes.buffer as ArrayBuffer);
    const webpBuffer = await encode(imageData, { quality: 75 });
    return { bytes: new Uint8Array(webpBuffer), contentType: "image/webp", ext: "webp" };
  } catch (err) {
    console.error("Conversion WebP indisponible, repli sur PNG brut :", err);
    return { bytes: pngBytes, contentType: "image/png", ext: "png" };
  }
}

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
