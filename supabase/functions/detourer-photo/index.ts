// Edge Function detourer-photo (04/10/2026) — retire le fond de la photo d'une pièce du dressing, pour que les pièces
// de la personne se mêlent aux visuels détourés du catalogue dans les compositions de tenue.
//
// Le service est Photoroom (« Remove Background »), appelé depuis ce seul fichier (via _shared/detourage.ts) : la clé
// ne quitte jamais le serveur. Elle se pose dans Edge Functions → Secrets sous le nom PHOTOROOM_API_KEY. Sans elle,
// la fonction répond « non_configure » et l'app garde la photo d'origine — jamais un blocage de l'ajout d'une pièce.
//
// Entrée : { photo_url: string } — URL signée du bucket dressing-photos (celle que uploadDressingPhoto renvoie),
// jamais une blob: URL. La photo d'origine n'est JAMAIS effacée ici : si la personne enregistre sa pièce pendant le
// détourage, elle porte encore l'original. C'est l'app qui l'efface, quand le détourage remplace bien sa photo.
//
// Entrée facultative : `mode: "mise_a_plat"` (10/10/2026) — pièce PORTÉE : mise à plat par Photoroom (Flat Lay, plan Plus), puis
// détourée ; fichier `….detouree.plat.webp`, plafond du jour à part (MAX_MISES_A_PLAT_PER_USER_PER_DAY, 5 par défaut).
//
// Sortie : { ok: true, photo_url } — URL signée du fichier détouré, WebP à fond transparent, au même dossier ; ou
// { ok: false, code } (cf. CodeErreurDetourage et « quota_atteint »). Le fichier détouré porte « .detouree. » dans son
// nom : c'est cette marque, et non une colonne, qui dit à l'app qu'une photo est détourée (aucune migration).
//
// Protection (comme analyze-dressing-photo, cf. _shared/protection.ts) : une personne connectée ; une photo qui est
// la SIENNE ; un plafond par compte et par jour — un détourage est un appel payant. La clé privilégiée passe, sans
// quota, pour les essais.
//
// Déploiement : par le workflow « Déployer les fonctions Supabase » (fusion dans main, dossier supabase/functions/),
// ou `supabase functions deploy detourer-photo`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import {
  cheminDansLeBucket,
  cheminDetoure,
  cheminMisAPlat,
  detourerAvecFournisseur,
  estPhotoDetouree,
  LIMITE_JOURNALIERE_PAR_DEFAUT,
  LIMITE_MISES_A_PLAT_PAR_DEFAUT,
  mettreAPlatAvecFournisseur,
  TAILLE_SOURCE_MAX_OCTETS,
  type CodeErreurDetourage,
} from "../_shared/detourage.ts";
import {
  authentifier,
  consommerQuota,
  estAppelantAdmin,
  jetonDepuisEntete,
  limiteDepuisEnv,
  urlPhotoAutorisee,
} from "../_shared/protection.ts";
import { toWebp } from "../_shared/webp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DUREE_URL_SIGNEE_S = 24 * 3600;

