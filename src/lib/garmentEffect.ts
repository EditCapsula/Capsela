import type { CategoryKey, Item } from "./types";
import { coupeOf } from "./attributes";

/**
 * Effet morphologique d'une pièce — phase 2A (chantier du 28/08/2026).
 *
 * On ne cherche PAS à décrire la coupe d'un vêtement, mais l'EFFET VISUEL
 * qu'il produit sur la silhouette. La distinction est le cœur du modèle :
 * une même ampleur ne produit pas le même effet selon la famille du
 * vêtement. Un pantalon large épaissit le bas, un pull oversize épaissit le
 * haut — la coupe seule ne le dit pas, la famille seule non plus.
 *
 *   FAMILLE   → quelle zone la pièce peut toucher
 *   TYPE      → effet direct, pour les seuls types stylistiquement univoques
 *   COUPE     → intensité, quand la colonne est renseignée
 *   SOUS_TYPE → terme de silhouette qui précise l'intensité
 *   LONGUEUR  → où la pièce s'arrête, qui change les proportions
 *
 * Changement conceptuel du 28/08/2026 : un type univoque produit un EFFET,
 * jamais une coupe. « wide leg » ne devient pas `coupe = 'Ample'`, il devient
 * « effet bas marqué ». La colonne `coupe` reste l'affaire du moteur existant.
 *
 * Ce n'est pas un dictionnaire de regex par vêtement : la zone vient de la
 * famille, jamais du texte, et chaque terme de type déclare les familles où
 * il a un sens. « cargo » lu sur un sac ne produit donc rien.
 *
 * Règle absolue : une donnée absente reste NEUTRE. Une pièce sans rien de
 * reconnaissable renvoie 0 partout avec une confiance « inconnue », et ne
 * doit jamais être traitée comme mauvaise.
 */

export type Intensite = 0 | 1 | 2 | 3;
export type Confiance = "haute" | "moyenne" | "faible" | "inconnue";
/** Où la pièce s'arrête. Deux pièces de même effet horizontal ne changent pas les proportions de la même façon. */
export type Longueur = "courte" | "standard" | "longue";

export interface EffetMorphologique {
  /** false pour les pièces qui ne modifient pas la silhouette (bonnet, sac, bijou). */
  pertinent: boolean;
  epaules: Intensite;
  taille: Intensite;
  hanches: Intensite;
  /** null = inconnue. Jamais « standard » par défaut : ce serait une donnée inventée. */
  longueur: Longueur | null;
  confiance: Confiance;
  motif: string;
}

const NEUTRE: EffetMorphologique = {
  pertinent: true, epaules: 0, taille: 0, hanches: 0, longueur: null,
  confiance: "inconnue", motif: "aucun type, coupe ni terme de silhouette exploitable",
};

/** Zone qu'une famille de vêtement peut toucher. `transverse` = robe/combinaison, qui traverse les trois. */
export type Zone = "haut" | "bas" | "transverse" | "aucune";

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
  // Ne structurent pas réellement la silhouette : exclues du calcul, jamais
  // comptées comme manquantes. La ceinture est un signal de TAILLE, mais au
  // niveau du look (cf. signatureLook), jamais une propriété de l'article.
  chaussures: "aucune",
  sac: "aucune",
  bijou: "aucune",
  accessoire: "aucune",
};

/**
 * Types stylistiquement UNIVOQUES — ceux dont la construction du vêtement
 * impose l'effet, indépendamment de la marque ou de la saison. Chaque entrée
 * déclare les familles où le terme a un sens : la zone reste donnée par la
 * famille, le type ne fait qu'en fixer l'intensité.
 *
 * Ce qui n'est PAS ici est délibéré. « polo », « chemise », « blouse »,
 * « pull », « cardigan », « t-shirt », « chino », « bermuda », « jupe midi »,
 * « robe » et « manteau » ne disent rien de fiable sur le volume : un pull
 * peut être près du corps ou oversize, un chino droit ou fuselé. Les coder
 * reviendrait à inventer de la donnée.
 */
interface TypeUnivoque {
  termes: string[];
  /** Familles où le terme a un sens. Ailleurs il est ignoré. */
  zones: Zone[];
  volume?: Intensite;
  taille?: Intensite;
  raison: string;
}

