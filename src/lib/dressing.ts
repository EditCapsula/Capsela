import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  AccessoireType,
  BijouType,
  CategoryKey,
  Coupe,
  HistoryEntry,
  Item,
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
    occasion: (row.occasion as OccasionKey[] | null) ?? undefined,
    shoeType: (row.shoe_type as ShoeType | null) ?? undefined,
    matiere: (row.matiere as Matiere | null) ?? undefined,
    coupe: (row.coupe as Coupe | null) ?? undefined,
    sacType: (row.sac_type as SacType | null) ?? undefined,
    bijouType: (row.bijou_type as BijouType | null) ?? undefined,
    accessoireType: (row.accessoire_type as AccessoireType | null) ?? undefined,
    subtype: row.subtype ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    worn: row.worn,
    wornPrev: row.worn_prev ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
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
    photo_url: item.photoUrl ?? null,
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
    return (data as DressingItemRow[]).map(rowToItem);
  } catch (err) {
    console.error("[dressing] échec fetchDressingItems", err);
    return [];
  }
}

/**
 * Upload la photo réelle d'une pièce vers le bucket dressing-photos (cf.
 * migration 0023) et renvoie son URL publique définitive — remplace
 * l'ancienne URL locale (blob:) qui redevenait invalide au rechargement.
 * Chemin {user_id}/{uuid}.{ext} : l'UUID évite toute collision entre deux
 * photos, l'extension est déduite du type MIME du fichier.
 */
export async function uploadDressingPhoto(userId: string, file: File): Promise<string> {
  const ext = file.type.split("/")[1] || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase()
    .storage.from("dressing-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = getSupabase().storage.from("dressing-photos").getPublicUrl(path);
  return data.publicUrl;
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
  return rowToItem(data as DressingItemRow);
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
