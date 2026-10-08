import { OCCASIONS } from "./data";
import type { OccasionKey } from "./types";

/*
 * LES OCCASIONS ENREGISTRÉES : UNE VALEUR CANONIQUE, ET UNE COUCHE DE LECTURE POUR L'HISTORIQUE (08/10/2026, décidé).
 *
 * « Sortie festive » est supprimée de la taxonomie : elle ne se distinguait de « Sortie / Soirée » que par un niveau d'habillage,
 * et ce niveau se déduit du contexte (type de lieu, préférence — cf. soireeHabillee), pas d'un choix de plus à faire. « Sortie /
 * Soirée » devient « Soirée ». La liste des occasions reste `OCCASIONS` (data.ts) : une seule source, utilisée par tous les écrans.
 *
 * Ce qui est déjà en base ne se réécrit pas : une planification, une tenue du journal ou une pièce du dressing peut porter
 * `festive` (valeur de l'ancienne taxonomie) ou, selon les exports, `sortie_festive` / `sortie_soiree`. Toute lecture passe par
 * `normaliserOccasion` : l'ancienne valeur s'affiche comme « Soirée », et la prochaine sauvegarde écrit `soiree`. Aucune migration
 * SQL n'est nécessaire ; `occasion` n'a pas de CHECK (migration 0030).
 */

const ANCIENNES_VALEURS: Record<string, OccasionKey> = {
  festive: "soiree",
  sortie_festive: "soiree",
  sortie_soiree: "soiree",
};

const VALEURS_ACTUELLES = new Set<string>(OCCASIONS.map(([key]) => key));

/** La valeur canonique d'une occasion lue en base ; `undefined` quand elle n'est pas reconnue (jamais une clé brute à l'écran). */
export function normaliserOccasion(brut: string | null | undefined): OccasionKey | undefined {
  if (!brut) return undefined;
  const cle = brut.trim().toLowerCase();
  if (VALEURS_ACTUELLES.has(cle)) return cle as OccasionKey;
  return ANCIENNES_VALEURS[cle];
}

/** Une liste d'occasions (étiquettes d'une pièce, occasions d'une valise) ramenée aux valeurs canoniques, sans doublon ; les valeurs inconnues sont ignorées. */
export function normaliserOccasions(brut: readonly string[] | null | undefined): OccasionKey[] {
  const sortie: OccasionKey[] = [];
  for (const b of brut ?? []) {
    const o = normaliserOccasion(b);
    if (o && !sortie.includes(o)) sortie.push(o);
  }
  return sortie;
}

/**
 * Une soirée « habillée » : le niveau d'habillage que portait l'occasion « Sortie festive » (formalité 4, talons préférés, pas de
 * chemise), déduit du CONTEXTE de la soirée et non plus d'une occasion à part. ARBITRAGE ÉDITORIAL du 08/10/2026, non mesuré :
 *   · un bar ou un rooftop (l'ancien « club, anniversaire ») ;
 *   · la préférence « Élégant(e) » ou « Audacieux(se) » (celles qui demandent une tenue plus affirmée).
 * Sans contexte — la tenue du jour, une valise —, la soirée reste polyvalente (formalité 3, comme l'ancienne « Sortie / Soirée »).
 * Un événement particulier (mariage, baptême) reste l'occasion « Événement / Cérémonie », à sa propre formalité.
 */
export function soireeHabillee(contexte: { typeLieu?: string | null; humeur?: string | null } | undefined): boolean {
  if (!contexte) return false;
  return contexte.typeLieu === "Bar / Rooftop" || contexte.humeur === "elegant" || contexte.humeur === "audacieux";
}
