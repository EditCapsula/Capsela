import { metalOf } from "./attributes";
import { colorimetrieUtilisable, estSaison, type Colorimetrie } from "./colorimetrie";
import { FALLBACK_HEX, PALETTE } from "./data";
import { PAL_COULEURS } from "./palCouleurs";
import type { CategoryKey, Item } from "./types";

/*
 * LA COLORIMÉTRIE DANS LE MOTEUR DE TENUES (30/09/2026, demandé par la
 * propriétaire : « on doit tenir compte de la colorimétrie dans les
 * recommandations de tenues »). Rouvre l'arbitrage du 25/09/2026, qui la
 * réservait à l'affichage.
 *
 * LE PRINCIPE, celui de la méthode des saisons : une couleur agit surtout
 * PRÈS DU VISAGE. D'où trois règles, toutes molles — aucune n'écarte une
 * catégorie, aucune ne vide un tirage :
 *
 *   1. près du visage, une couleur « avec modération » est évitée quand une
 *      autre pièce convient (jamais retirée des tenues : elle reste possible
 *      en bas, en chaussures, en sac, et près du visage faute d'alternative) ;
 *   2. près du visage, les couleurs de la saison (signature et neutres) sont
 *      bienvenues au même titre que ses couleurs préférées ;
 *   3. les bijoux suivent le métal de la saison : doré pour les saisons
 *      chaudes, argenté pour les froides.
 *
 * Loin du visage (bas, chaussures, sac, ceinture…), rien ne change : la
 * préférence de palette d'origine (R-S10) s'applique seule, à l'identique.
 *
 * ARBITRAGE ÉDITORIAL : la zone du visage, la correspondance des teintes et
 * l'ordre des paliers ci-dessous. La mesure de l'effet est dans
 * docs/colorimetrie.md.
 */

/** Ce que le moteur lit de la colorimétrie : des hex de PAL_COULEURS, et un métal. */
export interface ColorimetrieMoteur {
  /** Signature + neutres : préférées près du visage. */
  harmonie: ReadonlySet<string>;
  /** « Avec modération » : évitées près du visage quand une alternative existe. */
  loinDuVisage: ReadonlySet<string>;
  /** Métal des bijoux : doré (saisons chaudes), argenté (froides), ou aucune préférence. */
  metal: "or" | "argent" | null;
  /**
   * LEVIER DE MESURE, inerte en production (colorimetrieMoteur ne le pose
   * jamais) : "paliers" rejoue la première version, où « préférée ET de la
   * saison » passait avant tout — cf. candidatsCouleur et l'audit
   * scripts/colorimetrie-moteur.audit.ts.
   */
  strategie?: "union" | "paliers";
}

const METAL_DE_SAISON = { printemps: "or", automne: "or", ete: "argent", hiver: "argent" } as const;

/** La colorimétrie du profil telle que le moteur la lit, ou null (aucun effet). */
export function colorimetrieMoteur(c: Colorimetrie | null | undefined): ColorimetrieMoteur | null {
  if (!colorimetrieUtilisable(c)) return null;
  const harmonie = new Set([...(c!.signature ?? []), ...(c!.neutres ?? [])]);
  return {
    harmonie,
    // Une teinte à la fois « harmonie » et « modération » ne peut pas être les
    // deux : l'harmonie l'emporte (aucune saison actuelle n'a ce cas).
    loinDuVisage: new Set((c!.moderation ?? []).filter((h) => !harmonie.has(h))),
    metal: estSaison(c!.saison) ? METAL_DE_SAISON[c!.saison] : null,
  };
}

/*
 * DEUX PALETTES, UNE CORRESPONDANCE. Les pièces du dressing prennent leurs
 * couleurs dans PALETTE (51 teintes depuis le 02/10/2026, data.ts — AddScreen et l'analyse de
 * photo du dressing), la colorimétrie dans PAL_COULEURS (21 teintes). Seules
 * neuf ont le même hex. Le plus proche en RGB se trompe (mesuré : Chocolat →
 * Bordeaux, Corail → Camel, Bleu ciel → Beige) : la correspondance est donc
 * écrite à la main, teinte par teinte. Une teinte sans équivalent honnête
 * (Vert sauge) ne correspond à rien, et la colorimétrie ne dit alors rien de
 * la pièce.
 */
const PAL_PAR_NOM = new Map(PAL_COULEURS.map(([n, h]) => [n, h]));

