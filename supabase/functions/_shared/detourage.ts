// Détourage des photos du dressing (04/10/2026) — la partie PURE de l'Edge Function detourer-photo : nommage du
// fichier détouré, lecture du type d'image, et l'appel au fournisseur avec un `fetch` injectable (donc testable sans
// réseau). Rien ici ne lit un secret ni ne touche à Supabase : l'Edge Function s'en charge.
//
// POURQUOI UN FICHIER À PART ET UN FOURNISSEUR DERRIÈRE UNE FONCTION. Le service retenu (Photoroom, « Remove
// Background ») est une proposition du 04/10/2026 ; en changer ne doit toucher que `detourerAvecFournisseur`. Le
// contrat d'appel ci-dessous (point d'entrée, champ `image_file`, en-tête `x-api-key`, retour PNG transparent par
// défaut) est CONFIRMÉ par des extraits de la documentation du fournisseur, mais jamais ESSAYÉ : aucune clé, et le site
// est bloqué depuis le conteneur de développement. Voir docs/detourage.md pour ce qui reste à valider.

/** Marque du fichier détouré, dans son nom : c'est elle, et non une colonne, qui dit qu'une photo est détourée. */
export const MARQUE_DETOUREE = ".detouree.";

/** Une photo source au-delà de cette taille n'est pas envoyée au fournisseur (la photo du dressing est déjà ramenée à 1 200 px). */
export const TAILLE_SOURCE_MAX_OCTETS = 8 * 1024 * 1024;

/** Un détourage rendu au-delà de cette taille est refusé : une réponse démesurée n'est pas une image de vêtement. */
export const TAILLE_RESULTAT_MAX_OCTETS = 12 * 1024 * 1024;

/** Détourages par compte et par jour : une image détourée est un appel payant (modifiable par le secret MAX_DETOURAGES_PER_USER_PER_DAY). */
export const LIMITE_JOURNALIERE_PAR_DEFAUT = 10;

export const POINT_D_ENTREE_PHOTOROOM = "https://sdk.photoroom.com/v1/segment";

// LA MISE À PLAT (10/10/2026) — pour une photo où la pièce est PORTÉE (le détourage seul garderait la personne). Appel
// « Flat Lay » de l'API Image Editing de Photoroom (plan Plus) : POST sur /v2/edit, en-tête `x-api-key`, champ `imageFile`,
// paramètre `flatLay.mode` = `ai.auto`. Contrat lu dans des extraits de docs.photoroom.com (recherche web), JAMAIS ESSAYÉ d'ici :
// le site est bloqué depuis le conteneur de développement. Le résultat est une image qui n'a pas forcément de fond transparent :
// l'Edge Function la passe donc par le détourage ci-dessus. Génératif : la pièce peut différer de la photo (couleur, détails).
export const POINT_D_ENTREE_PHOTOROOM_EDIT = "https://image-api.photoroom.com/v2/edit";

/** Marque d'une photo mise à plat, après celle du détourage : `{user}/{uuid}.detouree.plat.webp` — un fichier mis à plat reste un fichier détouré. */
export const MARQUE_MISE_A_PLAT = ".plat.";

/** Mises à plat par compte et par jour : un appel génératif coûte plus qu'un détourage (secret MAX_MISES_A_PLAT_PER_USER_PER_DAY). */
export const LIMITE_MISES_A_PLAT_PAR_DEFAUT = 5;

/** `{user}/{uuid}.jpg` devient `{user}/{uuid}.detouree.plat.webp`. */
export function cheminMisAPlat(cheminOriginal: string, ext: "webp" | "png" = "webp"): string {
  // Une photo déjà détourée (`….detouree.webp`) mise à plat ensuite : `….detouree.plat.webp`, sans doubler la marque.
  const sansExtension = cheminOriginal.replace(/\.[^./]+$/, "").replace(/\.detouree$/, "");
  return `${sansExtension}${MARQUE_DETOUREE}${MARQUE_MISE_A_PLAT.slice(1)}${ext}`;
}

/** Le fichier a-t-il été mis à plat ? Seul le chemin compte, jamais la chaîne de requête. */
export function estPhotoMiseAPlat(urlOuChemin: string | null | undefined): boolean {
  if (!urlOuChemin) return false;
  return urlOuChemin.split("?")[0].includes(`${MARQUE_DETOUREE}${MARQUE_MISE_A_PLAT.slice(1)}`);
}

/**
 * `{user}/{uuid}.jpg` devient `{user}/{uuid}.detouree.webp` : même dossier, donc la même politique de stockage. Le
 * repli sur le PNG brut (conversion WebP indisponible, cf. webp.ts) garde la marque : `.detouree.png`.
 */
export function cheminDetoure(cheminOriginal: string, ext: "webp" | "png" = "webp"): string {
  const sansExtension = cheminOriginal.replace(/\.[^./]+$/, "");
  return `${sansExtension}${MARQUE_DETOUREE}${ext}`;
}

/**
 * Le chemin d'une photo à l'intérieur du bucket `dressing-photos`, depuis son URL (signée ou publique), ou null
 * si l'URL n'en vient pas. Le dossier de la personne en est le premier segment.
 */
export function cheminDansLeBucket(photoUrl: string): string | null {
  let chemin: string;
  try {
    chemin = new URL(photoUrl).pathname;
  } catch {
    return null;
  }
  const m = /^\/storage\/v1\/object\/(?:sign|public)\/dressing-photos\/(.+)$/.exec(chemin);
  if (!m) return null;
  try {
    const decode = decodeURIComponent(m[1]);
    return decode.includes("..") ? null : decode;
  } catch {
    return null;
  }
}

