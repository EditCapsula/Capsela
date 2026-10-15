import { MONTHS_FR } from "./data";

/**
 * « Membre depuis octobre 2026 » (15/10/2026, demandé : sous l'e-mail de Mon profil). La date est celle de l'inscription :
 * `created_at` du compte Supabase, ou la création du compte démo sur l'appareil. Sans date lisible, null : la ligne ne
 * s'affiche pas plutôt que d'afficher une date inventée. Mois et année lus dans le fuseau de l'appareil.
 */
export function libelleMembreDepuis(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Membre depuis ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
