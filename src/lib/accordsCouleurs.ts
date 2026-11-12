import { isNeutralColor } from "./attributes";
import { FALLBACK_HEX } from "./data";
import type { Item } from "./types";

/**
 * LES ACCORDS DE COULEURS « À LA WADA » (12/11/2026, demandé par la propriétaire : « reprendre les grands principes de A Dictionary
 * of Color Combinations », option B, partout). Ce sont les PRINCIPES du livre de Sanzo Wada qui sont repris, jamais ses données
 * (ni ses 348 associations, ni des relevés de couleurs tiers) :
 *
 *   1. L'harmonie est concrète, pas géométrique : deux couleurs peuvent s'accorder sans être voisines ni opposées sur le cercle
 *      (vieux rose et olive, ocre et violet) — ce que R-S2 (logic.ts) seule ne voit pas.
 *   2. Des tons ROMPUS — adoucis, poudrés, terreux, grisés — et au plus UNE couleur FRANCHE, en accent.
 *   3. Un écart de CLARTÉ : l'association tient par la valeur (clair, moyen, foncé) autant que par la teinte.
 *
 * Ce module dit seulement si un ensemble de pièces forme un tel accord. Il sert à deux endroits du moteur unique (logic.ts) :
 * l'harmonisation d'une tenue en cours de composition (une deuxième, voire troisième couleur y devient possible si elle forme un
 * accord) et le score (R-S19, bonus d'un accord à plusieurs couleurs). Le levier de mesure `sansAccordsWada` rend le comportement
 * d'avant, pour l'audit avant / après (AGENTS.md).
 *
 * SEUILS — ARBITRAGE ÉDITORIAL du 12/11/2026, validé par la propriétaire le même jour après l'audit accords-wada (scripts/), des
 * ordres de grandeur sur la saturation et la clarté HSL du hex de la pièce :
 *   · franche : saturation ≥ SEUIL_FRANCHE et clarté moyenne (ni très claire ni très foncée) — un rouge, un bleu roi, un jaune vif ;
 *   · rompue : toute autre couleur non neutre — vieux rose, olive, ocre, bleu gris, lilas, terracotta ;
 *   · écart de clarté : au moins ECART_CLARTE entre la plus claire et la plus foncée des couleurs de la tenue, neutres compris.
 * Une couleur inconnue (FALLBACK_HEX) ne forme jamais d'accord : faute de savoir.
 */
export const SEUIL_FRANCHE = 0.5;
export const ECART_CLARTE = 0.25;
/** R-S1 : au-delà de trois couleurs non neutres, la tenue est pénalisée — un accord n'en compte jamais plus. */
export const MAX_COULEURS_ACCORD = 3;

type Couleur = Pick<Item, "hex" | "color">;

function hsl(hex: string): { s: number; l: number } {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}

const connue = (c: Couleur) => !!c.hex && /^#?[0-9a-f]{6}$/i.test(c.hex) && c.hex.toUpperCase() !== FALLBACK_HEX.toUpperCase();

/** Une couleur franche : saturée, de clarté moyenne. Les autres couleurs non neutres sont rompues. */
export function estFranche(c: Couleur): boolean {
  if (!connue(c) || isNeutralColor(c.color)) return false;
  const { s, l } = hsl(c.hex);
  return s >= SEUIL_FRANCHE && l >= 0.25 && l <= 0.75;
}

/** Les couleurs distinctes d'un ensemble (par teinte hex). */
function distinctes(pieces: readonly Couleur[]): Couleur[] {
  const vues = new Map<string, Couleur>();
  for (const p of pieces) if (p.hex) vues.set(p.hex.toUpperCase(), p);
  return [...vues.values()];
}

/**
 * Les pièces forment-elles un accord à la Wada ? Au moins une couleur non neutre, au plus trois, au plus une franche, et un écart de
 * clarté suffisant entre toutes les couleurs (neutres compris). Le bijou, accent métallique, est laissé à l'appelant.
 */
export function formeUnAccord(pieces: readonly Couleur[]): boolean {
  const couleurs = distinctes(pieces);
  if (couleurs.some((c) => !connue(c))) return false;
  const nonNeutres = couleurs.filter((c) => !isNeutralColor(c.color));
  if (nonNeutres.length < 1 || nonNeutres.length > MAX_COULEURS_ACCORD) return false;
  if (nonNeutres.filter(estFranche).length > 1) return false;
  const clartes = couleurs.map((c) => hsl(c.hex).l);
  return Math.max(...clartes) - Math.min(...clartes) >= ECART_CLARTE;
}

/** Un accord à PLUSIEURS couleurs (au moins deux non neutres) : celui que R-S19 récompense, et que R-S2 seule ne voyait pas. */
export function accordAPlusieursCouleurs(pieces: readonly Couleur[]): boolean {
  return distinctes(pieces).filter((c) => !isNeutralColor(c.color)).length >= 2 && formeUnAccord(pieces);
}