/** L'URL (ou le chemin) désigne-t-elle un fichier détouré ? Seul le chemin compte, jamais la chaîne de requête. */
export function estPhotoDetouree(urlOuChemin: string | null | undefined): boolean {
  if (!urlOuChemin) return false;
  return urlOuChemin.split("?")[0].includes(MARQUE_DETOUREE);
}

export type TypeImage = "jpeg" | "png" | "webp";

/** Le type réel d'une image, lu dans ses premiers octets : l'en-tête `Content-Type` d'un fichier envoyé ne prouve rien. */
export function typeImage(octets: Uint8Array): TypeImage | null {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "jpeg";
  if (octets.length >= 8 && octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) return "png";
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 &&
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export type CodeErreurDetourage =
  | "non_configure" // aucune clé de fournisseur : le détourage n'est pas branché
  | "photo_invalide" // la source n'est pas une image lisible, ou trop lourde
  | "photo_refusee" // le fournisseur n'a pas pu traiter cette photo
  | "credits_epuises" // le compte du fournisseur n'a plus de crédit
  | "fournisseur_indisponible" // réseau, délai ou erreur du fournisseur
  | "resultat_invalide"; // la réponse n'est pas une image exploitable

export type IssueFournisseur = { ok: true; octets: Uint8Array; type: TypeImage } | { ok: false; code: CodeErreurDetourage };

/**
 * Envoie la photo au fournisseur et rend l'image détourée (fond transparent). `fetchFn` est injectable pour les
 * essais ; en production c'est `fetch`. Jamais d'exception : tout échec est un code, que l'appelant traduit.
 * La clé voyage dans l'en-tête `x-api-key` — jamais dans l'URL, qui se retrouverait dans des journaux.
 */
export async function detourerAvecFournisseur(
  fetchFn: typeof fetch,
  cle: string,
  photo: Uint8Array,
  delaiMs = 30_000,
  pointDEntree = POINT_D_ENTREE_PHOTOROOM,
): Promise<IssueFournisseur> {
  const type = typeImage(photo);
  if (!type || photo.length === 0 || photo.length > TAILLE_SOURCE_MAX_OCTETS) return { ok: false, code: "photo_invalide" };
  const formulaire = new FormData();
  formulaire.append("image_file", new Blob([photo as BlobPart], { type: `image/${type}` }), `photo.${type === "jpeg" ? "jpg" : type}`);
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delaiMs);
  try {
    const reponse = await fetchFn(pointDEntree, { method: "POST", headers: { "x-api-key": cle, Accept: "image/png" }, body: formulaire, signal: controle.signal });
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, code: "non_configure" };
    if (reponse.status === 402) return { ok: false, code: "credits_epuises" };
    if (reponse.status === 400 || reponse.status === 413 || reponse.status === 415 || reponse.status === 422) return { ok: false, code: "photo_refusee" };
    if (!reponse.ok) return { ok: false, code: "fournisseur_indisponible" };
    const octets = new Uint8Array(await reponse.arrayBuffer());
    if (octets.length === 0 || octets.length > TAILLE_RESULTAT_MAX_OCTETS) return { ok: false, code: "resultat_invalide" };
    const rendu = typeImage(octets);
    // Le fournisseur doit rendre un PNG (ou un WebP) : un JPEG n'a pas de transparence, ce ne serait pas un détourage.
    if (rendu !== "png" && rendu !== "webp") return { ok: false, code: "resultat_invalide" };
    return { ok: true, octets, type: rendu };
  } catch {
    return { ok: false, code: "fournisseur_indisponible" };
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Envoie la photo à l'appel Flat Lay et rend l'image mise à plat (PNG, JPEG ou WebP : pas forcément transparente). Même contrat
 * d'échec que detourerAvecFournisseur : jamais d'exception, un code.
 */
export async function mettreAPlatAvecFournisseur(
  fetchFn: typeof fetch,
  cle: string,
  photo: Uint8Array,
  delaiMs = 90_000,
  pointDEntree = POINT_D_ENTREE_PHOTOROOM_EDIT,
): Promise<IssueFournisseur> {
  const type = typeImage(photo);
  if (!type || photo.length === 0 || photo.length > TAILLE_SOURCE_MAX_OCTETS) return { ok: false, code: "photo_invalide" };
  const formulaire = new FormData();
  formulaire.append("imageFile", new Blob([photo as BlobPart], { type: `image/${type}` }), `photo.${type === "jpeg" ? "jpg" : type}`);
  formulaire.append("flatLay.mode", "ai.auto");
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delaiMs);
  try {
    const reponse = await fetchFn(pointDEntree, { method: "POST", headers: { "x-api-key": cle, Accept: "image/*" }, body: formulaire, signal: controle.signal });
    // 401 / 403 : clé refusée, ou plan sans accès à cet appel (Plus) — l'appelant garde la photo d'origine.
    if (reponse.status === 401 || reponse.status === 403) return { ok: false, code: "non_configure" };
    if (reponse.status === 402) return { ok: false, code: "credits_epuises" };
    if (reponse.status === 400 || reponse.status === 413 || reponse.status === 415 || reponse.status === 422) return { ok: false, code: "photo_refusee" };
    if (!reponse.ok) return { ok: false, code: "fournisseur_indisponible" };
    const octets = new Uint8Array(await reponse.arrayBuffer());
    if (octets.length === 0 || octets.length > TAILLE_RESULTAT_MAX_OCTETS) return { ok: false, code: "resultat_invalide" };
    const rendu = typeImage(octets);
    if (!rendu) return { ok: false, code: "resultat_invalide" };
    return { ok: true, octets, type: rendu };
  } catch {
    return { ok: false, code: "fournisseur_indisponible" };
  } finally {
    clearTimeout(minuteur);
  }
}
