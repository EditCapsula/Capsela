// La lecture d'un ticket de caisse (30/10/2026, demandé : « ajouter des pièces depuis un ticket de caisse », le nom du magasin dans
// « Marque » — arbitré par la propriétaire le même jour).
//
// Le ticket est lu pour préremplir des fiches de pièces, et rien d'autre : le nom du magasin, puis chaque VÊTEMENT ou accessoire acheté —
// un nom lisible, sa catégorie, sa taille et sa couleur quand le ticket les écrit. Jamais le prix, la date, le moyen de paiement ni un
// numéro de carte : la consigne les exclut, et le lecteur ne garde que les champs ci-dessous. Toute valeur hors des listes fermées est
// écartée ; une réponse inutilisable donne un ticket vide, et l'app propose de saisir les pièces à la main.
//
// Module pur (aucun accès à Deno) : testé côté app (src/lib/__tests__/lectureTicket.test.ts).

import { ACCESSOIRE_TYPES, aUnMotif, BIJOU_TYPES, CATEGORY_KEYS, MOTIFS, PALETTE, SAC_TYPES, SHOE_TYPES, SUBTYPES, type CategoryKey, type Motif } from "./enumsPiece.ts";

/*
 * LE PRÉREMPLISSAGE ENRICHI (06/11/2026, brief « Optimisation UX/UI du parcours d'ajout… », partie 3). Le ticket ne donnait que le nom,
 * la catégorie, la taille et la couleur ; il donne aussi, quand le libellé, la référence ou la connaissance de l'enseigne l'établissent,
 * le MODÈLE, les MANCHES, le MOTIF et les SAISONS — les champs déjà présents dans le formulaire, avec leurs seules valeurs permises.
 * Rien d'inventé : une valeur incertaine reste null (ou vide pour les saisons), le champ reste à remplir. Les saisons viennent de la
 * nature du vêtement, jamais de la date d'achat. Le nom n'a qu'une majuscule, la première (convention de l'app).
 */

/** Les modèles d'une catégorie : les mêmes listes que le formulaire (modelesDe, importTenue.ts). */
export function modelesDeLaCategorie(cat: CategoryKey): readonly string[] {
  if (cat === "chaussures") return SHOE_TYPES;
  if (cat === "sac") return SAC_TYPES;
  if (cat === "bijou") return BIJOU_TYPES;
  if (cat === "accessoire") return ACCESSOIRE_TYPES;
  return SUBTYPES[cat] ?? [];
}
/** Catégories à manches — synchronisée avec CATEGORIES_A_MANCHES (src/lib/manches.ts), comme analyseTenue.ts. */
const CATEGORIES_A_MANCHES: readonly CategoryKey[] = ["haut", "pull", "robe", "combinaison", "veste", "manteau"];
const MANCHES = ["sans", "courtes", "trois_quarts", "longues"] as const;
export type MancheLue = (typeof MANCHES)[number];
const SAISONS = ["Printemps", "Été", "Automne", "Hiver"] as const;

/** « BLOUSON CUIR CEINTURÉ », « Blouson Cuir Ceinturé » → « Blouson cuir ceinturé » : seule la première lettre en majuscule. */
export function nomAvecUneMajuscule(nom: string): string {
  const bas = nom.toLocaleLowerCase("fr-FR");
  return bas.charAt(0).toLocaleUpperCase("fr-FR") + bas.slice(1);
}

export const ARTICLES_MAX = 30;
const NOM_MAX = 60;
const MAGASIN_MAX = 40;

export interface ArticleLu {
  /** Un nom lisible (« T-shirt blanc »), tiré du libellé du ticket ; à vérifier dans la fiche. */
  nom: string;
  categorie: (typeof CATEGORY_KEYS)[number] | null;
  /** Taille ou pointure, telle qu'écrite (« M », « 38 ») ; null si le ticket ne la donne pas. */
  taille: string | null;
  /** Un nom de la palette de l'app ; null si le ticket ne dit pas la couleur. */
  couleur: string | null;
  /** Le modèle (sous-type, type de chaussure, de sac…) parmi ceux de la catégorie ; null si incertain. */
  modele: string | null;
  /** Les manches, pour une catégorie qui en a ; null si incertain. */
  manches: MancheLue | null;
  /** Le motif (jamais pour un bijou) ; null si incertain. */
  motif: Motif | null;
  /** Les saisons d'après la nature du vêtement, dans l'ordre de l'année ; vide si incertain. */
  saisons: string[];
}

export interface TicketLu {
  magasin: string | null;
  articles: ArticleLu[];
}

