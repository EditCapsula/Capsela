/**
 * LA COUCHE EXTÉRIEURE, À CÔTÉ DE LA TENUE (04/11/2026, brief « Séparer la tenue principale du manteau »).
 *
 * Le moteur n'est pas réécrit : il compose la tenue comme avant, manteau compris (« LE MANTEAU PAR LE FROID », logic.ts, sous
 * SEUIL_MANTEAU). Cette fonction décide seulement, À L'AFFICHAGE, quelle pièce se montre à part, dans « Pour l'extérieur » :
 *
 *   · un MANTEAU (catégorie `manteau` : manteau, trench, caban, doudoune, parka, imperméable — data.ts), quand la météo du jour est
 *     connue ET sous SEUIL_MANTEAU, le seuil où le moteur l'ajoute PAR LE FROID. C'est le seul cas où un manteau entre dans une tenue
 *     comme couche de dessus ajoutée pour la météo : le seuil est celui du moteur, aucun n'est inventé ;
 *   · au-dessus, un manteau que le moteur a mis dans la tenue (un trench porté comme pièce de style) reste DANS le look ;
 *   · une VESTE (blazer, veste légère…) reste toujours dans le look : c'est une pièce de la tenue, pas un manteau extérieur ;
 *   · sans météo connue, rien n'est séparé : on ne présente jamais une recommandation « selon la météo » sans météo.
 *
 * Le moteur, ses scores, la capsule et les règles (style, silhouette, colorimétrie) ne changent pas : seule la présentation change.
 */

import { SEUIL_MANTEAU } from "./logic";
import type { Item } from "./types";

export interface TenueSeparee {
  /** Les pièces du look : celles du flat lay, celles que l'on compte. */
  principal: Item[];
  /** Le manteau proposé à part, ou null (temps doux ou chaud, météo inconnue, aucun manteau dans la tenue). */
  exterieur: Item | null;
}

export function separerCoucheExterieure(pieces: Item[], temperature: number | null | undefined): TenueSeparee {
  const froid = typeof temperature === "number" && Number.isFinite(temperature) && temperature < SEUIL_MANTEAU;
  if (!froid) return { principal: pieces, exterieur: null };
  const exterieur = pieces.find((p) => p.cat === "manteau") ?? null;
  if (!exterieur) return { principal: pieces, exterieur: null };
  return { principal: pieces.filter((p) => p.id !== exterieur.id), exterieur };
}

/**
 * Les autres manteaux proposables, sans doublon avec la tenue ni avec le manteau proposé : `candidats` vient du moteur
 * (candidatsDeRemplacement, toutes ses règles appliquées — saison, bornes de température, occasion…), jamais d'une liste à part.
 */
export function autresManteaux(candidats: Item[], tenue: Item[], exterieur: Item | null): Item[] {
  const dans = new Set(tenue.map((p) => p.id));
  if (exterieur) dans.add(exterieur.id);
  const vus = new Set<number>();
  return candidats.filter((c) => c.cat === "manteau" && !dans.has(c.id) && !vus.has(c.id) && vus.add(c.id));
}
