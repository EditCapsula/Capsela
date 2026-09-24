import { getSupabase, isSupabaseConfigured } from "./supabase";
import { jourLocal } from "./outfitFeedback";
import type { MomentJournee } from "./prevision";
import type { OccasionKey } from "./types";

/**
 * TENUES PLANIFIÉES — accès à `planned_outfits` (migration 0030).
 *
 * Mêmes conventions que la couche saved_looks / outfit_feedback de
 * dressing.ts : lecture qui rend [] plutôt que de jeter, écriture qui jette
 * pour que l'appelant n'ajoute rien à son state avant confirmation, et mode
 * démo (Supabase non configuré) traité comme une base vide.
 *
 * `jour` est TOUJOURS envoyé en date locale. Le défaut `current_date` de la
 * colonne est en UTC : une tenue planifiée après minuit serait classée la
 * veille. Le défaut n'est qu'un filet, jamais le chemin normal.
 */

export interface TenuePlanifiee {
  id: string;
  /** AAAA-MM-JJ, en date locale. */
  jour: string;
  moment: MomentJournee;
  occasion: OccasionKey;
  /** WorkMode ou DateContext selon l'occasion ; null pour les huit autres. */
  sousChoix: string | null;
  lieu: string;
  typeLieu: string | null;
  dressingSeul: boolean;
  pieceIds: number[];
  /** La PRÉVISION au moment de planifier, pas la météo du jour J. */
  temp: number | null;
  weatherLabel: string | null;
}

interface PlannedOutfitRow {
  id: number | string;
  jour: string;
  moment: string;
  occasion: string;
  sous_choix: string | null;
  lieu: string;
  type_lieu: string | null;
  dressing_seul: boolean;
  piece_ids: number[];
  temp: number | string | null;
  weather_label: string | null;
}

function rowToTenue(r: PlannedOutfitRow): TenuePlanifiee {
  return {
    id: String(r.id),
    jour: r.jour,
    moment: r.moment as MomentJournee,
    occasion: r.occasion as OccasionKey,
    sousChoix: r.sous_choix,
    lieu: r.lieu,
    typeLieu: r.type_lieu,
    dressingSeul: r.dressing_seul,
    pieceIds: r.piece_ids ?? [],
    // `numeric` revient en chaîne côté PostgREST — le convertir ici, une
    // fois, plutôt que de laisser chaque écran deviner son type.
    temp: r.temp == null ? null : Number(r.temp),
    weatherLabel: r.weather_label,
  };
}

/** Rend [] en mode démo ou en cas d'échec — l'écran affiche alors « rien de prévu », jamais une erreur. */
export async function fetchTenuesPlanifiees(userId: string): Promise<TenuePlanifiee[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabase()
      .from("planned_outfits")
      .select("id, jour, moment, occasion, sous_choix, lieu, type_lieu, dressing_seul, piece_ids, temp, weather_label")
      .eq("user_id", userId)
      .order("jour", { ascending: true });
    if (error) {
      console.error("[planifier] échec fetchTenuesPlanifiees", error);
      return [];
    }
    return (data as PlannedOutfitRow[]).map(rowToTenue);
  } catch (err) {
    console.error("[planifier] échec fetchTenuesPlanifiees", err);
    return [];
  }
}

/**
 * Enregistre — ou remplace — la tenue d'un créneau.
 *
 * `upsert` sur (user_id, jour, moment) : replanifier le même créneau corrige
 * la ligne au lieu d'en empiler une seconde, ce que la contrainte d'unicité
 * de la migration 0030 rend possible. Deux créneaux distincts le même jour
 * restent deux lignes.
 *
 * Jette en cas d'échec : l'appelant n'ajoute la tenue à son state qu'une fois
 * la promesse résolue, jamais avant (même précaution que insertSavedLook).
 */
export async function upsertTenuePlanifiee(
  userId: string,
  t: Omit<TenuePlanifiee, "id">
): Promise<TenuePlanifiee> {
  const { data, error } = await getSupabase()
    .from("planned_outfits")
    .upsert(
      {
        user_id: userId,
        jour: t.jour,
        moment: t.moment,
        occasion: t.occasion,
        sous_choix: t.sousChoix,
        lieu: t.lieu,
        type_lieu: t.typeLieu,
        dressing_seul: t.dressingSeul,
        piece_ids: t.pieceIds,
        temp: t.temp,
        weather_label: t.weatherLabel,
      },
      { onConflict: "user_id,jour,moment" }
    )
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Échec de l'écriture dans planned_outfits");
  return rowToTenue(data as PlannedOutfitRow);
}

export async function deleteTenuePlanifiee(id: string): Promise<void> {
  const { error } = await getSupabase().from("planned_outfits").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Répartit les tenues entre les deux onglets de la liste.
 *
 * LA BASCULE SE FAIT SUR LE JOUR, PAS SUR L'HEURE. Une tenue prévue ce soir
 * reste « à venir » toute la journée : la faire passer en « passée » à midi
 * parce que le créneau du matin est écoulé demanderait de comparer des heures
 * que la colonne `moment` ne porte pas — elle nomme un moment, elle ne le
 * date pas. Le jour même, tout est à venir.
 *
 * Les à-venir sont triées du plus proche au plus lointain, les passées du
 * plus récent au plus ancien : dans les deux cas, ce qui compte d'abord est
 * en tête.
 */
export function repartirParEcheance(
  tenues: readonly TenuePlanifiee[],
  aujourdHui: string = jourLocal()
): { aVenir: TenuePlanifiee[]; passees: TenuePlanifiee[] } {
  const aVenir: TenuePlanifiee[] = [];
  const passees: TenuePlanifiee[] = [];
  for (const t of tenues) (t.jour >= aujourdHui ? aVenir : passees).push(t);
  aVenir.sort((a, b) => a.jour.localeCompare(b.jour));
  passees.sort((a, b) => b.jour.localeCompare(a.jour));
  return { aVenir, passees };
}
