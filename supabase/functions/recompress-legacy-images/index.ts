// Recompression du stock hérité de visuels PNG — fonction de maintenance,
// à usage unique, destinée à être supprimée une fois le stock épuisé.
//
// POURQUOI
// Relevé du 26/08/2026 : Cached Egress à 9,78 Go pour un quota Free de 5 Go
// (196 %), période de grâce jusqu'au 22/09/2026 après laquelle les requêtes
// du projet renvoient 402. Cause : 361 visual_assets pointent encore vers un
// PNG 1024×1024 non compressé (~650 Ko) généré avant le correctif du
// 21/08/2026, contre ~50 Ko pour un WebP 800×800. Facteur ~13.
//
// CE QU'ELLE FAIT
// Pour chaque asset dont image_url finit en .png : télécharge le fichier,
// le repasse dans toWebp (le MÊME code que la génération, cf.
// ../_shared/webp.ts), téléverse le WebP, met à jour image_url.
//
// CE QU'ELLE NE FAIT PAS, VOLONTAIREMENT
// - aucun appel à OpenAI : on recompresse l'image existante, on ne la
//   régénère pas. Coût nul, et le visuel reste rigoureusement le même ;
// - aucune suppression : le PNG d'origine reste dans le bucket. Le nettoyage
//   des orphelins est une étape séparée, la seule irréversible ;
// - aucun autre champ que image_url n'est écrit (updated_at bouge seul, via
//   le trigger de la table).
//
// PRÉREQUIS
// Un secret RECOMPRESS_ADMIN_KEY dans Settings > Edge Functions > Secrets,
// avec pour valeur une chaîne aléatoire quelconque. Ce n'est PAS une clé
// d'API Supabase : elle ne sert qu'à cette fonction et ne donne accès à rien
// d'autre. Sans ce secret, la fonction répond 503.
//
// APPEL
// Depuis le panneau de test du tableau de bord (Edge Functions > cette
// fonction > Test), méthode POST, corps :
//   {"admin_key": "<valeur du secret>", "dry_run": true}
//
// En ligne de commande, la clé peut aussi passer par l'en-tête :
//   curl -X POST \
//     'https://<ref>.supabase.co/functions/v1/recompress-legacy-images' \
//     -H "Authorization: Bearer $RECOMPRESS_ADMIN_KEY" \
//     -H 'Content-Type: application/json' \
//     -d '{"limit": 25}'
//
// Corps accepté : { admin_key?: string, limit?: number, dry_run?: boolean }.
// Idempotente : une ligne convertie ne finit plus en .png, donc un second
// appel ne la reprend pas. Relancer jusqu'à ce que `restants` vaille 0.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { toWebp } from "../_shared/webp.ts";
import { ADMIN_KEY_MISSING, getAdminKey, getAdminKeySource } from "../_shared/adminKey.ts";

const BUCKET = "catalog-images";
// Chaque image coûte un décodage PNG + un redimensionnement + un encodage
// WebP, tous en WASM, donc du calcul pur — c'est exactement ce que le budget
// CPU d'une invocation Edge limite.
//
// Mesuré le 28/08/2026 : un lot de 5 s'interrompt sur WORKER_RESOURCE_LIMIT
// après avoir converti 3 images ; un lot de 1 passe confortablement. Le
// plafond réel est donc de 3. On s'arrête à 2 par défaut pour garder une
// marge — un PNG plus lourd que la moyenne coûte davantage, et un lot
// interrompu gaspille le travail déjà calculé pour l'image en cours.
//
// Le plafond dur reste bas pour la même raison : au-delà, l'appel échoue
// systématiquement. Passer à l'échelle se fait en enchaînant les appels
// (cf. .github/workflows/recompress-legacy-images.yml), pas en grossissant
// les lots.
const DEFAULT_LIMIT = 2;
const MAX_LIMIT = 5;

interface AssetRow {
  id: number;
  visual_key: string;
  image_url: string;
}

