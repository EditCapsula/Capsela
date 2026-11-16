/**
 * LES TENUES DU JOUR, GARDÉES SUR L'APPAREIL (16/11/2026, demandé : « fiabiliser la génération de tenues. Si j'actualise la page sur le
 * web les tenues doivent rester exactement les mêmes. Si je ferme l'app les tenues doivent être les mêmes sauf si j'actualise via Autre
 * tenue »).
 *
 * Avant : la tenue du jour et les cartes du carrousel ne vivaient qu'en mémoire. Recharger la page ou rouvrir l'app relançait le
 * moteur, qui tire au sort parmi les tenues possibles : d'autres tenues. Le carrousel était de plus recalculé à chaque changement d'un
 * degré de la température.
 *
 * Désormais, pour AUJOURD'HUI : la tenue affichée pour chaque contexte (occasion, mode de travail, type de rendez-vous) et les cartes du
 * carrousel sont gardées en localStorage, rangées par compte. Recharger, fermer puis rouvrir rend les mêmes tenues. Ce qui en produit
 * de nouvelles : « Autre tenue », changer d'occasion pour la première fois de la journée, changer de style ou de dressing (le contexte du
 * carrousel), une pièce qui ne se retrouve plus (réparation), et le jour suivant.
 *
 * Aucune donnée serveur, aucun nouveau traitement : des identifiants de pièces, sur l'appareil, effacés avec le compte.
 */

export interface TenueGardee {
  ids: number[];
  missingCats: string[];
  formalityDowngraded: boolean;
  occasionRelachee: boolean;
  noCompleteOutfit: boolean;
  failureReason: string | null;
}

export interface CarrouselGarde {
  cle: string;
  propositions: Record<string, number[]>;
  tentees: string[];
}

export interface Gardees {
  jour: string;
  /** Une tenue par contexte (cleContexte). */
  tenues: Record<string, TenueGardee>;
  carrousel: CarrouselGarde | null;
}

export const cleGardees = (userId: string | null): string => `capsela.tenuesDuJour.${userId ?? "demo"}`;

/** Le contexte d'une tenue : occasion, et les sous-choix qui changent ce que le moteur compose. */
export const cleContexte = (c: { occasion: string; workMode: string; dateContext: string }): string => `${c.occasion}|${c.workMode}|${c.dateContext}`;

const vide = (jour: string): Gardees => ({ jour, tenues: {}, carrousel: null });

const estIds = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number");

/** Lecture défensive : un autre jour, un contenu illisible ou partiel redevient vide. Pure. */
export function lireGardeesDepuis(brut: string | null, jour: string): Gardees {
  if (!brut) return vide(jour);
  try {
    const o = JSON.parse(brut) as Partial<Gardees>;
    if (!o || o.jour !== jour) return vide(jour);
    const tenues: Record<string, TenueGardee> = {};
    for (const [k, t] of Object.entries(o.tenues ?? {})) {
      if (!t || !estIds(t.ids)) continue;
      tenues[k] = {
        ids: t.ids,
        missingCats: Array.isArray(t.missingCats) ? t.missingCats.filter((x): x is string => typeof x === "string") : [],
        formalityDowngraded: t.formalityDowngraded === true,
        occasionRelachee: t.occasionRelachee === true,
        noCompleteOutfit: t.noCompleteOutfit === true,
        failureReason: typeof t.failureReason === "string" ? t.failureReason : null,
      };
    }
    const c = o.carrousel;
    const propositions: Record<string, number[]> = {};
    if (c && typeof c.cle === "string") for (const [k, ids] of Object.entries(c.propositions ?? {})) if (estIds(ids)) propositions[k] = ids;
    const carrousel =
      c && typeof c.cle === "string" ? { cle: c.cle, propositions, tentees: Array.isArray(c.tentees) ? c.tentees.filter((x): x is string => typeof x === "string") : [] } : null;
    return { jour, tenues, carrousel };
  } catch {
    return vide(jour);
  }
}

export function lireGardees(userId: string | null, jour: string): Gardees {
  if (typeof window === "undefined") return vide(jour);
  try {
    return lireGardeesDepuis(window.localStorage.getItem(cleGardees(userId)), jour);
  } catch {
    return vide(jour);
  }
}

function ecrire(userId: string | null, g: Gardees): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleGardees(userId), JSON.stringify(g));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la mémoire de la session suffit.
  }
}

export function garderTenue(userId: string | null, jour: string, contexte: string, t: TenueGardee): void {
  const g = lireGardees(userId, jour);
  ecrire(userId, { ...g, tenues: { ...g.tenues, [contexte]: t } });
}

export function garderCarrousel(userId: string | null, jour: string, c: CarrouselGarde): void {
  const g = lireGardees(userId, jour);
  ecrire(userId, { ...g, carrousel: c });
}

/** Une tenue gardée n'est rendue que si TOUTES ses pièces se retrouvent encore (dressing et catalogue) : sinon, un nouveau tirage. */
export function tenueRestituable(t: TenueGardee | undefined, existe: (id: number) => boolean): t is TenueGardee {
  return Boolean(t && t.ids.length > 0 && t.ids.every(existe));
}
