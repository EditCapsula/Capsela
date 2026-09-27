import { CAPSULE_SEASONS, capsuleSeasonBucket } from "./capsule";
import { saisonParDefaut } from "./data";
import type { CapsuleSeason, CategoryKey, Item, Season } from "./types";

/**
 * LES QUATRE SAISONS D'UNE PIÈCE (27/09/2026, demandé : « Je veux 4
 * saisons »).
 *
 * Jusque-là, une pièce ne portait qu'une valeur à trois choix — « Printemps /
 * Été », « Automne / Hiver », « Toutes saisons » — et c'est encore la seule
 * que lit le moteur de tenues (filtres saisonniers de logic.ts et capsule.ts,
 * fenêtres « À redécouvrir » de selectors.ts), qui raisonne en deux moitiés
 * d'année. L'utilisatrice choisit désormais parmi les quatre saisons, autant
 * qu'elle veut ; la valeur à trois choix en est DÉDUITE (seasonDepuisSaisons),
 * si bien que le moteur se comporte exactement comme avant :
 *
 *   · saisons toutes au printemps/été   → « Printemps / Été »
 *   · saisons toutes en automne/hiver   → « Automne / Hiver »
 *   · saisons des deux moitiés          → « Toutes saisons »
 *
 * Le détail est conservé (colonne `saisons`, migration 0040) et affiché sur la
 * fiche de la pièce ; le moteur, lui, n'en tire rien de plus qu'avant — une
 * pièce « Printemps · Automne » reste proposée toute l'année. Le lui faire
 * lire changerait les tenues : c'est une mesure à part, pas un effet de bord.
 */

export const QUATRE_SAISONS: readonly CapsuleSeason[] = CAPSULE_SEASONS;

/** Remet une liste dans l'ordre de l'année, sans doublon ni valeur inconnue. */
export function ordonnerSaisons(saisons: readonly string[]): CapsuleSeason[] {
  return QUATRE_SAISONS.filter((s) => saisons.includes(s));
}

/** Les saisons que recouvre une valeur à trois choix — pour une pièce enregistrée avant les quatre saisons. */
export function saisonsDepuisSeason(season: Season): CapsuleSeason[] {
  if (season === "Printemps / Été") return ["Printemps", "Été"];
  if (season === "Automne / Hiver") return ["Automne", "Hiver"];
  return [...QUATRE_SAISONS];
}

/** La valeur à trois choix que lit le moteur, déduite des saisons choisies. Liste vide : « Toutes saisons », sans restriction. */
export function seasonDepuisSaisons(saisons: readonly CapsuleSeason[]): Season {
  const moities = new Set(saisons.map(capsuleSeasonBucket));
  return moities.size === 1 ? [...moities][0] : "Toutes saisons";
}

/** Les saisons proposées à l'ajout tant que l'utilisatrice n'a rien touché : la suggestion, sinon les quatre. */
export function saisonsParDefaut(cat: CategoryKey, name: string): CapsuleSeason[] {
  return saisonsDepuisSeason(saisonParDefaut(cat, name));
}

/** Les saisons d'une pièce : les quatre saisons enregistrées, sinon celles que recouvre sa valeur à trois choix. */
export function saisonsDe(item: Pick<Item, "season" | "saisons">): CapsuleSeason[] {
  return item.saisons?.length ? ordonnerSaisons(item.saisons) : saisonsDepuisSeason(item.season);
}

/**
 * Coche ou décoche une saison. La dernière restante ne se décoche pas : une
 * pièce sans aucune saison n'aurait pas de sens, et l'enregistrer « Toutes
 * saisons » en silence serait enregistrer autre chose que ce qui est montré.
 */
export function basculerSaison(saisons: readonly CapsuleSeason[], s: CapsuleSeason): CapsuleSeason[] {
  if (saisons.includes(s)) return saisons.length > 1 ? saisons.filter((x) => x !== s) : [...saisons];
  return ordonnerSaisons([...saisons, s]);
}

/** « Automne · Hiver », « Été », « Toutes saisons » quand les quatre y sont. */
export function libelleSaisons(saisons: readonly CapsuleSeason[]): string {
  const liste = ordonnerSaisons(saisons);
  if (liste.length === 0 || liste.length === QUATRE_SAISONS.length) return "Toutes saisons";
  return liste.join(" · ");
}
