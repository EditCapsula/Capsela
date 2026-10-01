import { accessoireTypeFor } from "./attributes";
import { type Verdict, clePieces, jourLocal } from "./outfitFeedback";
import { manchesDepuis } from "./manches";
import { ordonnerSaisons } from "./saisons";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  AccessoireType,
  CapsuleSeason,
  BijouType,
  CategoryKey,
  ChoixRevente,
  Coupe,
  HistoryEntry,
  Item,
  Manches,
  Matiere,
  OccasionKey,
  PhotoAnalysis,
  SacType,
  SavedLook,
  Season,
  ShoeType,
} from "./types";

/**
 * Persistance Supabase du dressing réel (table dressing_items) et de
 * l'historique des tenues portées (table outfit_history) — cf. migrations
 * 0021/0022. Seuls les champs effectivement renseignés par saveItem
 * (store.tsx) pour une pièce du dressing réel sont mappés ici ; tous les
 * autres champs d'Item (rolePiece, styleTags, imageUrl...) ne concernent que
 * les pièces du catalogue vestiaire_universel (cf. vestiaire.ts) et n'ont
 * pas de colonne correspondante.
 */

interface DressingItemRow {
  id: number;
  user_id: string;
  name: string;
  brand: string | null;
  cat: string;
  color: string;
  hex: string;
  size: string | null;
  season: string;
  occasion: string[] | null;
  shoe_type: string | null;
  matiere: string | null;
  coupe: string | null;
  sac_type: string | null;
  bijou_type: string | null;
  accessoire_type: string | null;
  subtype: string | null;
  photo_url: string | null;
  worn: number | null;
  worn_prev: number | null;
  created_at: string;
  /** Migration 0035 — absente de la ligne tant qu'elle n'est pas exécutée. */
  revente?: string | null;
  /** Migration 0040 — absente de la ligne tant qu'elle n'est pas exécutée. */
  saisons?: string[] | null;
  /** Migration 0042 — absente de la ligne tant qu'elle n'est pas exécutée. */
  manches?: string | null;
}

function rowToItem(row: DressingItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    cat: row.cat as CategoryKey,
    color: row.color,
    hex: row.hex,
    size: row.size,
    season: row.season as Season,
    saisons: row.saisons?.length ? ordonnerSaisons(row.saisons) : undefined,
    manches: manchesDepuis(row.manches),
    occasion: (row.occasion as OccasionKey[] | null) ?? undefined,
    shoeType: (row.shoe_type as ShoeType | null) ?? undefined,
    matiere: (row.matiere as Matiere | null) ?? undefined,
    coupe: (row.coupe as Coupe | null) ?? undefined,
    sacType: (row.sac_type as SacType | null) ?? undefined,
    bijouType: (row.bijou_type as BijouType | null) ?? undefined,
    accessoireType: accessoireTypeFor(row.cat as CategoryKey, row.accessoire_type as AccessoireType | null, row.name),
    subtype: row.subtype ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    worn: row.worn,
    wornPrev: row.worn_prev ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    revente: row.revente === "gardee" || row.revente === "de_cote" ? row.revente : undefined,
  };
}

function itemToRow(item: Omit<Item, "id">, userId: string) {
  return {
    user_id: userId,
    name: item.name,
    brand: item.brand ?? null,
    cat: item.cat,
    color: item.color,
    hex: item.hex,
    size: item.size ?? null,
    season: item.season,
    occasion: item.occasion ?? null,
    shoe_type: item.shoeType ?? null,
    matiere: item.matiere ?? null,
    coupe: item.coupe ?? null,
    sac_type: item.sacType ?? null,
    bijou_type: item.bijouType ?? null,
    accessoire_type: item.accessoireType ?? null,
    subtype: item.subtype ?? null,
    // Jamais l'URL signée en base : elle expire. Cf. urlPhotoCanonique.
    photo_url: urlPhotoCanonique(item.photoUrl) ?? null,
    worn: item.worn ?? null,
    worn_prev: item.wornPrev ?? null,
  };
}

