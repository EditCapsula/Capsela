import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import { computeLookScore, tenueAUnSocle } from "./logic";
import type { Weather } from "./data";
import type { Item } from "./types";
import type { AvisStyliste } from "../../supabase/functions/_shared/avisStyliste.ts";

/*
 * LA NOTE DE L'AVIS DE STYLISTE (03/10/2026, demandée par la propriétaire).
 *
 * Une note sur 10 qui évalue LA TENUE et sa cohérence — jamais la personne —, présentée comme un
 * diagnostic de style. Elle ne coûte aucun appel au modèle : c'est une couche de présentation posée sur
 * des signaux DÉJÀ calculés par l'application.
 *
 *   avis (verdict) ──────────────┐
 *   pièces reconnues → dressing ─┴→ computeLookScore (règles R-S, tracées) → quatre dimensions → note
 *
 * D'OÙ VIENT CHAQUE DIMENSION — et ce qui n'existe pas.
 *   · Couleurs (25 %)      : R-S1 sobriété, R-S2 harmonie, R-S3 60/30/10, R-S10 palette, R-S18 saison.
 *   · Coordination (20 %)  : R-S6 chaussures, R-S8 matières (jusqu'à 8), R-S11 superposition (jusqu'à 10).
 *   · Finition (10 %)      : R-S4 métaux, R-S5 pièces fortes, R-S7 sac et chaussures, touche de couleur.
 *   · Lecture de la styliste (45 %) : le titre du verdict (liste fermée de l'avis). C'est la SEULE porte
 *     d'entrée du style déclaré et des proportions, que le modèle reçoit en contexte (contexteDepuisProfil).
 *   La proposition du brief comptait deux dimensions de plus — « proportions / silhouette » (25 %) et « style »
 *   (20 %). Aucune n'est calculable dans le code : le terme morphologique du score (R-S9) a été RETIRÉ le
 *   29/08/2026 parce qu'il jugeait la silhouette à partir d'une regex sur un nom de produit, et aucune règle ne
 *   compare les pièces au style déclaré. Rien n'est inventé : leurs 45 % passent à la lecture de la styliste, et
 *   le modèle morphologique n'est ni touché ni dupliqué.
 *
 * QUAND IL N'Y A PAS DE NOTE. La note exige une composition reconnue dans le dressing (au moins deux pièces,
 * un socle haut + bas ou une robe) : sans elle, aucune règle de score n'a de pièces à lire, et la seule lecture
 * du texte ne ferait pas une note « calculée ». L'avis s'affiche alors comme avant. Une dimension non
 * évaluable (pas d'accessoire reconnu, pas de verdict sur un avis ancien) est écartée, ses points redistribués
 * sur les autres — jamais remplacée par une valeur.
 *
 * ARBITRAGE ÉDITORIAL : les pondérations, la base de chaque dimension (7 pour les couleurs sans pénalité, 5,5 pour la coordination) et les seuils des
 * libellés sont une proposition produit, pas une mesure. Mesurer leur distribution sur de vrais avis reste à
 * faire (cf. docs/avis-de-styliste.md).
 */

export type CleDimension = "couleurs" | "coordination" | "finition" | "lecture";

export interface DimensionNote {
  cle: CleDimension;
  libelle: string;
  /** Sur 10, une décimale. */
  note: number;
  /** Poids RÉEL dans la note (somme = 1 sur les dimensions évaluées). */
  poids: number;
}

/** Une piste « À améliorer » : un titre court, une explication, et — quand il y en a — la pièce du dressing qui la réalise. */
export interface Amelioration {
  titre: string;
  texte: string;
  pieces: Item[];
}

export interface NoteTenue {
  note: number;
  libelle: string;
  phrase: string;
  dimensions: DimensionNote[];
  ameliorations: Amelioration[];
}

