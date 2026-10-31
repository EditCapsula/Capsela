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

/* ── Affichage (onboarding, Mon profil, récapitulatif) ───────────────────────────────────────── */

export const LIBELLES_MISE_EN_VALEUR: Record<MiseEnValeur, string> = {
  taille: "Ma taille",
  jambes: "Mes jambes",
  decollete: "Mon décolleté",
  epaules: "Mes épaules",
  bras: "Mes bras",
  hanches: "Mes hanches",
  dos: "Mon dos",
  courbes: "Mes courbes",
};

export const LIBELLES_COUPES: Record<CoupePreferee, string> = {
  ajustees: "Ajustées",
  droites: "Droites",
  fluides: "Fluides",
  amples: "Amples",
  structurees: "Structurées",
};

export const LIBELLE_SANS_MISE_EN_VALEUR = "Aucune préférence particulière";
export const LIBELLE_SANS_COUPE = "Cela dépend du vêtement";

/**
 * Les options proposées selon le genre (arbitrage du 31/10/2026) : pour un homme, ni décolleté, ni courbes, ni hanches — cinq
 * options. Genre non renseigné : la liste complète, comme la grille de styles. Une valeur hors de la liste du genre, restée d'un
 * autre genre, n'est ni affichée ni comptée (`miseEnValeurDuGenre`).
 */
const MISE_EN_VALEUR_HOMME: readonly MiseEnValeur[] = ["taille", "jambes", "epaules", "bras", "dos"];
export function misesEnValeurProposees(gender: string | null): readonly MiseEnValeur[] {
  return gender === "homme" ? MISE_EN_VALEUR_HOMME : MISES_EN_VALEUR;
}
export function miseEnValeurDuGenre(valeurs: MiseEnValeur[] | null, gender: string | null): MiseEnValeur[] | null {
  if (valeurs === null) return null;
  const permis = misesEnValeurProposees(gender);
  const gardees = valeurs.filter((v) => permis.includes(v));
  // Des choix tous hors du genre ne deviennent pas « aucune préférence » : la question est à reposer.
  return gardees.length || !valeurs.length ? gardees : null;
}

/**
 * Visuels (31/10/2026) : détails de vêtements femme, sans mannequin, en 3:4. Côté homme, les visuels sont à produire
 * (docs/onboarding-evolution/prompts-visuels.md) : `null`, la carte s'affiche alors sans image — jamais un visuel femme.
 */
export function visuelMiseEnValeur(v: MiseEnValeur, gender: string | null): string | null {
  return gender === "homme" ? null : `/onboarding/mise-en-valeur/${v}.webp`;
}
export function visuelCoupe(c: CoupePreferee, gender: string | null): string | null {
  return gender === "homme" ? null : `/onboarding/coupes/${c}.webp`;
}
/** La vignette des deux réponses neutres : celle du « Je ne sais pas » de la colorimétrie. */
export const VISUEL_NEUTRE = "/onboarding/colorimetrie/neutre-lin.webp";

/**
 * Bascule d'une option. Choisir une option remplace la réponse neutre ; retirer la dernière ramène à « pas encore répondu »
 * (`null`), jamais à « aucune préférence » : la réponse neutre ne se donne qu'en la choisissant.
 */
export function basculerOption<T extends string>(courant: T[] | null, v: T): T[] | null {
  const liste = courant ?? [];
  if (!liste.includes(v)) return [...liste, v];
  const reste = liste.filter((x) => x !== v);
  return reste.length ? reste : null;
}

/** Texte d'un champ pour le profil : null si jamais posé. */
export function libelleMiseEnValeur(valeurs: MiseEnValeur[] | null, gender: string | null): string | null {
  const v = miseEnValeurDuGenre(valeurs, gender);
  if (v === null) return null;
  return v.length ? v.map((x) => LIBELLES_MISE_EN_VALEUR[x]).join(", ") : LIBELLE_SANS_MISE_EN_VALEUR;
}
export function libelleCoupes(valeurs: CoupePreferee[] | null): string | null {
  if (valeurs === null) return null;
  return valeurs.length ? valeurs.map((x) => LIBELLES_COUPES[x]).join(", ") : LIBELLE_SANS_COUPE;
}
