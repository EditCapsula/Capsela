/**
 * VIDÉO RÉCOMPENSÉE — le mécanisme côté app, sans le fournisseur.
 *
 * Arbitré le 24/09/2026 : monter la mécanique maintenant, choisir le SDK plus
 * tard. Ce fichier est la frontière entre les deux. Tout ce qui ne dépend pas
 * du fournisseur est ici ; tout ce qui en dépend est derrière `FournisseurVideo`,
 * dont il n'existe AUCUNE implémentation aujourd'hui.
 *
 * CE QUE L'APP NE FAIT PAS, ET NE FERA PAS. Elle n'accorde pas le bonus. Elle
 * ne le demande même pas. `accorder_bonus_generation` est révoquée à
 * `authenticated` (migration 0033) : un téléphone ne peut pas se l'accorder,
 * même en appelant le RPC à la main. C'est le réseau publicitaire qui
 * constate le visionnage et appelle notre fonction Edge `video-recompense`.
 * L'app déclenche, puis relit son quota.
 *
 * TANT QU'AUCUN FOURNISSEUR N'EST ENREGISTRÉ, `fournisseurVideo()` rend null et
 * l'interface n'affiche JAMAIS la carte vidéo. C'est la seule façon honnête de
 * livrer ça : un bouton « Regarder une vidéo » qui n'ouvre aucune vidéo est
 * précisément la promesse qu'on ne peut pas afficher. La maquette Premium
 * Gates prévoit d'ailleurs cet état — « si la vidéo du jour a déjà été
 * utilisée, la carte disparaît : seul Premium reste proposé ».
 */

/** Ce qu'un SDK devra fournir. Trois issues, pas deux : « vue », « abandonnée », « indisponible ». */
export type IssueVideo = "vue" | "abandonnee" | "indisponible";

export interface FournisseurVideo {
  /** Nom court, pour les journaux. Jamais affiché. */
  readonly nom: string;
  /** Une vidéo est-elle chargée et prête ? Une vidéo qu'on doit attendre ne se propose pas. */
  pret(): boolean;
  /** Lance la vidéo et résout quand elle se termine, d'une façon ou d'une autre. Ne jette jamais. */
  montrer(): Promise<IssueVideo>;
}

/**
 * Le registre. Vide, et c'est l'état voulu au 24/09/2026.
 *
 * Le jour où un fournisseur est arbitré, il s'enregistre ici au démarrage de
 * l'app et tout le reste — carte vidéo, trois temps, relecture du quota —
 * s'allume sans qu'une ligne d'interface change.
 */
let fournisseur: FournisseurVideo | null = null;

export function enregistrerFournisseurVideo(f: FournisseurVideo | null): void {
  fournisseur = f;
}

export function fournisseurVideo(): FournisseurVideo | null {
  return fournisseur;
}

/**
 * Peut-on proposer une vidéo maintenant ?
 *
 * Deux conditions, et les deux comptent. Pas de fournisseur : la carte
 * n'existe pas. Fournisseur présent mais pas prêt : elle n'existe pas non
 * plus — proposer une vidéo qui mettra dix secondes à se charger est pire que
 * ne rien proposer, parce que l'attente se lit comme une panne.
 *
 * `bonusDejaPris` vient du quota renvoyé par la base : une seule vidéo par
 * jour, et c'est la base qui le fait respecter, pas cette fonction.
 */
export function peutProposerVideo(f: FournisseurVideo | null, bonusDejaPris: boolean): boolean {
  if (!f) return false;
  if (bonusDejaPris) return false;
  return f.pret();
}
