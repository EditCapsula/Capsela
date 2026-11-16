import type { CapsuleSeason, Item } from "./types";
import { PAL_COULEURS } from "./palCouleurs";
import { teinteDe, estPresDuVisage, type ColorimetrieMoteur } from "./colorimetrieMoteur";

/**
 * CONSEILS D'ASSOCIATION DE COULEURS (02/10/2026, demandé : « le rose et le marron ensemble,
 * c'est top pour l'automne, mais avec une pointe de rouge, c'est parfait »).
 *
 * La saison est celle de l'ANNÉE (la date consultée), jamais celle de la colorimétrie du
 * profil : « top pour l'automne » parle du calendrier. La colorimétrie n'intervient que pour
 * ADOUCIR la phrase quand une des couleurs est à doser près du visage pour la personne.
 *
 * Étendus aux quatre saisons le 16/11/2026 (dix accords chacune, listes de la propriétaire).
 *
 * ARBITRAGE ÉDITORIAL : les accords ci-dessous sont des choix de style, pas une
 * mesure. Une phrase n'est affichée que si les couleurs citées sont VRAIMENT dans la tenue
 * affichée (jamais une donnée inventée).
 */

export interface RegleAssociation {
  saison: CapsuleSeason;
  /** Les deux couleurs de l'accord, par nom PAL_COULEURS. */
  accord: [string, string];
  /** La touche qui rend l'accord « parfait ». */
  pointe: string;
}



/** Libellés avec article, pour les phrases. */
export const LIBELLES: Record<string, string> = {
  "Vieux rose": "le vieux rose", Marron: "le marron", Rouge: "le rouge", Moutarde: "la moutarde", Chocolat: "le chocolat",
  Bordeaux: "le bordeaux", Terracotta: "la terracotta", Crème: "la crème", Kaki: "le kaki", "Vert olive": "le vert olive",
  Camel: "le camel", Cognac: "le cognac", Marine: "le marine", Ivoire: "l'ivoire", "Vert forêt": "le vert forêt", Beige: "le beige",
  "Gris anthracite": "le gris anthracite", Champagne: "le champagne", Prune: "la prune", Taupe: "le taupe", "Rose poudré": "le rose poudré",
  // Printemps, été, hiver (16/11/2026).
  "Gris clair": "le gris clair", "Vert sauge": "le vert sauge", "Bleu ciel": "le bleu ciel", "Beige rosé": "le beige rosé",
  Corail: "le corail", Blanc: "le blanc", "Blanc cassé": "le blanc cassé", Sable: "le sable", Noir: "le noir",
  "Vert bouteille": "le vert bouteille", Rouille: "le rouille",
};

const A = (accord: [string, string], pointe: string): RegleAssociation => ({ saison: "Automne", accord, pointe });
const P = (accord: [string, string], pointe: string): RegleAssociation => ({ saison: "Printemps", accord, pointe });
const E = (accord: [string, string], pointe: string): RegleAssociation => ({ saison: "Été", accord, pointe });
const H = (accord: [string, string], pointe: string): RegleAssociation => ({ saison: "Hiver", accord, pointe });

export const REGLES_ASSOCIATION: RegleAssociation[] = [
  A(["Vieux rose", "Marron"], "Rouge"),
  A(["Moutarde", "Chocolat"], "Bordeaux"),
  A(["Terracotta", "Crème"], "Kaki"),
  A(["Vert olive", "Camel"], "Bordeaux"),
  A(["Cognac", "Marine"], "Ivoire"),
  A(["Vert forêt", "Beige"], "Cognac"),
  A(["Bordeaux", "Gris anthracite"], "Champagne"),
  A(["Prune", "Taupe"], "Moutarde"),
  A(["Chocolat", "Rose poudré"], "Camel"),
  A(["Kaki", "Terracotta"], "Crème"),

  // LES TROIS AUTRES SAISONS (16/11/2026, listes fournies par la propriétaire : « ok pour étendre aux autres saisons »). ARBITRAGE
  // ÉDITORIAL, comme l'automne. Ses couleurs sont reprises telles quelles : « Beige rosé », « Blanc cassé », « Rouille » sont des couleurs
  // du dressing (PALETTE, data.ts), reconnues par leur nom (porteLaCouleur).
  // Printemps — douceur, fraîcheur et nuances lumineuses.
  P(["Rose poudré", "Gris clair"], "Vert sauge"),
  P(["Crème", "Vert sauge"], "Camel"),
  P(["Bleu ciel", "Beige rosé"], "Corail"),
  P(["Blanc", "Rose poudré"], "Moutarde"),
  P(["Corail", "Blanc cassé"], "Marine"),
  P(["Kaki", "Crème"], "Rose poudré"),
  P(["Camel", "Blanc"], "Corail"),
  P(["Vert sauge", "Gris clair"], "Rose poudré"),
  P(["Sable", "Bleu ciel"], "Terracotta"),
  P(["Beige rosé", "Prune"], "Crème"),
  // Été — lumière, contraste et caractère.
  E(["Blanc", "Marine"], "Rouge"),
  E(["Bleu ciel", "Sable"], "Blanc"),
  E(["Corail", "Blanc cassé"], "Kaki"),
  E(["Moutarde", "Marine"], "Blanc"),
  E(["Vert bouteille", "Crème"], "Camel"),
  E(["Prune", "Beige rosé"], "Rose poudré"),
  E(["Terracotta", "Sable"], "Corail"),
  E(["Vert sauge", "Blanc"], "Terracotta"),
  E(["Rouille", "Marine"], "Blanc cassé"),
  E(["Kaki", "Blanc cassé"], "Bordeaux"),
  // Hiver — profondeur, élégance et contrastes.
  H(["Noir", "Camel"], "Bordeaux"),
  H(["Marine", "Gris clair"], "Rouge"),
  H(["Vert bouteille", "Blanc"], "Bordeaux"),
  H(["Marine", "Crème"], "Prune"),
  H(["Gris anthracite", "Blanc"], "Corail"),
  H(["Chocolat", "Blanc cassé"], "Marine"),
  H(["Bordeaux", "Noir"], "Camel"),
  H(["Prune", "Gris clair"], "Rose poudré"),
  H(["Marine", "Moutarde"], "Blanc"),
  H(["Noir", "Blanc"], "Terracotta"),
];

