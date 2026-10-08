import { contexteCapsule, estDeSaison, representativeWeatherFor } from "./capsule";
import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import { OCCASIONS } from "./data";
import { describeOutfitVariation, getOutfitsForItem, nounInfoDuNom, outfitFormality, type ItemOutfitVariation, type OutfitStyleInsight } from "./logic";
import type { CapsuleSeason, Item, OccasionKey } from "./types";

/*
 * « COMMENT PORTER … ? » ET LE DÉTAIL D'UN LOOK — les dérivés purs des deux
 * écrans (27/09/2026). Les idées elles-mêmes viennent toujours de
 * getOutfitsForItem (un seul moteur) ; ce module ne fait que dire d'où vient
 * chaque pièce, dans quel ordre présenter les idées et comment titrer.
 *
 * LA SOURCE D'UNE PIÈCE EST EXPLICITE : « owned » si elle figure dans le
 * dressing réel (state.items), « catalog » sinon. Jamais déduite d'un nom,
 * d'une image ou d'un id seul — une pièce du catalogue déclarée « J'ai déjà »
 * a été remplacée par une vraie pièce, qui seule est au dressing.
 */

export type SourcePiece = "owned" | "catalog";

/**
 * LES IDÉES D'UNE PIÈCE, LE DRESSING D'ABORD (27/09/2026, brief « Comment
 * porter … ? » : « la capsule complète seulement si nécessaire, jamais
 * ajoutée artificiellement »).
 *
 * wardrobePool remplace la capsule par le dressing CATÉGORIE PAR CATÉGORIE :
 * une catégorie absente du dressing (veste, robe, foulard…) y reste pourvue
 * par la capsule, et le moteur s'en sert même quand le dressing suffisait.
 * Mesuré sur un dressing complet de neuf pièces, trois tirages : 10 à 12
 * idées sur 17 contenaient une suggestion (blazer par-dessus le manteau,
 * foulard, robe de la capsule).
 *
 * Deux tirages du même moteur, sans rien y changer : d'abord sur les seules
 * pièces du dressing (plus la pièce pivot) ; getOutfitsForItem ne gardant que
 * des tenues complètes, chaque idée obtenue se porte entièrement avec le
 * dressing. Puis, seulement pour les occasions que le dressing ne couvre pas,
 * les idées du pool complété par la capsule. `dressing` null : le tirage
 * d'origine, sur le seul wardrobePool (paramètre de mesure, cf. AGENTS.md).
 */
export function ideesDressingDAbord(
  pivot: Item,
  wardrobePool: Item[],
  dressing: Item[] | null,
  capsuleSeason: CapsuleSeason,
  preferredHexes: string[],
  gender: "femme" | "homme" | null,
  /** Colorimétrie du profil (30/09/2026) — cf. getOutfitsForItem. */
  colorimetrie: ColorimetrieMoteur | null = null
): ItemOutfitVariation[] {
  const pool = wardrobePool.some((i) => i.id === pivot.id) ? wardrobePool : [...wardrobePool, pivot];
  const meteo = representativeWeatherFor(capsuleSeason);
  const tirer = (p: Item[]) => getOutfitsForItem(pivot.id, p, meteo, preferredHexes, {}, gender, capsuleSeason, colorimetrie);
  if (!dressing) return tirer(pool);
  // Le dressing seul, mais DE LA SAISON des idées (28/09/2026) : des bottines
  // d'automne ne complètent pas une idée d'été — sans ce filtre, la tenue
  // « entièrement de ton dressing » l'emportait sur les chaussures d'été de
  // la capsule. La pièce pivot reste, quelle que soit sa saison.
  const deSaison = contexteCapsule(capsuleSeason);
  const duDressing = tirer(
    pool.filter((it) => it.id === pivot.id || (sourcePiece(it.id, dressing) === "owned" && estDeSaison(it, deSaison)))
  );
  const couvertes = new Set(duDressing.map((v) => v.occasion));
  const completees = tirer(pool).filter((v) => !couvertes.has(v.occasion));
  const rang = (o: OccasionKey) => OCCASIONS.findIndex(([k]) => k === o);
  return [...duDressing, ...completees].sort((a, b) => rang(a.occasion) - rang(b.occasion)).slice(0, 18);
}

export const sourcePiece = (id: number, dressing: Item[]): SourcePiece => (dressing.some((it) => it.id === id) ? "owned" : "catalog");

export interface ProvenanceLook {
  dressing: number;
  suggestions: number;
  total: number;
}

export function provenanceLook(ids: number[], dressing: Item[]): ProvenanceLook {
  const dressingCount = ids.filter((id) => sourcePiece(id, dressing) === "owned").length;
  return { dressing: dressingCount, suggestions: ids.length - dressingCount, total: ids.length };
}

/** « Tout est dans ton dressing », « 4 pièces de ton dressing · 1 suggestion », « 5 suggestions de ta capsule ». */
export function texteProvenance(p: ProvenanceLook): string {
  const s = (n: number) => (n > 1 ? "s" : "");
  if (p.suggestions === 0) return "Tout est dans ton dressing";
  if (p.dressing === 0) return `${p.suggestions} suggestion${s(p.suggestions)} de ta capsule`;
  return `${p.dressing} pièce${s(p.dressing)} de ton dressing · ${p.suggestions} suggestion${s(p.suggestions)}`;
}

