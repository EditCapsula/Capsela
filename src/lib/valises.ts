import { getSupabase, isSupabaseConfigured } from "./supabase";
import { jourLocal } from "./outfitFeedback";
import type { TenuePlanifiee } from "./planifier";
import type { OccasionKey } from "./types";
import type { LookValise, MeteoJour, SituationValise, TailleBagage, TypeSejour } from "./valise";

/**
 * LES VALISES ENREGISTRÉES — accès à `valises` (migrations 0038, 0039) et
 * copie sur l'appareil (docs/valise.md).
 *
 * PLUSIEURS VALISES DEPUIS LE 27/09/2026 : elles remontent dans « Mes
 * planifications » (Planifier), à venir jusqu'à leur date de retour, puis
 * passées. « Nouvelle valise » en ajoute une au lieu de remplacer la
 * précédente ; supprimer est une action explicite.
 *
 * DEUX ENDROITS, UNE SEULE LISTE. Les valises sont toujours gardées sur
 * l'appareil (localStorage), et en plus dans le compte quand la table
 * existe. Une valise créée hors ligne, ou avant la migration, porte un
 * identifiant local (« local-… ») jusqu'à ce que le compte l'accepte ;
 * l'écran dit où elle est gardée plutôt que de laisser croire qu'elle
 * suivra sur un autre téléphone.
 *
 * Lecture qui rend null quand le compte n'est pas joignable ([] quand il
 * répond sans valise) ; écriture qui rend un résultat que l'écran affiche ;
 * mode démo traité comme un compte absent.
 */

export interface ValiseGardee {
  version: 2;
  /** Identifiant du compte (bigserial, en chaîne) ou local (« local-… ») tant qu'elle n'y est pas. */
  id: string;
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
  /**
   * Les pièces du dressing au moment du calcul (27/09/2026) : une pièce
   * ajoutée depuis se reconnaît, et l'écran propose de recomposer la valise.
   * Absent des valises plus anciennes.
   */
  dressingIds?: number[];
}

let compteur = 0;
/** Identifiant d'une valise pas encore enregistrée dans le compte. */
export const nouvelIdLocal = () => `local-${Date.now().toString(36)}-${(compteur++).toString(36)}`;
export const estIdLocal = (id: string) => id.startsWith("local-");

/** Valise du lot 1 (version 1) ou de la version à une seule valise, reprise sans rien perdre. */
type ValiseAncienne = Omit<ValiseGardee, "version" | "id"> & { version: 1 | 2; id?: string };

export function normaliserValise(v: ValiseAncienne | null | undefined): ValiseGardee | null {
  if (!v || (v.version !== 1 && v.version !== 2)) return null;
  return { ...v, version: 2, id: v.id ?? nouvelIdLocal() };
}

/** Ajoute ou remplace une valise de la liste, par identifiant. */
export function avecValise(liste: ValiseGardee[], v: ValiseGardee): ValiseGardee[] {
  return liste.some((x) => x.id === v.id) ? liste.map((x) => (x.id === v.id ? v : x)) : [v, ...liste];
}

// ── Mes planifications : tenues et valises ──────────────────────────────

export type Planification = { type: "tenue"; tenue: TenuePlanifiee } | { type: "valise"; valise: ValiseGardee };

/**
 * Tenues planifiées et valises, réparties entre « À venir » et « Passées ».
 *
 * Une valise est À VENIR JUSQU'À SON RETOUR : pendant le séjour, c'est
 * encore elle qu'on ouvre. Une tenue bascule sur son jour (repartirParEcheance).
 * À venir : la plus proche d'abord (départ d'une valise, jour d'une tenue) ;
 * passées : la plus récente d'abord (retour d'une valise).
 */
export function repartirPlanifications(
  tenues: readonly TenuePlanifiee[],
  valises: readonly ValiseGardee[],
  aujourdHui: string = jourLocal()
): { aVenir: Planification[]; passees: Planification[] } {
  const aVenir: [string, Planification][] = [];
  const passees: [string, Planification][] = [];
  for (const t of tenues) (t.jour >= aujourdHui ? aVenir : passees).push([t.jour, { type: "tenue", tenue: t }]);
  for (const v of valises) {
    if (v.retour >= aujourdHui) aVenir.push([v.depart, { type: "valise", valise: v }]);
    else passees.push([v.retour, { type: "valise", valise: v }]);
  }
  aVenir.sort((a, b) => a[0].localeCompare(b[0]));
  passees.sort((a, b) => b[0].localeCompare(a[0]));
  return { aVenir: aVenir.map(([, p]) => p), passees: passees.map(([, p]) => p) };
}

