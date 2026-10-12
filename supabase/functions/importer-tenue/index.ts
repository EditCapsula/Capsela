// Edge Function importer-tenue (10/10/2026) — « Importer une tenue » : à partir de la photo d'une tenue, rend UNE PIÈCE PAR OBJET.
//
//   photo (stockage privé) → lecture des objets par le modèle de vision (catégorie, couleur,
//   matière, manches, boîte) → recadrage de chaque boîte sur la photo d'origine (vérifié, resserré) → un fichier par objet. AUCUN détourage ici (12/10/2026) :
//   il se lance à l'ajout de la pièce (detourer-photo, `recadrer`).
//
// Entrée : { photo_url } — URL signée du bucket dressing-photos (celle que uploadDressingPhoto renvoie), la photo de la personne.
// Sortie : { ok: true, tenue_url, objets: [{ …ObjetTenue, photo_url }] } — URL signées, 24 h ; `objets` peut être vide (rien
// repéré). Ou { ok: false, code } (CodeErreurDetourage, « quota_atteint », « lecture_indisponible »).
//
// Rien n'est ajouté au dressing ici : l'app montre les objets, la personne coche, et seulement alors des pièces sont créées. Les
// fichiers des objets non gardés sont supprimés par l'app (même dossier, noms `….oN.webp`, et `….oN.detouree.webp` une fois détourés).
//
// Coût par tenue : une lecture OpenAI et une vérification par objet (détail bas) ; plus de Photoroom. Un plafond par compte
// et par jour (MAX_IMPORTS_TENUE_PER_USER_PER_DAY, 50 par défaut depuis le 11/10/2026, 5 avant) est le seul garde-fou financier. Jamais d'appel sans compte connecté
// ni sur la photo d'une autre personne. Secrets : OPENAI_API_KEY, IMPORT_TENUE_MODEL (facultatif).
//
// NON ESSAYÉ contre les vrais services : le contrat du détourage est celui de _shared/detourage.ts (extraits de documentation),
// la lecture de la boîte des objets par le modèle n'a jamais été mesurée sur de vraies tenues.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { MARGES_RECADRAGE, assainerObjets, assainerVerification, cheminObjet, promptTenue, promptVerificationRecadrage, rectangleAffine, rectangleDeRecadrage, recadrerPixels } from "../_shared/analyseTenue.ts";
import {
  cheminDansLeBucket,
  estPhotoDetouree,
  typeImage,
  TAILLE_SOURCE_MAX_OCTETS,
  type CodeErreurDetourage,
} from "../_shared/detourage.ts";
import { authentifier, consommerQuota, estAppelantAdmin, jetonDepuisEntete, limiteDepuisEnv, urlPhotoAutorisee } from "../_shared/protection.ts";
import { decoderImage, imageDataVersPng, imageDataVersWebp } from "../_shared/webp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LIMITE_PAR_DEFAUT = 50;
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

  const cleOpenai = Deno.env.get("OPENAI_API_KEY");
  if (!cleOpenai) return echec("non_configure");

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

    // 2. PAS de mise à plat ici (11/10/2026, demandé : « la mise à plat n'est pas automatique, c'est le détourage qui l'est »). Les objets
    // sont lus et découpés sur la photo d'origine ; la mise à plat reste une action demandée sur la fiche d'une pièce.
    const typeSource = typeImage(octetsSource);
    if (!typeSource) return echec("photo_invalide");

    // 3. Les objets, lus sur la photo d'origine.
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
              { type: "image_url", image_url: { url: `data:image/${typeSource};base64,${base64(octetsSource)}`, detail: "high" } },
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

    // Vérification d'un recadrage par le modèle de vision (12/10/2026) : l'article est-il vraiment dans ce recadrage, et où ? Une réponse
    // illisible ou un échec du service rend null : l'appelant garde alors son recadrage (jamais une pièce rejetée sur une panne).
    const verifierRecadrage = async (png: Uint8Array, o: { nom: string; cat: string }) => {
      try {
        const rep = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${cleOpenai}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modele,
            store: false,
            response_format: { type: "json_object" },
            max_tokens: 200,
            messages: [{ role: "user", content: [{ type: "text", text: promptVerificationRecadrage(o) }, { type: "image_url", image_url: { url: `data:image/png;base64,${base64(png)}`, detail: "low" } }] }],
          }),
        });
        if (!rep.ok) return null;
        const texte = (await rep.json())?.choices?.[0]?.message?.content;
        return texte ? assainerVerification(JSON.parse(texte)) : null;
      } catch {
        return null;
      }
    };

    // 4. Un recadrage PAR OBJET (11/10/2026), sur la photo d'origine : détourer d'abord la planche entière puis la recadrer laissait
    // des fragments des pièces voisines dans les boîtes qui se chevauchent.
    const planche = await decoderImage(octetsSource, typeSource);
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

    // Plus de planche à plat : tenue_url reste null, l'écran n'affiche pas la bascule photo / à plat.
    const tenueUrl: string | null = null;
    const rendus = [];
    for (const [i, objet] of objets.entries()) {
      // Le recadrage de chaque pièce est préparé ici, SANS détourage (12/10/2026) : le détourage est l'appel le plus cher et la moitié des
      // pièces proposées ne sont pas gardées. Il se lance à l'ajout (detourer-photo, `recadrer`). Marge large d'abord, puis resserrée sur
      // ce que la vérification a vu ; sans vérification (panne), la marge étroite : un recadrage large risquerait d'inclure la voisine.
      let r = rectangleDeRecadrage(planche.width, planche.height, objet.boite, MARGES_RECADRAGE[1]);
      let rogne = recadrerPixels(planche.data, planche.width, planche.height, r);
      const entree = await imageDataVersPng({ data: rogne.data, width: rogne.width, height: rogne.height, colorSpace: "srgb" } as ImageData);
      if (!entree) continue;
      const verif = await verifierRecadrage(entree, { nom: objet.nom, cat: objet.cat });
      if (verif && !verif.present) {
        console.warn("[importer-tenue] objet", i, "écarté : absent de son recadrage");
        continue;
      }
      if (verif?.boite) r = rectangleAffine(r, verif.boite, planche.width, planche.height);
      else if (!verif) r = rectangleDeRecadrage(planche.width, planche.height, objet.boite, MARGES_RECADRAGE[0]);
      rogne = recadrerPixels(planche.data, planche.width, planche.height, r);
      const url = await deposer(cheminObjet(chemin, i), { data: rogne.data, width: rogne.width, height: rogne.height, colorSpace: "srgb" } as ImageData);
      if (url) rendus.push({ ...objet, photo_url: url });
    }
    return reponse({ ok: true, tenue_url: tenueUrl, objets: rendus });
  } catch (err) {
    console.error("[importer-tenue] erreur inattendue :", err);
    return echec("fournisseur_indisponible");
  }
});