export const TEINTE_DU_DRESSING: Record<string, string | null> = {
  Blanc: "Blanc",
  "Blanc cassé": "Blanc / écru",
  Crème: "Crème",
  Sable: "Sable",
  Camel: "Camel",
  Caramel: "Camel",
  Terracotta: "Terracotta",
  Rouille: "Terracotta",
  Brique: "Terracotta",
  Chocolat: "Chocolat",
  Moutarde: "Moutarde",
  Kaki: "Kaki",
  "Vert sauge": null,
  "Vert bouteille": "Vert bouteille",
  Taupe: "Taupe",
  "Beige rosé": "Beige",
  "Rose poudré": "Rose poudré",
  Corail: "Corail",
  "Gris clair": "Gris",
  Gris: "Gris",
  "Gris anthracite": "Gris",
  "Bleu ciel": "Bleu",
  Denim: "Bleu",
  Marine: "Marine",
  Prune: "Prune",
  Bordeaux: "Bordeaux",
  Noir: "Noir",
  // Ajouts du 02/10/2026 (data.ts / palCouleurs.ts). Rouge, Bleu et Beige existaient déjà dans la
  // palette personnelle, donc dans les saisons : ils se lisent comme eux-mêmes. Les autres teintes
  // ajoutées ne sont encore placées dans AUCUNE saison : « sans équivalent » (null) tant que ce
  // n'est pas arbitré — la colorimétrie ne dit rien d'elles, et une pièce de ces couleurs n'est ni
  // favorisée ni écartée par elle. Les mapper vers elles-mêmes les ferait passer pour « hors
  // saison » et changerait le comportement du moteur.
  Rouge: "Rouge",
  Bleu: "Bleu",
  Beige: "Beige",
  Marron: null,
  Cognac: null,
  "Rouge cerise": null,
  "Vieux rose": null,
  "Rose pâle": null,
  Fuchsia: null,
  Jaune: null,
  Orange: null,
  Abricot: null,
  "Vert olive": null,
  "Vert forêt": null,
  Émeraude: null,
  Menthe: null,
  "Bleu nuit": null,
  "Bleu cobalt": null,
  Turquoise: null,
  Lavande: null,
  Ivoire: null,
  Champagne: null,
  Nude: null,
  "Gris perle": null,
};

const cle = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** hex (majuscules) → hex PAL_COULEURS ; puis nom de couleur normalisé → hex PAL_COULEURS. */
const PAR_HEX = new Map<string, string | null>();
const PAR_NOM = new Map<string, string | null>();
for (const [nom, hex] of PAL_COULEURS) {
  PAR_HEX.set(hex.toUpperCase(), hex);
  PAR_NOM.set(cle(nom), hex);
}
for (const [nom, hex] of PALETTE) {
  const pal = TEINTE_DU_DRESSING[nom];
  const cible = pal ? PAL_PAR_NOM.get(pal) ?? null : null;
  PAR_HEX.set(hex.toUpperCase(), cible);
  PAR_NOM.set(cle(nom), cible);
}
// Le repli des pièces sans couleur renseignée a le hex de « Sable » : c'est
// une couleur INCONNUE, jamais une teinte. La colorimétrie n'en dit rien.
PAR_HEX.set(FALLBACK_HEX.toUpperCase(), null);

/** La teinte PAL_COULEURS d'une pièce, ou null quand on ne peut pas la dire honnêtement. */
export function teinteDe(it: Pick<Item, "hex" | "color">): string | null {
  if (!it.hex || it.hex.toUpperCase() === FALLBACK_HEX.toUpperCase()) return null;
  const parHex = PAR_HEX.get(it.hex.toUpperCase());
  if (parHex !== undefined) return parHex;
  return it.color ? PAR_NOM.get(cle(it.color)) ?? null : null;
}

/** Catégories portées près du visage. Les vestes et manteaux encadrent le visage par le col. */
export const CATEGORIES_VISAGE: readonly CategoryKey[] = ["haut", "pull", "robe", "combinaison", "veste", "manteau"];
const ACCESSOIRES_VISAGE = new Set(["Foulard", "Écharpe"]);

export function estPresDuVisage(it: Item): boolean {
  return CATEGORIES_VISAGE.includes(it.cat) || (it.cat === "accessoire" && ACCESSOIRES_VISAGE.has(it.accessoireType ?? ""));
}

/** La colorimétrie a-t-elle quelque chose à dire de cette pièce ? */
const concernee = (it: Item) => estPresDuVisage(it) || it.cat === "bijou";

/** La pièce s'accorde-t-elle à la saison ? Une pièce loin du visage, ou de couleur inconnue, n'a pas à s'y accorder. */
function accordee(it: Item, c: ColorimetrieMoteur): boolean {
  if (it.cat === "bijou") {
    const m = metalOf(it);
    return !c.metal || m === "aucun" || m === c.metal;
  }
  if (!estPresDuVisage(it)) return true;
  const t = teinteDe(it);
  return t === null || c.harmonie.has(t);
}

/** Accord « positif » : la pièce EST dans la saison (pas seulement neutre faute d'information). */
function accordeePositivement(it: Item, c: ColorimetrieMoteur): boolean {
  if (it.cat === "bijou") return !!c.metal && metalOf(it) === c.metal;
  const t = teinteDe(it);
  return estPresDuVisage(it) && t !== null && c.harmonie.has(t);
}