// ── Sur l'appareil ───────────────────────────────────────────────────────

const cleListe = (userId: string | null) => `capsela.valises.${userId ?? "demo"}`;
/** Clé de la version à une seule valise : reprise une fois, puis retirée. */
const cleAncienne = (userId: string | null) => `capsela.valise.${userId ?? "demo"}`;

export function lireValisesLocales(userId: string | null): ValiseGardee[] {
  try {
    const raw = localStorage.getItem(cleListe(userId));
    const liste = raw ? ((JSON.parse(raw) as ValiseAncienne[]).map(normaliserValise).filter(Boolean) as ValiseGardee[]) : [];
    const ancienne = localStorage.getItem(cleAncienne(userId));
    if (ancienne) {
      const v = normaliserValise(JSON.parse(ancienne));
      localStorage.removeItem(cleAncienne(userId));
      if (v) {
        const reprise = avecValise(liste, v);
        garderValisesLocales(userId, reprise);
        return reprise;
      }
    }
    return liste;
  } catch {
    return [];
  }
}

export function garderValisesLocales(userId: string | null, liste: ValiseGardee[]) {
  try {
    localStorage.setItem(cleListe(userId), JSON.stringify(liste));
  } catch {
    // Stockage indisponible : les valises restent affichées, elles ne survivront pas au rechargement.
  }
}

// ── Dans le compte ───────────────────────────────────────────────────────

interface ValiseRow {
  id?: number | string;
  destination: string;
  depart: string;
  retour: string;
  bagage: TailleBagage;
  sejour: string | null;
  occasions: string[];
  piece_ids: (number | string)[];
  calcul: Pick<ValiseGardee, "meteos" | "situations" | "looks" | "situationsSansLook" | "dressingIds">;
}

const nombres = (l: (number | string)[] | null | undefined) => (l ?? []).map(Number);

export function rowToValise(r: ValiseRow): ValiseGardee {
  return {
    version: 2,
    id: String(r.id),
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
    ...(r.calcul?.dressingIds ? { dressingIds: r.calcul.dressingIds } : {}),
    // bigint[] revient parfois en chaînes côté PostgREST.
    pieceIds: nombres(r.piece_ids),
  };
}

export function valiseToRow(v: ValiseGardee): Omit<ValiseRow, "id"> {
  return {
    destination: v.destination,
    depart: v.depart,
    retour: v.retour,
    bagage: v.bagage,
    sejour: v.sejour,
    occasions: v.occasions,
    piece_ids: v.pieceIds,
    calcul: {
      meteos: v.meteos,
      situations: v.situations,
      looks: v.looks,
      situationsSansLook: v.situationsSansLook,
      ...(v.dressingIds ? { dressingIds: v.dressingIds } : {}),
    },
  };
}

/** null en mode démo ou en cas d'échec (table absente comprise) ; [] quand le compte n'a aucune valise. */
export async function fetchValises(userId: string): Promise<ValiseGardee[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase()
      .from("valises")
      .select("id, destination, depart, retour, bagage, sejour, occasions, piece_ids, calcul")
      .eq("user_id", userId)
      .order("depart", { ascending: false });
    if (error || !data) return null;
    return (data as ValiseRow[]).map(rowToValise);
  } catch {
    return null;
  }
}

/**
 * Enregistre la valise dans le compte : met à jour la ligne si elle y est
 * déjà, l'insère sinon et rend son nouvel identifiant. Rien n'est
 * journalisé : la destination et les dates sont des données personnelles.
 */
export async function enregistrerValise(userId: string, v: ValiseGardee): Promise<{ ok: boolean; id: string }> {
  if (!isSupabaseConfigured) return { ok: false, id: v.id };
  try {
    const ligne = { ...valiseToRow(v), updated_at: new Date().toISOString() };
    if (!estIdLocal(v.id)) {
      const { error } = await getSupabase().from("valises").update(ligne).eq("id", v.id).eq("user_id", userId);
      return { ok: !error, id: v.id };
    }
    const { data, error } = await getSupabase()
      .from("valises")
      .insert({ user_id: userId, ...ligne })
      .select("id")
      .single();
    if (error || !data) return { ok: false, id: v.id };
    return { ok: true, id: String((data as { id: number | string }).id) };
  } catch {
    return { ok: false, id: v.id };
  }
}

/** Une valise locale n'a rien à supprimer dans le compte. */
export async function supprimerValiseDuCompte(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || estIdLocal(id)) return true;
  try {
    const { error } = await getSupabase().from("valises").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