const TYPES_UNIVOQUES: TypeUnivoque[] = [
  { termes: ["body"], zones: ["haut"], volume: 0, taille: 1,
    raison: "un body épouse le buste par construction et laisse voir la taille" },
  { termes: ["caraco"], zones: ["haut"], volume: 0,
    raison: "un caraco est une pièce étroite à fines bretelles" },
  { termes: ["surchemise"], zones: ["haut"], volume: 2,
    raison: "une surchemise se porte par-dessus, donc taillée plus large qu'une chemise" },
  { termes: ["legging"], zones: ["bas"], volume: 0,
    raison: "un legging est près du corps par définition" },
  { termes: ["wide leg", "palazzo"], zones: ["bas"], volume: 3,
    raison: "jambe large sur toute la longueur" },
  { termes: ["cargo"], zones: ["bas"], volume: 2,
    raison: "les poches plaquées ajoutent du volume à la hauteur des hanches" },
  { termes: ["crayon"], zones: ["bas"], volume: 0, taille: 1,
    raison: "une jupe crayon suit la ligne des hanches" },
  // Distinction que seule la famille permet : un évasement partant de la
  // taille (jupe, robe) ajoute du volume sur les hanches ; un évasement
  // partant du genou (bootcut, flare sur un pantalon) laisse la hanche
  // ajustée. Le même mot, deux effets opposés — d'où deux entrées.
  { termes: ["trapèze", "évasé", "évasée", "ligne a"], zones: ["bas", "transverse"], volume: 2, taille: 1,
    raison: "volume qui s'ouvre depuis la taille, donc porté par les hanches" },
  { termes: ["flare", "bootcut", "patte d'éléphant"], zones: ["bas"], volume: 1,
    raison: "ajusté sur la hanche, l'évasement ne commence qu'au genou" },
  { termes: ["fourreau"], zones: ["transverse"], volume: 0, taille: 2,
    raison: "un fourreau suit le corps et marque la taille" },
  { termes: ["portefeuille", "cache-cœur"], zones: ["haut", "transverse"], volume: 0, taille: 3,
    raison: "le croisement noue la taille" },
];

/**
 * Vocabulaire fermé des termes de silhouette, relevé sur le catalogue réel.
 * Chaque terme dit une INTENSITÉ, jamais une zone — la zone reste donnée par
 * la famille. Consulté seulement si aucun type univoque n'a répondu.
 */
const VOLUME_PAR_TERME: { termes: string[]; intensite: Intensite }[] = [
  { termes: ["oversize", "baggy", "wide", "large", "ample", "loose"], intensite: 3 },
  { termes: ["relaxed", "ballon", "bouffant", "plissé", "plissée"], intensite: 2 },
  { termes: ["droit", "droite", "regular", "fluide", "pinces"], intensite: 1 },
  { termes: ["cigarette", "fuselé", "fuselée", "slim", "skinny", "moulant"], intensite: 0 },
];

/** Termes qui marquent la taille. Portés par le vêtement lui-même, pas par un accessoire. */
const TAILLE_PAR_TERME: { termes: string[]; intensite: Intensite }[] = [
  { termes: ["ceinturé", "ceinturée", "corset", "bustier"], intensite: 3 },
  { termes: ["cintré", "cintrée", "ajusté", "ajustée"], intensite: 2 },
  { termes: ["pinces"], intensite: 1 },
];

/** Termes qui structurent le haut, indépendamment de l'ampleur. */
const EPAULES_PAR_TERME: string[] = ["structuré", "structurée", "épaulettes", "saharienne", "varsity", "bomber"];

const LONGUEUR_PAR_TERME: { termes: string[]; valeur: Longueur }[] = [
  { termes: ["crop", "cropped", "court", "courte", "mini", "ras"], valeur: "courte" },
  { termes: ["midi", "maxi", "long", "longue", "longues", "genou", "cheville"], valeur: "longue" },
];

/**
 * Un terme de longueur précédé de « manches », « col » ou « épaules » qualifie
 * un élément du vêtement, pas le vêtement. « Chemise manches longues » n'est
 * pas une chemise longue. `manches` est le mot le plus fréquent des sous-types
 * du catalogue (25 pièces parmi les non évaluées) : le cas n'a rien de marginal.
 */
const PORTEURS_DE_LONGUEUR = new Set(["manche", "manches", "col", "cols", "epaule", "epaules"]);

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

