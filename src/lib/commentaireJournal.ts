import { OCCASIONS } from "./data";
import { OCCASIONS_EDITORIALES, TEXTES_JOURNAL, libelleOccasion } from "./occasionEditoriale";
import { historiqueDansPeriode, type PeriodeJournal } from "./selectors";
import type { HistoryEntry, OccasionKey } from "./types";

/*
 * LE MOTEUR DE COMMENTAIRES DU JOURNAL (16/10/2026, spécification « Moteur de commentaires éditoriaux du Journal », arbitrages
 * produit validés le même jour). Il remplace styleDePeriode (« Le quotidien arrive en tête depuis le début ») : à partir des tenues
 * PORTÉES de la période choisie, il retient un type de commentaire, puis ses mots dans la bibliothèque (occasionEditoriale.ts).
 *
 * Les tenues comptées sont les entrées de l'historique (state.history) : une entrée n'existe que pour une tenue validée « je la
 * porte » — une tenue seulement proposée n'y entre jamais. Une tenue sans occasion notée compte dans le total, dans aucune occasion.
 *
 * Fonction pure : mêmes tenues, même période, même instant → même commentaire. Aucun appel réseau, aucune écriture.
 */

/**
 * Les seuils, en un seul endroit (ARBITRAGE ÉDITORIAL, première configuration à valider sur données réelles — pas une vérité
 * statistique). Les parts sont des fractions (0,40 = 40 %), les écarts aussi (0,15 = 15 points).
 */
export const SEUILS_COMMENTAIRE = {
  /** En dessous : « Ton Journal prend forme », aucune occasion désignée. */
  MIN_TENUES_OBSERVATION: 5,
  /** En dessous : « Ton style se dessine peu à peu », toujours aucune occasion désignée. */
  MIN_TENUES_TENDANCE: 10,
  /** Part minimale de l'occasion en tête pour la dire dominante. */
  PART_DOMINANTE: 0.4,
  /** Avance minimale sur la deuxième pour la dire dominante. */
  ECART_DOMINANT: 0.15,
  /** Écart maximal entre les deux premières pour parler d'équilibre. */
  ECART_EQUILIBRE: 0.05,
  /** Nombre d'occasions représentées à partir duquel la répartition est dite diversifiée. */
  MIN_OCCASIONS_DIVERSITE: 4,
} as const;

/** Les seuils sont atteints « au moins » : une part de 40 % exactement est dominante. Tolérance d'arrondi des flottants (0,35 − 0,30). */
const EPS = 1e-9;

export type OccasionReelle = Exclude<OccasionKey, "all">;

export type TypeCommentaire =
  | "vide"
  | "insuffisant"
  | "emergent"
  | "secours"
  | "equilibre"
  | "diversifie"
  | "dominant"
  | "en_tete";

export interface StatistiquesOccasions {
  /** Tenues portées sur la période, avec ou sans occasion. */
  total: number;
  /** Tenues par occasion (les huit, zéro compris). */
  comptes: Record<OccasionReelle, number>;
  /** Part de chaque occasion dans le total (null si aucune tenue : jamais de division par zéro). */
  parts: Record<OccasionReelle, number> | null;
  /** Occasions représentées, de la plus fréquente à la moins fréquente ; à égalité, l'ordre du référentiel OCCASIONS. */
  classement: { occasion: OccasionReelle; compte: number; part: number }[];
  /** Tenues qui portent une occasion. */
  avecOccasion: number;
  /** Nombre d'occasions représentées par au moins une tenue. */
  occasionsRepresentees: number;
  /** Écart de part entre la première et la deuxième occasion (la deuxième vaut 0 s'il n'y en a pas) ; null sans occasion. */
  ecart: number | null;
}

export interface CommentaireJournal {
  type: TypeCommentaire;
  titre: string;
  description: string;
  /** L'occasion désignée (dominante ou en tête), sinon null. */
  occasion: OccasionReelle | null;
  libelleOccasion: string | null;
  /** Tenues de l'occasion désignée (0 sans occasion désignée). */
  compte: number;
  total: number;
  /** Part de l'occasion en tête, null sans occasion. */
  part: number | null;
  ecart: number | null;
  stats: StatistiquesOccasions;
}

/** Les huit occasions, dans l'ordre du référentiel : il départage les égalités, indépendamment de l'ordre de chargement. */
const ORDRE: OccasionReelle[] = OCCASIONS.map(([k]) => k).filter((k): k is OccasionReelle => k !== "all");

const estOccasion = (o: unknown): o is OccasionReelle => typeof o === "string" && (ORDRE as string[]).includes(o);