export function inviteTicket(): string {
  return [
    "Tu lis la photo d'un ticket de caisse pour une application de garde-robe.",
    "Relève : le nom du magasin (l'enseigne), puis chaque VÊTEMENT, chaussure, sac, bijou ou accessoire de mode acheté.",
    "Ignore tout le reste : produits non vestimentaires, sacs de caisse, remises, totaux, prix, date, heure, moyen de paiement, numéros.",
    "Ne recopie JAMAIS un numéro de carte, de compte, de fidélité ou de transaction.",
    "Identifie chaque vêtement : ne te limite pas à recopier le libellé. Sers-toi du libellé, des abréviations usuelles de l'enseigne,",
    "et de la référence produit quand elle permet de reconnaître l'article de cette enseigne avec certitude. Ne recopie jamais la référence.",
    "Distingue ce qui est écrit, ce qui se déduit avec une vraie fiabilité (un « jean » est en denim, une « doudoune » a des manches longues),",
    "et ce qui ne peut pas se savoir : dans ce dernier cas, null. Ne choisis JAMAIS une valeur pour remplir un champ.",
    "Pour chaque article :",
    "- nom : un nom court et lisible en français, avec SEULEMENT la première lettre en majuscule (« Blouson cuir ceinturé », jamais",
    "  « BLOUSON CUIR CEINTURÉ » ni « Blouson Cuir Ceinturé ») ; « TSHIRT MC BCO » devient « T-shirt manches courtes blanc » ;",
    "  n'invente pas de détail que le libellé ou la référence n'établissent pas ;",
    `- categorie : EXACTEMENT parmi ${CATEGORY_KEYS.join(", ")} ; null si tu ne peux pas trancher ;`,
    "- modele : EXACTEMENT une valeur de la liste de sa catégorie, sinon null :",
    ...CATEGORY_KEYS.filter((c) => modelesDeLaCategorie(c).length).map((c) => `    ${c} : ${modelesDeLaCategorie(c).join(", ")}`),
    "- taille : la taille ou la pointure écrite sur le ticket (XS, S, M, L, XL, 36, 38…), sinon null ;",
    `- couleur : EXACTEMENT parmi ${PALETTE.map(([n]) => n).join(", ")} ; seulement si le libellé ou la référence établissent la couleur, sinon null ;`,
    `- manches : pour ${CATEGORIES_A_MANCHES.join(", ")} seulement, EXACTEMENT parmi sans, courtes, trois_quarts, longues (MC = courtes, ML = longues) ; sinon null ;`,
    `- motif : sauf pour un bijou, EXACTEMENT parmi ${MOTIFS.join(", ")} (rayé = rayures, imprimé fleuri = fleurs, « uni » seulement si c'est écrit ou certain), sinon null ;`,
    "- saisons : les saisons où ce vêtement se porte, parmi Printemps, Été, Automne, Hiver, D'APRÈS SA NATURE (matière, épaisseur, type :",
    "  doudoune ou manteau en laine : Automne, Hiver ; débardeur en lin : Printemps, Été) — JAMAIS d'après la date d'achat ; [] si incertain.",
    "Un article acheté en plusieurs exemplaires identiques ne compte qu'une fois.",
    'Réponds en JSON : {"magasin": "..." ou null, "articles": [{"nom": "...", "categorie": "...", "modele": "...", "taille": "...", "couleur": "...", "manches": "...", "motif": "...", "saisons": ["..."]}]}.',
    "Si la photo n'est pas un ticket de caisse lisible : {\"magasin\": null, \"articles\": []}.",
  ].join("\n");
}

const texte = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s && s.length <= max && !/\d{6,}/.test(s.replace(/\s/g, "")) ? s : null;
};

/** La réponse du modèle, réduite aux champs gardés. Un nom qui contient une longue suite de chiffres est écarté (jamais un numéro). */
export function ticketLu(reponse: unknown): TicketLu {
  const r = (reponse ?? {}) as { magasin?: unknown; articles?: unknown };
  const magasin = texte(r.magasin, MAGASIN_MAX);
  const articles: ArticleLu[] = [];
  const vus = new Set<string>();
  for (const brut of Array.isArray(r.articles) ? r.articles : []) {
    const a = (brut ?? {}) as Record<string, unknown>;
    const brutNom = texte(a.nom, NOM_MAX);
    if (!brutNom) continue;
    const nom = nomAvecUneMajuscule(brutNom);
    const categorie = typeof a.categorie === "string" && (CATEGORY_KEYS as readonly string[]).includes(a.categorie) ? (a.categorie as CategoryKey) : null;
    const taille = texte(a.taille, 6);
    const couleur = typeof a.couleur === "string" && PALETTE.some(([n]) => n === a.couleur) ? a.couleur : null;
    // Modèle, manches, motif : seulement une valeur permise POUR SA CATÉGORIE ; sans catégorie sûre, rien.
    const modele = categorie && typeof a.modele === "string" && modelesDeLaCategorie(categorie).includes(a.modele) ? a.modele : null;
    const manches = categorie && CATEGORIES_A_MANCHES.includes(categorie) && typeof a.manches === "string" && (MANCHES as readonly string[]).includes(a.manches) ? (a.manches as MancheLue) : null;
    const motif = categorie && aUnMotif(categorie) && typeof a.motif === "string" && (MOTIFS as readonly string[]).includes(a.motif) ? (a.motif as Motif) : null;
    const saisons = categorie && Array.isArray(a.saisons) ? SAISONS.filter((x) => (a.saisons as unknown[]).includes(x)) : [];
    const cle = `${nom.toLowerCase()}|${taille ?? ""}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    articles.push({ nom, categorie, taille, couleur, modele, manches, motif, saisons: [...saisons] });
    if (articles.length >= ARTICLES_MAX) break;
  }
  return { magasin, articles };
}
