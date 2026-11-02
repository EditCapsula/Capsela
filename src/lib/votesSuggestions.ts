/**
 * LES VOTES SUR LES SUGGESTIONS DE LA CAPSULE (02/11/2026, refonte de la fiche d'une suggestion : « J'aime », « Pas pour moi »,
 * « Je possède déjà », et « Remplacer cette pièce »).
 *
 * Même modèle que les retours sur les accords de saison (retoursAccords.ts) : gardés SUR L'APPAREIL, rangés par compte, puis
 * rattachés au compte par la table `suggestions_capsule` (migration 0056, votesSuggestionsCompte.ts) quand elle existe. Une pièce du
 * catalogue n'a qu'UN état à la fois ; les quatre restent distincts, jamais confondus (arbitré le 02/11/2026) :
 *   - aimee     : une préférence. C'est le cœur des favoris d'Explorer pour une suggestion (un seul état « aimée »). La pièce reste
 *                 dans la capsule ; elle n'entre PAS dans le dressing.
 *   - rejetee   : « Pas pour moi ». La pièce sort de la capsule, une autre prend sa place (le « Je ne suis pas intéressée » d'avant).
 *   - possedee  : « Je possède déjà ». Enregistré quand la fiche ajoutée au dressing est sauvée ; la pièce du dressing la remplace.
 *   - remplacee : écartée par « Remplacer cette pièce » (la pièce remplacée et celles qu'on a passées pour arriver à l'alternative).
 * Les trois derniers écartent la pièce de la capsule (piecesEcarteesParVotes), comme `suggestedExcluded` le fait déjà.
 */

export type EtatSuggestion = "aimee" | "rejetee" | "possedee" | "remplacee";
/** identifiant de la pièce du catalogue → état. */
export type TableVotes = Record<string, EtatSuggestion>;

export const ETATS_SUGGESTION: readonly EtatSuggestion[] = ["aimee", "rejetee", "possedee", "remplacee"];
const ECARTANTS: readonly EtatSuggestion[] = ["rejetee", "possedee", "remplacee"];

export const cleVotesSuggestions = (userId: string | null): string => `capsela.votesSuggestions.${userId ?? "demo"}`;

/** Ne garde que les entrées bien formées (identifiant entier, état connu). Pure. */
export function nettoyerVotes(brut: unknown): TableVotes {
  const out: TableVotes = {};
  if (!brut || typeof brut !== "object") return out;
  for (const [cle, v] of Object.entries(brut as Record<string, unknown>)) {
    if (/^\d+$/.test(cle) && typeof v === "string" && (ETATS_SUGGESTION as readonly string[]).includes(v)) out[cle] = v as EtatSuggestion;
  }
  return out;
}

/** Pose un état, ou le retire (`etat` null, ex. : retirer un cœur). Pure. */
export function voter(table: TableVotes, pieceId: number, etat: EtatSuggestion | null): TableVotes {
  const suite = { ...table };
  if (etat === null) delete suite[String(pieceId)];
  else suite[String(pieceId)] = etat;
  return suite;
}

/** Les pièces que les votes écartent de la capsule. Pure. */
export function piecesEcarteesParVotes(table: TableVotes): number[] {
  return Object.entries(table)
    .filter(([, v]) => ECARTANTS.includes(v))
    .map(([k]) => Number(k));
}

/** Les suggestions aimées. Pure. */
export function piecesAimees(table: TableVotes): Set<number> {
  return new Set(Object.entries(table).filter(([, v]) => v === "aimee").map(([k]) => Number(k)));
}

/**
 * Fusion appareil / compte, comme fusionnerRetours : le compte l'emporte sur un même identifiant ; ce que seul l'appareil connaît est
 * gardé et renvoyé vers le compte (`aEnvoyer`). Pure.
 */
export function fusionnerVotes(local: TableVotes, compte: TableVotes): { fusion: TableVotes; aEnvoyer: TableVotes } {
  const fusion: TableVotes = { ...local, ...compte };
  const aEnvoyer: TableVotes = {};
  for (const [cle, v] of Object.entries(local)) if (!(cle in compte)) aEnvoyer[cle] = v;
  return { fusion, aEnvoyer };
}

export function lireVotes(userId: string | null): TableVotes {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(cleVotesSuggestions(userId));
    return brut ? nettoyerVotes(JSON.parse(brut)) : {};
  } catch {
    return {};
  }
}

/** Défensif : le stockage peut manquer, la mémoire de la session suffit alors. */
export function ecrireVotes(userId: string | null, table: TableVotes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleVotesSuggestions(userId), JSON.stringify(table));
  } catch {
    // Stockage indisponible.
  }
}
