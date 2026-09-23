/**
 * Avis rapide sur la tenue du jour — partie PURE.
 *
 * Isolée du reste pour une raison de fond : les deux règles ci-dessous sont
 * les seules de cette fonctionnalité qui peuvent être fausses SANS que rien
 * ne plante. Une clé mal formée ou un jour décalé n'émettent aucune erreur —
 * ils créent silencieusement une ligne de trop, ou classent l'avis au mauvais
 * jour. Elles sont donc ici, et testées hors ligne.
 *
 * Toutes deux ont été identifiées à la relecture du SQL, avant écriture.
 */

/** Verdicts acceptés par la contrainte CHECK de `outfit_feedback`. */
export type Verdict = "adore" | "pas_aujourdhui";

/**
 * Le JOUR, en date LOCALE.
 *
 * Le défaut SQL de la colonne est `current_date`, c'est-à-dire la date du
 * SERVEUR, en UTC. Une utilisatrice qui donne son avis à 00 h 30 à Paris est
 * le jour précédent côté serveur : l'avis serait classé la veille, et la clé
 * d'unicité (user, jour, pièces) ne serait pas la même qu'à 23 h. L'app envoie
 * donc toujours le jour explicitement, et le défaut ne sert que de filet.
 *
 * `toISOString()` est écarté pour exactement la même raison : il convertit en
 * UTC. Les composantes locales sont lues une à une.
 */
export function jourLocal(d: Date = new Date()): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

/**
 * Les ids de pièces, TRIÉS et dédoublonnés.
 *
 * L'unicité en base porte sur (user_id, jour, piece_ids), et l'égalité de
 * tableaux en Postgres est SENSIBLE À L'ORDRE : {11,12} et {12,11} sont deux
 * clés différentes. Or `addPieceToOutfit` ajoute en fin de tableau, donc
 * retirer puis remettre une pièce donne le même jeu dans un autre ordre —
 * une seconde ligne au lieu d'une correction, soit l'inverse de ce que
 * l'unicité est censée garantir.
 *
 * Le reste du code connaît déjà cette règle : `lookWornCount` trie avant de
 * comparer deux looks. Elle est ici rendue explicite et obligatoire.
 */
export function clePieces(ids: readonly number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** Deux tenues sont la même si elles rassemblent les mêmes pièces, quel que soit l'ordre. */
export function memeTenue(a: readonly number[], b: readonly number[]): boolean {
  const ca = clePieces(a);
  const cb = clePieces(b);
  return ca.length === cb.length && ca.every((id, i) => id === cb[i]);
}

export interface AvisDuJour {
  jour: string;
  pieceIds: number[];
  verdict: Verdict;
}

/**
 * Décide de la nouvelle liste d'avis après un tap — partie PURE de l'action
 * du store.
 *
 * Extraite pour une raison mesurée : dans les fixtures de rendu, toutes les
 * actions du store sont remplacées par des no-op, donc aucune capture d'écran
 * ne peut prouver que ce choix est juste. Il se vérifie ici.
 *
 * Trois comportements, dont le troisième est le moins évident :
 *   - aucun avis sur cette tenue -> on l'ajoute ;
 *   - un AUTRE verdict -> il est remplacé, jamais empilé ;
 *   - le MÊME verdict -> il est RETIRÉ. Sans ce geste, un tap involontaire
 *     serait définitif pour la journée.
 *
 * Les avis portant sur une autre tenue ou un autre jour ne sont jamais
 * touchés : une régénération dans la journée crée une entrée distincte.
 */
export function appliquerAvis(
  existants: readonly AvisDuJour[],
  entree: { jour: string; pieceIds: readonly number[]; verdict: Verdict }
): { liste: AvisDuJour[]; retire: boolean } {
  const cle = clePieces(entree.pieceIds);
  const concerne = (a: AvisDuJour) => a.jour === entree.jour && memeTenue(a.pieceIds, cle);
  const retire = existants.some((a) => concerne(a) && a.verdict === entree.verdict);
  const liste = [
    ...existants.filter((a) => !concerne(a)),
    ...(retire ? [] : [{ jour: entree.jour, pieceIds: cle, verdict: entree.verdict }]),
  ];
  return { liste, retire };
}
