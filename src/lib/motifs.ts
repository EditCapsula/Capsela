import type { CategoryKey, Motif } from "./types";

/*
 * LE MOTIF D'UNE PIÈCE (11/10/2026, demandé : « on peut détecter s'il y a des motifs ? »). Une valeur parmi huit, lue sur la photo par
 * l'analyse (analyze-dressing-photo, importer-tenue), corrigeable dans la fiche, jamais déduite d'un nom. Colonne `motif`, migration 0051.
 *
 * Aujourd'hui le motif s'AFFICHE et se corrige ; le moteur de tenues ne le lit PAS (aucune règle sur l'association de deux motifs : elle
 * demanderait un arbitrage de style et une mesure, règle d'audit). Un bijou n'a pas de motif.
 *
 * LA LISTE reste identique à celle des fonctions Edge (supabase/functions/_shared/enumsPiece.ts) : un test le verrouille.
 */
export const MOTIFS: readonly { valeur: Motif; libelle: string }[] = [
  { valeur: "uni", libelle: "Uni" },
  { valeur: "rayures", libelle: "Rayures" },
  { valeur: "carreaux", libelle: "Carreaux" },
  { valeur: "pois", libelle: "Pois" },
  { valeur: "fleurs", libelle: "Fleurs" },
  { valeur: "animalier", libelle: "Animalier" },
  { valeur: "graphique", libelle: "Graphique" },
  { valeur: "autre", libelle: "Autre" },
];

/** Toute catégorie sauf le bijou peut avoir un motif (une chemise, un foulard, un sac…). */
export const aUnMotif = (cat: CategoryKey): boolean => cat !== "bijou";

/** Valeur lue en base ou rendue par l'analyse : une des huit, sinon rien. */
export function motifDepuis(brut: string | null | undefined): Motif | undefined {
  return MOTIFS.find((m) => m.valeur === brut)?.valeur;
}

export const libelleMotif = (m: Motif): string => MOTIFS.find((x) => x.valeur === m)!.libelle;
