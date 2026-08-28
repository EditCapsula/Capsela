import type { CategoryKey, Item } from "./types";
import { coupeOf } from "./attributes";

/**
 * Effet morphologique d'une pièce — prototype (chantier du 28/08/2026).
 *
 * On ne cherche PAS à décrire la coupe d'un vêtement, mais l'EFFET VISUEL
 * qu'il produit sur la silhouette. La distinction est le cœur du modèle :
 * une même ampleur ne produit pas le même effet selon la famille du
 * vêtement. Un pantalon large épaissit le bas, un pull oversize épaissit le
 * haut — la coupe seule ne le dit pas, la famille seule non plus.
 *
 *   FAMILLE  → quelle zone la pièce peut toucher
 *   COUPE    → avec quelle intensité, quand elle est renseignée
 *   SOUS_TYPE→ terme de silhouette qui précise ou corrige l'intensité
 *
 * Ce n'est pas un dictionnaire de regex par vêtement : la zone vient de la
 * famille, jamais du texte. Le vocabulaire de silhouette est fermé et
 * s'applique à l'intérieur du contexte donné par la famille — un « large »
 * lu sur un pantalon et sur un pull ne produit pas le même effet.
 *
 * Règle absolue : une donnée absente reste NEUTRE. Une pièce sans coupe et
 * sans terme reconnu renvoie 0 partout avec une confiance « inconnue », et
 * ne doit jamais être traitée comme mauvaise.
 */

export type Intensite = 0 | 1 | 2 | 3;
export type Confiance = "haute" | "moyenne" | "faible" | "inconnue";

export interface EffetMorphologique {
  /** false pour les pièces qui ne modifient pas la silhouette (bonnet, sac, bijou). */
  pertinent: boolean;
  epaules: Intensite;
  taille: Intensite;
  hanches: Intensite;
  confiance: Confiance;
  motif: string;
}

const NEUTRE: EffetMorphologique = {
  pertinent: true, epaules: 0, taille: 0, hanches: 0,
  confiance: "inconnue", motif: "aucune coupe ni terme de silhouette exploitable",
};

/** Zone qu'une famille de vêtement peut toucher. `transverse` = robe/combinaison, qui traverse les trois. */
type Zone = "haut" | "bas" | "transverse" | "aucune";

const ZONE_PAR_FAMILLE: Record<CategoryKey, Zone> = {
  haut: "haut",
  pull: "haut",
  veste: "haut",
  manteau: "haut",
  pantalon: "bas",
  jean: "bas",
  short: "bas",
  jupe: "bas",
  robe: "transverse",
  combinaison: "transverse",
  // Ne modifient pas la silhouette : exclues du calcul, jamais comptées comme
  // manquantes. La ceinture est un signal de TAILLE, mais au niveau du look
  // (cf. effetCeinture), jamais une propriété morphologique de l'article.
  chaussures: "aucune",
  sac: "aucune",
  bijou: "aucune",
  accessoire: "aucune",
};

/**
 * Vocabulaire fermé des termes de silhouette, relevé sur le catalogue réel
 * (audit du vocabulaire de sous_type, 28/08/2026). Chaque terme dit une
 * INTENSITÉ, jamais une zone — la zone reste donnée par la famille.
 */
const VOLUME_PAR_TERME: { termes: string[]; intensite: Intensite }[] = [
  { termes: ["oversize", "palazzo", "baggy", "wide", "large", "ample", "loose"], intensite: 3 },
  { termes: ["cargo", "trapèze", "évasé", "évasée", "flare", "relaxed", "ballon", "bouffant"], intensite: 2 },
  { termes: ["droit", "droite", "regular"], intensite: 1 },
  { termes: ["cigarette", "fuselé", "fuselée", "slim", "skinny", "crayon", "moulant"], intensite: 0 },
];

/** Termes qui marquent la taille. Portés par le vêtement lui-même, pas par un accessoire. */
const TAILLE_PAR_TERME: { termes: string[]; intensite: Intensite }[] = [
  { termes: ["ceinturé", "ceinturée", "portefeuille", "cache-cœur", "corset", "bustier"], intensite: 3 },
  { termes: ["cintré", "cintrée", "fourreau", "ajusté", "ajustée"], intensite: 2 },
];

/** Termes qui structurent le haut, indépendamment de l'ampleur. */
const EPAULES_PAR_TERME: string[] = ["structuré", "structurée", "épaules", "épaulettes", "saharienne", "varsity", "bomber"];