export function statistiquesOccasions(tenues: Pick<HistoryEntry, "occasion">[]): StatistiquesOccasions {
  const total = tenues.length;
  const comptes = Object.fromEntries(ORDRE.map((o) => [o, 0])) as Record<OccasionReelle, number>;
  for (const t of tenues) if (estOccasion(t.occasion)) comptes[t.occasion] += 1;
  const parts = total > 0 ? (Object.fromEntries(ORDRE.map((o) => [o, comptes[o] / total])) as Record<OccasionReelle, number>) : null;
  const classement = ORDRE.filter((o) => comptes[o] > 0)
    .map((o) => ({ occasion: o, compte: comptes[o], part: comptes[o] / total }))
    .sort((a, b) => b.compte - a.compte || ORDRE.indexOf(a.occasion) - ORDRE.indexOf(b.occasion));
  const avecOccasion = classement.reduce((n, c) => n + c.compte, 0);
  const ecart = classement.length ? classement[0].part - (classement[1]?.part ?? 0) : null;
  return { total, comptes, parts, classement, avecOccasion, occasionsRepresentees: classement.length, ecart };
}

const pl = (n: number, un: string, plusieurs: string) => (n <= 1 ? un : plusieurs);

/** Le commentaire de la carte pour ces tenues portées (déjà limitées à la période). Ordre des règles : spécification, §4. */
export function commentaireDesTenues(tenues: Pick<HistoryEntry, "occasion">[]): CommentaireJournal {
  const stats = statistiquesOccasions(tenues);
  const { total, classement, ecart } = stats;
  const S = SEUILS_COMMENTAIRE;
  const generique = (type: Exclude<TypeCommentaire, "dominant" | "en_tete">): CommentaireJournal => ({
    type,
    ...TEXTES_JOURNAL[type],
    occasion: null,
    libelleOccasion: null,
    compte: 0,
    total,
    part: classement[0]?.part ?? null,
    ecart,
    stats,
  });

  // 1. Aucune tenue portée sur la période.
  if (total === 0) return generique("vide");
  // Des tenues, mais aucune occasion exploitable : le secours, jamais une tendance déduite de rien.
  if (classement.length === 0) return generique("secours");
  // 2. et 3. Historique trop court pour désigner une occasion.
  if (total < S.MIN_TENUES_OBSERVATION) return generique("insuffisant");
  if (total < S.MIN_TENUES_TENDANCE) return generique("emergent");

  const premiere = classement[0];
  const exAequo = classement.filter((c) => c.compte === premiere.compte).length;
  // 4. et 5. Égalité exacte en tête : jamais de gagnante désignée.
  if (exAequo >= 3) return generique("diversifie");
  if (exAequo === 2) return generique("equilibre");
  // 6. Deux premières proches (écart de 5 points ou moins). Il faut deux occasions : une seule, très minoritaire face à des tenues sans
  // occasion, n'est pas un « équilibre entre plusieurs occasions ».
  if (classement.length >= 2 && ecart! <= S.ECART_EQUILIBRE + EPS) return generique("equilibre");
  // 7. Domination nette : au moins 40 % des tenues et 15 points d'avance.
  if (premiere.part >= S.PART_DOMINANTE - EPS && ecart! >= S.ECART_DOMINANT - EPS) return designee("dominant", premiere, stats);
  // 8. Au moins quatre occasions représentées, sans dominante.
  if (classement.length >= S.MIN_OCCASIONS_DIVERSITE) return generique("diversifie");
  // 9. Sinon, l'occasion en tête, sans en exagérer l'importance.
  return designee("en_tete", premiere, stats);
}

function designee(type: "dominant" | "en_tete", premiere: StatistiquesOccasions["classement"][number], stats: StatistiquesOccasions): CommentaireJournal {
  const o = OCCASIONS_EDITORIALES[premiere.occasion];
  const texte = type === "dominant" ? o.dominante : o.enTete;
  const description = texte.description
    .replace("{tenues}", `${premiere.compte} ${pl(premiere.compte, "tenue", "tenues")}`)
    .replace("{total}", String(stats.total));
  return {
    type,
    titre: texte.titre,
    description,
    occasion: premiere.occasion,
    libelleOccasion: libelleOccasion(premiere.occasion),
    compte: premiere.compte,
    total: stats.total,
    part: premiere.part,
    ecart: stats.ecart,
    stats,
  };
}

/** Le commentaire de la période choisie dans le Journal : les tenues portées de la période (historiqueDansPeriode), puis le moteur. */
export function commentaireJournal(history: HistoryEntry[], periode: PeriodeJournal, now: Date = new Date()): CommentaireJournal {
  return commentaireDesTenues(historiqueDansPeriode(history, periode, now));
}

/**
 * La liste « Tout mon journal » ouverte par le bouton de la carte : l'occasion de la carte ET la période du Journal. `periode` null
 * (« Tout afficher ») retire la période sans toucher à l'occasion ; `occasion` « toutes » garde toutes les occasions.
 */
export function filtrerListeJournal<T extends { ts: number; occasion: OccasionKey }>(
  entrees: T[],
  occasion: OccasionKey | "toutes",
  periode: PeriodeJournal | null,
  now: Date = new Date()
): T[] {
  const dePeriode = periode ? historiqueDansPeriode(entrees, periode, now) : entrees;
  return occasion === "toutes" ? dePeriode : dePeriode.filter((e) => e.occasion === occasion);
}
