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

import { vestePlusLongueQueLeManteau } from "./forme";
import { SEUIL_MANTEAU } from "./logic";
import type { Item } from "./types";

export interface TenueSeparee {
  /** Les pièces du look : celles du flat lay, celles que l'on compte. */
  principal: Item[];
  /** Le manteau proposé à part, ou null (temps doux ou chaud, météo inconnue, aucun manteau dans la tenue). */
  exterieur: Item | null;
}

export interface TenueSepareeEtendue extends TenueSeparee {
  /** Vrai quand le manteau n'est pas dans la tenue : le moteur le PROPOSE en plus (cas « tenue sans manteau, manteau disponible »). */
  suggere: boolean;
  /**
   * Le manteau de la tenue que la proposition REMPLACE (12/11/2026, R-B25) : trop court pour la veste qu'il couvrirait. Il ne se montre
   * pas et ne se compte pas comme porté ; porter la proposition le remplace dans la tenue. null sinon.
   */
  remplace: Item | null;
  /**
   * « Pour finaliser ta tenue » (12/11/2026, arbitré) : le manteau de la tenue est plus court que sa veste, et ni le dressing ni la capsule
   * n'en ont un assez long. L'encart conseille un manteau plus long au lieu de montrer le manteau trop court.
   */
  conseilManteauPlusLong: boolean;
}

/**
 * `candidats` (facultatif) : les manteaux que le moteur admet pour ce contexte (candidatsDeRemplacement : saison, bornes de température,
 * occasion…). Par le froid, une tenue SANS manteau reçoit le premier d'entre eux en « Pour l'extérieur » (04/11/2026, signalé : « sur
 * cette page il manque la strate extérieure ») ; sans candidat, rien n'est proposé — jamais un manteau inventé.
 */
export function separerCoucheExterieure(
  pieces: Item[],
  temperature: number | null | undefined,
  candidats: Item[] = [],
  /**
   * Les manteaux de la CAPSULE que le moteur admet pour cette tenue (candidatsDeRemplacement sur la capsule) — 12/11/2026, arbitré : quand
   * le manteau de la tenue est plus court que la veste qu'il couvre (R-B25, la veste de formalité reste), « on propose une pièce de la
   * capsule qui fonctionne avec la tenue ».
   */
  candidatsCapsule: Item[] = []
): TenueSepareeEtendue {
  const froid = typeof temperature === "number" && Number.isFinite(temperature) && temperature < SEUIL_MANTEAU;
  const rien = { remplace: null, conseilManteauPlusLong: false };
  if (!froid) return { principal: pieces, exterieur: null, suggere: false, ...rien };
  const exterieur = pieces.find((p) => p.cat === "manteau") ?? null;
  if (exterieur) {
    const principal = pieces.filter((p) => p.id !== exterieur.id);
    const vestes = principal.filter((p) => p.cat === "veste");
    if (!vestes.some((v) => vestePlusLongueQueLeManteau(v, exterieur))) return { principal, exterieur, suggere: false, ...rien };
    // Un manteau qui COUVRE la veste : sa longueur connue, et aucune veste plus longue — le dressing d'abord, puis la capsule. Une
    // longueur inconnue ne se suppose pas (« aucune donnée inventée ») : elle ne suffit pas à dire qu'il est assez long.
    const couvre = (m: Item) => m.cat === "manteau" && m.longueur != null && !vestes.some((v) => vestePlusLongueQueLeManteau(v, m));
    const propose = autresManteaux([...candidats, ...candidatsCapsule], pieces, null).find(couvre) ?? null;
    if (propose) return { principal, exterieur: propose, suggere: true, remplace: exterieur, conseilManteauPlusLong: false };
    return { principal, exterieur: null, suggere: false, remplace: exterieur, conseilManteauPlusLong: true };
  }
  // Sans manteau adapté dans le dressing, un manteau de la CAPSULE (12/11/2026, demandé : « la recommandation d'ajout de manteau doit
  // être remplacée par l'affichage de la strate Extérieur avec un manteau de la capsule si pas de manteau adapté dans le dressing »).
  const propose = autresManteaux(candidats, pieces, null)[0] ?? autresManteaux(candidatsCapsule, pieces, null)[0] ?? null;
  return { principal: pieces, exterieur: propose, suggere: propose !== null, ...rien };
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

/**
 * La température qui peut justifier « selon la météo » : aujourd'hui, celle du jour si elle n'est pas faite des valeurs par défaut
 * (choisirMeteo, weather.ts) ; un autre jour, sa prévision. Sinon null : rien n'est séparé, rien n'est dit de la météo.
 */
export function temperatureReelle(args: { decalage: number; sourceMeteo: string; tempDuJour: number; prevue: number | null | undefined }): number | null {
  if (args.decalage === 0) return args.sourceMeteo !== "defaut" ? args.tempDuJour : null;
  return typeof args.prevue === "number" ? args.prevue : null;
}
