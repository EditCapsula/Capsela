import type { IdVisite } from "./visites";

/*
 * LES VISITES DÉJÀ VUES (05/11/2026, arbitré : « dans le compte Supabase, avec l'appareil en secours »). Dans le compte : la liste
 * `visitesVues` de `profiles.prefs` (le champ JSON des préférences, sans migration, comme les congés) — elle suit l'utilisatrice d'un
 * appareil à l'autre. Sur l'appareil : `capsela.visites.<compte>`, écrite d'abord, pour qu'une visite fermée ne revienne pas même
 * si l'écriture dans le compte échoue (hors ligne, mode démo). La liste vue est l'union des deux. La clé locale part avec le compte
 * (donneesLocales.ts).
 */

export const cleVisitesLocales = (userId: string | null): string => `capsela.visites.${userId ?? "demo"}`;

export function lireVuesLocales(userId: string | null): string[] {
  try {
    const brut = localStorage.getItem(cleVisitesLocales(userId));
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function ecrireVuesLocales(userId: string | null, vues: readonly string[]): void {
  try {
    localStorage.setItem(cleVisitesLocales(userId), JSON.stringify([...new Set(vues)]));
  } catch {
    // Stockage refusé (navigation privée) : le compte garde la liste.
  }
}

/** Les visites vues : celles du compte et celles de l'appareil, sans doublon. */
export function vuesReunies(duCompte: readonly string[] | undefined, locales: readonly string[]): string[] {
  return [...new Set([...(duCompte ?? []), ...locales])];
}

// ── La visite demandée depuis l'Aide (Gérer mon compte → Support) ──────────────────────────────────────────────────────────

let demandee: IdVisite | null = null;
const abonnes = new Set<() => void>();

/** Demande la relance d'une visite : elle se jouera à la prochaine ouverture de son écran, même déjà vue. */
export function demanderVisite(id: IdVisite): void {
  demandee = id;
  abonnes.forEach((f) => f());
}

export const visiteDemandee = (): IdVisite | null => demandee;

/** La demande est prise en compte : elle ne se rejoue pas. */
export function oublierDemande(): void {
  demandee = null;
}

export function suivreDemandes(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
