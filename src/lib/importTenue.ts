import { aDesManches } from "./manches";
import { accessoireTypeFor } from "./attributes";
import { ACCESSOIRE_TYPES, BIJOU_TYPES, CATS, SAC_TYPES, SHOE_TYPES, SUBTYPES } from "./data";
import { seasonDepuisSaisons } from "./saisons";
import type { AccessoireType, BijouType, CapsuleSeason, CategoryKey, Item, Manches, Matiere, SacType, ShoeType } from "./types";


/*
 * IMPORTER UNE TENUE (10/10/2026, option B) — la partie pure de l'écran : le brouillon de chaque objet repéré, ce qui le rend
 * complet, ce qui est créé. La fonction Edge `importer-tenue` rend les objets ; rien n'entre dans le dressing sans l'accord de
 * la personne, et seule une pièce COCHÉE ET COMPLÈTE est créée. Voir docs/importer-tenue.md.
 */

/** Un objet tel que le rend la fonction Edge (forme de `ObjetTenue` côté serveur + l'URL de son fichier). */
export interface ObjetRepere {
  nom: string;
  cat: CategoryKey;
  sousType?: string;
  shoeType?: string;
  sacType?: string;
  bijouType?: string;
  accessoireType?: string;
  couleur: { nom: string; hex: string };
  couleurLue: boolean;
  matiere?: string;
  manches?: Manches;
  photo_url: string;
}

/** Ce que la personne voit et modifie pour un objet. */
export interface BrouillonPiece {
  /** Position dans la lecture, stable : sert de clé. */
  cle: number;
  nom: string;
  cat: CategoryKey;
  /** Le modèle : sous-type, type de chaussure, de sac, de bijou ou d'accessoire selon la catégorie. */
  type: string;
  couleur: { nom: string; hex: string };
  /** false : la couleur n'a pas été lue, elle n'est pas présentée comme détectée. */
  couleurLue: boolean;
  matiere?: string;
  manches: Manches | null;
  /** Jamais présélectionnées, jamais déduites : la personne choisit. */
  saisons: CapsuleSeason[];
  photoUrl: string;
  coche: boolean;
}

/** Les modèles proposés pour une catégorie (même liste que « Ajouter une pièce »). */
export function modelesDe(cat: CategoryKey): string[] {
  if (cat === "chaussures") return SHOE_TYPES;
  if (cat === "sac") return SAC_TYPES;
  if (cat === "bijou") return BIJOU_TYPES;
  if (cat === "accessoire") return ACCESSOIRE_TYPES;
  return SUBTYPES[cat] ?? [];
}

const typeLu = (o: ObjetRepere): string =>
  (o.cat === "chaussures" ? o.shoeType : o.cat === "sac" ? o.sacType : o.cat === "bijou" ? o.bijouType : o.cat === "accessoire" ? o.accessoireType : o.sousType) ?? "";

/** Les objets rendus par le serveur, en brouillons : tous cochés, aucune saison. */
export function brouillonsDepuis(objets: ObjetRepere[]): BrouillonPiece[] {
  return objets.map((o, i) => ({
    cle: i,
    nom: o.nom,
    cat: o.cat,
    type: modelesDe(o.cat).includes(typeLu(o)) ? typeLu(o) : "",
    couleur: o.couleur,
    couleurLue: o.couleurLue,
    matiere: o.matiere,
    manches: aDesManches(o.cat) ? o.manches ?? null : null,
    saisons: [],
    photoUrl: o.photo_url,
    coche: true,
  }));
}

/** Changer de catégorie : le modèle et les manches d'avant ne valent plus. */
export function changerCategorie(b: BrouillonPiece, cat: CategoryKey): BrouillonPiece {
  if (cat === b.cat) return b;
  return { ...b, cat, type: "", manches: aDesManches(cat) ? b.manches : null };
}

export type Manque = "modele" | "manches" | "saisons";

