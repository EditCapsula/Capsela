import { CATLABEL } from "./data";
import { formalityOf } from "./attributes";
import { isCatalogId } from "./catalog";
import { candidatsDeRemplacement, computeLookScore } from "./logic";
import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import type { Weather } from "./data";
import type { Gender } from "./profile";
import type { DateContext, Item, OccasionKey, WorkMode } from "./types";
import { estDansLUnivers } from "./univers";

/**
 * REMPLACER UNE PIÈCE D'UN LOOK (12/11/2026, brief « Flat lay interactif et remplacement des articles »).
 *
 * Aucun moteur de plus : les alternatives sont celles que le moteur unique accepte déjà pour un remplacement
 * (`candidatsDeRemplacement` : occasion, saison et saison déclarée, météo, formalité, sport et cocooning, harmonie avec le reste du look),
 * puis CLASSÉES par le score du look entier une fois la pièce échangée (`computeLookScore` : palette, morphologie, colorimétrie, accords
 * de couleurs, cohérence des pièces entre elles). La même catégorie passe avant les catégories voisines (un pantalon avant une jupe).
 *
 * D'où viennent les alternatives (point 7 du brief) : une pièce du DRESSING se remplace par une pièce du dressing ; une SUGGESTION de la
 * capsule, par une pièce du dressing ou une autre pièce de la capsule. La provenance de chaque pièce ne change jamais : une pièce du
 * dressing reste « à toi », une suggestion reste une suggestion (isCatalogId).
 */
export interface ContexteLook {
  occasion: OccasionKey;
  workMode: WorkMode;
  dateContext: DateContext;
  weather: Weather;
  palette: string[];
  morphology: string | null;
  colorimetrie: ColorimetrieMoteur | null;
  gender: Gender | null;
}

export const estSuggestion = (it: Pick<Item, "id">): boolean => isCatalogId(it.id);

/** Le pool où chercher, selon la provenance de la pièce touchée. */
export function poolDeRemplacement(piece: Item, dressing: readonly Item[], suggestions: readonly Item[]): Item[] {
  if (!estSuggestion(piece)) return [...dressing];
  const vus = new Set<number>();
  return [...dressing, ...suggestions].filter((p) => (vus.has(p.id) ? false : (vus.add(p.id), true)));
}

/** Les alternatives classées, la meilleure d'abord ; `max` au plus. */
export function alternativesClassees(look: readonly Item[], piece: Item, pool: readonly Item[], c: ContexteLook, max = 12): Item[] {
  const tenue = [...look];
  const candidats = candidatsDeRemplacement(tenue, [...pool], piece.id, piece.cat, c.occasion, c.workMode, c.dateContext, c.weather).filter(
    (p) => p.id !== piece.id && !tenue.some((t) => t.id === p.id) && estDansLUnivers(p, c.gender)
  );
  const notes = candidats.map((p) => ({
    p,
    memeCategorie: p.cat === piece.cat ? 1 : 0,
    score: computeLookScore(
      tenue.map((t) => (t.id === piece.id ? p : t)),
      c.occasion,
      c.palette,
      c.morphology,
      new Set(),
      c.weather,
      c.workMode,
      c.dateContext,
      [],
      c.colorimetrie
    ).score,
  }));
  notes.sort((a, b) => b.memeCategorie - a.memeCategorie || b.score - a.score || a.p.id - b.p.id);
  return notes.slice(0, max).map((n) => n.p);
}

/** Le look avec la pièce échangée, à sa place ; les autres pièces ne bougent pas. */
export function remplacerDansIds(ids: readonly number[], ancienId: number, nouvelId: number): number[] {
  if (!ids.includes(ancienId) || ids.includes(nouvelId)) return [...ids];
  return ids.map((id) => (id === ancienId ? nouvelId : id));
}

/** Un lien d'affiliation valide : une adresse http(s) bien formée, sinon rien (aucun bouton « Acheter » sans lien). */
export function lienAffiliationValide(lien: string | undefined | null): string | null {
  if (!lien) return null;
  try {
    const u = new URL(lien.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * LA JUSTIFICATION COURTE D'UNE ALTERNATIVE (13/11/2026, planche « Remplacer » : « Plus structuré », « Look plus décontracté »).
 * Seulement ce que les données disent, rien d'inventé : une autre catégorie (« Jean à la place »), sinon l'écart de formalité des deux
 * pièces (formalityOf, 0 à 4) — plus habillée, plus décontractée, ou le même registre.
 */
export function justificationRemplacement(ancien: Item, nouvel: Item): string {
  if (nouvel.cat !== ancien.cat) return `${CATLABEL[nouvel.cat]} à la place`;
  const ecart = formalityOf(nouvel) - formalityOf(ancien);
  if (ecart >= 1) return "Plus habillée";
  if (ecart <= -1) return "Plus décontractée";
  return "Même registre";
}