/** Retourne [] en mode démo ou en cas d'échec réseau — l'appelant garde alors le dressing tel quel plutôt que de l'écraser. */
export async function fetchDressingItems(userId: string): Promise<Item[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabase()
      .from("dressing_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[dressing] échec fetchDressingItems", error);
      return [];
    }
    return await signerPhotosDressing((data as DressingItemRow[]).map(rowToItem));
  } catch (err) {
    console.error("[dressing] échec fetchDressingItems", err);
    return [];
  }
}

/** Côté le plus long d'une photo enregistrée. Au-delà, l'écran n'en montre rien de plus. */
export const PHOTO_COTE_MAX = 1200;
/** Qualité JPEG. 0,8 est le seuil au-delà duquel le poids monte sans gain visible sur une photo de vêtement. */
export const PHOTO_QUALITE = 0.8;

/**
 * Réduit une photo AVANT l'envoi (correctif 10/09/2026, après un dépassement
 * de quota « Cached Egress Exceeded » chez Supabase).
 *
 * Jusqu'ici le fichier de l'appareil photo partait tel quel : les photos
 * mesurées dans le bucket pesaient de 2 à 8,4 Mo pièce, pour être affichées
 * dans une vignette de 200 px. Le coût n'est pas le stockage — c'est l'egress,
 * facturé à chaque affichage : six vignettes à 3 Mo, ce sont 18 Mo servis
 * chaque fois qu'on ouvre « Mes pièces ».
 *
 * NE JAMAIS BLOQUER L'AJOUT. Tout ce qui peut manquer — un navigateur sans
 * `createImageBitmap`, un rendu serveur sans `document`, un canvas refusé, un
 * fichier qui n'est pas une image — rend le fichier d'origine plutôt que de
 * lever. Une photo lourde vaut mieux qu'une pièce qu'on ne peut pas ajouter.
 *
 * Et jamais de résultat pire que l'entrée : si le ré-encodage produit un
 * fichier plus gros (petite image déjà optimisée), on garde l'original.
 */
export async function compressDressingPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    // `imageOrientation` applique l'orientation EXIF : sans elle, les photos
    // prises en portrait sur téléphone ressortent couchées.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const echelle = Math.min(1, PHOTO_COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Fond blanc avant le dessin : le JPEG ignore la transparence et rendrait
    // noir le fond d'un PNG détouré.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITE)
    );
    if (!blob || blob.size >= file.size) return file;
    const nom = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${nom}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

/**
 * Upload la photo réelle d'une pièce vers le bucket dressing-photos (cf.
 * migration 0023) et renvoie une URL SIGNÉE pour l'afficher — remplace
 * l'ancienne URL locale (blob:) qui redevenait invalide au rechargement.
 * C'est la forme canonique (urlPhotoCanonique) qui sera enregistrée.
 * Chemin {user_id}/{uuid}.{ext} : l'UUID évite toute collision entre deux
 * photos, l'extension est déduite du type MIME du fichier — celui du fichier
 * COMPRESSÉ, qui n'est pas forcément celui d'origine.
 */
export async function uploadDressingPhoto(userId: string, file: File): Promise<string> {
  const photo = await compressDressingPhoto(file);
  const ext = photo.type.split("/")[1] || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase()
    .storage.from("dressing-photos")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (error) throw error;
  const { data: signee } = await getSupabase().storage.from("dressing-photos").createSignedUrl(path, DUREE_URL_PHOTO_DRESSING_S);
  if (signee?.signedUrl) return signee.signedUrl;
  // Signature impossible : l'URL publique, lisible tant que le bucket l'est
  // encore. La base reçoit de toute façon la forme canonique.
  return getSupabase().storage.from("dressing-photos").getPublicUrl(path).data.publicUrl;
}

/**
 * Suggère catégorie/couleur/sous-type/matière... à partir de la photo d'une
 * pièce réelle (recette 22/08/2026) — réutilise le même compte OpenAI que
 * la génération d'images catalogue (Edge Function analyze-dressing-photo).
 * Ne renvoie jamais d'erreur à l'appelant : un échec (réseau, quota, réponse
 * imprévue) redonne simplement {} — l'appelant (uploadAddPhoto, store.tsx)
 * traite ça comme "rien à suggérer", jamais comme un blocage de l'ajout.
 */
