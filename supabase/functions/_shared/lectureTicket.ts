// La lecture d'un ticket de caisse (30/10/2026, demandé : « ajouter des pièces depuis un ticket de caisse », le nom du magasin dans
// « Marque » — arbitré par la propriétaire le même jour).
//
// Le ticket est lu pour préremplir des fiches de pièces, et rien d'autre : le nom du magasin, puis chaque VÊTEMENT ou accessoire acheté —
// un nom lisible, sa catégorie, sa taille et sa couleur quand le ticket les écrit. Jamais le prix, la date, le moyen de paiement ni un
// numéro de carte : la consigne les exclut, et le lecteur ne garde que les champs ci-dessous. Toute valeur hors des listes fermées est
// écartée ; une réponse inutilisable donne un ticket vide, et l'app propose de saisir les pièces à la main.
//
// Module pur (aucun accès à Deno) : testé côté app (src/lib/__tests__/lectureTicket.test.ts).

import { CATEGORY_KEYS, PALETTE } from "./enumsPiece.ts";

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
    "Pour chaque article :",
    "- nom : un nom court et lisible en français, déduit du libellé (« TSHIRT MC BCO » devient « T-shirt manches courtes blanc ») ;",
    "  n'invente pas de détail que le libellé ne dit pas ;",
    `- categorie : EXACTEMENT parmi ${CATEGORY_KEYS.join(", ")} ; null si tu ne peux pas trancher ;`,
    "- taille : la taille ou la pointure écrite sur le ticket (XS, S, M, L, XL, 36, 38…), sinon null ;",
    `- couleur : EXACTEMENT parmi ${PALETTE.map(([n]) => n).join(", ")} ; seulement si le libellé dit la couleur, sinon null.`,
    "Un article acheté en plusieurs exemplaires identiques ne compte qu'une fois.",
    'Réponds en JSON : {"magasin": "..." ou null, "articles": [{"nom": "...", "categorie": "...", "taille": "...", "couleur": "..."}]}.',
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
    const nom = texte(a.nom, NOM_MAX);
    if (!nom) continue;
    const categorie = typeof a.categorie === "string" && (CATEGORY_KEYS as readonly string[]).includes(a.categorie) ? (a.categorie as ArticleLu["categorie"]) : null;
    const taille = texte(a.taille, 6);
    const couleur = typeof a.couleur === "string" && PALETTE.some(([n]) => n === a.couleur) ? a.couleur : null;
    const cle = `${nom.toLowerCase()}|${taille ?? ""}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    articles.push({ nom, categorie, taille, couleur });
    if (articles.length >= ARTICLES_MAX) break;
  }
  return { magasin, articles };
}
