/*
 * MISE EN VALEUR ET COUPES PRÉFÉRÉES (31/10/2026, brief « Évolution de l'onboarding Capsela »,
 * docs/onboarding-evolution/diagnostic-et-proposition.md).
 *
 * Deux préférences DÉCLARÉES, rangées dans une seule colonne jsonb nullable
 * (`profiles.preferences_silhouette`, migration 0054), sur le modèle de `colorimetrie` (0034).
 *
 * TROIS ÉTATS PAR CHAMP, et la différence compte :
 *   - `null` : la question n'a jamais été posée (profils antérieurs) ;
 *   - `[]`   : réponse donnée, « Aucune préférence particulière » / « Cela dépend du vêtement » ;
 *   - liste  : les options choisies.
 * Un champ `[]` est RENSEIGNÉ (arbitrage du 31/10/2026 : ces champs comptent dans la complétude, et
 * la réponse neutre vaut réponse).
 *
 * Aucun effet moteur à ce stade : le branchement (coupes à la sélection de la capsule, neutralisation
 * de `valeurDirection` pour épaules / hanches) passe d'abord par un audit, cf. § 2.4 du diagnostic.
 */

export const MISES_EN_VALEUR = ["taille", "jambes", "decollete", "epaules", "bras", "hanches", "dos", "courbes"] as const;
export type MiseEnValeur = (typeof MISES_EN_VALEUR)[number];

export const COUPES_PREFEREES = ["ajustees", "droites", "fluides", "amples", "structurees"] as const;
export type CoupePreferee = (typeof COUPES_PREFEREES)[number];

export interface PreferencesSilhouette {
  miseEnValeur: MiseEnValeur[] | null;
  coupes: CoupePreferee[] | null;
}

export const PREFERENCES_SILHOUETTE_VIDES: PreferencesSilhouette = { miseEnValeur: null, coupes: null };

/** Lu tel quel en base : une valeur inconnue est écartée, un champ absent ou mal formé redevient `null` (jamais posé). */
export function lirePreferencesSilhouette(brut: unknown): PreferencesSilhouette {
  if (!brut || typeof brut !== "object") return PREFERENCES_SILHOUETTE_VIDES;
  const o = brut as Record<string, unknown>;
  const liste = <T extends string>(v: unknown, permis: readonly T[]): T[] | null =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is T => (permis as readonly string[]).includes(x as string)))] : null;
  return { miseEnValeur: liste(o.miseEnValeur, MISES_EN_VALEUR), coupes: liste(o.coupes, COUPES_PREFEREES) };
}

/** La forme écrite en base (version incluse, pour qu'une évolution de la forme reste lisible). */
export function preferencesSilhouetteVersLigne(p: PreferencesSilhouette): Record<string, unknown> {
  return { version: 1, miseEnValeur: p.miseEnValeur, coupes: p.coupes };
}

export function memesPreferencesSilhouette(a: PreferencesSilhouette, b: PreferencesSilhouette): boolean {
  const eq = (x: string[] | null, y: string[] | null) =>
    x === null || y === null ? x === y : x.length === y.length && [...x].sort().join() === [...y].sort().join();
  return eq(a.miseEnValeur, b.miseEnValeur) && eq(a.coupes, b.coupes);
}
