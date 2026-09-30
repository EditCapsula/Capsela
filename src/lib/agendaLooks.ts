import { composerPlanche } from "./compositionEditoriale";
import { occasionShortLabel } from "./data";
import { describeOutfitVariation } from "./logic";
import type { TenuePlanifiee } from "./planifier";
import type { Item, OccasionKey } from "./types";
import type { Planification, ValiseGardee } from "./valises";

/*
 * « MES LOOKS À VENIR » — l'agenda de looks de Planifier (30/09/2026, brief
 * « Refonte premium de la page Mes planifications »). La page cessait d'être
 * une liste de cartes identiques : elle dit d'abord LE prochain look, puis les
 * suivants, puis le reste, et range les voyages en contexte.
 *
 * Ces fonctions ne décident rien sur les données : elles ordonnent ce que
 * repartirPlanifications a déjà réparti (à venir / passées, triés par date),
 * et mettent en mots ce que la tenue enregistrée contient.
 */

/**
 * « Demain », « Dans 3 jours », ou rien (déplacé de PlanifierScreen le
 * 30/09/2026, inchangé). L'indicateur NE DOUBLE JAMAIS LA DATE au-delà d'une
 * semaine : « DANS 24 JOURS » à côté de « DIM. 19 OCT. » est deux fois la même
 * information, et la moins utile des deux gagne en place.
 */
export function echeanceCourte(jour: string, aujourdhui: string): string | null {
  const a = Date.parse(`${jour}T12:00:00`);
  const b = Date.parse(`${aujourdhui}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const n = Math.round((a - b) / 86400000);
  if (n < 0) return null;
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n <= 7) return `Dans ${n} jours`;
  return null;
}

/** Looks montrés avec leur image dans la frise, après le prochain ; au-delà, une ligne par look. */
export const SUIVANTS_AVEC_IMAGE = 3;
/** Looks passés montrés avec leur image avant la liste compacte. */
export const PASSEES_AVEC_IMAGE = 4;

export interface AgendaLooks {
  /** Les voyages (valises), en contexte : ils ne concurrencent pas le look. */
  voyages: ValiseGardee[];
  /** Le prochain look, héros de la page — jamais pour les passées. */
  prochain: TenuePlanifiee | null;
  /** La frise : les looks suivants, avec leur image. */
  suivants: TenuePlanifiee[];
  /** Le reste, en lignes compactes : une page de cartes identiques n'a pas de fin. */
  plusTard: TenuePlanifiee[];
}

export function composerAgenda(liste: readonly Planification[], vue: "up" | "past"): AgendaLooks {
  const voyages = liste.flatMap((p) => (p.type === "valise" ? [p.valise] : []));
  const tenues = liste.flatMap((p) => (p.type === "tenue" ? [p.tenue] : []));
  if (vue === "past") {
    return { voyages, prochain: null, suivants: tenues.slice(0, PASSEES_AVEC_IMAGE), plusTard: tenues.slice(PASSEES_AVEC_IMAGE) };
  }
  const [prochain = null, ...reste] = tenues;
  return { voyages, prochain, suivants: reste.slice(0, SUIVANTS_AVEC_IMAGE), plusTard: reste.slice(SUIVANTS_AVEC_IMAGE) };
}

/** « 4 occasions préparées » — tenues et voyages à venir ; rien à zéro (l'état vide parle alors). */
export function sousTitreAgenda(nbAVenir: number): string | null {
  if (nbAVenir <= 0) return null;
  return `${nbAVenir} ${nbAVenir > 1 ? "occasions préparées" : "occasion préparée"}`;
}

/** Les occasions d'un voyage, telles que choisies à sa préparation (« Plage · Dîner… »), quatre au plus. */
export function occasionsDuVoyage(v: Pick<ValiseGardee, "occasions">): string[] {
  return [...new Set(v.occasions)].slice(0, 4).map((o) => occasionShortLabel(o));
}

/** Looks d'une valise dont toutes les pièces sont encore dans le dressing — même compte que la carte valise. */
export function looksDisponibles(v: Pick<ValiseGardee, "looks">, dressing: readonly Pick<Item, "id">[]): number {
  return v.looks.filter((l) => l.ids.every((id) => dressing.some((i) => i.id === id))).length;
}

/**
 * « LE DÉTAIL CAPSELA » — le conseil de style du look, JAMAIS un texte écrit
 * pour l'occasion : describeOutfitVariation, le gabarit déterministe des idées
 * de looks, lu sur les pièces réelles de la tenue enregistrée (contraste de
 * formalité quand il existe — « Le blazer structure la robe, tandis que… » —,
 * sinon les pièces les plus distinctives). La pièce de référence est le héros
 * de la planche (robe, haut photographié, sinon haut) : celle que l'image met
 * en avant. Moins de deux pièces : rien — une phrase sur une pièce seule ne
 * conseille rien, et l'appelant se replie sur la phrase de l'occasion.
 */
export function detailCapsela(pieces: Item[], occasion: OccasionKey): string | null {
  if (pieces.length < 2) return null;
  const heros = composerPlanche(pieces).pieces.find((p) => p.role === "hero")?.item ?? pieces[0];
  const { sentence } = describeOutfitVariation({ occasion, ids: pieces.map((p) => p.id), score: 0 }, pieces, heros.id, 0, 1);
  return sentence.trim() || null;
}
