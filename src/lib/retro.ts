import { jourLocal } from "./outfitFeedback";
import { dateDuJour } from "./jourConsulte";
import type { TenuePlanifiee } from "./planifier";
import { plansDuJour } from "./planifier";
import type { HistoryEntry, OccasionKey } from "./types";

/*
 * LES TENUES PASSÉES, ACCESSIBLES DEPUIS L'ACCUEIL (04/10/2026, demandé : « si la tenue d'hier a été déclarée comme
 * portée, il faudrait la rendre accessible — l'objectif est de conserver l'historique des tenues passées »).
 *
 * L'historique existe déjà (state.history, le Journal) ; ce module ne fait que le rendre atteignable depuis la barre de
 * date. Il n'a RIEN à voir avec le jour consulté du store (jourDecalage, 0 à +4, qui pilote la tenue proposée, la météo
 * prévue et ce qui s'écrit en base) : une journée passée ne se compose pas, elle se relit. D'où un « retour » local à
 * l'Accueil, en jours, et deux dérivés purs.
 */

export interface TenuePassee {
  /** « porte » : une tenue déclarée portée (historique) ; « plan » : une tenue planifiée ce jour-là, sans trace de port. */
  source: "porte" | "plan";
  pieceIds: number[];
  occasion: OccasionKey;
  /** Météo enregistrée au moment de la validation (porte) ou de la planification (plan) — jamais une prévision. */
  temp: number | null;
  weatherLabel: string | null;
  plan: TenuePlanifiee | null;
}

/** La tenue de ce jour passé : celle déclarée portée d'abord (la plus récente du jour), sinon le plan du jour. */
export function tenuePassee(history: readonly HistoryEntry[], plans: readonly TenuePlanifiee[], jour: string): TenuePassee | null {
  const portee = history.filter((h) => jourLocal(new Date(h.ts)) === jour && h.pieceIds.length > 0).sort((a, b) => b.ts - a.ts)[0];
  if (portee) {
    return { source: "porte", pieceIds: portee.pieceIds, occasion: portee.occasion, temp: portee.temp ?? null, weatherLabel: portee.weatherLabel ?? null, plan: null };
  }
  const plan = plansDuJour(plans, jour).find((p) => p.pieceIds.length > 0);
  return plan ? { source: "plan", pieceIds: plan.pieceIds, occasion: plan.occasion, temp: plan.temp, weatherLabel: plan.weatherLabel, plan } : null;
}

/** Les retours en arrière (1 = hier) où il y a une tenue à relire, du plus récent au plus ancien. */
export const RETRO_MAX_JOURS = 30;

export function retoursAvecTenue(
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  maintenant: Date = new Date(),
  max: number = RETRO_MAX_JOURS
): number[] {
  const out: number[] = [];
  for (let k = 1; k <= max; k++) {
    if (tenuePassee(history, plans, jourLocal(dateDuJour(-k, maintenant)))) out.push(k);
  }
  return out;
}

/** Le retour plus ancien que `depuis` (0 = aujourd'hui) où il y a une tenue, ou null. */
export const retourPrecedent = (retours: readonly number[], depuis: number): number | null => retours.find((k) => k > depuis) ?? null;

/** Le retour plus récent que `depuis`, ou 0 (aujourd'hui) s'il n'y en a pas. */
export const retourSuivant = (retours: readonly number[], depuis: number): number => [...retours].reverse().find((k) => k < depuis) ?? 0;
