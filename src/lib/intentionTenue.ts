/**
 * CE QUE L'ÉCRAN TENUE DOIT OUVRIR EN ARRIVANT (13/11/2026, demandé : « si aucune chaussure ne convient pour cette tenue […] afficher la
 * chaussure fantôme avec un + qui invite à en choisir une paire adaptée parmi celles du catalogue » ; « tu as déjà tous les composants »).
 * Le « + » de la silhouette de l'accueil mène à Ma tenue du jour et y ouvre la feuille « Choisir des chaussures » qui existe déjà — les
 * mêmes paires, les mêmes règles, jamais une seconde liste. Une intention ne sert qu'une fois : un retour sur l'écran ne la rejoue pas.
 */
let choixChaussures = false;

export function demanderChoixChaussures(): void {
  choixChaussures = true;
}

/** Lue à l'ouverture de l'écran, sans l'effacer : React peut appeler l'initialisation deux fois (mode strict). */
export function lireChoixChaussures(): boolean {
  return choixChaussures;
}

/** Effacée une fois l'écran monté : un retour sur l'écran ne rouvre pas la feuille. */
export function oublierChoixChaussures(): void {
  choixChaussures = false;
}
