/*
 * UN SEUL CALENDRIER POUR LES DATES DU SÉJOUR (20/10/2026, demandé : « un seul calendrier où on choisit la date de départ et la date
 * de retour »). Module pur : la grille d'un mois et la règle des deux touchers. Les jours sont des chaînes AAAA-MM-JJ, comme partout
 * dans la valise.
 */

const pad = (n: number) => String(n).padStart(2, "0");
export const jourIso = (annee: number, mois: number, jour: number) => `${annee}-${pad(mois + 1)}-${pad(jour)}`;

/**
 * La grille d'un mois (`mois` de 0 à 11), semaines commençant le lundi : des jours AAAA-MM-JJ, et `null` pour les cases avant le 1er
 * et après le dernier jour, de sorte que la grille compte un nombre entier de semaines.
 */
export function grilleDuMois(annee: number, mois: number): (string | null)[] {
  const premier = new Date(annee, mois, 1).getDay(); // 0 = dimanche
  const decalage = (premier + 6) % 7; // lundi = 0
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases: (string | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => jourIso(annee, mois, i + 1))];
  while (cases.length % 7) cases.push(null);
  return cases;
}

/**
 * Un toucher sur le calendrier. Premier toucher : le départ. Second : le retour, s'il ne précède pas le départ — sinon ce jour devient
 * le nouveau départ. Une période complète, touchée à nouveau, recommence par le départ. Un départ et un retour le même jour font un
 * séjour d'un jour.
 */
export function toucherJour(periode: { depart: string; retour: string }, jour: string): { depart: string; retour: string } {
  const { depart, retour } = periode;
  if (!depart || retour || jour < depart) return { depart: jour, retour: "" };
  return { depart, retour: jour };
}

/** Le mois suivant ou précédent d'un couple (année, mois 0-11). */
export function decalerMois(annee: number, mois: number, delta: number): { annee: number; mois: number } {
  const d = new Date(annee, mois + delta, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}