const reponse = (corps: Record<string, unknown>, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STATUT_PAR_CODE: Record<CodeErreurDetourage | "quota_atteint", number> = {
  non_configure: 503,
  photo_invalide: 400,
  photo_refusee: 422,
  credits_epuises: 503,
  fournisseur_indisponible: 502,
  resultat_invalide: 502,
  quota_atteint: 429,
};
const echec = (code: CodeErreurDetourage | "quota_atteint") => reponse({ ok: false, code }, STATUT_PAR_CODE[code]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Sans clé de fournisseur, rien n'est consommé ni appelé : le détourage n'est simplement pas branché.
  const cleFournisseur = Deno.env.get("PHOTOROOM_API_KEY");
  if (!cleFournisseur) return echec("non_configure");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return reponse({ ok: false, error: ADMIN_KEY_MISSING }, 500);
  const admin = createClient(supabaseUrl, cleAdmin);
  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!estAdmin && !utilisatrice) return reponse({ ok: false, error: "Non authentifié." }, 401);

  let photoUrl: string;
  // « mise_a_plat » : la pièce est portée sur la photo ; sinon, détourage simple (le fond seul).
  let miseAPlat = false;
  try {
    const body = await req.json();
    miseAPlat = body.mode === "mise_a_plat";
    photoUrl = String(body.photo_url || "");
    if (!photoUrl.startsWith("http")) throw new Error("photo_url invalide");
  } catch {
    return echec("photo_invalide");
  }
  if (utilisatrice && !urlPhotoAutorisee(photoUrl, supabaseUrl, utilisatrice.id)) {
    return reponse({ ok: false, error: "Cette photo n'est pas une photo de ton dressing." }, 403);
  }
  const chemin = cheminDansLeBucket(photoUrl);
  if (!chemin) return echec("photo_invalide");
  // Une photo déjà détourée n'a rien à retirer : refusée AVANT le quota et l'appel payant.
  if (estPhotoDetouree(chemin)) return echec("photo_invalide");

  if (utilisatrice) {
    // Une mise à plat est un appel génératif, plus cher : son plafond du jour est à part et plus bas.
    const limite = miseAPlat
      ? limiteDepuisEnv(Deno.env.get("MAX_MISES_A_PLAT_PER_USER_PER_DAY"), LIMITE_MISES_A_PLAT_PAR_DEFAUT)
      : limiteDepuisEnv(Deno.env.get("MAX_DETOURAGES_PER_USER_PER_DAY"), LIMITE_JOURNALIERE_PAR_DEFAUT);
    const quota = await consommerQuota(admin, utilisatrice.id, miseAPlat ? "detourer-photo-plat" : "detourer-photo", limite);
    if (quota === "limite") return echec("quota_atteint");
    if (quota === "indisponible") return reponse({ ok: false, error: "Service momentanément indisponible." }, 503);
  }

  try {
    // 1. La photo, lue dans le stockage privé par l'URL signée que l'app vient d'obtenir.
    const source = await fetch(photoUrl);
    if (!source.ok) return echec("photo_invalide");
    const octetsSource = new Uint8Array(await source.arrayBuffer());
    if (octetsSource.length > TAILLE_SOURCE_MAX_OCTETS) return echec("photo_invalide");

    // 2. Le détourage (fond transparent), puis la conversion WebP — repli sur le PNG brut si elle échoue. Pour une pièce portée,
    // la mise à plat passe d'abord, puis son résultat est détouré : le fichier final est transparent dans les deux cas.
    let aDetourer = octetsSource;
    if (miseAPlat) {
      const plat = await mettreAPlatAvecFournisseur(fetch, cleFournisseur, octetsSource);
      if (!plat.ok) {
        console.error("[detourer-photo] échec mise à plat :", plat.code);
        return echec(plat.code);
      }
      aDetourer = plat.octets;
    }
    const detouree = await detourerAvecFournisseur(fetch, cleFournisseur, aDetourer);
    if (!detouree.ok) {
      console.error("[detourer-photo] échec fournisseur :", detouree.code);
      return echec(detouree.code);
    }
    const encodee = detouree.type === "png" ? await toWebp(detouree.octets) : { bytes: detouree.octets, contentType: "image/webp", ext: "webp" };
    const ext = encodee.ext === "webp" ? "webp" : "png";

    // 3. L'enregistrement, au même dossier que l'original (même politique de stockage, même propriétaire).
    const sortie = miseAPlat ? cheminMisAPlat(chemin, ext) : cheminDetoure(chemin, ext);
    const { error: erreurDepot } = await admin.storage.from("dressing-photos").upload(sortie, encodee.bytes, { contentType: encodee.contentType, upsert: false });
    if (erreurDepot) {
      console.error("[detourer-photo] dépôt impossible :", erreurDepot.message);
      return echec("fournisseur_indisponible");
    }
    const { data: signee } = await admin.storage.from("dressing-photos").createSignedUrl(sortie, DUREE_URL_SIGNEE_S);
    if (!signee?.signedUrl) return echec("fournisseur_indisponible");

    return reponse({ ok: true, photo_url: signee.signedUrl });
  } catch (err) {
    console.error("[detourer-photo] erreur inattendue :", err);
    return echec("fournisseur_indisponible");
  }
});