/** Longueur du vêtement, en ignorant les longueurs de manche et de col. */
function longueurDe(texte: string): { valeur: Longueur; terme: string } | null {
  const mots = normaliser(texte).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < mots.length; i++) {
    if (PORTEURS_DE_LONGUEUR.has(mots[i - 1] ?? "")) continue;
    for (const { termes, valeur } of LONGUEUR_PAR_TERME) {
      if (termes.some((t) => normaliser(t) === mots[i])) return { valeur, terme: mots[i] };
    }
  }
  return null;
}

/**
 * Effet d'une pièce. `sousType` peut être passé explicitement quand l'appelant
 * dispose du sous-type brut du catalogue ; sinon on lit `it.subtype`, que
 * `rowToCatalogItem` renseigne depuis la colonne `sous_type`.
 */
export function effetMorphologique(it: Item, sousType?: string | null): EffetMorphologique {
  const zone = ZONE_PAR_FAMILLE[it.cat];
  if (zone === "aucune") {
    return { ...NEUTRE, pertinent: false, confiance: "haute", motif: `catégorie ${it.cat} : ne structure pas la silhouette` };
  }

  const texte = `${sousType ?? it.subtype ?? ""} ${it.name || ""}`;
  const coupeExplicite = Boolean(it.coupe);

  let volume: Intensite | null = null;
  let taille: Intensite = 0;
  let source = "";
  let sourceTaille = "";

  // 1. Type univoque — la construction du vêtement impose l'effet.
  //    Seules les familles déclarées sont concernées : « cargo » sur un sac
  //    ne produit rien.
  let typeTrouve: TypeUnivoque | null = null;
  for (const t of TYPES_UNIVOQUES) {
    if (!t.zones.includes(zone)) continue;
    const trouve = contient(texte, t.termes);
    if (!trouve) continue;
    typeTrouve = t;
    if (t.volume !== undefined) { volume = t.volume; source = `type « ${trouve} » (${t.raison})`; }
    if (t.taille !== undefined) { taille = t.taille; sourceTaille = `type « ${trouve} »`; }
    break;
  }

  // 2. Colonne coupe — fait structuré, prioritaire sur le texte libre.
  if (coupeExplicite) {
    const c = coupeOf(it);
    volume = c === "oversize" ? 3 : c === "ajusté" ? 0 : 1;
    source = `coupe « ${it.coupe} »`;
  }

  // 3. Vocabulaire fermé, seulement si rien de plus sûr n'a répondu.
  if (volume === null) {
    for (const { termes, intensite } of VOLUME_PAR_TERME) {
      const trouve = contient(texte, termes);
      if (trouve) { volume = intensite; source = `terme « ${trouve} »`; break; }
    }
  }
  if (taille === 0) {
    for (const { termes, intensite } of TAILLE_PAR_TERME) {
      const trouve = contient(texte, termes);
      if (trouve) { taille = intensite; sourceTaille = `terme « ${trouve} »`; break; }
    }
  }

  const structure = zone !== "bas" ? contient(texte, EPAULES_PAR_TERME) : null;
  const lng = longueurDe(texte);

  if (volume === null && taille === 0 && !structure && !lng) return NEUTRE;

  const v = volume ?? 0;
  let epaules: Intensite = 0;
  let hanches: Intensite = 0;

  if (zone === "haut") epaules = borne(v + (structure ? 1 : 0));
  else if (zone === "bas") hanches = v;
  else {
    // Robe et combinaison traversent les trois zones : l'ampleur s'y répartit
    // au lieu de s'y concentrer, d'où une intensité réduite sur chacune.
    epaules = borne(v / 2 + (structure ? 1 : 0));
    hanches = borne(v / 2);
  }

  const motifs = [
    volume !== null ? `volume ${v} depuis ${source}` : null,
    taille > 0 ? `taille ${taille} depuis ${sourceTaille}` : null,
    structure ? `épaules renforcées par « ${structure} »` : null,
    lng ? `longueur ${lng.valeur} depuis « ${lng.terme} »` : null,
  ].filter(Boolean);

  // La confiance décrit la SOURCE du volume, pas la richesse du motif : une
  // pièce dont on ne connaît que la longueur n'est pas évaluable en volume.
  const confiance: Confiance =
    coupeExplicite || typeTrouve ? "haute"
    : volume !== null || taille > 0 ? "moyenne"
    : "faible";

  return { pertinent: true, epaules, taille, hanches, longueur: lng?.valeur ?? null, confiance, motif: motifs.join(" · ") };
}

