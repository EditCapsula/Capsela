import type { Gender } from "./profile";

/**
 * L'UNIVERS VESTIMENTAIRE DU PROFIL — UNE SEULE RÈGLE POUR TOUT LE MOTEUR (12/11/2026, brief 2.3, point 2.3 : « un utilisateur masculin
 * reçoit directement des propositions de vêtements féminins »).
 *
 * La règle : l'univers du profil FILTRE le catalogue AVANT tout calcul de score. Une pièce taguée pour l'autre univers n'entre jamais ;
 * une pièce unisexe (ou non taguée) entre dans les deux. Aucun score — silhouette, couleur, style — ne peut la faire revenir.
 *
 * Elle était écrite six fois (capsule, ses filets de sécurité, pièces de valise, suggestions d'autres styles), chaque fois avec la même
 * faille : sans genre au profil, AUCUN filtre — le catalogue entier, à dominante femme, et les styles femme par défaut. C'est ce qu'a
 * reçu le compte homme testé : l'étape Genre pouvait être passée sans réponse. Depuis le 12/11/2026 elle est obligatoire
 * (ProfileSetupScreen) et l'onboarding l'est aussi (onboarding.ts) ; un profil sans genre ne reçoit plus, par défaut, que les pièces
 * unisexes — jamais le catalogue féminin.
 *
 * La capsule gardait aussi un garde-fou « au moins 16 pièces » : s'il en restait moins après le filtre, le filtre était ANNULÉ et les
 * pièces de l'autre univers revenaient. Retiré : une capsule plus courte vaut mieux qu'une pièce de l'autre univers.
 *
 * Les pièces du DRESSING de la personne ne portent pas de genre : elles passent toujours. Ce qu'elle possède n'est jamais écarté.
 */

/** Ce qu'une pièce déclare de son univers : "femme", "homme", "unisexe", ou rien (pièce du dressing, catalogue de secours). */
type AvecGenre = { genre?: string | null };

export function estDansLUnivers(piece: object, gender: Gender | null | undefined): boolean {
  const g = (piece as AvecGenre).genre;
  if (g !== "femme" && g !== "homme") return true;
  return g === gender;
}

export function filtrerParUnivers<T extends object>(pieces: readonly T[], gender: Gender | null | undefined): T[] {
  return pieces.filter((p) => estDansLUnivers(p, gender));
}