const POIDS: Record<CleDimension, number> = { couleurs: 0.25, coordination: 0.2, finition: 0.1, lecture: 0.45 };
const LIBELLES: Record<CleDimension, string> = {
  couleurs: "Harmonie des couleurs",
  coordination: "Coordination des pièces",
  finition: "Finition et accessoires",
  lecture: "Lecture de la styliste",
};

/** Le titre du verdict (liste fermée, TITRES_VERDICT) lu en note : seul le NIVEAU compte, jamais le texte libre. */
const NOTE_DU_VERDICT: Record<string, number> = { "Très réussi": 9, Réussi: 8, "Bien vu": 7, "À affiner": 5.5 };

/** Seuils du brief : 9–10, 8–8,9, 7–7,9, 6–6,9, 5–5,9, < 5. */
export function interpretationNote(note: number): { libelle: string; phrase: string } {
  if (note >= 9) return { libelle: "Une tenue très maîtrisée", phrase: "Les pièces fonctionnent particulièrement bien ensemble." };
  if (note >= 8) return { libelle: "Une tenue harmonieuse", phrase: "Une belle cohérence d'ensemble, avec quelques détails qui peuvent encore la sublimer." };
  if (note >= 7) return { libelle: "Une base très réussie", phrase: "L'association fonctionne bien ; quelques ajustements peuvent renforcer l'équilibre." };
  if (note >= 6) return { libelle: "Une bonne base à affiner", phrase: "La tenue fonctionne, mais certains éléments peuvent être mieux coordonnés." };
  if (note >= 5) return { libelle: "Une base intéressante", phrase: "Quelques ajustements permettraient de créer davantage d'harmonie." };
  return { libelle: "Une tenue à rééquilibrer", phrase: "Quelques changements ciblés peuvent transformer l'ensemble." };
}

/** « 8,2 » : la virgule française, toujours une décimale. */
export const formaterNote = (note: number) => note.toFixed(1).replace(".", ",");

const arrondi = (n: number) => Math.round(n * 10) / 10;
const borner = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Titre court de chaque pénalité de score — la règle dit déjà la phrase, le titre dit l'action. */
const TITRE_REGLE: Record<string, string> = {
  "R-S1": "Alléger la palette",
  "R-S4": "Unifier les métaux",
  "R-S5": "Adoucir une pièce forte",
  "R-S7": "Équilibrer sac et chaussures",
};

export interface EntreeNote {
  avis: AvisStyliste;
  /** Les pièces du dressing reconnues sur la photo (compositionReconnue). */
  composition: Item[];
  /** Le dressing actuel : sert à proposer une pièce possédée pour la touche de couleur. */
  dressing: Item[];
  /** Les pièces rattachées au conseil principal par le serveur, déjà filtrées sur le dressing actuel. */
  piecesDuConseil: Item[];
  titreConseil?: string;
  titreVerdict?: string;
  palette: string[];
  colorimetrie?: ColorimetrieMoteur | null;
  meteo: Weather;
}

const CATS_FINITION = ["chaussures", "sac", "bijou", "accessoire"];

