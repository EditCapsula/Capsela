import { clePrincipale } from "./logic";
import { SEUIL_POLYVALENTE, looksParPiece, occasionsCouvertes, type Generateur, type LookValise, type SituationValise } from "./valise";
import type { CreneauPlanning } from "./planningValise";
import type { Item, OccasionKey } from "./types";

/*
 * LES AJUSTEMENTS D'UNE VALISE (phase C, 04/10/2026) : polyvalence par pièce, « Alléger ma valise » avec aperçu, « Ajouter
 * une tenue ». Pur, comme valise.ts : rien ici ne compose une tenue par lui-même, tout passe par le générateur (le moteur de
 * tenues) ; rien n'est stocké, tout se relit des pièces et des looks de la valise. Aucune règle morphologique : le moteur
 * est celui de la tenue du jour, tel quel (R-S9 retiré le 29/08/2026).
 */

// ── Polyvalence ──────────────────────────────────────────────────────────

/**
 * Les numéros des jours (1 = premier jour du séjour) où une pièce est portée d'après le planning : ceux des créneaux dont le
 * look la contient. Vide sans planning ou si elle n'est dans aucun look planifié.
 */
export function joursDeLaPiece(planning: readonly CreneauPlanning[], looks: readonly LookValise[], id: number, jours: readonly string[]): number[] {
  const portes = new Set(planning.filter((c) => c.look != null && looks[c.look]?.ids.includes(id)).map((c) => c.jour));
  return jours.flatMap((j, i) => (portes.has(j) ? [i + 1] : []));
}

// ── Alléger ──────────────────────────────────────────────────────────────

export type RaisonAllegement = "aucun_look" | "doublon" | "un_look" | "faible";

export const LIBELLE_RAISON: Record<RaisonAllegement, string> = {
  aucun_look: "Dans aucun look de la valise",
  doublon: "Une autre pièce du même type sert davantage",
  un_look: "Utilisée dans un seul look",
  faible: "Peu polyvalente",
};

export interface PieceAllegeable {
  id: number;
  raison: RaisonAllegement;
  /** Le nombre de looks de la valise où elle figure. */
  looks: number;
}

/**
 * Les pièces qu'on peut retirer, les moins utiles d'abord : celles qui n'atteignent pas le seuil de polyvalence
 * (SEUIL_POLYVALENTE). La raison dit un fait de la valise — jamais « remplaçable », qui demanderait un calcul du moteur.
 * Un doublon : une autre pièce du même type, dans la valise, figure dans davantage de looks.
 */
export function piecesAllegeables(pieces: readonly Item[], looks: readonly LookValise[]): PieceAllegeable[] {
  const parPiece = looksParPiece([...looks]);
  const n = (id: number) => parPiece.get(id) ?? 0;
  return pieces
    .filter((p) => n(p.id) < SEUIL_POLYVALENTE)
    .map((p): PieceAllegeable => {
      const k = n(p.id);
      const doublon = pieces.some((q) => q.id !== p.id && q.cat === p.cat && n(q.id) > k);
      const raison: RaisonAllegement = k === 0 ? "aucun_look" : doublon ? "doublon" : k === 1 ? "un_look" : "faible";
      return { id: p.id, raison, looks: k };
    })
    .sort((a, b) => a.looks - b.looks || a.id - b.id);
}

export interface ApercuAllegement {
  piecesAvant: number;
  piecesApres: number;
  looksAvant: number;
  looksApres: number;
  /** Les occasions qui n'auraient plus aucun look. */
  occasionsPerdues: OccasionKey[];
}

/**
 * L'avant / après d'un retrait : les looks CONSERVÉS sont ceux qui ne contiennent aucune pièce retirée. C'est un plancher —
 * à l'enregistrement le moteur recompose avec les pièces restantes et peut en trouver d'autres, jamais moins.
 */
export function apercuAllegement(pieceIds: readonly number[], looks: readonly LookValise[], situations: readonly SituationValise[], retirees: readonly number[]): ApercuAllegement {
  const hors = new Set(retirees);
  const gardes = looks.filter((l) => !l.ids.some((id) => hors.has(id)));
  const avant = occasionsCouvertes([...looks], [...situations]);
  const apres = new Set(occasionsCouvertes(gardes, [...situations]));
  return {
    piecesAvant: pieceIds.length,
    piecesApres: pieceIds.filter((id) => !hors.has(id)).length,
    looksAvant: looks.length,
    looksApres: gardes.length,
    occasionsPerdues: avant.filter((o) => !apres.has(o)),
  };
}

// ── Ajouter une tenue ────────────────────────────────────────────────────

export interface TenueProposee {
  ids: number[];
  /** Les pièces du dressing qu'elle demande et que la valise n'a pas encore ; vide : elle se fait avec la valise telle quelle. */
  ajouts: number[];
}

/**
 * UNE TENUE DE PLUS POUR UNE SITUATION (« Ajouter une tenue »), dans l'ordre : d'abord avec les seules pièces de la valise ;
 * à défaut, avec le reste du dressing, en retenant la tenue qui demande le moins de pièces à ajouter. Le moteur (`generer`)
 * tire, comme pour les looks de la valise : aucune tenue n'est écrite ici. Une tenue déjà dans la valise (même pièce
 * principale, clePrincipale) n'est pas proposée une seconde fois. Rien quand le dressing ne permet pas de tenue nouvelle.
 */
export function nouvelleTenue(
  situation: SituationValise,
  pieceIds: readonly number[],
  dressing: readonly Item[],
  looksExistants: readonly LookValise[],
  generer: Generateur,
  tirages = 12
): TenueProposee | null {
  const dansValise = new Set(pieceIds);
  const poolValise = dressing.filter((i) => dansValise.has(i.id));
  const dejaLa = new Set(looksExistants.map((l) => clePrincipale(l.ids, [...dressing]) || [...l.ids].sort((a, b) => a - b).join(",")));
  const essayer = (pool: Item[]): TenueProposee | null => {
    let meilleure: TenueProposee | null = null;
    for (let n = 0; n < tirages; n++) {
      const t = generer(pool, situation);
      if (!t) continue;
      const ids = [...new Set(t.ids)].sort((a, b) => a - b);
      const cle = clePrincipale(ids, pool) || ids.join(",");
      if (dejaLa.has(cle)) continue;
      const ajouts = ids.filter((id) => !dansValise.has(id));
      if (!meilleure || ajouts.length < meilleure.ajouts.length) meilleure = { ids, ajouts };
      if (!ajouts.length) break;
    }
    return meilleure;
  };
  return essayer(poolValise) ?? essayer([...dressing]);
}

/** La valise une fois la tenue ajoutée : ses pièces, ses looks (le nouveau répond à la situation), et les situations encore sans look. */
export function avecTenue(
  v: { pieceIds: number[]; looks: LookValise[]; situationsSansLook: number[] },
  tenue: TenueProposee,
  situationIndex: number
): { pieceIds: number[]; looks: LookValise[]; situationsSansLook: number[] } {
  return {
    pieceIds: [...new Set([...v.pieceIds, ...tenue.ids])],
    looks: [...v.looks, { ids: tenue.ids, situations: [situationIndex], elargie: false }],
    situationsSansLook: v.situationsSansLook.filter((i) => i !== situationIndex),
  };
}