function normaliser(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function contient(texte: string, termes: string[]): string | null {
  const t = normaliser(texte);
  for (const terme of termes) {
    if (t.includes(normaliser(terme))) return terme;
  }
  return null;
}

const borne = (n: number): Intensite => Math.max(0, Math.min(3, Math.round(n))) as Intensite;

/**
 * Effet d'une pièce. `sousType` est passé à part parce que Item ne porte pas
 * toujours le sous_type brut du catalogue selon la provenance de la pièce.
 */
export function effetMorphologique(it: Item, sousType: string | null | undefined): EffetMorphologique {
  const zone = ZONE_PAR_FAMILLE[it.cat];
  if (zone === "aucune") {
    return { ...NEUTRE, pertinent: false, confiance: "haute", motif: `catégorie ${it.cat} : ne modifie pas la silhouette` };
  }

  const texte = `${sousType || ""} ${it.name || ""}`;
  const coupe = coupeOf(it);
  const coupeExplicite = Boolean(it.coupe);

  // 1. Intensité de volume. La colonne prime ; à défaut, le vocabulaire fermé.
  let volume: Intensite | null = null;
  let source = "";
  if (coupeExplicite) {
    volume = coupe === "oversize" ? 3 : coupe === "ajusté" ? 0 : 1;
    source = `coupe « ${it.coupe} »`;
  } else {
    for (const { termes, intensite } of VOLUME_PAR_TERME) {
      const trouve = contient(texte, termes);
      if (trouve) { volume = intensite; source = `terme « ${trouve} »`; break; }
    }
  }

  // 2. Taille : terme porté par le vêtement.
  let taille: Intensite = 0;
  let sourceTaille = "";
  for (const { termes, intensite } of TAILLE_PAR_TERME) {
    const trouve = contient(texte, termes);
    if (trouve) { taille = intensite; sourceTaille = `terme « ${trouve} »`; break; }
  }

  // 3. Structure d'épaules : renforce le haut sans dépendre de l'ampleur.
  const structure = contient(texte, EPAULES_PAR_TERME);

  if (volume === null && taille === 0 && !structure) return NEUTRE;

  const v = volume ?? 0;
  let epaules: Intensite = 0;
  let hanches: Intensite = 0;

  if (zone === "haut") epaules = borne(v + (structure ? 1 : 0));
  else if (zone === "bas") hanches = v;
  else {
    // Robe et combinaison traversent les trois zones : l'ampleur s'y répartit
    // au lieu de se concentrer, d'où une intensité réduite sur chacune.
    epaules = borne(v / 2 + (structure ? 1 : 0));
    hanches = borne(v / 2);
  }

  const motifs = [
    volume !== null ? `volume ${v} depuis ${source}` : null,
    taille > 0 ? `taille ${taille} depuis ${sourceTaille}` : null,
    structure ? `épaules renforcées par « ${structure} »` : null,
  ].filter(Boolean);

  return {
    pertinent: true,
    epaules, taille, hanches,
    confiance: coupeExplicite ? "haute" : volume !== null || taille > 0 ? "moyenne" : "faible",
    motif: motifs.join(" · "),
  };
}

/**
 * Signature d'un look — somme bornée des effets de ses pièces, plus le signal
 * de ceinture. Celui-ci vit au niveau du look et jamais sur l'article : une
 * ceinture ne « définit une taille » que portée avec autre chose. Et son
 * absence ne signifie pas une taille indéfinie — une pièce cintrée la définit
 * déjà, ce que capte TAILLE_PAR_TERME.
 */
export function signatureLook(
  pieces: { item: Item; sousType: string | null | undefined }[]
): { epaules: Intensite; taille: Intensite; hanches: Intensite; piecesEvaluees: number } {
  let epaules = 0, taille = 0, hanches = 0, piecesEvaluees = 0;
  for (const { item, sousType } of pieces) {
    const e = effetMorphologique(item, sousType);
    if (!e.pertinent) continue;
    if (e.confiance !== "inconnue") piecesEvaluees += 1;
    epaules += e.epaules;
    taille += e.taille;
    hanches += e.hanches;
  }
  // Une ceinture marque la taille du look. Une robe ceinturée cumule donc le
  // terme porté par la robe et le signal de l'accessoire, ce qui est voulu.
  if (pieces.some(({ item }) => item.cat === "accessoire" && item.accessoireType === "Ceinture")) {
    taille += 2;
  }
  return { epaules: borne(epaules), taille: borne(taille), hanches: borne(hanches), piecesEvaluees };
}