export async function analyzeDressingPhoto(photoUrl: string): Promise<PhotoAnalysis> {
  try {
    const { data, error } = await getSupabase().functions.invoke("analyze-dressing-photo", {
      body: { photo_url: photoUrl },
    });
    if (error) {
      console.error("[dressing] échec analyzeDressingPhoto", error);
      return {};
    }
    return (data as PhotoAnalysis) ?? {};
  } catch (err) {
    console.error("[dressing] échec analyzeDressingPhoto", err);
    return {};
  }
}

/** Insère la pièce et renvoie la ligne créée (id généré par Postgres) — l'appelant l'ajoute à son state une fois la promesse résolue. */
export async function insertDressingItem(userId: string, item: Omit<Item, "id">): Promise<Item> {
  const { data, error } = await getSupabase()
    .from("dressing_items")
    .insert(itemToRow(item, userId))
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Échec de l'insertion dans dressing_items");
  // La ligne rend la forme canonique ; l'écran garde l'URL signée qu'il affiche déjà.
  return { ...rowToItem(data as DressingItemRow), photoUrl: item.photoUrl };
}

/**
 * Segment d'URL publique commun à tout objet du bucket dressing-photos.
 * Sert à distinguer une photo personnelle — la seule qu'on ait le droit de
 * supprimer — d'une image de catalogue : `startEditItem` retombe sur
 * `img.url` (bucket catalog-images, visuel produit PARTAGÉ par toutes les
 * utilisatrices) quand la pièce n'a pas de photo propre, et cette URL peut
 * finir persistée dans photo_url. La supprimer casserait le visuel pour
 * tout le monde.
 */
const PREFIXE_PHOTOS_DRESSING = "/storage/v1/object/public/dressing-photos/";
/** Même bucket, URL signée (bucket privé, 30/09/2026) : `/object/sign/…?token=`. */
const PREFIXE_PHOTOS_DRESSING_SIGNEE = "/storage/v1/object/sign/dressing-photos/";

/*
 * BUCKET PRIVÉ, URL SIGNÉES (30/09/2026). Le bucket était public (0023) : une
 * URL suffisait pour voir la photo, et ce sont des photos personnelles — dont
 * des hauts photographiés portés. Il passe en privé, comme celui des avis de
 * styliste (0036).
 *
 * LA BASE NE CHANGE PAS DE FORMAT. `photo_url` garde l'URL publique de
 * l'objet, qui n'est plus qu'un repère (bucket privé : elle ne donne accès à
 * rien) ; aucune donnée à migrer, et le code d'avant reste lisible. En
 * mémoire, `photoUrl` porte une URL signée, créée à la lecture du dressing et
 * après chaque upload ; avant toute écriture, elle redevient la forme
 * canonique — une URL signée expire, elle ne doit jamais être enregistrée.
 *
 * L'ORDRE DE MISE EN PRODUCTION NE CASSE RIEN : une URL signée se lit aussi
 * sur un bucket public. Ce code part d'abord, le SQL qui rend le bucket privé
 * ensuite.
 */

/**
 * Durée des URL signées des photos du dressing. 24 h, et non l'heure des avis
 * de styliste : le dressing est lu une fois par session, pas à chaque écran,
 * et une vignette qui expire en cours d'usage s'afficherait vide. Une URL
 * transmise par erreur ne vaut plus rien le lendemain — contre toujours avec
 * le bucket public. [HYPOTHÈSE TECHNIQUE]
 */
export const DUREE_URL_PHOTO_DRESSING_S = 24 * 3600;

/** L'URL désigne-t-elle une photo du bucket dressing-photos ? Rend l'index et le préfixe trouvés. */
function prefixePhoto(url: string): { i: number; prefixe: string } | null {
  for (const prefixe of [PREFIXE_PHOTOS_DRESSING, PREFIXE_PHOTOS_DRESSING_SIGNEE]) {
    const i = url.indexOf(prefixe);
    if (i !== -1) return { i, prefixe };
  }
  return null;
}

