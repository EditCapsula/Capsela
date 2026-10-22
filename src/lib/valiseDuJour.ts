import { planningDeLaValise } from "./planningValise";
import type { TenuePlanifiee } from "./planifier";
import { elementProgramme } from "./programmeValise";
import { joursDuSejour, lookAChaussuresEtSac, type LookValise } from "./valise";
import type { ValiseGardee } from "./valises";
import type { Item } from "./types";

/*
 * LA VALISE FAIT LA TENUE DU JOUR PENDANT LE SÉJOUR (20/10/2026, demandé : « faire le lien entre les looks de valise et la tenue du jour »).
 *
 * Module pur. Entre le départ et le retour d'une valise, le jour consulté a déjà ses looks : ceux que la valise répartit jour par jour
 * (planningDuProgramme, l'onglet Looks). On les rend sous la forme d'une tenue planifiée VIRTUELLE — jamais enregistrée — pour qu'ils
 * passent par le mécanisme qui fait déjà d'une tenue planifiée la tenue du jour (planDuJour.ts) :
 *   · le look de la JOURNÉE (à défaut, celui du trajet le jour du départ ou du retour) devient la tenue du jour ;
 *   · le look du SOIR est rappelé sous la tenue, comme un plan de soirée.
 * Une tenue que la personne a planifiée elle-même pour ce jour passe avant (le store la place en premier).
 *
 * Les looks retenus sont exactement ceux que l'écran Valise montre (mêmes filtres, même ordre) : le planning est le même des deux côtés.
 */

export const PREFIXE_PLAN_VALISE = "valise:";
export const estPlanValise = (id: string | null | undefined): boolean => !!id && id.startsWith(PREFIXE_PLAN_VALISE);

/** La valise du séjour en cours ce jour-là (départ ≤ jour ≤ retour) ; la plus proche du départ s'il y en a plusieurs. */
export function valiseDuJour(valises: readonly ValiseGardee[], jour: string): ValiseGardee | null {
  return [...valises].filter((v) => v.depart <= jour && jour <= v.retour).sort((a, b) => a.depart.localeCompare(b.depart))[0] ?? null;
}

/** Les looks que l'écran Valise montre : toutes leurs pièces dans la valise, des chaussures et un sac (ValiseScreen, `looks`). */
export function looksVisibles(v: ValiseGardee, pool: readonly Item[]): LookValise[] {
  const pieces = v.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const ids = pieces.map((p) => p.id);
  return v.looks.filter((l) => l.ids.every((id) => ids.includes(id)) && lookAChaussuresEtSac(l.ids, pieces));
}

export interface ValiseDuJourConsulte {
  valise: ValiseGardee;
  /** 1 pour le jour du départ. */
  numero: number;
  /** Le look de la journée, en tenue planifiée virtuelle ; null quand le planning n'en donne pas pour ce jour. */
  journee: TenuePlanifiee | null;
  /** Le look du soir, en tenue planifiée virtuelle ; null sans look du soir ce jour-là. */
  soir: TenuePlanifiee | null;
  /** Tous les looks de la valise (ceux que son écran montre), avec leur occasion : « Autre tenue » les parcourt pendant le séjour. */
  looks: { ids: number[]; occasion: TenuePlanifiee["occasion"] }[];
}

export function looksValiseDuJour(v: ValiseGardee, jour: string, pool: readonly Item[]): ValiseDuJourConsulte {
  const jours = joursDuSejour(v.depart, v.retour);
  const numero = jours.indexOf(jour) + 1;
  const looks = looksVisibles(v, pool);
  // Une valise composée avant le planning jour par jour n'en a pas : aucun look attribué, la tenue du jour se tire dans ses pièces.
  const planning = planningDeLaValise(v, jours, looks);
  const duJour = planning.filter((c) => c.jour === jour && c.look != null);
  const virtuel = (moment: TenuePlanifiee["moment"], c: (typeof duJour)[number] | undefined): TenuePlanifiee | null => {
    if (!c || c.look == null) return null;
    const look = looks[c.look];
    const occasion = elementProgramme(c.sousId)?.mere ?? v.situations[look.situations[0]]?.occasion ?? "quotidien";
    return {
      id: `${PREFIXE_PLAN_VALISE}${v.id}:${jour}:${moment === "Soirée" ? "soir" : "jour"}`,
      jour,
      moment,
      occasion,
      sousChoix: null,
      lieu: v.destination,
      typeLieu: null,
      dressingSeul: false,
      pieceIds: [...look.ids],
      temp: null,
      weatherLabel: null,
    };
  };
  return {
    valise: v,
    numero,
    looks: looks.map((l) => ({ ids: [...l.ids], occasion: v.situations[l.situations[0]]?.occasion ?? "quotidien" })),
    journee: virtuel("Toute la journée", duJour.find((c) => c.creneau === "jour") ?? duJour.find((c) => c.creneau === "trajet")),
    soir: virtuel("Soirée", duJour.find((c) => c.creneau === "soir")),
  };
}

/** Les pièces de la valise, résolues : le vivier de « Autre tenue » pendant le séjour — jamais une pièce restée à la maison. */
export const piecesDeLaValise = (v: ValiseGardee, pool: readonly Item[]): Item[] =>
  v.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);

/**
 * « AUTRE TENUE » PENDANT LE SÉJOUR (20/10/2026) : le look suivant de la valise, dans l'ordre de la valise, en revenant au début —
 * jamais la tenue affichée. Les looks de la valise sont complets et composés pour ce voyage ; tirer de nouvelles tenues dans ses seules
 * pièces pouvait rendre une tenue sans chaussures quand la météo du jour écartait celles de la valise. null : aucun autre look.
 */
export function lookSuivant<T extends { ids: number[] }>(looks: readonly T[], courante: readonly number[]): T | null {
  const cle = (ids: readonly number[]) => [...new Set(ids)].sort((a, b) => a - b).join(",");
  const actuelle = cle(courante);
  const i = looks.findIndex((l) => cle(l.ids) === actuelle);
  for (let k = 1; k <= looks.length; k++) {
    const l = looks[(Math.max(i, -1) + k + looks.length) % looks.length];
    if (cle(l.ids) !== actuelle) return l;
  }
  return null;
}
