import { saisonCalendairePour } from "./capsule";

/**
 * « PAS POUR MOI », POUR LA SAISON EN COURS (13/11/2026, mission « Harmonisation du système de fiches », arbitré : « la saison en
 * cours »). Jusqu'ici « Pas pour moi » enregistrait un refus DÉFINITIF (vote « rejetee », votesSuggestions.ts) : la suggestion ne
 * revenait jamais, sans que la personne l'ait demandé. Désormais :
 *   · « Pas pour moi » retire la pièce de la capsule pour la saison calendaire en cours ; elle peut revenir la saison suivante.
 *     Gardé sur l'appareil, sans migration ; aucune préférence durable n'est écrite ;
 *   · « Ne plus me proposer cette pièce » (menu ⋯) garde le refus définitif d'avant (vote « rejetee »).
 *
 * Une saison se repère par son année de début : l'hiver de décembre 2026 à février 2027 est « 2026-Hiver ».
 */
export type TablePasPourMoi = Record<string, string>;

export function cleSaison(d: Date): string {
  const annee = d.getMonth() <= 1 ? d.getFullYear() - 1 : d.getFullYear();
  return `${annee}-${saisonCalendairePour(d)}`;
}

/** Les pièces écartées pour la saison de `maintenant` ; celles d'une saison passée ne comptent plus. */
export function piecesPasPourMoi(table: TablePasPourMoi, maintenant: Date): number[] {
  const cle = cleSaison(maintenant);
  return Object.entries(table)
    .filter(([, s]) => s === cle)
    .map(([id]) => Number(id));
}

export function ajouterPasPourMoi(table: TablePasPourMoi, id: number, maintenant: Date): TablePasPourMoi {
  return { ...nettoyer(table, maintenant), [String(id)]: cleSaison(maintenant) };
}

export function retirerPasPourMoi(table: TablePasPourMoi, id: number): TablePasPourMoi {
  const suite = { ...table };
  delete suite[String(id)];
  return suite;
}

/** Sans les saisons passées : la table ne grossit pas indéfiniment. */
export function nettoyer(table: TablePasPourMoi, maintenant: Date): TablePasPourMoi {
  const cle = cleSaison(maintenant);
  return Object.fromEntries(Object.entries(table).filter(([id, s]) => /^\d+$/.test(id) && s === cle));
}

const cleStockage = (userId: string | null) => `capsela.pasPourMoi.${userId ?? "demo"}`;

export function lirePasPourMoi(userId: string | null): TablePasPourMoi {
  try {
    const brut = JSON.parse(localStorage.getItem(cleStockage(userId)) ?? "{}");
    return brut && typeof brut === "object" ? nettoyer(brut as TablePasPourMoi, new Date()) : {};
  } catch {
    return {};
  }
}

export function ecrirePasPourMoi(userId: string | null, table: TablePasPourMoi): void {
  try {
    localStorage.setItem(cleStockage(userId), JSON.stringify(table));
  } catch {
    // Stockage refusé : le retrait vaut pour cette session.
  }
}
