import { GROUPES_AFFAIRES, type AffaireVoyage, type GroupeAffaire } from "./affairesVoyage";
import type { CategoryKey, Item } from "./types";

/*
 * LA CHECKLIST DE DÉPART (refonte du 19/10/2026, brief « Refonte UX/UI de la fonctionnalité Valise »). Module pur : les articles à
 * préparer — les pièces de la valise et les affaires de voyage — rangés par section, la progression et les filtres. L'écran Valise et
 * son Aperçu lisent la MÊME progression (`progressionChecklist`), jamais deux calculs.
 *
 * Ce que la checklist n'est pas :
 *   - la sélection : cocher dit « préparé physiquement », sans rien ajouter, retirer ni recomposer (les looks ne bougent pas) ;
 *   - une liste de quantités : une pièce de la valise est UN article physique, même portée dans plusieurs looks. Il n'existe pas de
 *     quantité dans le modèle (une pièce du dressing est un objet unique) : aucune n'est inventée.
 *
 * L'état « préparé » est celui que la valise garde déjà (`ValiseGardee.cochees` pour les pièces, `affaires.cochees` pour les affaires),
 * sur l'appareil et dans le compte : aucune donnée nouvelle.
 */

export type SectionChecklist = "vetements" | "chaussures" | "accessoires" | GroupeAffaire;

/** Les sections, dans l'ordre de l'écran : les pièces de la valise d'abord, puis les affaires de voyage (leurs groupes, inchangés). */
export const SECTIONS_CHECKLIST: { id: SectionChecklist; libelle: string }[] = [
  { id: "vetements", libelle: "Vêtements" },
  { id: "chaussures", libelle: "Chaussures" },
  { id: "accessoires", libelle: "Sacs et accessoires" },
  ...GROUPES_AFFAIRES,
];

const SECTION_DE_CATEGORIE: Record<CategoryKey, SectionChecklist> = {
  haut: "vetements",
  pull: "vetements",
  pantalon: "vetements",
  jean: "vetements",
  jupe: "vetements",
  short: "vetements",
  robe: "vetements",
  combinaison: "vetements",
  veste: "vetements",
  manteau: "vetements",
  chaussures: "chaussures",
  sac: "accessoires",
  bijou: "accessoires",
  accessoire: "accessoires",
};

export interface ArticleChecklist {
  /** Unique dans la checklist : « p-<id> » pour une pièce, « a-<id> » pour une affaire. */
  cle: string;
  section: SectionChecklist;
  libelle: string;
  prete: boolean;
  /** La pièce de la valise ; absente pour une affaire de voyage. */
  piece?: Item;
  /** L'affaire de voyage ; absente pour une pièce. */
  affaire?: AffaireVoyage;
}

/** Les articles de la checklist : chaque pièce de la valise une fois, puis les affaires affichées. */
export function articlesChecklist(
  pieces: readonly Item[],
  piecesCochees: readonly number[],
  affaires: readonly AffaireVoyage[],
  affairesCochees: readonly string[]
): ArticleChecklist[] {
  const vues = new Set<number>();
  const depuisPieces = pieces.flatMap((p): ArticleChecklist[] => {
    if (vues.has(p.id)) return [];
    vues.add(p.id);
    return [{ cle: `p-${p.id}`, section: SECTION_DE_CATEGORIE[p.cat], libelle: p.name, prete: piecesCochees.includes(p.id), piece: p }];
  });
  const depuisAffaires = affaires.map((a): ArticleChecklist => ({ cle: `a-${a.id}`, section: a.groupe, libelle: a.libelle, prete: affairesCochees.includes(a.id), affaire: a }));
  return [...depuisPieces, ...depuisAffaires];
}

export interface Progression {
  preparees: number;
  total: number;
  restantes: number;
  /** Arrondi à l'entier ; 0 quand il n'y a rien à préparer. */
  pourcentage: number;
}

export function progressionChecklist(articles: readonly ArticleChecklist[]): Progression {
  const total = articles.length;
  const preparees = articles.filter((a) => a.prete).length;
  return { preparees, total, restantes: total - preparees, pourcentage: total ? Math.round((preparees / total) * 100) : 0 };
}

export type FiltreChecklist = "tout" | "a_preparer" | "preparees";

export const filtrerChecklist = (articles: readonly ArticleChecklist[], filtre: FiltreChecklist): ArticleChecklist[] =>
  filtre === "tout" ? [...articles] : articles.filter((a) => a.prete === (filtre === "preparees"));

/** Les sections non vides, dans l'ordre, chacune avec SA progression (sur tous ses articles, quel que soit le filtre) et ses articles filtrés. */
export function sectionsChecklist(
  articles: readonly ArticleChecklist[],
  filtre: FiltreChecklist
): { id: SectionChecklist; libelle: string; progression: Progression; articles: ArticleChecklist[] }[] {
  return SECTIONS_CHECKLIST.flatMap((s) => {
    const siens = articles.filter((a) => a.section === s.id);
    if (!siens.length) return [];
    return [{ ...s, progression: progressionChecklist(siens), articles: filtrerChecklist(siens, filtre) }];
  });
}