interface Echec {
  id: number;
  visual_key: string;
  raison: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: ADMIN_KEY_MISSING }, 500);
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // Garde d'accès : cette fonction réécrit image_url sur des centaines de
  // lignes, elle ne doit pas être appelable depuis l'app — la clé anon suffit
  // à passer la vérification de jeton de Supabase, elle ne protège rien ici.
  //
  // Le mot de passe est un secret DÉDIÉ, RECOMPRESS_ADMIN_KEY, et surtout pas
  // la clé service_role (correctif 27/08/2026, après que cette dernière a dû
  // être collée dans le panneau de test du tableau de bord puis révoquée) :
  //  - un secret dédié ne donne accès qu'à cette fonction, alors qu'une clé
  //    service_role divulguée ouvre la totalité de la base ;
  //  - il se change en une ligne, sans rien casser ailleurs ;
  //  - il survit à toute rotation des clés d'API du projet.
  //
  // Il se pose une fois : Settings > Edge Functions > Secrets, avec pour
  // valeur une chaîne aléatoire quelconque. Passé dans le corps sous
  // admin_key, parce que le panneau de test impose son propre en-tête
  // Authorization sans toujours permettre de le remplacer ; l'en-tête reste
  // accepté pour un appel en ligne de commande.
  const adminKey = Deno.env.get("RECOMPRESS_ADMIN_KEY");
  if (!adminKey) {
    return json(
      { error: "Secret RECOMPRESS_ADMIN_KEY absent : à définir dans Settings > Edge Functions > Secrets." },
      503
    );
  }
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const fournie = typeof body.admin_key === "string" ? body.admin_key.trim() : bearer;
  if (fournie !== adminKey) {
    return json({ error: "Clé d'administration invalide (champ admin_key du corps, ou en-tête Authorization)." }, 403);
  }

  let limit = DEFAULT_LIMIT;
  if (body.limit !== undefined) {
    const n = Number(body.limit);
    if (!Number.isFinite(n) || n < 1) {
      return json({ error: "limit invalide : entier positif attendu." }, 400);
    }
    limit = Math.min(Math.floor(n), MAX_LIMIT);
  }
  const dryRun = body.dry_run === true;

  // Curseur : ne considérer que les assets d'id strictement supérieur.
  // Indispensable pour enjamber une image que la fonction n'arrive pas à
  // traiter (relevé du 28/08/2026 : une image sature le budget CPU même
  // seule, et la sélection étant ordonnée par id, chaque appel suivant
  // retombait dessus — le traitement s'arrêtait définitivement à cet endroit).
  let apresId = 0;
  if (body.apres_id !== undefined) {
    const n = Number(body.apres_id);
    if (!Number.isFinite(n) || n < 0) {
      return json({ error: "apres_id invalide : entier positif ou nul attendu." }, 400);
    }
    apresId = Math.floor(n);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Deux comptes, volontairement distincts :
  //  - restants        : tous les PNG du catalogue, la mesure qui a du sens
  //                      pour un humain, curseur ou pas ;
  //  - restants_a_traiter : ceux situés après le curseur, ce qui pilote la
  //                      boucle appelante. L'écart entre les deux, en fin de
  //                      parcours, ce sont exactement les images enjambées.
  const { count: restantsAvant, error: countErr } = await supabase
    .from("visual_assets")
    .select("id", { count: "exact", head: true })
    .like("image_url", "%.png");
  if (countErr) {
    return json({ error: `Comptage impossible : ${countErr.message}` }, 500);
  }

  const { count: restantsApresCurseur, error: countCurseurErr } = await supabase
    .from("visual_assets")
    .select("id", { count: "exact", head: true })
    .like("image_url", "%.png")
    .gt("id", apresId);
  if (countCurseurErr) {
    return json({ error: `Comptage impossible : ${countCurseurErr.message}` }, 500);
  }

  const { data: assets, error: selectErr } = await supabase
    .from("visual_assets")
    .select("id, visual_key, image_url")
    .like("image_url", "%.png")
    .gt("id", apresId)
    .order("id", { ascending: true })
    .limit(limit)
    .returns<AssetRow[]>();
  if (selectErr) {
    return json({ error: `Sélection impossible : ${selectErr.message}` }, 500);
  }

  if (!assets || assets.length === 0) {
    return json({
      traites: 0,
      convertis: 0,
      echecs: [],
      restants: restantsAvant ?? 0,
      restants_a_traiter: 0,
      dernier_id: apresId,
      message: "Plus aucun PNG à recompresser après ce curseur.",
    });
  }

  // Plus grand id du lot tenté — le curseur que l'appelant reprendra, qu'une
  // image ait été convertie ou non. C'est ce qui garantit l'avancée même
  // quand une image échoue.
  const dernierId = assets[assets.length - 1].id;

  if (dryRun) {
    return json({
      dry_run: true,
      cle_utilisee: getAdminKeySource(),
      restants: restantsAvant ?? 0,
      restants_a_traiter: restantsApresCurseur ?? 0,
      dernier_id: dernierId,
      lot: assets.map((a) => ({ id: a.id, visual_key: a.visual_key, chemin: cheminDepuisUrl(a.image_url) })),
    });
  }

  const echecs: Echec[] = [];
  let convertis = 0;
  let octetsAvant = 0;
  let octetsApres = 0;

  for (const asset of assets) {
    const chemin = cheminDepuisUrl(asset.image_url);
    if (!chemin) {
      echecs.push({ id: asset.id, visual_key: asset.visual_key, raison: `URL non reconnue : ${asset.image_url}` });
      continue;
    }

    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(chemin);
      if (dlErr || !blob) throw new Error(`téléchargement : ${dlErr?.message ?? "réponse vide"}`);

      const pngBytes = new Uint8Array(await blob.arrayBuffer());
      const { bytes, contentType, ext } = await toWebp(pngBytes);

      // Repli déclenché : toWebp a rendu le PNG d'origine. On ne réécrit
      // rien — remplacer un PNG par le même PNG ne ferait que créer un
      // orphelin de plus, et masquerait le problème derrière un succès.
      if (ext !== "webp") {
        throw new Error("compression WebP indisponible (repli sur PNG) — asset laissé intact");
      }
      if (bytes.length >= pngBytes.length) {
        throw new Error(`WebP (${bytes.length} o) pas plus léger que l'original (${pngBytes.length} o) — asset laissé intact`);
      }

      const nouveauChemin = `${chemin.replace(/\.png$/i, "")}.webp`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(nouveauChemin, bytes, { contentType, upsert: true, cacheControl: "31536000" });
      if (upErr) throw new Error(`téléversement : ${upErr.message}`);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nouveauChemin);
      const nouvelleUrl = urlData.publicUrl;

      const { error: updErr } = await supabase
        .from("visual_assets")
        .update({ image_url: nouvelleUrl })
        .eq("id", asset.id);
      if (updErr) throw new Error(`mise à jour de la ligne : ${updErr.message}`);

      convertis++;
      octetsAvant += pngBytes.length;
      octetsApres += bytes.length;
    } catch (err) {
      echecs.push({
        id: asset.id,
        visual_key: asset.visual_key,
        raison: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({
    traites: assets.length,
    convertis,
    echecs,
    restants: Math.max((restantsAvant ?? 0) - convertis, 0),
    restants_a_traiter: Math.max((restantsApresCurseur ?? 0) - assets.length, 0),
    dernier_id: dernierId,
    octets_avant: octetsAvant,
    octets_apres: octetsApres,
    gain: octetsAvant > 0 ? `${Math.round((1 - octetsApres / octetsAvant) * 100)} %` : null,
  });
});

/**
 * Extrait le chemin interne au bucket depuis une URL publique Supabase, de
 * la forme https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<chemin>.
 * Les segments sont ré-encodés à l'écriture par le client Storage, il faut
 * donc les décoder ici — un dossier ou un nom accentué casserait sinon le
 * téléchargement.
 */
function cheminDepuisUrl(url: string): string | null {
  const marqueur = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marqueur);
  if (i === -1) return null;
  const brut = url.slice(i + marqueur.length).split("?")[0];
  if (!brut) return null;
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
