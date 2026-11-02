import { isStatement } from "./attributes";
import { contexteCapsule, estDeSaison, occasionsOf, pieceOrienteeParMorphologie, styleFit } from "./capsule";
import { OCCASIONS } from "./data";
import { paletteHexes, silhouetteForme, STYLE_ID_TO_CATALOG_LABEL, styleLabel, type Profile, type StyleId } from "./profile";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "./types";

/*
 * DÉRIVÉS D'AFFICHAGE DE L'ÉCRAN CAPSULE (refonte éditoriale, 25/09/2026).
 *
 * Rien ici ne choisit une pièce de la capsule : c'est `computeDefaultCapsule`
 * qui le fait, et il n'est pas touché. Ces fonctions lisent ce qu'il a rendu
 * et les données de chaque pièce pour décider QUOI MONTRER — quelles pièces
 * mettre en avant, quelles raisons afficher, quelles alternatives proposer —
 * sans jamais écrire une justification que le système n'a pas calculée.
 * Pures, donc testées (etatDePort.test.ts en est le modèle).
 */

/**
 * Pièces du dressing montrées dans la capsule d'une saison.
 *
 * ARBITRAGE ÉDITORIAL (25/09/2026). La capsule ne contenait jusqu'ici que des
 * suggestions : « Dans ton dressing » ne pouvait donc jamais s'afficher. Une
 * pièce réelle y entre si sa saison est celle de la capsule — même règle que
 * le filtre saisonnier du moteur (`capsuleSeasonBucket`, « Toutes saisons »
 * compris) — et rien d'autre : ni style ni palette, puisqu'elle t'appartient
 * déjà. Elle ne prend la place d'aucune suggestion.
 */
export function piecesDuDressingPourSaison(items: Item[], saison: CapsuleSeason): Item[] {
  // Quatre saisons d'une pièce quand elle les porte (27/09/2026) : une pièce
  // cochée Été seul n'entre plus dans la capsule de Printemps.
  const contexte = contexteCapsule(saison);
  return items.filter((it) => estDeSaison(it, contexte));
}

/**
 * Poids visuel d'une vignette, par famille (polish Capsule V2, 26/09/2026).
 *
 * La vignette agrandit déjà chaque pièce jusqu'à ce que le rectangle qu'elle
 * occupe remplisse la zone utile du cadre (cadrageImage.ts) : le vide très
 * variable que laissent les images du catalogue ne compte plus. Mais avec une
 * seule marge pour tous, une paire de boucles d'oreilles remplissait son cadre
 * autant qu'un manteau, et une paire de chaussures, posée à plat, en occupait
 * toute la largeur. La marge dépend donc de la famille : homogène entre deux
 * vêtements, entre deux chaussures, entre deux sacs — et un bijou reste plus
 * petit qu'un manteau, comme sur une page de magazine.
 *
 * ARBITRAGE ÉDITORIAL : les valeurs sont réglées à l'œil, sur des images de
 * banc aux marges internes volontairement inégales. Vide conservé de chaque
 * côté, en fraction du cadre.
 */
export type FamilleVisuelle = "vetement" | "chaussures" | "sac" | "bijou" | "accessoire";

export function familleVisuelle(cat: CategoryKey): FamilleVisuelle {
  if (cat === "chaussures" || cat === "sac" || cat === "bijou" || cat === "accessoire") return cat;
  return "vetement";
}

const MARGE_FAMILLE: Record<FamilleVisuelle, number> = {
  vetement: 0.08,
  chaussures: 0.15,
  sac: 0.13,
  bijou: 0.24,
  accessoire: 0.18,
};

export function margeVignette(cat: CategoryKey): number {
  return MARGE_FAMILLE[familleVisuelle(cat)];
}

/**
 * Familles des « pièces clés », dans l'ordre d'affichage : ce qu'on met
 * par-dessus, la maille ou le haut qui s'y glisse, la chaussure du quotidien.
 */
const FAMILLES_CLES: CategoryKey[][] = [
  ["manteau", "veste"],
  ["pull", "haut"],
  ["chaussures"],
  ["pantalon", "jean", "jupe", "robe"],
];

/**
 * Une pièce est-elle PROPRE à la saison de la capsule — et pas seulement
 * compatible avec elle ? (01/10/2026, demandé : « les pièces clés doivent être
 * cohérentes avec la saison »). Un t-shirt « toutes saisons » est de saison
 * partout, donc en hiver aussi, et c'est ce qui le faisait sortir parmi les
 * trois pièces clés d'une capsule d'hiver.
 *
 * Trois lectures, de la plus précise à la moins : les saisons cochées d'une
 * pièce réelle (sans les quatre) ; la saison déclarée d'une pièce du catalogue,
 * quand ce n'est pas « Toutes saisons » ; ses saisons de capsule
 * (saison_capsule), quand elles n'en couvrent pas quatre. Aucune lecture d'un
 * nom : une pièce sans aucune de ces données est neutre, ni propre ni
 * contraire à la saison.
 */
