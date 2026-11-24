/**
 * LA COUCHE EXTÉRIEURE, À CÔTÉ DE LA TENUE (04/11/2026, brief « Séparer la tenue principale du manteau »).
 *
 * Le moteur n'est pas réécrit : il compose la tenue comme avant, manteau compris (« LE MANTEAU PAR LE FROID », logic.ts, sous
 * SEUIL_MANTEAU). Cette fonction décide seulement, À L'AFFICHAGE, quelle pièce se montre à part, dans « Pour l'extérieur » :
 *
 *   · un MANTEAU (catégorie `manteau` : manteau, trench, caban, doudoune, parka, imperméable — data.ts), dès que la météo du jour est
 *     connue, sous SEUIL_SANS_EXTERIEUR (22 °C) et hors maison (Cocooning, Télétravail) — 17/11/2026, arbitré ; avant, sous SEUIL_MANTEAU
 *     seulement, un trench porté au-dessus restait dans le look. Le choix du manteau suit ses bornes de température (meteo_max_temp) ;
 *   · une VESTE (blazer, veste légère…) reste toujours dans le look : c'est une pièce de la tenue, pas un manteau extérieur ;
 *   · sans météo connue, rien n'est séparé : on ne présente jamais une recommandation « selon la météo » sans météo.
 *
 * Le moteur, ses scores, la capsule et les règles (style, silhouette, colorimétrie) ne changent pas : seule la présentation change.
 */

import { vestePlusLongueQueLeManteau } from "./forme";
import { candidatsDeRemplacement, SEUIL_SANS_EXTERIEUR } from "./logic";
import type { Weather } from "./data";
import { manteauTropLeger, manteauxParChaleur } from "./plafondManteau";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "./types";

/*
 * LE MANTEAU LE PLUS ADAPTÉ À LA MINIMALE (19/11/2026, arbitré par la propriétaire, signalé : « le trench coat est trop léger pour des
 * températures min de 2 degrés »). Deux causes, mesurées dans le code :
 *   1. les manteaux candidats étaient admis avec la température DU MOMENT (meteoDuJour, 10° sur la capture), alors que la couche
 *      extérieure se décide sur la MINIMALE du jour depuis le 16/11/2026 (temperatureReelle) ;
 *   2. un manteau n'a qu'un PLAFOND (meteo_max_temp : trench 20°, manteau en laine 12°, façon shearling 7°) : par 2°, tous sont admis, et
 *      le premier venu était retenu, trench compris.
 * Désormais : les manteaux sont admis à la minimale, puis classés du plafond le plus BAS au plus haut — le plus chaud qui reste admis passe
 * devant (par 2° : shearling, puis laine, puis trench). Un manteau sans plafond connu (dressing sans sous-type) passe après, dans son ordre :
 * aucune chaleur n'est supposée. Aucune donnée de production modifiée : seules les bornes existantes servent.
 */

/** Le classement par chaleur vit dans plafondManteau.ts depuis le 21/11/2026 (partagé avec le moteur) ; réexporté pour les appelants. */
export { manteauxParChaleur };

/**
 * Les manteaux que le moteur admet pour la tenue À LA TEMPÉRATURE DE LA COUCHE (la minimale du jour, temperatureReelle), classés par
 * chaleur. La seule entrée des écrans pour « Pour l'extérieur » : candidatsDeRemplacement (toutes ses règles — saison, occasion, bornes),
 * avec la météo du jour ramenée à cette température.
 */
