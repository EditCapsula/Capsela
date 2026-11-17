import type { HistoryEntry, Item } from "./types";

/*
 * « DE RETOUR APRÈS N JOURS » (17/11/2026, maquette « Capsela — Tenue du jour » : après « Porter cette tenue », « Ton pantalon droit est
 * de retour, pas porté depuis 44 jours. Ajouté à ton journal », seulement quand c'est vrai). Pur, testé.
 *
 * La donnée : le Journal (outfit_history), daté, et non `Item.worn` (un nombre de jours écrit au dernier port, qui ne vieillit pas).
 * Parmi les pièces de la tenue, celle dont le dernier port AVANT aujourd'hui est le plus ancien, s'il date d'au moins SEUIL_RETOUR_JOURS.
 * Une pièce jamais portée selon le Journal n'est pas « de retour » : on ne dit rien (aucune donnée inventée).
 */

/** À partir de combien de jours sans port une pièce est dite « de retour ». ARBITRAGE ÉDITORIAL du 17/11/2026, réversible. */
export const SEUIL_RETOUR_JOURS = 14;

const debutDuJour = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function pieceDeRetour(
  pieces: readonly Pick<Item, "id" | "name">[],
  historique: readonly Pick<HistoryEntry, "ts" | "pieceIds">[],
  maintenant = Date.now()
): { piece: Pick<Item, "id" | "name">; jours: number } | null {
  const aujourdhui = debutDuJour(maintenant);
  let meilleure: { piece: Pick<Item, "id" | "name">; jours: number } | null = null;
  for (const p of pieces) {
    let dernier: number | null = null;
    for (const h of historique) {
      if (h.ts >= aujourdhui || !h.pieceIds.includes(p.id)) continue;
      if (dernier === null || h.ts > dernier) dernier = h.ts;
    }
    if (dernier === null) continue;
    const jours = Math.round((aujourdhui - debutDuJour(dernier)) / 86_400_000);
    if (jours >= SEUIL_RETOUR_JOURS && (!meilleure || jours > meilleure.jours)) meilleure = { piece: p, jours };
  }
  return meilleure;
}

/** Le message après « Porter cette tenue » : la pièce de retour s'il y en a une, puis le Journal. Sans genre grammatical deviné. */
export function messagePortee(retour: { piece: Pick<Item, "name">; jours: number } | null): string {
  return retour ? `${retour.piece.name} : de retour après ${retour.jours} jours. Tenue ajoutée à ton journal.` : "Tenue ajoutée à ton journal.";
}

/** La dernière tenue portée le jour de `maintenant` (le Journal), ou null. */
export function porteeLe<T extends Pick<HistoryEntry, "ts">>(historique: readonly T[], maintenant = Date.now()): T | null {
  const debut = debutDuJour(maintenant);
  const fin = debut + 86_400_000;
  let derniere: T | null = null;
  for (const h of historique) if (h.ts >= debut && h.ts < fin && (!derniere || h.ts > derniere.ts)) derniere = h;
  return derniere;
}

/** La clé d'une liste de pièces, sans ordre : deux tenues aux mêmes pièces ont la même. */
export const cleSlideIds = (ids: readonly number[]) => [...ids].sort((a, b) => a - b).join(",");
