import { OCC_FORMALITY } from "./data";
import { adapteeALOccasion } from "./selectors";
import type { Item, OccasionKey } from "./types";

/*
 * LA TENUE POLYVALENTE (04/11/2026, brief « Évolution du parcours de planification », règle présentée puis validée par la propriétaire).
 * Planifier accepte plusieurs occasions pour un même moment (« Travail » puis « Soirée »). Le moteur, lui, compose pour UNE occasion — ses
 * règles de formalité en dépendent — et il n'est pas dupliqué :
 *
 *   1. L'OCCASION PRINCIPALE est la plus habillée des occasions cochées (OCC_FORMALITY, data.ts) ; à égalité, la première cochée. Le moteur
 *      compose pour elle, avec toutes ses règles (sous-choix compris).
 *   2. Parmi plusieurs tirages du moteur, la tenue retenue est la première dont CHAQUE pièce reste adaptée aux autres occasions cochées
 *      (adapteeALOccasion, selectors.ts — la règle que le pool applique déjà : chaussures habillées en soirée, pièces décontractées en voyage…).
 *   3. Aucun tirage ne passe : la meilleure tenue pour l'occasion principale, et l'écran dit « Pensée d'abord pour … ».
 *
 * Sport et Cocooning ne se combinent pas : une tenue de sport ou d'intérieur ne passe pour aucune autre occasion, et l'inverse. Les choisir
 * remplace la sélection ; choisir une autre occasion les retire.
 */

export const OCCASIONS_SEULES: readonly OccasionKey[] = ["sport", "cocooning"];

/** Coche ou décoche une occasion, dans l'ordre où elles ont été choisies. */
export function basculerOccasion(choisies: readonly OccasionKey[], key: OccasionKey): OccasionKey[] {
  if (choisies.includes(key)) return choisies.filter((o) => o !== key);
  if (OCCASIONS_SEULES.includes(key)) return [key];
  return [...choisies.filter((o) => !OCCASIONS_SEULES.includes(o)), key];
}

/** L'occasion pour laquelle le moteur compose : la plus habillée, la première cochée à égalité. */
export function occasionPrincipale(choisies: readonly OccasionKey[]): OccasionKey | null {
  let meilleure: OccasionKey | null = null;
  for (const o of choisies) if (meilleure == null || (OCC_FORMALITY[o] ?? 0) > (OCC_FORMALITY[meilleure] ?? 0)) meilleure = o;
  return meilleure;
}

/** Les autres occasions cochées, dans leur ordre. */
export function occasionsSecondaires(choisies: readonly OccasionKey[]): OccasionKey[] {
  const p = occasionPrincipale(choisies);
  return choisies.filter((o) => o !== p);
}

/** Chaque pièce de la tenue reste-t-elle adaptée à chacune des autres occasions ? */
export function convientAussiA(pieces: readonly Item[], autres: readonly OccasionKey[], genre?: string | null): boolean {
  return autres.every((o) => pieces.every((p) => adapteeALOccasion(p, o, genre)));
}

/** Tirages du moteur essayés pour trouver une tenue polyvalente — autant que pour départager une préférence (CANDIDATS_HUMEUR). */
export const TIRAGES_POLYVALENTE = 10;

/**
 * La tenue d'une planification à plusieurs occasions : le premier tirage qui convient à toutes, sinon le premier tirage (`polyvalente:
 * false`). `tirer` est le moteur unique, déjà réglé pour l'occasion principale ; `resoudre` rend les pièces d'une tenue.
 */
export function tirerPolyvalente<T extends { ids: number[]; noCompleteOutfit?: boolean }>(
  tirer: () => T | null,
  resoudre: (ids: number[]) => Item[],
  autres: readonly OccasionKey[],
  genre?: string | null,
  tirages = TIRAGES_POLYVALENTE
): { tenue: T | null; polyvalente: boolean } {
  const premier = tirer();
  if (!autres.length || !premier || premier.noCompleteOutfit) return { tenue: premier, polyvalente: autres.length === 0 };
  if (convientAussiA(resoudre(premier.ids), autres, genre)) return { tenue: premier, polyvalente: true };
  for (let i = 1; i < tirages; i++) {
    const t = tirer();
    if (t && !t.noCompleteOutfit && convientAussiA(resoudre(t.ids), autres, genre)) return { tenue: t, polyvalente: true };
  }
  return { tenue: premier, polyvalente: false };
}
