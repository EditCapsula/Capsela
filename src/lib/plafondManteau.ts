import type { CategoryKey } from "./types";

/**
 * LE PLAFOND D'UN MANTEAU DU DRESSING, PAR SON SOUS-TYPE (19/11/2026, demandé : « si un utilisateur ajoute un manteau lui-même, le
 * sous-type de manteau permet d'appliquer la même règle que dans le moteur »).
 *
 * Au catalogue, chaque manteau porte son plafond de température (meteo_max_temp, vestiaire_universel) ; le moteur s'en sert pour l'admettre
 * ou non, et « Pour l'extérieur » pour retenir le plus chaud à la minimale du jour (coucheExterieure.ts). Un manteau du dressing n'avait
 * aucune borne : il passait partout, et par 2° un trench ajouté valait une doudoune. Il reçoit ici le plafond de son sous-type (SUBTYPES,
 * data.ts) — en mémoire seulement, jamais écrit en base (itemToRow ne le connaît pas). Sans sous-type, aucun plafond : rien n'est supposé.
 *
 * Valeurs : Trench 20° et Manteau 12° reprennent le catalogue (« trench 20°, manteau droit en laine 12° », logic.ts). Imperméable, Caban,
 * Parka et Doudoune sont un ARBITRAGE ÉDITORIAL à confronter aux plafonds du catalogue par sous-type (requête de contrôle dans le message
 * du 19/11/2026) : l'imperméable comme le trench, le caban comme le manteau de laine, la parka et la doudoune plus bas.
 */
export const PLAFOND_PAR_SOUS_TYPE: Record<string, number> = {
  Trench: 20,
  Imperméable: 20,
  Manteau: 12,
  Caban: 12,
  Parka: 8,
  Doudoune: 5,
};

/** Le plafond de température d'un manteau d'après son sous-type, ou undefined (autre catégorie, sous-type absent ou inconnu). */
export function plafondDuSousType(cat: CategoryKey, subtype: string | null | undefined): number | undefined {
  if (cat !== "manteau" || !subtype) return undefined;
  return PLAFOND_PAR_SOUS_TYPE[subtype.trim()];
}
