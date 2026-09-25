import { estAvis, piecesSuggerees, type AvisStyliste, type PieceSuggeree } from "./avisStylisteClient";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/*
 * AVIS DE STYLISTE ENREGISTRÉS DANS LE JOURNAL (docs/avis-de-styliste.md
 * sections 14 et 23 ; migration 0036 ; arbitrages du 25/09/2026).
 *
 * AVANT LA MIGRATION 0036 (exécutée à la main, jamais supposée faite) :
 * l'enregistrement échoue et l'écran le dit ; la lecture rend une liste
 * vide — la section du Journal reste masquée. Rien ne casse ailleurs : ces
 * accès sont isolés, aucune autre écriture n'en dépend.
 *
 * LA PHOTO : bucket PRIVÉ, lue par URL signée (1 h), jamais par URL publique.
 * Elle n'est écrite que sur « Enregistrer dans mon journal ».
 */

export const BUCKET_AVIS = "avis-styliste-photos";
/** Durée de validité des URL signées des photos (s). Suffit pour une visite du Journal. */
const DUREE_URL_SIGNEE_S = 3600;

export interface AvisEnregistre {
  id: string;
  creeLe: number;
  analyseId: string;
  avis: AvisStyliste;
  pieces: PieceSuggeree[];
  photoPath: string | null;
  /** URL signée, remplie à la lecture ; null si pas de photo ou signature impossible. */
  photoUrl: string | null;
}

interface LigneAvis {
  id: string;
  created_at: string;
  analyse_id: string;
  resultat: unknown;
  pieces_dressing: unknown;
  photo_path: string | null;
}

/** Ligne → avis ; null si le résultat stocké n'a pas la forme attendue (jamais affiché tel quel). */
export function ligneVersAvis(l: LigneAvis, photoUrl: string | null = null): AvisEnregistre | null {
  if (!l || typeof l.id !== "string" || !estAvis(l.resultat)) return null;
  const t = Date.parse(l.created_at);
  return {
    id: l.id,
    creeLe: Number.isFinite(t) ? t : 0,
    analyseId: String(l.analyse_id ?? ""),
    avis: l.resultat,
    pieces: piecesSuggerees(l.pieces_dressing),
    photoPath: typeof l.photo_path === "string" ? l.photo_path : null,
    photoUrl,
  };
}

/** Table ou relation absente (migration non exécutée) — distincte d'une vraie panne. */
export function estTableAbsente(erreur: { code?: string } | null | undefined): boolean {
  return erreur?.code === "42P01" || erreur?.code === "PGRST205";
}

/**
 * Enregistre l'avis affiché, avec sa photo (arbitré : conservée tant que
 * l'avis existe). Photo d'abord, puis la ligne ; si la ligne échoue, la photo
 * est retirée — pas de fichier orphelin. Un même résultat déjà enregistré
 * (analyse_id unique) est rendu tel quel : jamais de doublon.
 */
export async function enregistrerAvis(
  userId: string,
  donnees: { analyseId: string; avis: AvisStyliste; pieces: PieceSuggeree[]; photo: File | null }
): Promise<AvisEnregistre | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabase();
  let chemin: string | null = null;
  try {
    if (donnees.photo) {
      chemin = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET_AVIS).upload(chemin, donnees.photo, { contentType: "image/jpeg", upsert: false });
      if (error) return null;
    }
    const { data, error } = await supabase
      .from("avis_styliste")
      .insert({
        user_id: userId,
        analyse_id: donnees.analyseId,
        resultat: donnees.avis,
        pieces_dressing: donnees.pieces,
        photo_path: chemin,
      })
      .select("*")
      .single();
    if (error) {
      if (chemin) await supabase.storage.from(BUCKET_AVIS).remove([chemin]).catch(() => undefined);
      if (error.code === "23505") {
        // Déjà enregistré (double envoi rattrapé par la contrainte d'unicité).
        const { data: existant } = await supabase.from("avis_styliste").select("*").eq("analyse_id", donnees.analyseId).maybeSingle();
        return existant ? ligneVersAvis(existant as LigneAvis) : null;
      }
      return null;
    }
    return ligneVersAvis(data as LigneAvis);
  } catch {
    if (chemin) await supabase.storage.from(BUCKET_AVIS).remove([chemin]).catch(() => undefined);
    return null;
  }
}

/** Avis de l'utilisatrice, du plus récent au plus ancien, photos signées. [] en cas d'échec (section masquée). */
export async function listerAvis(userId: string): Promise<AvisEnregistre[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("avis_styliste").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    const lignes = data as LigneAvis[];
    const chemins = lignes.map((l) => l.photo_path).filter((c): c is string => Boolean(c));
    const urls = new Map<string, string>();
    if (chemins.length) {
      const { data: signees } = await supabase.storage.from(BUCKET_AVIS).createSignedUrls(chemins, DUREE_URL_SIGNEE_S);
      for (const s of signees ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    return lignes.map((l) => ligneVersAvis(l, l.photo_path ? urls.get(l.photo_path) ?? null : null)).filter((a): a is AvisEnregistre => Boolean(a));
  } catch {
    return [];
  }
}

/** Supprime l'avis, puis sa photo (§14). false si la ligne n'a pas pu être supprimée. */
export async function supprimerAvis(avis: AvisEnregistre): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("avis_styliste").delete().eq("id", avis.id);
    if (error) return false;
    // La ligne est partie : la photo suit, au mieux — un échec ici laisse un
    // fichier privé, jamais un avis sans photo.
    if (avis.photoPath) await supabase.storage.from(BUCKET_AVIS).remove([avis.photoPath]).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