// ─────────────────────────────────────────────────────────────────────────────
// Niveau LOOK
// ─────────────────────────────────────────────────────────────────────────────

export type ClasseLook = "MORPHOLOGY_READY" | "MORPHOLOGY_PARTIAL" | "MORPHOLOGY_UNKNOWN";

export interface SignatureLook {
  epaules: Intensite;
  taille: Intensite;
  hanches: Intensite;
  longueur: Longueur | null;
  /** true si au moins une pièce couvrant cette moitié du corps a pu être évaluée. */
  hautConnu: boolean;
  basConnu: boolean;
  /** La taille n'est « connue » que si une pièce la marque explicitement, ou si le look porte une ceinture. */
  tailleConnue: boolean;
  piecesEvaluees: number;
  piecesPertinentes: number;
  classe: ClasseLook;
}

/**
 * Signature d'un look — somme bornée des effets de ses pièces, plus le signal
 * de ceinture. Celui-ci vit au niveau du look et jamais sur l'article : une
 * ceinture ne « définit une taille » que portée avec autre chose. Et son
 * absence ne signifie pas une taille indéfinie — une pièce cintrée la définit
 * déjà, ce que capte TAILLE_PAR_TERME.
 *
 * Le classement repose sur une propriété du problème, pas sur un seuil choisi :
 * toutes les cibles morphologiques portent sur une RELATION entre le haut et le
 * bas de la silhouette. Connaître une seule moitié ne permet donc jamais de
 * dire si un ensemble équilibre quoi que ce soit — d'où READY = les deux
 * moitiés évaluées, PARTIAL = une seule, UNKNOWN = aucune.
 */
