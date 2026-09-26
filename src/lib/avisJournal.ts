import { estAvis, piecesSuggerees, type AvisStyliste, type PieceSuggeree } from "./avisStylisteClient";
import { lireReconnaissance, type VetementReconnu } from "./reconnaissance";
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
 * Elle est écrite avec l'avis, enregistré automatiquement dès sa réception
 * (26/09/2026 ; auparavant sur « Enregistrer dans mon journal »).
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
  /** Pièces reconnues sur la photo, corrections comprises (migration 0037) — [] avant elle, ou pour un avis plus ancien. */
  reconnaissance: VetementReconnu[];
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
  /** Absente avant la migration 0037 : `select("*")` ne la rend simplement pas. */
  pieces_reconnues?: unknown;
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
    reconnaissance: lireReconnaissance(l.pieces_reconnues),
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

/**
 * Écrit la reconnaissance (corrections comprises) sur un avis enregistré.
 * ISOLÉE de l'insertion (règle du projet) : avant la migration 0037 —
 * colonne absente, ou pas de droit de mise à jour —, elle échoue seule et
 * l'écran le dit ; l'avis, lui, est bien enregistré. Une mise à jour refusée
 * par RLS ne lève pas d'erreur : elle ne touche aucune ligne, d'où la
 * relecture de l'identifiant.
 */
export async function enregistrerReconnaissanceAvis(avisId: string, reconnaissance: VetementReconnu[]): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await getSupabase().from("avis_styliste").update({ pieces_reconnues: reconnaissance }).eq("id", avisId).select("id");
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
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

/* ───────── Présentation dans le Journal (26/09/2026) ───────── */

/**
 * Le verdict d'une carte, tiré de l'avis global RÉEL — aucune génération de
 * plus, aucune note. La styliste ouvre souvent son avis par une formule
 * courte (« Une tenue lumineuse et fluide : … ») : c'est elle, jusqu'à la
 * première ponctuation forte, si elle fait entre 12 et 60 caractères. Sinon
 * null — la carte montre alors l'avis global lui-même, tronqué.
 */
export function verdictCourt(avisGlobal: string): string | null {
  const t = avisGlobal.trim();
  const m = /^(.+?)\s*[:.;—!?]/.exec(t);
  if (!m) return null;
  const tete = m[1].trim();
  return tete.length >= 12 && tete.length <= 60 ? tete : null;
}

/** Du plus récent au plus ancien, sur la date réellement enregistrée — sans modifier la liste reçue. */
export function trierAvisRecents<T extends { creeLe: number }>(avis: T[]): T[] {
  return [...avis].sort((a, b) => b.creeLe - a.creeLe);
}