export function manteauxPourLaCouche(
  tenue: Item[],
  pool: Item[],
  exclu: number,
  occasion: OccasionKey,
  workMode: WorkMode,
  dateContext: DateContext,
  weather: Weather,
  temperature: number | null | undefined
): Item[] {
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
    return candidatsDeRemplacement(tenue, pool, exclu, "manteau" as CategoryKey, occasion, workMode, dateContext, weather);
  }
  const c = candidatsDeRemplacement(tenue, pool, exclu, "manteau" as CategoryKey, occasion, workMode, dateContext, { ...weather, temp: temperature });
  return manteauxParChaleur(c, temperature);
}

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
  candidatsCapsule: Item[] = [],
  /**
   * Vrai à la maison (estContexteMaison : Cocooning, Télétravail) — 17/11/2026, arbitré : « tout manteau dans la strate Extérieur, sauf en
   * Cocooning et en télétravail ». Rien n'y est séparé ni proposé.
   */
  chezSoi = false
): TenueSepareeEtendue {
  // TOUT MANTEAU À PART SOUS 22 °C (17/11/2026, arbitré par la propriétaire : « ce n'est pas pour toutes les températures, c'est pour
  // en dessous de 22 degrés » ; remplace « par le froid seulement, sous SEUIL_MANTEAU » du 04/11) : météo connue, hors maison et sous
  // SEUIL_SANS_EXTERIEUR, le manteau de la tenue se montre dans « Pour l'extérieur » ; une tenue sans manteau reçoit le premier que le
  // moteur admet (candidatsDeRemplacement : ses bornes meteo_max_temp choisissent un trench à 16°). À partir de 22 °C, aucune strate.
  // Jamais de manteau inventé : sans candidat, rien.
  const meteoConnue = typeof temperature === "number" && Number.isFinite(temperature);
  const rien = { remplace: null, conseilManteauPlusLong: false };
  if (!meteoConnue || chezSoi || temperature >= SEUIL_SANS_EXTERIEUR) return { principal: pieces, exterieur: null, suggere: false, ...rien };
  const exterieur = pieces.find((p) => p.cat === "manteau") ?? null;
  if (exterieur) {
    const principal = pieces.filter((p) => p.id !== exterieur.id);
    const vestes = principal.filter((p) => p.cat === "veste");
    if (!vestes.some((v) => vestePlusLongueQueLeManteau(v, exterieur))) {
      // TROP LÉGER POUR LA MINIMALE (19/11/2026, arbitré) : le moteur a pu retenir un manteau à la température du moment. Quand un
      // candidat admis à la minimale est plus chaud (plafond plus bas) que celui de la tenue, il le remplace dans « Pour l'extérieur »,
      // comme R-B25 : le manteau remplacé ne se montre pas et ne se compte pas comme porté. Un manteau de la tenue sans plafond connu
      // reste : rien ne dit qu'il est léger. Les candidats doivent venir de manteauxPourLaCouche (admis et classés à cette température).
      const tous = autresManteaux([...candidats, ...candidatsCapsule], pieces, null);
      const plusChaud =
        // Le manteau de la tenue est trop léger (plancher de son sous-type) : le premier candidat qui ne l'est pas le remplace.
        (manteauTropLeger(exterieur, temperature) ? tous.find((m) => !manteauTropLeger(m, temperature)) : undefined) ??
        tous.find(
          (m) => !manteauTropLeger(m, temperature) && m.meteoMaxTemp != null && exterieur.meteoMaxTemp != null && m.meteoMaxTemp < exterieur.meteoMaxTemp && temperature <= m.meteoMaxTemp
        );
      // Un manteau qui DÉCLARE tenir à cette température (meteo_min_temp atteint) n'est pas remplacé.
      const declareAssezChaud = exterieur.meteoMinTemp != null && temperature >= exterieur.meteoMinTemp;
      if (plusChaud && !declareAssezChaud) return { principal, exterieur: plusChaud, suggere: true, remplace: exterieur, conseilManteauPlusLong: false };
      return { principal, exterieur, suggere: false, ...rien };
    }
    // Un manteau qui COUVRE la veste : sa longueur connue, et aucune veste plus longue — le dressing d'abord, puis la capsule. Une
    // longueur inconnue ne se suppose pas (« aucune donnée inventée ») : elle ne suffit pas à dire qu'il est assez long.
    const couvre = (m: Item) => m.cat === "manteau" && m.longueur != null && !vestes.some((v) => vestePlusLongueQueLeManteau(v, m));
    const propose = autresManteaux([...candidats, ...candidatsCapsule], pieces, null).find(couvre) ?? null;
    if (propose) return { principal, exterieur: propose, suggere: true, remplace: exterieur, conseilManteauPlusLong: false };
    return { principal, exterieur: null, suggere: false, remplace: exterieur, conseilManteauPlusLong: true };
  }
  // Sans manteau adapté dans le dressing, un manteau de la CAPSULE (12/11/2026, demandé : « la recommandation d'ajout de manteau doit
  // être remplacée par l'affichage de la strate Extérieur avec un manteau de la capsule si pas de manteau adapté dans le dressing »).
  // Un manteau du dressing trop léger pour la température (19/11/2026) cède la place à un manteau de la capsule qui ne l'est pas ; faute
  // d'autre, il reste proposé — « Pour l'extérieur » dit alors qu'il faut plus chaud (phraseManteauTropLeger).
  const assezChaud = (l: Item[]) => autresManteaux(l, pieces, null).find((m) => !manteauTropLeger(m, temperature));
  const propose = assezChaud(candidats) ?? assezChaud(candidatsCapsule) ?? autresManteaux(candidats, pieces, null)[0] ?? autresManteaux(candidatsCapsule, pieces, null)[0] ?? null;
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
 *
 * LA MINIMALE DU JOUR D'ABORD (16/11/2026, arbitré : « avec le minimum du jour ») : quand la prévision la donne (`minDuJour`, store), c'est
 * elle qui décide de la couche extérieure — stable toute la journée, la même sur toutes les cartes. On prend son manteau pour le moment
 * le plus froid, pas pour l'heure où l'on ouvre l'app. Sans prévision, la règle d'avant.
 */
/**
 * La température de « Pour l'extérieur » est-elle la MINIMALE du jour (24/11/2026, retour d'un testeur : « on voit 4 degrés en haut et 2
 * sur la strate extérieur, ce n'est pas très clair que l'on parle de minimale ») ? Mêmes cas que temperatureReelle : vrai quand c'est la
 * minimale qu'elle rend. L'écran le dit alors (« min 2° », « minimale d'aujourd'hui : 2° »).
 */
export function temperatureEstMinimale(args: { decalage: number; sourceMeteo: string; minDuJour?: number | null }): boolean {
  const min = typeof args.minDuJour === "number" && Number.isFinite(args.minDuJour);
  return min && (args.decalage !== 0 || args.sourceMeteo !== "defaut");
}

export function temperatureReelle(args: {
  decalage: number;
  sourceMeteo: string;
  tempDuJour: number;
  prevue: number | null | undefined;
  minDuJour?: number | null;
}): number | null {
  const min = typeof args.minDuJour === "number" && Number.isFinite(args.minDuJour) ? args.minDuJour : null;
  if (args.decalage === 0) return args.sourceMeteo !== "defaut" ? (min ?? args.tempDuJour) : null;
  return min ?? (typeof args.prevue === "number" ? args.prevue : null);
}