export function proprePourSaison(it: Item, saison: CapsuleSeason): boolean {
  const ctx = contexteCapsule(saison);
  if (it.saisons?.length) return it.saisons.length < 4 && it.saisons.includes(saison);
  if (it.season !== "Toutes saisons") return estDeSaison(it, ctx);
  return Boolean(it.capsuleSeasons?.length && it.capsuleSeasons.length < 4 && it.capsuleSeasons.includes(saison));
}

/** Une pièce d'intérieur : chaussures d'intérieur, ou pièce déclarée pour le seul Cocooning. Jamais une pièce clé (01/11/2026). */
export function estPieceDInterieur(it: Item): boolean {
  if (it.shoeType === "Chaussures d'intérieur") return true;
  const occ = occasionsOf(it);
  return occ.length === 1 && occ[0] === "cocooning";
}

/** Nombre de saisons que la pièce déclare (mêmes lectures que proprePourSaison) ; 4 sans donnée. Moins = plus typique de sa saison. */
function nombreDeSaisons(it: Item): number {
  if (it.saisons?.length) return it.saisons.length;
  if (it.capsuleSeasons?.length) return it.capsuleSeasons.length;
  if (it.season && it.season !== "Toutes saisons") return 2;
  return 4;
}

/**
 * Jusqu'à 3 pièces clés, choisies PARMI les suggestions de la capsule. Une pièce par famille (FAMILLES_CLES) ; la 4ᵉ famille ne sert
 * que si l'une des trois premières est vide.
 *
 * Avec la saison de la capsule — RÈGLES VALIDÉES PAR LA PROPRIÉTAIRE LE 01/11/2026 (signalé : des chaussures d'intérieur et une
 * maille ajourée parmi les pièces clés d'une capsule d'automne) :
 *   1. jamais une pièce d'intérieur (estPieceDInterieur) ;
 *   2. les pièces les plus TYPIQUES de la saison d'abord : propres à la saison (proprePourSaison), puis celles qui déclarent le
 *      moins de saisons ; en Automne et Hiver, à égalité, la plus chaude (température maximale la plus basse) ;
 *   3. plus de repli : une famille sans pièce propre à la saison laisse sa place à la suivante ;
 *   4. à égalité, la pièce qui couvre le plus d'occasions, puis l'indispensable, puis l'ordre de la capsule.
 * En Automne ou Hiver, la famille « maille ou haut » ne retient toujours que des pulls et des hauts à manches longues (01/10/2026).
 * Famille « manteau ou veste » (01/11/2026) : en hiver, un manteau avant toute veste.
 * Sans saison : la règle d'origine (l'indispensable, sinon la première de la famille).
 */
export function piecesCles(capsule: Item[], max = 3, saison?: CapsuleSeason): Item[] {
  const retenues: Item[] = [];
  const froid = saison === "Automne" || saison === "Hiver";
  for (const famille of FAMILLES_CLES) {
    if (retenues.length >= max) break;
    let candidates = capsule.filter((it) => famille.includes(it.cat));
    if (!saison) {
      const choix = candidates.find((it) => it.estBasiqueCapsule) ?? candidates[0];
      if (choix) retenues.push(choix);
      continue;
    }
    candidates = candidates.filter((it) => !estPieceDInterieur(it) && proprePourSaison(it, saison));
    if (froid && famille.includes("haut")) candidates = candidates.filter((it) => it.cat === "pull" || it.manches === "longues");
    // En hiver, un manteau passe devant toute veste (01/11/2026, validé par la propriétaire, signalé : une « Veste matelassée légère »
    // pièce clé d'une capsule d'hiver). Le rôle « calque » ne sert pas à les distinguer : le catalogue le donne à toutes ses vestes et
    // à tous ses manteaux (99 sur 99, mesuré le même jour).
    if (saison === "Hiver" && famille.includes("manteau") && candidates.some((it) => it.cat === "manteau")) {
      candidates = candidates.filter((it) => it.cat === "manteau");
    }
    if (!candidates.length) continue;
    const rang = (it: Item) => capsule.indexOf(it);
    const cle = (it: Item): number[] => [
      nombreDeSaisons(it),
      froid ? (it.meteoMaxTemp ?? 99) : 0,
      -occasionsOf(it).length,
      it.estBasiqueCapsule ? 0 : 1,
      rang(it),
    ];
    const meilleure = candidates.reduce((a, b) => {
      const ka = cle(a);
      const kb = cle(b);
      for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return kb[k] < ka[k] ? b : a;
      return a;
    });
    retenues.push(meilleure);
  }
  return retenues;
}