/**
 * Chemin de l'objet à l'intérieur du bucket dressing-photos, ou null si
 * l'URL n'en vient pas (image de catalogue, blob: local, champ vide).
 * Null est le résultat sûr : il ne déclenche aucune suppression.
 * URL publique ou signée : même chemin, donc même fichier.
 */
export function dressingPhotoPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const trouve = prefixePhoto(url);
  if (!trouve) return null;
  const chemin = url.slice(trouve.i + trouve.prefixe.length).split("?")[0];
  return chemin ? decodeURIComponent(chemin) : null;
}

/**
 * La forme enregistrée en base : l'URL publique de l'objet, sans jeton.
 * Toute autre URL (catalogue, blob: local) est rendue telle quelle.
 */
export function urlPhotoCanonique(url: string | undefined): string | undefined {
  if (!url) return url;
  const trouve = prefixePhoto(url);
  if (!trouve) return url;
  const chemin = url.slice(trouve.i + trouve.prefixe.length).split("?")[0];
  return chemin ? url.slice(0, trouve.i) + PREFIXE_PHOTOS_DRESSING + chemin : url;
}

/**
 * Remplace, pour l'affichage, l'URL de chaque photo personnelle par une URL
 * signée — un seul appel pour tout le dressing. En cas d'échec, les pièces
 * sont rendues telles quelles : la photo reste visible tant que le bucket est
 * public, et rien d'autre du dressing n'est perdu.
 */
async function signerPhotosDressing(items: Item[]): Promise<Item[]> {
  const chemins = [...new Set(items.map((it) => dressingPhotoPath(it.photoUrl)).filter((c): c is string => Boolean(c)))];
  if (!chemins.length) return items;
  try {
    const { data, error } = await getSupabase().storage.from("dressing-photos").createSignedUrls(chemins, DUREE_URL_PHOTO_DRESSING_S);
    if (error || !data) {
      console.error("[dressing] échec de signature des photos", error);
      return items;
    }
    const urls = new Map<string, string>();
    for (const s of data) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    return items.map((it) => {
      const chemin = dressingPhotoPath(it.photoUrl);
      const signee = chemin ? urls.get(chemin) : undefined;
      return signee ? { ...it, photoUrl: signee } : it;
    });
  } catch (err) {
    console.error("[dressing] échec de signature des photos", err);
    return items;
  }
}

/**
 * Supprime des photos personnelles devenues orphelines. La politique du
 * bucket (migration 0023) restreint déjà la suppression au propriétaire du
 * préfixe {user_id}/ : une URL forgée pointant vers le dossier d'une autre
 * utilisatrice serait refusée par Supabase, pas seulement par ce code.
 */
export async function deleteDressingPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await getSupabase().storage.from("dressing-photos").remove(paths);
  if (error) throw error;
}

export async function deleteDressingItem(id: number): Promise<void> {
  const { error } = await getSupabase().from("dressing_items").delete().eq("id", id);
  if (error) throw error;
}