/*
 * LES TROIS FAMILLES DES PASTILLES (Quotidien / Travail / Sortie). Une
 * occasion sans famille (Sport) n'apparaît que sous « Tous les looks ».
 * ARBITRAGE ÉDITORIAL : Cocooning et Voyage rejoignent le Quotidien ;
 * Rendez-vous important le Travail ; Rendez-vous amoureux et Cérémonie la
 * Sortie.
 */
export type FamilleLook = "quotidien" | "travail" | "sortie";

export const FAMILLES_LOOK: { cle: FamilleLook; libelle: string }[] = [
  { cle: "quotidien", libelle: "Quotidien" },
  { cle: "travail", libelle: "Travail" },
  { cle: "sortie", libelle: "Sortie" },
];

const FAMILLE_DE: Partial<Record<OccasionKey, FamilleLook>> = {
  quotidien: "quotidien",
  cocooning: "quotidien",
  voyage: "quotidien",
  travail_formel: "travail",
  entretien: "travail",
  soiree: "sortie",
  date: "sortie",
  evenement_perso: "sortie",
};

export const familleDe = (occasion: OccasionKey): FamilleLook | null => FAMILLE_DE[occasion] ?? null;

export interface LookNumerote {
  variation: ItemOutfitVariation;
  /** « LOOK N » : la place du look dans l'ordre de « Tous les looks », identique sur la page de détail. */
  numero: number;
  famille: FamilleLook | null;
  provenance: ProvenanceLook;
}

/**
 * L'ordre de présentation. Les pièces du dressing passent d'abord : à
 * famille égale, le look qui demande le moins de suggestions vient en tête
 * (tri stable, l'ordre du moteur départage). Les trois premiers sont, si
 * elles existent, la meilleure idée Quotidien, Travail puis Sortie — trois
 * looks différenciés avant les autres.
 */
export function ordonnerLooks(variations: ItemOutfitVariation[], dressing: Item[]): LookNumerote[] {
  const annotes = variations
    .map((variation, i) => ({ variation, i, famille: familleDe(variation.occasion), provenance: provenanceLook(variation.ids, dressing) }))
    .sort((a, b) => a.provenance.suggestions - b.provenance.suggestions || a.i - b.i);
  const tetes = FAMILLES_LOOK.map((f) => annotes.find((a) => a.famille === f.cle)).filter((a): a is (typeof annotes)[number] => Boolean(a));
  return [...tetes, ...annotes.filter((a) => !tetes.includes(a))].map(({ variation, famille, provenance }, index) => ({
    variation,
    numero: index + 1,
    famille,
    provenance,
  }));
}

const commenceParVoyelle = (mot: string) => /^[aeiouyàâäéèêëîïôöûü]/i.test(mot);

/**
 * « Comment porter ton manteau chocolat ? » — l'article s'accorde au nom
 * affiché (nounInfoDuNom). Une pièce qui n'est pas au dressing n'est pas « la
 * tienne » : article défini. Nom non reconnu : « cette pièce », jamais un
 * accord deviné.
 */
export function titreCommentPorter(piece: Item, possedee: boolean): string {
  const info = nounInfoDuNom(piece.name);
  if (!info) return "Comment porter cette pièce ?";
  const nom = piece.name.trim().charAt(0).toLowerCase() + piece.name.trim().slice(1);
  const voyelle = commenceParVoyelle(nom);
  const article = possedee
    ? info.plural ? "tes " : info.gender === "m" || voyelle ? "ton " : "ta "
    : info.plural ? "les " : voyelle ? "l'" : info.gender === "m" ? "le " : "la ";
  return `Comment porter ${article}${nom} ?`;
}

/** Clé d'un look : ses pièces, dans l'ordre du moteur. */
export const cleLook = (ids: number[]) => ids.join("-");

/**
 * Titre et phrase de chaque look (describeOutfitVariation), calculés comme
 * l'écran l'a toujours fait : rang et écart de formalité au sein des idées
 * de la même occasion. Une seule fonction pour la carte et la page de
 * détail — le même look porte le même nom sur les deux.
 */
export function decrireLooks(variations: ItemOutfitVariation[], pool: Item[], pivotId: number): Map<string, OutfitStyleInsight> {
  const pieces = (v: ItemOutfitVariation) => v.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  const resultat = new Map<string, OutfitStyleInsight>();
  const occasions = Array.from(new Set(variations.map((v) => v.occasion)));
  for (const occasion of occasions) {
    const groupe = variations.filter((v) => v.occasion === occasion).map((variation) => ({ variation, pieces: pieces(variation) }));
    const formalite = new Map(groupe.map((x) => [x.variation, outfitFormality(x.pieces, pivotId)]));
    const rang = new Map([...groupe].sort((a, b) => formalite.get(a.variation)! - formalite.get(b.variation)!).map((x, r) => [x.variation, r]));
    const moyenne = groupe.reduce((somme, x) => somme + formalite.get(x.variation)!, 0) / (groupe.length || 1);
    for (const { variation, pieces: p } of groupe) {
      const ecart = formalite.get(variation)! - moyenne;
      resultat.set(cleLook(variation.ids), describeOutfitVariation(variation, p, pivotId, rang.get(variation)!, groupe.length, ecart));
    }
  }
  return resultat;
}
