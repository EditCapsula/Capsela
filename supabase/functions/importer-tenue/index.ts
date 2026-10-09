// Edge Function importer-tenue (10/10/2026) — « Importer une tenue » : à partir de la photo d'une tenue, rend UNE PIÈCE PAR OBJET.
//
//   photo (stockage privé) → mise à plat par Photoroom (Flat Lay) → lecture des objets par le modèle de vision (catégorie, couleur,
//   matière, manches, boîte) → détourage de la planche (fond transparent) → recadrage de chaque boîte → un fichier par objet.
//
// Entrée : { photo_url } — URL signée du bucket dressing-photos (celle que uploadDressingPhoto renvoie), la photo de la personne.
// Sortie : { ok: true, tenue_url, objets: [{ …ObjetTenue, photo_url }] } — URL signées, 24 h ; `objets` peut être vide (rien
// repéré). Ou { ok: false, code } (CodeErreurDetourage, « quota_atteint », « lecture_indisponible »).
//
// Rien n'est ajouté au dressing ici : l'app montre les objets, la personne coche, et seulement alors des pièces sont créées. Les
// fichiers des objets non gardés sont supprimés par l'app (même dossier, noms `….oN.detouree.plat.webp` et `….tenue.webp`).
//
// Coût par tenue : une mise à plat (appel génératif Photoroom, plan Plus), une lecture OpenAI, un détourage. Un plafond par compte
// et par jour (MAX_IMPORTS_TENUE_PER_USER_PER_DAY, 5 par défaut) est le seul garde-fou financier. Jamais d'appel sans compte connecté
// ni sur la photo d'une autre personne. Secrets : PHOTOROOM_API_KEY, OPENAI_API_KEY, IMPORT_TENUE_MODEL (facultatif).
//
// NON ESSAYÉ contre les vrais services : le contrat de la mise à plat est celui de _shared/detourage.ts (extraits de documentation),
// la lecture de la boîte des objets par le modèle n'a jamais été mesurée sur de vraies tenues.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { assainerObjets, cheminObjet, cheminTenue, promptTenue, rectangleDeRecadrage, recadrerPixels } from "../_shared/analyseTenue.ts";
import {
  cheminDansLeBucket,
  detourerAvecFournisseur,
  estPhotoDetouree,
  mettreAPlatAvecFournisseur,
  TAILLE_SOURCE_MAX_OCTETS,
  type CodeErreurDetourage,
} from "../_shared/detourage.ts";
import { authentifier, consommerQuota, estAppelantAdmin, jetonDepuisEntete, limiteDepuisEnv, urlPhotoAutorisee } from "../_shared/protection.ts";
import { decoderPng, imageDataVersWebp } from "../_shared/webp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LIMITE_PAR_DEFAUT = 5;
const MODELE_PAR_DEFAUT = "gpt-4.1-mini";
const DUREE_URL_SIGNEE_S = 24 * 3600;