/** Complément de lieu de chaque occasion, pour une phrase lisible. */
const OCCASION_EN_PHRASE: Record<Exclude<OccasionKey, "all">, string> = {
  quotidien: "au quotidien",
  travail_formel: "au travail",
  date: "en tête-à-tête",
  soiree: "en soirée",
  sport: "au sport",
  cocooning: "à la maison",
  voyage: "en voyage",
  evenement_perso: "pour une cérémonie",
};

const ORDRE_OCCASIONS = OCCASIONS.map(([key]) => key);

/** Occasions d'une pièce dans l'ordre de la taxonomie — celles que la sélection lit (`occasionsOf`). */
function occasionsTriees(it: Item): Exclude<OccasionKey, "all">[] {
  const siennes = new Set(occasionsOf(it));
  return ORDRE_OCCASIONS.filter((o): o is Exclude<OccasionKey, "all"> => o !== "all" && siennes.has(o));
}

function enumeration(parties: string[]): string {
  if (parties.length <= 1) return parties.join("");
  return parties.slice(0, -1).join(", ") + " et " + parties[parties.length - 1];
}

/**
 * Introduction éditoriale de la capsule — une phrase courte (polish du
 * 25/09/2026 : lisible d'un coup d'œil), dont chaque partie n'apparaît que si
 * la capsule affichée la rend vraie :
 * - « des essentiels » : au moins une pièce indispensable (`estBasiqueCapsule`) ;
 * - « des pièces de caractère » : au moins une pièce statement (`isStatement`,
 *   la même lecture que la place réservée de la sélection).
 * La palette n'y figure plus : la ligne « Pensées pour … ta palette » de
 * l'en-tête le dit déjà, juste au-dessus.
 * Sans aucune des deux, un texte fixe qui n'affirme rien de la sélection.
 */
export function introCapsule(capsule: Item[]): string {
  const essentiels = capsule.some((it) => it.estBasiqueCapsule);
  const caractere = capsule.some((it) => isStatement(it));
  if (essentiels && caractere) return "Des essentiels faciles à associer, et quelques pièces de caractère.";
  if (essentiels) return "Des essentiels faciles à associer.";
  if (caractere) return "Quelques pièces de caractère pour varier tes tenues.";
  return "Une base cohérente pour composer tes tenues.";
}

export interface RaisonSuggestion {
  cle: "style" | "palette" | "silhouette" | "indispensable" | "occasions" | "superposition";
  texte: string;
}

/**
 * « Pourquoi Capsela te la propose ? » — seulement ce que le système a
 * réellement lu pour la retenir. Chaque raison correspond à un critère de
 * `computeDefaultCapsule` ou à une donnée du catalogue, jamais à une
 * formule d'ambiance :
 *
 * - style : `styleFit` sur un style du profil, le filtre de curation ;
 * - palette : la teinte EXACTE est l'une des couleurs choisies. Le filtre
 *   `paletteFit` admet aussi les pièces « sans conflit connu » : ce n'est pas
 *   une affinité, on ne le présente donc pas comme tel ;
 * - silhouette : la sélection l'a comptée au titre de la morphologie
 *   (`pieceOrienteeParMorphologie`) — jamais pour les morphologies qui
 *   n'orientent pas la sélection, comme l'en-tête ;
 * - indispensable : `estBasiqueCapsule`, départage de la sélection ;
 * - occasions : celles que la sélection cherche à couvrir ;
 * - superposition : `rolePiece === "calque"`, donnée catalogue.
 */