/** « pour l'automne », « pour le printemps » ; « un accord d'hiver », « un accord de printemps » (16/11/2026 : le printemps ne s'élide pas). */
const POUR_LA_SAISON: Record<CapsuleSeason, string> = { Printemps: "pour le printemps", "Été": "pour l'été", Automne: "pour l'automne", Hiver: "pour l'hiver" };
const ACCORD_DE: Record<CapsuleSeason, string> = { Printemps: "un accord de printemps", "Été": "un accord d'été", Automne: "un accord d'automne", Hiver: "un accord d'hiver" };

const hex = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)?.[1];
const cleNom = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Une pièce PORTE-T-ELLE cette couleur ? Par son nom exact (16/11/2026), sinon par sa teinte. Le nom d'abord : la teinte regroupe des
 * nuances (« Gris clair » et « Gris anthracite » du dressing se lisent « Gris », « Bleu ciel » se lit « Bleu », colorimetrieMoteur.ts),
 * si bien qu'un accord écrit avec la nuance ne se reconnaissait jamais — celui d'automne « Bordeaux + Gris anthracite » compris.
 */
export function porteLaCouleur(p: Pick<Item, "hex" | "color">, nom: string): boolean {
  if (p.color && cleNom(p.color) === cleNom(nom)) return true;
  const h = hex(nom);
  return !!h && teinteDe(p) === h;
}

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const de = (libelle: string) => (/^l'/.test(libelle) ? `d'${libelle.slice(2)}` : `de ${libelle.replace(/^(le|la) /, "")}`);

/** La phrase d'une règle. `pointePresente` : la touche figure déjà dans la tenue. `adouci` : une couleur est à doser. */
export function phraseDe(r: RegleAssociation, pointePresente: boolean, adouci: boolean): string {
  const [a, b] = r.accord.map((n) => LIBELLES[n] ?? n.toLowerCase());
  const pointe = de(LIBELLES[r.pointe] ?? r.pointe.toLowerCase());
  const pour = POUR_LA_SAISON[r.saison];
  const accordDe = ACCORD_DE[r.saison];
  if (adouci) {
    return pointePresente
      ? `${maj(a)}, ${b} et une pointe ${pointe} : ${accordDe}, à porter plutôt en touches près du visage.`
      : `${maj(a)} et ${b} : ${accordDe}, à porter plutôt en touches près du visage.`;
  }
  return pointePresente
    ? `${maj(a)} et ${b}, avec une pointe ${pointe} : c'est parfait ${pour}.`
    : `${maj(a)} et ${b} ensemble, c'est top ${pour}. Avec une pointe ${pointe}, ce serait parfait.`;
}

export interface ConseilCouleur {
  texte: string;
  accord: [string, string];
  pointe: string;
  /** Clé stable de l'accord (cleAccord), sous laquelle son retour est gardé. */
  cle: string;
  pointePresente: boolean;
  adouci: boolean;
}

/** La clé d'un accord : sa saison et sa paire de couleurs, la pointe n'en fait pas partie. */
export const cleAccord = (r: Pick<RegleAssociation, "saison" | "accord">): string => `${r.saison}|${r.accord[0]}+${r.accord[1]}`;

/**
 * Le conseil d'une tenue pour la saison de l'année, ou null. Les accords qui ont déjà leur
 * pointe dans la tenue passent avant ceux qui ne l'ont pas ; à égalité, l'ordre de la table.
 */
export function conseilCouleur(
  pieces: readonly Item[],
  saisonAnnee: CapsuleSeason,
  colorimetrie: ColorimetrieMoteur | null = null,
  /** Les accords écartés par la personne (« Pas pour moi »), par cleAccord. */
  ecartes: ReadonlySet<string> = new Set()
): ConseilCouleur | null {
  const porte = (nom: string) => pieces.some((p) => porteLaCouleur(p, nom));
  const regles = REGLES_ASSOCIATION.filter((r) => r.saison === saisonAnnee && !ecartes.has(cleAccord(r)));
  const candidats = regles
    .filter((r) => r.accord.every(porte))
    .map((r) => ({ r, pointePresente: porte(r.pointe) }))
    .sort((x, y) => Number(y.pointePresente) - Number(x.pointePresente));
  const choix = candidats[0];
  if (!choix) return null;
  // Adouci : une des deux couleurs est à doser pour la personne ET se porte près du visage dans cette tenue.
  const adouci = !!colorimetrie && pieces.some((p) => {
    if (!estPresDuVisage(p)) return false;
    const t = teinteDe(p);
    return !!t && colorimetrie.loinDuVisage.has(t) && choix.r.accord.some((n) => porteLaCouleur(p, n));
  });
  return { texte: phraseDe(choix.r, choix.pointePresente, adouci), accord: choix.r.accord, pointe: choix.r.pointe, cle: cleAccord(choix.r), pointePresente: choix.pointePresente, adouci };
}