/** Met à jour une pièce existante ("Modifier les informations"/"Changer la photo", recette 24/08/2026) — mêmes colonnes qu'à l'insertion, jamais de nouvelle ligne. */
export async function updateDressingItem(id: number, item: Omit<Item, "id">): Promise<void> {
  const row = itemToRow(item, "");
  const { user_id: _userId, ...patch } = row;
  void _userId;
  const { error } = await getSupabase().from("dressing_items").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Enregistre le choix de revente d'une pièce (migration 0035). VOLONTAIREMENT
 * HORS de itemToRow : y ajouter `revente` enverrait la colonne à chaque
 * insertion et à chaque modification de pièce — et tant que la migration
 * n'est pas exécutée, TOUTES ces écritures échoueraient. Isolée ici, seule
 * cette action-là échoue, et l'appelant le dit.
 */
export async function updateDressingItemRevente(id: number, revente: ChoixRevente | null): Promise<void> {
  const { error } = await getSupabase().from("dressing_items").update({ revente }).eq("id", id);
  if (error) throw error;
}

/**
 * Enregistre les quatre saisons d'une pièce (migration 0040). Même règle que
 * `revente`, et pour la même raison : HORS de itemToRow. Tant que la colonne
 * n'existe pas, seule cette écriture échoue ; la pièce, elle, est enregistrée
 * avec sa valeur à trois choix (`season`), que le moteur lit seule.
 */
export async function updateDressingItemSaisons(id: number, saisons: CapsuleSeason[]): Promise<void> {
  const { error } = await getSupabase().from("dressing_items").update({ saisons }).eq("id", id);
  if (error) throw error;
}

/**
 * Enregistre la longueur des manches d'une pièce (migration 0042). Même règle
 * que `saisons` et `revente`, pour la même raison : HORS de itemToRow. Tant que
 * la colonne n'existe pas, seule cette écriture échoue — et l'appelant ne
 * l'émet que lorsque la valeur change.
 */
export async function updateDressingItemManches(id: number, manches: Manches | null): Promise<void> {
  const { error } = await getSupabase().from("dressing_items").update({ manches }).eq("id", id);
  if (error) throw error;
}

/**
 * Met à jour worn (et worn_prev si fourni) pour un lot de pièces — une
 * requête UPDATE par pièce (Promise.all) : les cibles diffèrent d'une pièce
 * à l'autre, un upsert nécessiterait de reposter les colonnes NOT NULL
 * (name, cat, color, hex, season) déjà en base, inutilement coûteux ici.
 */
export async function updateDressingItemWorn(
  updates: { id: number; worn: number | null; wornPrev?: number | null }[]
): Promise<void> {
  if (!updates.length) return;
  const supabase = getSupabase();
  const results = await Promise.all(
    updates.map(({ id, worn, wornPrev }) => {
      const patch: Record<string, unknown> = { worn };
      if (wornPrev !== undefined) patch.worn_prev = wornPrev;
      return supabase.from("dressing_items").update(patch).eq("id", id);
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

interface OutfitHistoryRow {
  id: number;
  user_id: string;
  occurred_at: string;
  piece_ids: number[];
  occasion: string;
  temp: number | null;
  weather_label: string | null;
}

function rowToHistoryEntry(row: OutfitHistoryRow): HistoryEntry {
  return {
    id: String(row.id),
    ts: new Date(row.occurred_at).getTime(),
    pieceIds: row.piece_ids ?? [],
    occasion: row.occasion as OccasionKey,
    temp: row.temp ?? undefined,
    weatherLabel: row.weather_label ?? undefined,
  };
}

/** Retourne [] en mode démo ou en cas d'échec réseau — l'appelant garde alors l'historique tel quel plutôt que de l'écraser. */
export async function fetchOutfitHistory(userId: string): Promise<HistoryEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabase()
      .from("outfit_history")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false });
    if (error) {
      console.error("[dressing] échec fetchOutfitHistory", error);
      return [];
    }
    return (data as OutfitHistoryRow[]).map(rowToHistoryEntry);
  } catch (err) {
    console.error("[dressing] échec fetchOutfitHistory", err);
    return [];
  }
}

/** Insère l'entrée et renvoie la ligne créée (id/occurred_at réels côté base). */
export async function insertOutfitHistoryEntry(userId: string, entry: Omit<HistoryEntry, "id">): Promise<HistoryEntry> {
  const { data, error } = await getSupabase()
    .from("outfit_history")
    .insert({
      user_id: userId,
      occurred_at: new Date(entry.ts).toISOString(),
      piece_ids: entry.pieceIds,
      occasion: entry.occasion,
      temp: entry.temp ?? null,
      weather_label: entry.weatherLabel ?? null,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Échec de l'insertion dans outfit_history");
  return rowToHistoryEntry(data as OutfitHistoryRow);
}

interface SavedLookRow {
  id: number;
  user_id: string;
  name: string;
  piece_ids: number[];
  occasion: string | null;
  source: string;
  created_at: string;
}

function rowToSavedLook(row: SavedLookRow): SavedLook {
  return {
    id: String(row.id),
    name: row.name,
    pieceIds: row.piece_ids ?? [],
    occasion: (row.occasion as OccasionKey | null) ?? undefined,
    source: row.source as SavedLook["source"],
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Retourne [] en mode démo ou en cas d'échec réseau — l'appelant garde alors les looks tels quels plutôt que de les écraser. */
export async function fetchSavedLooks(userId: string): Promise<SavedLook[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabase()
      .from("saved_looks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[dressing] échec fetchSavedLooks", error);
      return [];
    }
    return (data as SavedLookRow[]).map(rowToSavedLook);
  } catch (err) {
    console.error("[dressing] échec fetchSavedLooks", err);
    return [];
  }
}

/** Insère le look et renvoie la ligne créée (id réel côté base) — l'appelant l'ajoute à son state une fois la promesse résolue, jamais avant (cf. saveItem, même précaution). */
export async function insertSavedLook(userId: string, look: Omit<SavedLook, "id">): Promise<SavedLook> {
  const { data, error } = await getSupabase()
    .from("saved_looks")
    .insert({
      user_id: userId,
      name: look.name,
      piece_ids: look.pieceIds,
      occasion: look.occasion ?? null,
      source: look.source,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Échec de l'insertion dans saved_looks");
  return rowToSavedLook(data as SavedLookRow);
}

export async function deleteSavedLook(id: string): Promise<void> {
  const { error } = await getSupabase().from("saved_looks").delete().eq("id", id);
  if (error) throw error;
}

/** Ajoute une pièce à un look existant ("♡ Ajouter à un look", recette 24/08/2026, PieceScreen) — patch minimal (piece_ids uniquement). */
export async function updateSavedLook(id: string, pieceIds: number[]): Promise<void> {
  const { error } = await getSupabase().from("saved_looks").update({ piece_ids: pieceIds }).eq("id", id);
  if (error) throw error;
}

/* ── Avis rapide sur la tenue du jour (outfit_feedback, 0029) ──────────── */

export interface OutfitFeedbackRow {
  jour: string;
  piece_ids: number[];
  verdict: Verdict;
}

/**
 * Enregistre — ou corrige — l'avis du jour sur une tenue.
 *
 * `upsert` sur (user_id, jour, piece_ids) : un second tap remplace le verdict
 * au lieu d'empiler une ligne, ce que la contrainte d'unicité permet et que
 * `clePieces` rend fiable en triant les ids (cf. outfitFeedback.ts).
 *
 * `jour` est envoyé explicitement, en date locale : le défaut `current_date`
 * de la colonne est en UTC et classerait mal un avis donné après minuit.
 */
export async function upsertOutfitFeedback(
  userId: string,
  args: { pieceIds: readonly number[]; occasion: string | null; verdict: Verdict; jour?: string }
): Promise<void> {
  const { error } = await getSupabase()
    .from("outfit_feedback")
    .upsert(
      {
        user_id: userId,
        jour: args.jour ?? jourLocal(),
        piece_ids: clePieces(args.pieceIds),
        occasion: args.occasion,
        verdict: args.verdict,
      },
      { onConflict: "user_id,jour,piece_ids" }
    );
  if (error) throw error;
}

/**
 * Les avis déjà donnés AUJOURD'HUI, toutes tenues confondues.
 *
 * Chargé en bloc plutôt que ciblé sur la tenue courante : au démarrage, la
 * tenue n'est pas encore générée. L'écran retrouve ensuite la ligne qui
 * correspond à ses pièces. Une régénération dans la journée donne donc une
 * tenue sans verdict — c'est le comportement voulu, l'avis portait sur
 * l'autre.
 */
export async function fetchOutfitFeedbackDuJour(userId: string, jour = jourLocal()): Promise<OutfitFeedbackRow[]> {
  const { data, error } = await getSupabase()
    .from("outfit_feedback")
    .select("jour, piece_ids, verdict")
    .eq("user_id", userId)
    .eq("jour", jour);
  if (error) throw error;
  return (data ?? []) as OutfitFeedbackRow[];
}

/** Retire l'avis du jour sur cette tenue — repasser le même verdict l'annule. */
export async function deleteOutfitFeedback(userId: string, jour: string, pieceIds: readonly number[]): Promise<void> {
  const { error } = await getSupabase()
    .from("outfit_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("jour", jour)
    .eq("piece_ids", clePieces(pieceIds));
  if (error) throw error;
}
