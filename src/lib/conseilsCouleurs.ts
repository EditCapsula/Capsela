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
 * ARBITRAGE ÉDITORIAL : les dix accords d'automne ci-dessous sont des choix de style, pas une
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
};

const A = (accord: [string, string], pointe: string): RegleAssociation => ({ saison: "Automne", accord, pointe });

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
];

const hex = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)?.[1];

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const de = (libelle: string) => (/^l'/.test(libelle) ? `d'${libelle.slice(2)}` : `de ${libelle.replace(/^(le|la) /, "")}`);

/** La phrase d'une règle. `pointePresente` : la touche figure déjà dans la tenue. `adouci` : une couleur est à doser. */
export function phraseDe(r: RegleAssociation, pointePresente: boolean, adouci: boolean): string {
  const [a, b] = r.accord.map((n) => LIBELLES[n] ?? n.toLowerCase());
  const pointe = de(LIBELLES[r.pointe] ?? r.pointe.toLowerCase());
  const saison = r.saison.toLowerCase();
  if (adouci) {
    return pointePresente
      ? `${maj(a)}, ${b} et une pointe ${pointe} : un accord d'${saison}, à porter plutôt en touches près du visage.`
      : `${maj(a)} et ${b} : un accord d'${saison}, à porter plutôt en touches près du visage.`;
  }
  return pointePresente
    ? `${maj(a)} et ${b}, avec une pointe ${pointe} : c'est parfait pour l'${saison}.`
    : `${maj(a)} et ${b} ensemble, c'est top pour l'${saison}. Avec une pointe ${pointe}, ce serait parfait.`;
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
  const teintes = new Set<string>();
  for (const p of pieces) { const t = teinteDe(p); if (t) teintes.add(t); }
  const regles = REGLES_ASSOCIATION.filter((r) => r.saison === saisonAnnee && !ecartes.has(cleAccord(r)));
  const candidats = regles
    .filter((r) => r.accord.every((n) => { const h = hex(n); return !!h && teintes.has(h); }))
    .map((r) => ({ r, pointePresente: teintes.has(hex(r.pointe) ?? "") }))
    .sort((x, y) => Number(y.pointePresente) - Number(x.pointePresente));
  const choix = candidats[0];
  if (!choix) return null;
  // Adouci : une des deux couleurs est à doser pour la personne ET se porte près du visage dans cette tenue.
  const adouci = !!colorimetrie && pieces.some((p) => {
    if (!estPresDuVisage(p)) return false;
    const t = teinteDe(p);
    return !!t && colorimetrie.loinDuVisage.has(t) && choix.r.accord.some((n) => hex(n) === t);
  });
  return { texte: phraseDe(choix.r, choix.pointePresente, adouci), accord: choix.r.accord, pointe: choix.r.pointe, cle: cleAccord(choix.r), pointePresente: choix.pointePresente, adouci };
}