export function signatureLook(pieces: Item[]): SignatureLook {
  let epaules = 0, taille = 0, hanches = 0;
  let piecesEvaluees = 0, piecesPertinentes = 0;
  let hautConnu = false, basConnu = false, tailleConnue = false;
  let longueur: Longueur | null = null;

  for (const item of pieces) {
    const e = effetMorphologique(item);
    if (!e.pertinent) continue;
    piecesPertinentes += 1;
    const zone = ZONE_PAR_FAMILLE[item.cat];
    // Une zone est « connue » si on a su lui attribuer un chiffre : soit une
    // source de volume a été identifiée (l'intensité 0 d'un skinny est une
    // information, pas une absence), soit la pièce charge effectivement la
    // zone — cas d'un blazer dont seule la structure d'épaules est lisible.
    const sourceIdentifiee = e.confiance === "haute" || e.confiance === "moyenne";
    const evaluee = sourceIdentifiee || e.epaules > 0 || e.hanches > 0;
    if (evaluee) {
      piecesEvaluees += 1;
      if (zone === "haut" || zone === "transverse") hautConnu = true;
      if (zone === "bas" || zone === "transverse") basConnu = true;
    }
    if (e.taille > 0) tailleConnue = true;
    epaules += e.epaules;
    taille += e.taille;
    hanches += e.hanches;
    // La longueur retenue est celle de la pièce la plus basse renseignée : un
    // manteau long change les proportions même sur un pantalon court.
    if (e.longueur) longueur = e.longueur === "longue" ? "longue" : longueur ?? e.longueur;
  }

  // Une ceinture marque la taille du look. Une robe ceinturée cumule donc le
  // terme porté par la robe et le signal de l'accessoire, ce qui est voulu.
  if (pieces.some((it) => it.cat === "accessoire" && it.accessoireType === "Ceinture")) {
    taille += 2;
    tailleConnue = true;
  }

  const classe: ClasseLook =
    hautConnu && basConnu ? "MORPHOLOGY_READY"
    : hautConnu || basConnu ? "MORPHOLOGY_PARTIAL"
    : "MORPHOLOGY_UNKNOWN";

  return {
    epaules: borne(epaules), taille: borne(taille), hanches: borne(hanches),
    longueur, hautConnu, basConnu, tailleConnue, piecesEvaluees, piecesPertinentes, classe,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Score morphologique v2 — SHADOW MODE. Jamais branché sur le ranking.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direction visuelle induite par les VÊTEMENTS d'un look, pour une morphologie.
 *
 * Vocabulaire choisi avec soin (arbitrage du 28/08/2026) : le moteur ne mesure
 * pas si une silhouette est rééquilibrée — il ne connaît pas le corps, seulement
 * l'effet des vêtements. Il mesure donc une DIRECTION DE COMPENSATION, pas un
 * résultat. Dire « cette tenue rééquilibre » serait une prétention que le modèle
 * ne peut pas justifier.
 *
 * Trois états, pas deux : une tenue qui ne compense pas n'est pas mauvaise, elle
 * est neutre. Une poire peut porter une tenue 2/2 parfaitement élégante ; le
 * moteur n'a pas à la déprécier au motif qu'elle ne cherche pas à corriger quoi
 * que ce soit.
 */
export type Direction = "compensation_forte" | "compensation" | "neutre" | "defavorable" | "defavorable_fort";

const DELTA_PAR_DIRECTION: Record<Direction, number> = {
  compensation_forte: 10,
  compensation: 5,
  neutre: 0,
  defavorable: -5,
  defavorable_fort: -10,
};

/**
 * Échelle de direction pour les morphologies dont l'enjeu est un DIFFÉRENTIEL
 * entre le haut et le bas (poire, triangle inversé).
 *
 * Un écart nul ne compense rien : la tenue ajoute autant des deux côtés et
 * laisse donc le rapport inchangé. Mesuré sur 4 525 looks, 41,8 % des tenues
 * sont à écart nul — une règle « épaules ≥ hanches » les traitait toutes comme
 * favorables, ce qui était faux.
 *
 * Aucun seuil ici ne prétend qu'un écart donné SUFFIT à rééquilibrer une
 * silhouette. L'échelle ordonne des directions, elle ne certifie pas un résultat.
 */
function directionParEcart(ecart: number): Direction {
  if (ecart <= -2) return "defavorable_fort";
  if (ecart === -1) return "defavorable";
  if (ecart === 0) return "neutre";
  if (ecart === 1) return "compensation";
  return "compensation_forte";
}

/** Zones dont la connaissance conditionne un avis honnête, par morphologie. */
export const ZONES_REQUISES: Record<string, ("epaules" | "taille" | "hanches")[]> = {
  f_poire: ["epaules", "hanches"],
  f_triangle_inverse: ["epaules", "hanches"],
  // Garde-fou de volume : la taille n'entre pas dans l'alerte.
  f_sablier: ["epaules", "hanches"],
  f_rectangle: ["epaules", "taille", "hanches"],
  f_pomme: [],
};

export const zonesRequises = (morphology: string): ("epaules" | "taille" | "hanches")[] =>
  ZONES_REQUISES[morphology] ?? [];

/**
 * Robustesse de l'évidence d'un look. Distincte de la direction : un look peut
 * pointer nettement dans un sens sur la foi d'une seule pièce.
 *
 * HIGH exige au moins DEUX pièces évaluées — une robe seule marque « haut » et
 * « bas » à elle seule, mais l'avis ne repose alors que sur un article.
 */
export type NiveauConfiance = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export function niveauConfiance(pieces: Item[], signature?: SignatureLook): NiveauConfiance {
  const sig = signature ?? signatureLook(pieces);
  const part = sig.piecesPertinentes ? sig.piecesEvaluees / sig.piecesPertinentes : 0;
  if (sig.classe === "MORPHOLOGY_READY" && sig.piecesEvaluees >= 2 && part >= 0.75) return "HIGH";
  if (sig.classe === "MORPHOLOGY_READY") return "MEDIUM";
  if (sig.classe === "MORPHOLOGY_PARTIAL") return "LOW";
  return "UNKNOWN";
}

/**
 * Un conseil n'est affichable que si l'évidence est robuste ET la direction
 * positive. Une direction défavorable reste utile au classement mais n'est
 * JAMAIS montrée : elle dirait à une femme qu'un vêtement lui va mal.
 */
export function conseilAffichable(pieces: Item[], morphology: string | null): boolean {
  const sig = signatureLook(pieces);
  const niveau = niveauConfiance(pieces, sig);
  if (niveau !== "HIGH" && niveau !== "MEDIUM") return false;
  return scoreMorphoV2(pieces, morphology, sig).delta > 0;
}

export interface ScoreMorpho {
  /** false = aucune affirmation morphologique. Le score reste strictement neutre. */
  actif: boolean;
  /** Direction induite par les vêtements — jamais un jugement sur la tenue. */
  direction: Direction;
  delta: number;
  /** Différentiel mesuré, quand la morphologie en dépend. */
  ecart: number | null;
  motif: string;
}

const INACTIF = (motif: string): ScoreMorpho => ({ actif: false, direction: "neutre", delta: 0, ecart: null, motif });

/**
 * Écart entre la silhouette produite par le look et la cible de la
 * morphologie. Aucune règle par paire de pièces : la compensation émerge de
 * la somme des effets (un cargo qui charge les hanches et un blazer structuré
 * qui charge les épaules se rapprochent ensemble d'une cible équilibrée).
 *
 * Amplitudes alignées sur R-S9 legacy (+10 / −5) pour que la comparaison des
 * deux scores mesure la RÈGLE et non un changement d'échelle.
 */
export function scoreMorphoV2(pieces: Item[], morphology: string | null, signature?: SignatureLook): ScoreMorpho {
  if (!morphology) return INACTIF("aucune morphologie déclarée");
  const zones = zonesRequises(morphology);
  if (!ZONES_REQUISES[morphology]) return INACTIF(`morphologie « ${morphology} » inconnue du modèle`);
  if (!zones.length) return INACTIF(`${morphology} : aucune règle défendable sur les axes disponibles`);

  const sig = signature ?? signatureLook(pieces);
  if (sig.classe !== "MORPHOLOGY_READY") return INACTIF(`look ${sig.classe} : moitié de silhouette inconnue`);
  if (zones.includes("taille") && !sig.tailleConnue) {
    return INACTIF(`${morphology} dépend de la taille, non renseignée par ce look`);
  }

  const rendre = (direction: Direction, ecart: number | null, motif: string): ScoreMorpho =>
    ({ actif: true, direction, delta: DELTA_PAR_DIRECTION[direction], ecart, motif });

  // Poire et triangle inversé : l'enjeu est le DIFFÉRENTIEL haut/bas.
  if (morphology === "f_poire" || morphology === "f_triangle_inverse") {
    const ecart = morphology === "f_poire" ? sig.epaules - sig.hanches : sig.hanches - sig.epaules;
    const dir = directionParEcart(ecart);
    return rendre(dir, ecart, `écart ${ecart >= 0 ? "+" : ""}${ecart} (épaules ${sig.epaules} · hanches ${sig.hanches})`);
  }

  // Rectangle : créer de la définition. La taille doit être la zone la plus
  // marquée ET l'être suffisamment — une taille à 1 ne dessine rien.
  if (morphology === "f_rectangle") {
    const volume = Math.max(sig.epaules, sig.hanches);
    if (sig.taille >= 2 && sig.taille > volume) {
      return rendre("compensation_forte", sig.taille - volume, `taille ${sig.taille} au-dessus du volume ${volume}`);
    }
    if (volume - sig.taille >= 2) {
      return rendre("defavorable", sig.taille - volume, `volume ${volume} domine largement la taille ${sig.taille}`);
    }
    return rendre("neutre", sig.taille - volume, `taille ${sig.taille}, volume ${volume} : pas de définition marquée`);
  }

  // Sablier : GARDE-FOU PUR (arbitrage du 28/08/2026). Neutre par défaut, jamais
  // de bonus. Il ne dit pas « cette tenue est particulièrement adaptée » — il dit
  // seulement « cette combinaison accumule un volume extrême des deux côtés ».
  //
  // Le bonus précédent tombait sur 65,2 % des looks : un signal distribué deux
  // fois sur trois n'informe pas, et laissait croire à un classement là où il n'y
  // a qu'une alerte. Sa valeur se juge à la PRÉCISION de ses alertes, jamais à
  // leur fréquence.
  //
  // Il ne consulte pas la taille : l'alerte porte sur le volume qui l'encadre,
  // pas sur sa définition. Exiger une taille connue l'aurait rendu muet sur les
  // looks où elle ne l'est pas, sans rien apporter — cf. ZONES_REQUISES.
  if (morphology === "f_sablier") {
    if (sig.epaules >= 3 && sig.hanches >= 3) {
      return rendre("defavorable", null, `volume maximal des deux côtés (${sig.epaules}/${sig.hanches}) : la taille disparaît`);
    }
    return rendre("neutre", null, `volume ${sig.epaules}/${sig.hanches} : rien à signaler`);
  }

  return INACTIF(`${morphology} : aucune règle`);
}