export function raisonsSuggestion(it: Item, profile: Profile): RaisonSuggestion[] {
  const raisons: RaisonSuggestion[] = [];

  const styleRetenu = (profile.styles || []).find((id) => {
    const libelle = STYLE_ID_TO_CATALOG_LABEL[id as StyleId];
    return libelle ? styleFit(it, libelle) : false;
  });
  const libelleStyle = styleRetenu ? styleLabel(styleRetenu, profile.gender) : "";
  if (libelleStyle) raisons.push({ cle: "style", texte: `Dans ton style ${libelleStyle}` });

  if (paletteHexes(profile).some((h) => h.toLowerCase() === it.hex.toLowerCase())) {
    raisons.push({ cle: "palette", texte: "Une couleur de ta palette" });
  }

  const forme = silhouetteForme(profile.morphology);
  if (forme && pieceOrienteeParMorphologie(it, profile.morphology, profile.preferencesSilhouette?.miseEnValeur)) {
    raisons.push({ cle: "silhouette", texte: `Pensée aussi pour ta silhouette ${forme}` });
  }

  if (it.estBasiqueCapsule) raisons.push({ cle: "indispensable", texte: "Un indispensable, facile à associer" });

  const occ = occasionsTriees(it);
  if (occ.length) {
    raisons.push({
      cle: "occasions",
      texte: occ.length > 3 ? `Se porte ${OCCASION_EN_PHRASE[occ[0]]}, ${OCCASION_EN_PHRASE[occ[1]]} et dans ${occ.length - 2} autres occasions` : `Se porte ${enumeration(occ.map((o) => OCCASION_EN_PHRASE[o]))}`,
    });
  }

  if (it.rolePiece === "calque") raisons.push({ cle: "superposition", texte: "Idéale en superposition" });

  return raisons;
}

export interface AlternativeRemplacement {
  piece: Item;
  /** Exclusions à appliquer pour que la capsule contienne exactement cette pièce à la place de celle remplacée. */
  exclusions: number[];
}

/**
 * Alternatives proposées par « Remplacer cette pièce ».
 *
 * AUCUN SECOND MOTEUR. Les alternatives sont les pièces que
 * `computeDefaultCapsule` retient lui-même quand on écarte la suggestion : on
 * l'écarte, on regarde quelle pièce de la même catégorie entre dans la
 * capsule, puis on écarte aussi celle-ci pour voir la suivante — jusqu'à
 * `max`. Le moteur est passé en paramètre (`calculer`) : la fonction reste
 * pure et testable, et l'écran lui donne exactement l'appel qu'il fait pour
 * s'afficher.
 *
 * Choisir la k-ième alternative applique ses `exclusions` (la pièce remplacée
 * et les k−1 alternatives qu'on lui a préférées) : la capsule recalculée est
 * alors, par construction, celle où cette pièce est entrée.
 *
 * Liste vide si le moteur ne remet rien dans la catégorie : l'écran le dit,
 * sans inventer d'alternative.
 */
export function alternativesDeRemplacement(
  piece: Item,
  capsuleActuelle: Item[],
  exclusionsActuelles: number[],
  calculer: (exclusions: number[]) => Item[],
  max = 3
): AlternativeRemplacement[] {
  const presentes = new Set(capsuleActuelle.map((it) => it.id));
  const exclusions = [...exclusionsActuelles, piece.id];
  const alternatives: AlternativeRemplacement[] = [];
  while (alternatives.length < max) {
    const entree = calculer(exclusions).find((it) => it.cat === piece.cat && !presentes.has(it.id));
    if (!entree) break;
    alternatives.push({ piece: entree, exclusions: [...exclusions] });
    exclusions.push(entree.id);
  }
  return alternatives;
}

/**
 * LA PHRASE DE LA FICHE D'UNE SUGGESTION (02/11/2026, refonte : « une phrase courte expliquant pourquoi Capsela recommande cette pièce »,
 * ex. « Un essentiel qui complète naturellement ton style minimaliste »). Construite sur raisonsSuggestion — donc seulement sur ce que
 * la sélection a réellement lu — et sur isStatement (la place réservée aux pièces de caractère) : le rôle de la pièce (indispensable,
 * signature), puis le style du profil qu'elle sert. Sans aucune raison : null, et la fiche n'affiche pas de phrase.
 */
export function phraseSuggestion(it: Item, profile: Profile): string | null {
  const raisons = raisonsSuggestion(it, profile);
  const style = raisons.find((r) => r.cle === "style")?.texte.replace(/^Dans ton style /, "") ?? "";
  const signature = isStatement(it);
  const indispensable = !signature && raisons.some((r) => r.cle === "indispensable");
  if (signature && style) return `Une pièce signature qui donne du caractère à ton style ${style}.`;
  if (indispensable && style) return `Un indispensable qui complète naturellement ton style ${style}.`;
  if (signature) return "Une pièce signature, pour donner du caractère à tes tenues.";
  if (indispensable) return "Un indispensable, facile à associer avec le reste de ta capsule.";
  if (style) return `Choisie pour ton style ${style}.`;
  if (raisons.some((r) => r.cle === "palette")) return "Choisie dans une couleur de ta palette.";
  const occasions = raisons.find((r) => r.cle === "occasions");
  return occasions ? `${occasions.texte}.` : null;
}
