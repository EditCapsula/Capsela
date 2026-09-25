import { isStatement } from "./attributes";
import { capsuleSeasonBucket, occasionsOf, pieceOrienteeParMorphologie, styleFit } from "./capsule";
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
  const bucket = capsuleSeasonBucket(saison);
  return items.filter((it) => it.season === bucket || it.season === "Toutes saisons");
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
 * Jusqu'à 3 pièces clés, choisies PARMI les suggestions de la capsule.
 *
 * Il n'existait aucun mécanisme de « pièce clé » : règle simple et
 * déterministe, sans score nouveau. Une pièce par famille (FAMILLES_CLES),
 * la première marquée indispensable (`estBasiqueCapsule`, donnée catalogue
 * que la sélection privilégie déjà), sinon la première de la famille dans
 * l'ordre de la capsule. La 4ᵉ famille ne sert que si l'une des trois
 * premières est vide.
 */
export function piecesCles(capsule: Item[], max = 3): Item[] {
  const retenues: Item[] = [];
  for (const famille of FAMILLES_CLES) {
    if (retenues.length >= max) break;
    const candidates = capsule.filter((it) => famille.includes(it.cat));
    const choix = candidates.find((it) => it.estBasiqueCapsule) ?? candidates[0];
    if (choix) retenues.push(choix);
  }
  return retenues;
}

/** Complément de lieu de chaque occasion, pour une phrase lisible. */
const OCCASION_EN_PHRASE: Record<Exclude<OccasionKey, "all">, string> = {
  quotidien: "au quotidien",
  travail_formel: "au travail",
  entretien: "en rendez-vous important",
  date: "en tête-à-tête",
  soiree: "en sortie",
  festive: "en soirée festive",
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
 * Courte description d'une pièce clé, écrite uniquement depuis ses données :
 * indispensable (donnée catalogue) et occasions (celles que la sélection
 * compte). Trois occasions au plus ; au-delà, « et plus encore » plutôt
 * qu'une liste. Chaîne vide si rien n'est connu — l'écran n'affiche alors
 * que le nom.
 */
export function descriptionPieceCle(it: Item): string {
  const occ = occasionsTriees(it).map((o) => OCCASION_EN_PHRASE[o]);
  const lieux = occ.length > 3 ? occ.slice(0, 3).join(", ") + " et plus encore" : enumeration(occ);
  if (it.estBasiqueCapsule) return lieux ? `Un indispensable, à porter ${lieux}.` : "Un indispensable de la saison.";
  return lieux ? `À porter ${lieux}.` : "";
}

/**
 * Introduction éditoriale de la capsule — une phrase, dont chaque partie
 * n'apparaît que si la capsule affichée la rend vraie :
 * - « des essentiels » : au moins une pièce indispensable (`estBasiqueCapsule`) ;
 * - « des pièces dans ta palette » : au moins une teinte exactement choisie ;
 * - « quelques touches » : au moins une pièce statement (`isStatement`, la
 *   même lecture que la place réservée de la sélection).
 * Sans aucune des trois, un texte fixe qui n'affirme rien de la sélection.
 */
export function introCapsule(capsule: Item[], profile: Profile): string {
  const palette = paletteHexes(profile).map((h) => h.toLowerCase());
  const parties: string[] = [];
  if (capsule.some((it) => it.estBasiqueCapsule)) parties.push("des essentiels faciles à associer");
  if (palette.length && capsule.some((it) => palette.includes(it.hex.toLowerCase()))) parties.push("des pièces dans ta palette");
  if (capsule.some((it) => isStatement(it))) parties.push("quelques touches pour renouveler tes tenues");
  if (!parties.length) return "Une base cohérente pour composer tes tenues, pièce après pièce.";
  const phrase = enumeration(parties);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1) + ".";
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
  if (forme && pieceOrienteeParMorphologie(it, profile.morphology)) {
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
