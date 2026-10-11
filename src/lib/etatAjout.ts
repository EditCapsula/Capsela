/*
 * LES QUATRE ÉTATS DE « AJOUTER UNE PIÈCE » (11/10/2026, demandé : champs et bouton « Ajouter au dressing » masqués tant qu'il n'y a pas de
 * photo analysée). Dérivés de l'état RÉEL du pipeline (envoi, analyse), jamais d'un minuteur :
 *  - initial    : aucune photo, rien de saisi : seul le choix de la photo est montré ;
 *  - chargement : photo choisie, envoi ou analyse en cours : champs masqués, le texte d'analyse est sur la photo ;
 *  - echec      : l'analyse n'a rien lu : message, « Réessayer », remplacer la photo, ou saisie à la main ; pas de formulaire prérempli d'invention ;
 *  - pret       : analyse terminée, ou saisie à la main choisie, ou pièce modifiée : le formulaire complet.
 * Sans service d'analyse (mode démo), une photo ne peut pas échouer à être analysée : le formulaire s'ouvre.
 */
export type EtatAjout = "initial" | "chargement" | "echec" | "pret";

export interface EntreeEtatAjout {
  /** false : modification d'une pièce déjà enregistrée, le formulaire est toujours montré. */
  creation: boolean;
  photo: boolean;
  envoi: boolean;
  analyse: boolean;
  analysee: boolean;
  analyseDisponible: boolean;
  saisieManuelle: boolean;
  /** Un nom déjà présent (parcours « Remplacer par ta pièce ») : il y a de quoi montrer le formulaire. */
  nomRempli: boolean;
}

export function etatAjout(e: EntreeEtatAjout): EtatAjout {
  if (!e.creation || e.saisieManuelle) return "pret";
  if (e.photo) {
    if (e.envoi || e.analyse) return "chargement";
    return !e.analyseDisponible || e.analysee ? "pret" : "echec";
  }
  return e.nomRempli ? "pret" : "initial";
}