/** La note de la tenue, ou null quand rien de calculable n'est disponible (voir l'en-tête). */
export function noteDeLaTenue(e: EntreeNote): NoteTenue | null {
  const { composition } = e;
  if (composition.length < 2 || !tenueAUnSocle(composition)) return null;

  // « quotidien » et la météo du jour : la note ne lit que des règles de COULEUR, de matière et de pièces, que ni
  // l'occasion ni la météo ne font varier ; R-S15 (anti-répétition) est ignorée — elle parle de l'historique.
  const score = computeLookScore(composition, "quotidien", e.palette, null, new Set(), e.meteo, undefined, undefined, e.dressing, e.colorimetrie ?? null);
  const points = (...regles: string[]) => score.regles.filter((r) => regles.includes(r.regle)).reduce((s, r) => s + r.points, 0);
  const aUneCouleurAAjouter = score.proactives.some((p) => p.key === "color");

  const dimensions: Omit<DimensionNote, "poids">[] = [];

  // Couleurs — la base 7 vaut « aucune pénalité » ; les bonus la portent jusqu'à 10 selon la part atteinte des bonus
  // POSSIBLES (palette et saison ne comptent que si le profil les renseigne).
  const bonusMax = 25 + (e.palette.length ? 10 : 0) + (e.colorimetrie ? 10 : 0);
  const gagne = points("R-S2", "R-S3", "R-S10", "R-S18");
  const penCouleurs = -points("R-S1");
  dimensions.push({ cle: "couleurs", libelle: LIBELLES.couleurs, note: arrondi(borner(7 + (3 * gagne) / bonusMax - (3.5 * penCouleurs) / 10, 3, 10)) });

  // Coordination — base 5,5, jusqu'à 8 avec les chaussures (R-S6) et les matières (R-S8), que le moteur accorde presque
  // toujours : mesuré, ces deux bonus seuls portaient chaque tenue à 10. Les deux derniers points reviennent à la
  // superposition réussie (R-S11), la seule qui distingue vraiment une tenue pensée d'une tenue correcte.
  const aChaussures = composition.some((i) => i.cat === "chaussures");
  const socleMax = 5 + (aChaussures ? 10 : 0);
  const socleGagne = points("R-S6", "R-S8");
  const superposee = points("R-S11") > 0;
  dimensions.push({
    cle: "coordination",
    libelle: LIBELLES.coordination,
    note: arrondi(borner(5.5 + (2.5 * socleGagne) / socleMax + (superposee ? 2 : 0), 3, 10)),
  });

  // Finition — seulement si au moins une chaussure ou un accessoire a été reconnu.
  if (composition.some((i) => CATS_FINITION.includes(i.cat))) {
    const pen = -points("R-S4", "R-S5", "R-S7");
    dimensions.push({ cle: "finition", libelle: LIBELLES.finition, note: arrondi(borner(8.5 - 0.5 * pen - (aUneCouleurAAjouter ? 1 : 0), 3, 10)) });
  }

  // Lecture de la styliste — absente d'un avis ancien, sans titre de verdict.
  const lecture = e.titreVerdict ? NOTE_DU_VERDICT[e.titreVerdict] : undefined;
  if (lecture !== undefined) dimensions.push({ cle: "lecture", libelle: LIBELLES.lecture, note: lecture });

  const total = dimensions.reduce((s, d) => s + POIDS[d.cle], 0);
  const avecPoids: DimensionNote[] = dimensions.map((d) => ({ ...d, poids: POIDS[d.cle] / total }));
  const note = arrondi(borner(avecPoids.reduce((s, d) => s + d.note * d.poids, 0), 0, 10));

  // « À améliorer » : le conseil de la styliste d'abord, puis ce que les règles ont réellement relevé sur CETTE
  // tenue, trois au plus. Rien de générique : chaque ligne vient d'un constat.
  const ameliorations: Amelioration[] = [];
  if (e.avis.mainAdvice.trim()) {
    ameliorations.push({ titre: e.titreConseil ?? "Le conseil de la styliste", texte: e.avis.mainAdvice, pieces: e.piecesDuConseil });
  }
  score.regles
    .filter((r) => r.points < 0 && r.regle !== "R-S15" && r.message && TITRE_REGLE[r.regle])
    .sort((a, b) => a.points - b.points)
    .forEach((r) => ameliorations.push({ titre: TITRE_REGLE[r.regle], texte: r.message!, pieces: [] }));
  const couleur = score.proactives.find((p) => p.key === "color");
  if (couleur) {
    const piece = couleur.suggestedId !== undefined ? e.dressing.find((i) => i.id === couleur.suggestedId) : undefined;
    ameliorations.push({ titre: "Ajouter une touche de couleur", texte: couleur.text, pieces: piece ? [piece] : [] });
  }

  return { note, ...interpretationNote(note), dimensions: avecPoids, ameliorations: ameliorations.slice(0, 3) };
}