const loinDuVisage = (it: Item, c: ColorimetrieMoteur) => {
  if (!estPresDuVisage(it)) return false;
  const t = teinteDe(it);
  return t !== null && c.loinDuVisage.has(t);
};

/**
 * LES CANDIDATS D'UN TIRAGE, après préférences de couleur. Ne rend jamais
 * une liste vide quand `base` ne l'est pas.
 *
 * Sans colorimétrie, ou pour un tirage où aucune pièce n'est concernée (bas,
 * chaussures, sac…) : la règle d'origine de pick(), À L'IDENTIQUE — les
 * pièces de ses couleurs préférées (hex exact, pièce à couleur inconnue
 * comprise) si elles existent, sinon toutes.
 *
 * Avec colorimétrie, pour un tirage près du visage :
 *   1. les pièces « avec modération » sont écartées s'il en reste d'autres ;
 *   2. les pièces de ses couleurs préférées OU de sa saison, s'il y en a ;
 *      sinon tout ce qui reste. Ce groupe ne compte que s'il contient au
 *      moins une pièce qui y est pour sa couleur, pas seulement pour une
 *      couleur inconnue — sinon une pièce sans couleur renseignée
 *      l'emporterait sur toutes les autres.
 */
export function candidatsCouleur(base: Item[], preferredHexes: readonly string[], c: ColorimetrieMoteur | null): Item[] {
  const inconnue = (i: Item) => i.hex === FALLBACK_HEX;
  const preferee = (i: Item) => preferredHexes.includes(i.hex) || inconnue(i);
  if (!c || !base.some(concernee)) {
    const pref = preferredHexes.length ? base.filter(preferee) : [];
    return pref.length ? pref : base;
  }
  const sansModeration = base.filter((i) => !loinDuVisage(i, c));
  const reste = sansModeration.length ? sansModeration : base;
  const paliers: [Item[], (i: Item) => boolean][] = [];
  if (c.strategie !== "paliers") {
    // UNION (retenue le 30/09/2026, mesurée) : près du visage, ses couleurs
    // préférées et celles de sa saison sont également bienvenues — sinon
    // tout ce qui reste. La première version enchaînait les paliers
    // « préférée ET de la saison » puis « préférée » : juste, mais si étroit
    // (Printemps + Noir, Marine, Camel : le camel seul) que les tenues
    // distinctes tombaient de 855 à 293 sur un dressing de 36 pièces.
    paliers.push([
      reste.filter((i) => preferee(i) || accordee(i, c)),
      (i) => preferredHexes.includes(i.hex) || accordeePositivement(i, c),
    ]);
  } else if (preferredHexes.length) {
    paliers.push([reste.filter((i) => preferee(i) && accordee(i, c)), (i) => preferredHexes.includes(i.hex) && accordeePositivement(i, c)]);
    paliers.push([reste.filter(preferee), (i) => preferredHexes.includes(i.hex)]);
  }
  paliers.push([reste.filter((i) => accordee(i, c)), (i) => accordeePositivement(i, c)]);
  for (const [liste, justifiee] of paliers) if (liste.some(justifiee)) return liste;
  return reste;
}

/**
 * R-S18 — la tenue s'accorde à la saison près du visage : au moins une pièce
 * du visage dans la saison, et aucune « avec modération ». Un bonus, jamais
 * une pénalité : une tenue qui n'en bénéficie pas n'affiche aucun message.
 */
export function accordVisage(pieces: Item[], c: ColorimetrieMoteur | null): boolean {
  if (!c) return false;
  const visage = pieces.filter(estPresDuVisage);
  return visage.some((i) => accordeePositivement(i, c)) && !visage.some((i) => loinDuVisage(i, c));
}

/**
 * La colorimétrie pour les idées autour d'une pièce imposée : la teinte (ou
 * le métal) de la pièce est tenue pour accordée le temps de l'appel. Sans
 * cela, une pièce « avec modération » ne sortirait jamais de ses propres
 * idées — même motif que `effectiveHexes` dans getOutfitsForItem.
 */
export function colorimetriePourPivot(c: ColorimetrieMoteur | null, pivot: Item): ColorimetrieMoteur | null {
  if (!c) return null;
  if (pivot.cat === "bijou") return metalOf(pivot) !== "aucun" && metalOf(pivot) !== c.metal ? { ...c, metal: null } : c;
  const t = teinteDe(pivot);
  if (!t || !estPresDuVisage(pivot) || c.harmonie.has(t)) return c;
  const loin = new Set(c.loinDuVisage);
  loin.delete(t);
  return { ...c, harmonie: new Set([...c.harmonie, t]), loinDuVisage: loin };
}
