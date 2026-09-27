import { getSupabase, isSupabaseConfigured } from "./supabase";
import { jourLocal } from "./outfitFeedback";
import type { OccasionKey } from "./types";
import type { LookValise, MeteoJour, SituationValise, TailleBagage, TypeSejour } from "./valise";

/**
 * LA VALISE ENREGISTRÉE — accès à `valises` (migration 0038) et copie sur
 * l'appareil (docs/valise.md).
 *
 * DEUX ENDROITS, UN SEUL ÉTAT. La valise est toujours gardée sur l'appareil
 * (localStorage), et en plus dans le compte quand la table existe. Avant la
 * migration, l'écriture en base échoue : la valise fonctionne quand même, et
 * l'écran dit où elle est gardée (« sur cet appareil » / « dans ton compte »)
 * plutôt que de laisser croire qu'elle suivra sur un autre téléphone.
 *
 * Lecture qui rend null plutôt que de jeter ; écriture qui rend un booléen
 * (l'écran l'affiche) ; mode démo traité comme une base absente.
 */

export interface ValiseGardee {
  version: 2;
  destination: string;
  depart: string;
  retour: string;
  bagage: TailleBagage;
  sejour: TypeSejour | null;
  occasions: OccasionKey[];
  meteos: MeteoJour[];
  situations: SituationValise[];
  pieceIds: number[];
  looks: LookValise[];
  situationsSansLook: number[];
}

/** Valise du lot 1 (version 1), reprise sans rien perdre. */
interface ValiseV1 extends Omit<ValiseGardee, "version"> {
  version: 1;
}

export function normaliserValise(v: ValiseGardee | ValiseV1 | null | undefined): ValiseGardee | null {
  if (!v) return null;
  if (v.version === 2) return v;
  if (v.version === 1) return { ...v, version: 2 };
  return null;
}

/** Un séjour terminé ne se rouvre pas : on repart d'une valise neuve. */
export const valiseEnCours = (v: ValiseGardee | null, aujourdHui = jourLocal()) => (v && v.retour >= aujourdHui ? v : null);

// ── Sur l'appareil ───────────────────────────────────────────────────────

const cleStockage = (userId: string | null) => `capsela.valise.${userId ?? "demo"}`;

export function lireValiseLocale(userId: string | null): ValiseGardee | null {
  try {
    const raw = localStorage.getItem(cleStockage(userId));
    return raw ? valiseEnCours(normaliserValise(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
}

export function garderValiseLocale(userId: string | null, v: ValiseGardee | null) {
  try {
    if (v) localStorage.setItem(cleStockage(userId), JSON.stringify(v));
    else localStorage.removeItem(cleStockage(userId));
  } catch {
    // Stockage indisponible : la valise reste affichée, elle ne survivra pas au rechargement.
  }
}

// ── Dans le compte ───────────────────────────────────────────────────────

interface ValiseRow {
  destination: string;
  depart: string;
  retour: string;
  bagage: TailleBagage;
  sejour: string | null;
  occasions: string[];
  piece_ids: (number | string)[];
  calcul: Pick<ValiseGardee, "meteos" | "situations" | "looks" | "situationsSansLook">;
}

const nombres = (l: (number | string)[] | null | undefined) => (l ?? []).map(Number);

export function rowToValise(r: ValiseRow): ValiseGardee {
  return {
    version: 2,
    destination: r.destination,
    depart: r.depart,
    retour: r.retour,
    bagage: r.bagage,
    sejour: (r.sejour as TypeSejour | null) ?? null,
    occasions: (r.occasions ?? []) as OccasionKey[],
    meteos: r.calcul?.meteos ?? [],
    situations: r.calcul?.situations ?? [],
    looks: r.calcul?.looks ?? [],
    situationsSansLook: r.calcul?.situationsSansLook ?? [],
    // bigint[] revient parfois en chaînes côté PostgREST.
    pieceIds: nombres(r.piece_ids),
  };
}

export function valiseToRow(v: ValiseGardee): ValiseRow {
  return {
    destination: v.destination,
    depart: v.depart,
    retour: v.retour,
    bagage: v.bagage,
    sejour: v.sejour,
    occasions: v.occasions,
    piece_ids: v.pieceIds,
    calcul: { meteos: v.meteos, situations: v.situations, looks: v.looks, situationsSansLook: v.situationsSansLook },
  };
}

/** null en mode démo, sans ligne, ou en cas d'échec (table absente avant la migration comprise). */
export async function fetchValise(userId: string): Promise<ValiseGardee | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase()
      .from("valises")
      .select("destination, depart, retour, bagage, sejour, occasions, piece_ids, calcul")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return valiseEnCours(rowToValise(data as ValiseRow));
  } catch {
    return null;
  }
}

/**
 * true si la valise est enregistrée dans le compte. Rien n'est journalisé :
 * la destination et les dates sont des données personnelles, et l'échec
 * attendu avant la migration n'apprendrait rien de plus que l'écran.
 */
export async function enregistrerValise(userId: string, v: ValiseGardee): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await getSupabase()
      .from("valises")
      .upsert({ user_id: userId, ...valiseToRow(v), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return !error;
  } catch {
    return false;
  }
}

export async function supprimerValise(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await getSupabase().from("valises").delete().eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}
