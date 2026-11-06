// Le visuel d'un article lu sur un ticket de caisse (06/11/2026, option 2 arbitrée par la propriétaire : « Option 2 »). Un ticket ne
// donne pas de photo, et aucune source autorisée ne rend celle du produit (pas d'API Zara/Inditex, recherche d'images sans droits sur
// les photos) : Capsela GÉNÈRE un visuel indicatif de l'article décrit, avec le moteur des visuels du catalogue (buildImagePrompt :
// même fond, même lumière, même style). Ce n'est jamais présenté comme la photo du produit acheté. docs/visuel-ticket.md.
//
// Module pur (aucun accès à Deno) : testé côté app (src/lib/__tests__/visuelArticle.test.ts).

import { CATEGORY_KEYS, PALETTE } from "./enumsPiece.ts";
import type { VestiaireRow } from "./imagePrompt.ts";

/** Ce qui décrit l'article : son nom lu sur le ticket (corrigé ou non), sa catégorie, sa couleur, le genre du profil. */
export interface ArticleVisuel {
  nom: string;
  categorie: (typeof CATEGORY_KEYS)[number];
  couleur: string | null;
  genre: "femme" | "homme" | null;
}

const NOM_MAX = 60;

/** La demande reçue, réduite à des valeurs sûres ; null si elle ne décrit pas un article (nom vide, catégorie inconnue). */
export function articleValide(brut: unknown): ArticleVisuel | null {
  const o = (brut ?? {}) as Record<string, unknown>;
  const nom = String(o.nom ?? "").replace(/\s+/g, " ").trim();
  const categorie = String(o.categorie ?? "");
  if (!nom || nom.length > NOM_MAX || !(CATEGORY_KEYS as readonly string[]).includes(categorie)) return null;
  const couleur = PALETTE.some(([n]) => n === o.couleur) ? String(o.couleur) : null;
  const genre = o.genre === "femme" || o.genre === "homme" ? o.genre : null;
  return { nom, categorie: categorie as ArticleVisuel["categorie"], couleur, genre };
}

/**
 * La ligne que lit buildImagePrompt. Le nom tient lieu de sous-type : le moteur en tire le mot du vêtement (« pull », « chemise »,
 * « mocassins »…) et ses détails, jamais une interprétation libre ; sans mot reconnu, celui de la catégorie.
 */
export function ligneVestiaire(a: ArticleVisuel): VestiaireRow {
  return {
    id: 0,
    name: a.nom,
    category: a.categorie,
    sous_type: a.nom,
    couleur_dominante: a.couleur,
    matiere: null,
    genre: a.genre ?? "unisexe",
    coupe: null,
  };
}

/** La même description donne la même clé : un visuel déjà créé pour elle est rendu sans nouvelle génération. */
export function cleVisuel(a: ArticleVisuel): string {
  const n = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return [n(a.nom), a.categorie, n(a.couleur), a.genre ?? ""].join("|");
}

/**
 * Le fichier, dans le dossier privé de l'utilisatrice (bucket dressing-photos, comme ses photos). La marque « .detouree. » dit qu'il
 * a déjà un fond transparent : l'import ne le détoure pas une seconde fois (estPhotoDetouree).
 */
export const cheminVisuel = (userId: string, empreinte: string, ext = "webp"): string => `${userId}/visuel-${empreinte}.detouree.${ext}`;
