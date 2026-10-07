import { dateDuJour } from "./jourConsulte";
import { jourLocal } from "./outfitFeedback";
import { plansDuJour, type TenuePlanifiee } from "./planifier";
import { tenuePassee } from "./retro";
import type { HistoryEntry, OccasionKey } from "./types";

/*
 * LE CALENDRIER DES TENUES (05/10/2026, brief « Calendrier Capsela ») — la mémoire et le planning vestimentaire : ce que
 * j'ai porté, ce que je porte aujourd'hui, ce que j'ai prévu. Pur : tout se dérive de l'historique (state.history, le
 * Journal), des tenues planifiées (planned_outfits) et de la tenue proposée aujourd'hui ; rien n'est stocké, aucune donnée
 * n'est ajoutée au schéma.
 *
 * RÈGLE DU BRIEF : « ne pas déduire qu'une tenue a été portée simplement parce qu'elle existait ». Un jour PASSÉ n'est
 * « porté » que s'il a une entrée d'historique (une tenue validée avec « Porter cette tenue ») ; une tenue planifiée sans
 * trace de port reste « planifiée ». Le jour même est « du jour » : la tenue planifiée si elle existe, sinon celle que
 * Capsela propose. Un jour futur n'a que ses plans.
 */

export type StatutJour = "porte" | "planifiee" | "du_jour";

export interface TenueDuCalendrier {
  jour: string;
  statut: StatutJour;
  pieceIds: number[];
  occasion: OccasionKey;
  /** La tenue planifiée correspondante, quand il y en a une (pour l'ouvrir, la modifier). */
  plan: TenuePlanifiee | null;
  /** Météo enregistrée (porté, planifié) — jamais une météo de repli. */
  temp: number | null;
  weatherLabel: string | null;
}

/** La tenue proposée aujourd'hui par Capsela (state.outfit et son occasion) — facultative. */
export interface TenuePropose {
  pieceIds: number[];
  occasion: OccasionKey;
  temp?: number | null;
  weatherLabel?: string | null;
}

export function tenueDuCalendrier(
  jour: string,
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null
): TenueDuCalendrier | null {
  if (jour < aujourdhui) {
    const t = tenuePassee(history, plans, jour);
    return t ? { jour, statut: t.source === "porte" ? "porte" : "planifiee", pieceIds: t.pieceIds, occasion: t.occasion, plan: t.plan, temp: t.temp, weatherLabel: t.weatherLabel } : null;
  }
  const plan = plansDuJour(plans, jour).find((p) => p.pieceIds.length > 0) ?? null;
  if (plan) {
    return { jour, statut: jour === aujourdhui ? "du_jour" : "planifiee", pieceIds: plan.pieceIds, occasion: plan.occasion, plan, temp: plan.temp, weatherLabel: plan.weatherLabel };
  }
  if (jour === aujourdhui && proposee && proposee.pieceIds.length > 0) {
    return { jour, statut: "du_jour", pieceIds: proposee.pieceIds, occasion: proposee.occasion, plan: null, temp: proposee.temp ?? null, weatherLabel: proposee.weatherLabel ?? null };
  }
  return null;
}

// ── Les grilles ──────────────────────────────────────────────────────────

const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);

/** Le lundi de la semaine d'un jour, en date locale. */
export function lundiDe(jour: string): string {
  const d = dateDe(jour);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return jourLocal(d);
}

/** Les sept jours (lundi → dimanche) de la semaine qui contient `jour`. */
export function joursDeLaSemaine(jour: string): string[] {
  const l = dateDe(lundiDe(jour));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(l);
    d.setDate(l.getDate() + i);
    return jourLocal(d);
  });
}

/** Un mois en semaines de sept cases, lundi d'abord ; null pour les cases hors du mois. `mois` : 0 à 11. */
export function grilleDuMois(annee: number, mois: number): (string | null)[][] {
  const premier = new Date(annee, mois, 1, 12);
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;
  const cases: (string | null)[] = Array(decalage).fill(null);
  for (let j = 1; j <= nbJours; j++) cases.push(jourLocal(new Date(annee, mois, j, 12)));
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines: (string | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

/** Le mois d'un jour (« AAAA-MM-JJ ») décalé de `delta` mois : le premier du mois visé, pour y naviguer. */
export function moisDecale(jour: string, delta: number): string {
  const d = dateDe(jour);
  return jourLocal(new Date(d.getFullYear(), d.getMonth() + delta, 1, 12));
}

// ── La liste ─────────────────────────────────────────────────────────────

/** Fenêtre de la liste des tenues passées : au plus 60 jours en arrière (l'historique complet est le Journal). */
export const LISTE_PASSE_JOURS = 60;

/**
 * La liste : « à venir » (aujourd'hui compris, du plus proche au plus lointain) puis « passées » (de la plus récente à la
 * plus ancienne). Seuls les jours où il y a une tenue.
 */
export function listeDuCalendrier(
  aujourdhui: string,
  history: readonly HistoryEntry[],
  plans: readonly TenuePlanifiee[],
  proposee: TenuePropose | null,
  maintenant: Date = new Date()
): { avenir: TenueDuCalendrier[]; passees: TenueDuCalendrier[] } {
  const avenirJours = new Set<string>();
  if (proposee) avenirJours.add(aujourdhui);
  for (const p of plans) if (p.jour >= aujourdhui && p.pieceIds.length > 0) avenirJours.add(p.jour);
  const avenir = [...avenirJours]
    .sort()
    .map((j) => tenueDuCalendrier(j, aujourdhui, history, plans, proposee))
    .filter((t): t is TenueDuCalendrier => t !== null);
  const passees: TenueDuCalendrier[] = [];
  for (let k = 1; k <= LISTE_PASSE_JOURS; k++) {
    const t = tenueDuCalendrier(jourLocal(dateDuJour(-k, maintenant)), aujourdhui, history, plans, null);
    if (t) passees.push(t);
  }
  return { avenir, passees };
}
