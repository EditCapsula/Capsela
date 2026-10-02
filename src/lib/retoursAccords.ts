/**
 * LES RETOURS SUR LES ACCORDS DE SAISON (02/10/2026) — « J'aime cette association » / « Pas pour moi ».
 *
 * Gardés SUR L'APPAREIL, rangés par compte (localStorage), comme les recommandations des derniers
 * jours (recommandationsRecentes.ts) : aucune table serveur, donc aucune migration, et ils partent avec
 * le compte (donneesLocales.ts). Un signal par accord (la paire de couleurs d'une saison) : un seul
 * état à la fois, le même geste le retire, l'autre geste le remplace.
 *
 * Aujourd'hui, seul « Pas pour moi » a un effet : l'accord n'est plus proposé (conseilCouleur,
 * paramètre `ecartes`). « J'aime » est enregistré sans effet : il prépare une personnalisation
 * ultérieure, qui n'existe pas encore.
 */

export type RetourAccord = "aime" | "pas_pour_moi";
/** clé d'accord (cleAccord, conseilsCouleurs.ts) → retour. */
export type TableRetours = Record<string, RetourAccord>;

export const cleRetoursAccords = (userId: string | null): string => `capsela.accords.${userId ?? "demo"}`;

const RETOURS: readonly string[] = ["aime", "pas_pour_moi"];

/** Ne garde que les entrées bien formées : un stockage altéré ne doit rien casser. Pure. */
export function nettoyer(brut: unknown): TableRetours {
  const out: TableRetours = {};
  if (!brut || typeof brut !== "object") return out;
  for (const [cle, v] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof v === "string" && RETOURS.includes(v) && cle.includes("|")) out[cle] = v as RetourAccord;
  }
  return out;
}

/** Le même retour est RETIRÉ (réversible), un autre le REMPLACE. Pure. */
export function basculerRetour(table: TableRetours, cle: string, retour: RetourAccord): TableRetours {
  const suite = { ...table };
  if (suite[cle] === retour) delete suite[cle];
  else suite[cle] = retour;
  return suite;
}

/** Les accords que la personne ne veut plus voir. Pure. */
export function accordsEcartes(table: TableRetours): Set<string> {
  return new Set(Object.entries(table).filter(([, v]) => v === "pas_pour_moi").map(([k]) => k));
}

export function lireRetours(userId: string | null): TableRetours {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(cleRetoursAccords(userId));
    return brut ? nettoyer(JSON.parse(brut)) : {};
  } catch {
    return {};
  }
}

/** Défensif : le stockage peut manquer, la mémoire de la session suffit alors. */
export function ecrireRetours(userId: string | null, table: TableRetours): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleRetoursAccords(userId), JSON.stringify(table));
  } catch {
    // Stockage indisponible.
  }
}
