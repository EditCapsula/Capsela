import { FENETRE_JOURS, jourMoins, type RecommandationJour } from "./diversite";

/**
 * LES RECOMMANDATIONS DES DERNIERS JOURS, gardées sur l'appareil (01/10/2026).
 *
 * La diversification (diversite.ts) a besoin de savoir ce qui a été PROPOSÉ les
 * jours précédents. Ce que l'app garde déjà ne suffit pas : l'historique
 * (`outfit_history`) ne contient que les tenues PORTÉES et validées, les tenues
 * planifiées que celles que l'utilisatrice a planifiées, et la tenue de chaque
 * jour consulté ne vit qu'en mémoire (tenuesParJourRef), perdue au rechargement.
 *
 * Solution la plus légère : une petite table jour → tenue affichée, en
 * localStorage, rangée par compte, limitée aux jours utiles. Aucune table
 * serveur, aucun nouveau traitement de données personnelles : ce sont des
 * identifiants de pièces et une météo, sur l'appareil, effacés avec le compte
 * (donneesLocales.ts).
 */

export type TableRecommandations = Record<string, RecommandationJour>;

/** On garde cette fenêtre (plus large que la fenêtre de diversité, pour consulter plusieurs jours d'avance). */
const JOURS_GARDES = FENETRE_JOURS + 10;

export const cleRecommandations = (userId: string | null): string => `capsela.recommandees.${userId ?? "demo"}`;

/** Retire ce qui est plus vieux que la fenêtre utile avant `jourRef`, et ce qui est illisible. Pure. */
export function elaguer(table: TableRecommandations, jourRef: string): TableRecommandations {
  const plusAncien = jourMoins(jourRef, JOURS_GARDES);
  const out: TableRecommandations = {};
  for (const [jour, r] of Object.entries(table)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour < plusAncien) continue;
    if (!r || !Array.isArray(r.ids) || !r.ids.every((n) => typeof n === "number")) continue;
    out[jour] = { ids: r.ids, temp: typeof r.temp === "number" ? r.temp : null, label: typeof r.label === "string" ? r.label : null };
  }
  return out;
}

export function lireRecommandations(userId: string | null, jourRef: string): TableRecommandations {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(cleRecommandations(userId));
    return brut ? elaguer(JSON.parse(brut) as TableRecommandations, jourRef) : {};
  } catch {
    return {};
  }
}

/** Enregistre la tenue affichée ce jour-là. Défensif : le stockage peut manquer, rien ne doit alors échouer. */
export function ecrireRecommandation(userId: string | null, jour: string, r: RecommandationJour, jourRef: string): TableRecommandations {
  const table = elaguer({ ...lireRecommandations(userId, jourRef), [jour]: r }, jourRef);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(cleRecommandations(userId), JSON.stringify(table));
    } catch {
      // Stockage indisponible : la mémoire de la session suffit.
    }
  }
  return table;
}