/** Ce qui manque à une pièce pour être créée (dans l'ordre où l'écran le demande). Vide : elle est complète. */
export function manquesDe(b: BrouillonPiece): Manque[] {
  const m: Manque[] = [];
  // Comme « Ajouter une pièce » (R-B6) : une chaussure sans type n'est pas enregistrée.
  if (b.cat === "chaussures" && !b.type) m.push("modele");
  if (aDesManches(b.cat) && !b.manches) m.push("manches");
  if (b.saisons.length === 0) m.push("saisons");
  return m;
}

/** « Précise les saisons » — la phrase de la ligne d'une carte incomplète, sans rouge. */
export function phraseManque(m: Manque[]): string | null {
  if (m.length === 0) return null;
  if (m.length > 1) return "Précise les détails";
  return m[0] === "saisons" ? "Précise les saisons" : m[0] === "manches" ? "Précise les manches" : "Précise le modèle";
}

/** Pièces qui seront créées : cochées ET complètes. */
export function aCreer(bs: BrouillonPiece[]): BrouillonPiece[] {
  return bs.filter((b) => b.coche && manquesDe(b).length === 0);
}

/**
 * Le message sous le bouton quand une pièce cochée est incomplète : « Précise les saisons de [nom] pour l'ajouter. »
 * null quand toutes les pièces cochées sont complètes.
 */
export function messageIncomplet(bs: BrouillonPiece[]): string | null {
  const b = bs.find((x) => x.coche && manquesDe(x).length > 0);
  if (!b) return null;
  const m = manquesDe(b);
  const quoi = m.length > 1 ? "les détails" : m[0] === "saisons" ? "les saisons" : m[0] === "manches" ? "les manches" : "le modèle";
  return `Précise ${quoi} de ${b.nom || "cette pièce"} pour l'ajouter.`;
}

/** Dans un dressing gratuit : au plus `places` cases cochées. `null` : aucune limite à appliquer. */
export function limiterAuxPlaces(bs: BrouillonPiece[], places: number | null): BrouillonPiece[] {
  if (places === null) return bs;
  let reste = places;
  return bs.map((b) => {
    if (!b.coche) return b;
    if (reste > 0) {
      reste -= 1;
      return b;
    }
    return { ...b, coche: false };
  });
}

/** Cocher une case de plus est permis tant que les places le permettent. */
export function peutCocher(bs: BrouillonPiece[], places: number | null): boolean {
  return places === null || bs.filter((b) => b.coche).length < places;
}

/** Plus d'objets cochés que de places : l'écran le dit et propose Premium. */
export function depasseLesPlaces(nbObjets: number, places: number | null): boolean {
  return places !== null && nbObjets > places;
}

/** La pièce telle qu'elle entre au dressing (même forme que celle de `saveItem`). */
export function pieceDepuis(b: BrouillonPiece): Omit<Item, "id"> {
  const nom = b.nom.trim() || "Nouvelle pièce";
  return {
    name: nom,
    cat: b.cat,
    color: b.couleur.nom,
    hex: b.couleur.hex,
    season: seasonDepuisSaisons(b.saisons),
    saisons: b.saisons,
    manches: aDesManches(b.cat) ? b.manches ?? undefined : undefined,
    shoeType: b.cat === "chaussures" ? ((b.type || undefined) as ShoeType | undefined) : undefined,
    sacType: b.cat === "sac" ? ((b.type || undefined) as SacType | undefined) : undefined,
    bijouType: b.cat === "bijou" ? ((b.type || undefined) as BijouType | undefined) : undefined,
    accessoireType: accessoireTypeFor(b.cat, (b.cat === "accessoire" ? b.type || null : null) as AccessoireType | null, nom),
    subtype: !["chaussures", "sac", "bijou", "accessoire"].includes(b.cat) ? b.type || undefined : undefined,
    matiere: b.matiere as Matiere | undefined,
    photoUrl: b.photoUrl,
    worn: null,
  };
}

export const libelleCategorie = (cat: CategoryKey): string => CATS.find(([c]) => c === cat)?.[1] ?? cat;

/** « 3 pièces » / « 1 pièce ». */
export const nPieces = (n: number): string => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
