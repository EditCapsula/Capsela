import type { OrigineLook, SavedLook } from "./types";

/**
 * LA PROVENANCE D'UN LOOK (20/11/2026, demandé sur Mes looks, maquette à l'appui : « je veux surtout indiquer la provenance des looks »).
 *
 * Deux informations distinctes sur la carte :
 * - la SOURCE, connue de tout look depuis toujours (`source`, migration 0025) : « Tenue enregistrée » (une tenue proposée par Capsela,
 *   gardée telle quelle) ou « Look créé » (composé pièce par pièce) ;
 * - l'ORIGINE, l'endroit d'où une tenue a été enregistrée (`origine`, migration 0066). Elle n'était pas gardée avant le 20/11/2026 : un look
 *   plus ancien n'en a pas, et sa carte ne dit rien plutôt que d'inventer (convention : aucune donnée inventée).
 *
 * L'origine est écrite à part de l'insertion (jamais dans l'insertion elle-même : avant la migration, la colonne manquante ferait échouer
 * chaque sauvegarde), et gardée aussi sur l'appareil : avant la migration, ou si l'écriture échoue, la carte la montre quand même ici.
 */

export const LIBELLE_SOURCE: Record<SavedLook["source"], string> = {
  saved: "Tenue enregistrée",
  created: "Look créé",
};

export const LIBELLE_ORIGINE: Record<OrigineLook, string> = {
  tenue_du_jour: "Depuis Ma tenue du jour",
  accueil: "Depuis l'Accueil",
  planifier: "Depuis Planifier",
  composer: "Depuis la Capsule",
  idee_look: "Depuis une idée de look",
  valise: "Depuis ta valise",
};

const ORIGINES = Object.keys(LIBELLE_ORIGINE) as OrigineLook[];

export function estOrigineLook(v: unknown): v is OrigineLook {
  return typeof v === "string" && (ORIGINES as string[]).includes(v);
}

/** La phrase d'origine d'un look, ou null : un look créé (sa source le dit déjà) ou un look dont l'origine n'a pas été gardée. */
export function phraseOrigine(look: Pick<SavedLook, "source" | "origine">): string | null {
  if (look.source !== "saved" || !look.origine) return null;
  return LIBELLE_ORIGINE[look.origine] ?? null;
}

/** Complète les looks lus en base avec les origines gardées sur l'appareil ; celle de la base prime. */
export function avecOriginesLocales(looks: SavedLook[], locales: Record<string, OrigineLook>): SavedLook[] {
  return looks.map((l) => (l.origine || !locales[l.id] ? l : { ...l, origine: locales[l.id] }));
}

const CLE = "capsela.looks.origines";

export function lireOriginesLocales(): Record<string, OrigineLook> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(brut).filter(([, v]) => estOrigineLook(v))) as Record<string, OrigineLook>;
  } catch {
    return {};
  }
}

export function garderOrigineLocale(id: string, origine: OrigineLook): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ ...lireOriginesLocales(), [id]: origine }));
  } catch {
    // Stockage indisponible (navigation privée) : l'origine vit en base seulement.
  }
}