const reponse = (corps: Record<string, unknown>, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Code = CodeErreurDetourage | "quota_atteint" | "lecture_indisponible";
const STATUT: Record<Code, number> = {
  non_configure: 503,
  photo_invalide: 400,
  photo_refusee: 422,
  credits_epuises: 503,
  fournisseur_indisponible: 502,
  resultat_invalide: 502,
  quota_atteint: 429,
  lecture_indisponible: 502,
};
const echec = (code: Code) => reponse({ ok: false, code }, STATUT[code]);

const base64 = (octets: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(bin);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clePhotoroom = Deno.env.get("PHOTOROOM_API_KEY");
  const cleOpenai = Deno.env.get("OPENAI_API_KEY");
  if (!clePhotoroom || !cleOpenai) return echec("non_configure");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return reponse({ ok: false, error: ADMIN_KEY_MISSING }, 500);
  const admin = createClient(supabaseUrl, cleAdmin);
  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!estAdmin && !utilisatrice) return reponse({ ok: false, error: "Non authentifié." }, 401);

  let photoUrl: string;
  try {
    const body = await req.json();
    photoUrl = String(body.photo_url || "");
    if (!photoUrl.startsWith("http")) throw new Error("photo_url invalide");
  } catch {
    return echec("photo_invalide");
  }
  if (utilisatrice && !urlPhotoAutorisee(photoUrl, supabaseUrl, utilisatrice.id)) {
    return reponse({ ok: false, error: "Cette photo n'est pas une photo de ton dressing." }, 403);
  }
  const chemin = cheminDansLeBucket(photoUrl);
  // Une photo déjà détourée n'est pas une photo de tenue.
  if (!chemin || estPhotoDetouree(chemin)) return echec("photo_invalide");

  if (utilisatrice) {
    const limite = limiteDepuisEnv(Deno.env.get("MAX_IMPORTS_TENUE_PER_USER_PER_DAY"), LIMITE_PAR_DEFAUT);
    const quota = await consommerQuota(admin, utilisatrice.id, "importer-tenue", limite);
    if (quota === "limite") return echec("quota_atteint");
    if (quota === "indisponible") return reponse({ ok: false, error: "Service momentanément indisponible." }, 503);
  }

  try {
    // 1. La photo, lue dans le stockage privé.
    const source = await fetch(photoUrl);
    if (!source.ok) return echec("photo_invalide");
    const octetsSource = new Uint8Array(await source.arrayBuffer());
    if (octetsSource.length > TAILLE_SOURCE_MAX_OCTETS) return echec("photo_invalide");

    // 2. La tenue mise à plat. Sans elle, pas de découpe propre : jamais de recadrage d'une photo portée.
    const plat = await mettreAPlatAvecFournisseur(fetch, clePhotoroom, octetsSource);
    if (!plat.ok) {
      console.error("[importer-tenue] échec mise à plat :", plat.code);
      return echec(plat.code);
    }

    // 3. Les objets, lus sur l'image à plat (avec son fond : la lecture est plus sûre qu'à travers une transparence).
    const modele = Deno.env.get("IMPORT_TENUE_MODEL") || MODELE_PAR_DEFAUT;
    const lecture = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cleOpenai}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modele,
        // Journalisation refusée, comme analyze-dressing-photo : cette photo ne va pas dans un journal consultable.
        store: false,
        response_format: { type: "json_object" },
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptTenue() },
              { type: "image_url", image_url: { url: `data:image/${plat.type};base64,${base64(plat.octets)}`, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!lecture.ok) {
      console.error("[importer-tenue] lecture OpenAI :", lecture.status);
      return echec("lecture_indisponible");
    }
    const contenu = (await lecture.json())?.choices?.[0]?.message?.content;
    if (!contenu) return echec("lecture_indisponible");
    let brut: unknown;
    try {
      brut = JSON.parse(contenu);
    } catch {
      return echec("lecture_indisponible");
    }
    const objets = assainerObjets(brut);
    // Rien de repéré : aucune découpe, aucun détourage payant.
    if (objets.length === 0) return reponse({ ok: true, tenue_url: null, objets: [] });

    // 4. La planche détourée (fond transparent), puis un fichier par objet.
    const detouree = await detourerAvecFournisseur(fetch, clePhotoroom, plat.octets);
    if (!detouree.ok) {
      console.error("[importer-tenue] échec détourage :", detouree.code);
      return echec(detouree.code);
    }
    if (detouree.type !== "png") return echec("resultat_invalide");
    const planche = await decoderPng(detouree.octets);

    const deposer = async (cheminSortie: string, image: ImageData): Promise<string | null> => {
      const encodee = await imageDataVersWebp(image);
      if (!encodee) return null;
      const { error } = await admin.storage.from("dressing-photos").upload(cheminSortie, encodee.bytes, { contentType: encodee.contentType, upsert: false });
      if (error) {
        console.error("[importer-tenue] dépôt impossible :", error.message);
        return null;
      }
      const { data } = await admin.storage.from("dressing-photos").createSignedUrl(cheminSortie, DUREE_URL_SIGNEE_S);
      return data?.signedUrl ?? null;
    };

    const tenueUrl = await deposer(cheminTenue(chemin), planche);
    const rendus = [];
    for (const [i, objet] of objets.entries()) {
      const r = rectangleDeRecadrage(planche.width, planche.height, objet.boite);
      const rogne = recadrerPixels(planche.data, planche.width, planche.height, r);
      const url = await deposer(cheminObjet(chemin, i), { data: rogne.data, width: rogne.width, height: rogne.height, colorSpace: "srgb" } as ImageData);
      // Un objet dont le fichier n'a pas pu être enregistré n'est pas proposé : jamais une pièce sans visuel.
      if (url) rendus.push({ ...objet, photo_url: url });
    }
    return reponse({ ok: true, tenue_url: tenueUrl, objets: rendus });
  } catch (err) {
    console.error("[importer-tenue] erreur inattendue :", err);
    return echec("fournisseur_indisponible");
  }
});
