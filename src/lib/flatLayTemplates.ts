import type { CategoryKey } from "./types";
import type { Ref, RoleFlatLay } from "./flatLay";

/*
 * LES SIX TEMPLATES DU FLAT LAY (13/10/2026, brief « moteur de composition automatique des flat lays », validé par la propriétaire :
 * « ajout des six templates au-dessus du moteur existant, avec conservation du moteur actuel comme fallback »).
 *
 * RESPONSABILITÉS, pour ne rien dupliquer :
 *   · flatLay.ts (inchangé dans son principe) — LE MOTEUR : rôles (attribuerRoles), échelle par catégorie (PART_VISUELLE), collisions
 *     (desserrer), marges, graine déterministe, ajustement à la zone. Un template n'y change QUE les positions de référence.
 *   · flatLayTemplates.ts (ce fichier) — QUEL gabarit pour quelles pièces (`choisirTemplate`, hiérarchie configurable) et OÙ chaque rôle se pose
 *     (`GABARITS_TEMPLATES`), plus les corrections ponctuelles (`CORRECTIONS_PIECES`). Aucun calcul de taille, de chevauchement ni d'aléa.
 *   · FlatLayCapsela.tsx — passe le template choisi au moteur ; aucune règle de placement.
 *   · compositionEditoriale.ts / OutfitComposition.tsx — l'autre planche (agenda, valise, avis) : NON concernée, inchangée.
 *
 * UN TEMPLATE N'EST PAS UN CONTEXTE MÉTIER : il ne change ni la tenue, ni les pièces, ni les recommandations ; il ne fait que poser les
 * mêmes pièces autrement. Aucune pièce absente de la tenue n'est ajoutée. Sans template adapté (`choisirTemplate` rend null), ou pour un
 * contexte sans gabarit, le moteur actuel compose seul — exactement comme avant.
 *
 * COORDONNÉES : x et y sont des parts de la LARGEUR de la zone, y compté sur un carré de 100 (le moteur ajoute le décalage de hauteur du
 * contexte, puis ajuste la composition à la zone) ; `l` est la largeur de la partie visible de la pièce de référence de son rôle.
 */

export type TemplateFlatLay = "haut-bas-veste" | "robe" | "combinaison" | "veste-dominante" | "blazer-chic" | "minimaliste";

/** Les six templates, dans l'ordre de la maquette « Les templates de composition » (1 à 6) — des identifiants de conception, pas des règles métier. */
export const TEMPLATES: readonly TemplateFlatLay[] = ["haut-bas-veste", "robe", "combinaison", "veste-dominante", "blazer-chic", "minimaliste"];

/**
 * LA HIÉRARCHIE DE SÉLECTION — configurable : le premier template dont la condition est vraie l'emporte. Elle tranche les ambiguïtés :
 *   1. robe, 2. combinaison : la pièce unique décide, quoi qu'il y ait autour (une surcouche devient le second plan) ;
 *   3. blazer-chic AVANT veste-dominante : un blazer avec un haut, des chaussures ET un sac est le look éditorial chic complet, même avec un
 *      bas (le bas est alors intégré, pas exigé) ; sans sac ou sans chaussures, ce n'est pas ce look ;
 *   4. veste-dominante : une veste structurée (blazer, tailleur, manteau) et au moins deux autres vêtements ;
 *   5. haut-bas-veste : une veste plus légère (jean, bomber, surchemise) avec un haut ET un bas ;
 *   6. minimaliste : deux ou trois pièces, sans pièce dominante.
 * Un seul template par tenue ; aucun ne double une autre.
 */
export const HIERARCHIE_TEMPLATES: readonly TemplateFlatLay[] = ["robe", "combinaison", "blazer-chic", "veste-dominante", "haut-bas-veste", "minimaliste"];

export interface PieceTemplate {
  cat: CategoryKey | string;
  subtype?: string | null;
  name?: string | null;
}

const BAS: string[] = ["pantalon", "jean", "jupe", "short"];
const HAUTS: string[] = ["haut", "pull"];
const DESSUS: string[] = ["veste", "manteau"];
const VETEMENTS: string[] = [...HAUTS, ...BAS, ...DESSUS, "robe", "combinaison"];
const CONNUES: string[] = [...VETEMENTS, "chaussures", "sac", "bijou", "accessoire"];

const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** Un blazer, ou un tailleur : la veste qui structure une tenue (lue sur son sous-type puis son nom — jamais sur la couleur ni la personne). */
export function estBlazer(p: PieceTemplate): boolean {
  return p.cat === "veste" && /blazer|tailleur/.test(sansAccent(`${p.subtype ?? ""} ${p.name ?? ""}`));
}

const CONDITIONS: Record<TemplateFlatLay, (pieces: PieceTemplate[]) => boolean> = {
  robe: (ps) => ps.some((p) => p.cat === "robe"),
  combinaison: (ps) => ps.some((p) => p.cat === "combinaison"),
  "blazer-chic": (ps) =>
    ps.some(estBlazer) && ps.some((p) => HAUTS.includes(p.cat)) && ps.some((p) => p.cat === "chaussures") && ps.some((p) => p.cat === "sac"),
  "veste-dominante": (ps) => {
    const structuree = ps.some((p) => estBlazer(p) || p.cat === "manteau");
    const autres = ps.filter((p) => VETEMENTS.includes(p.cat) && !DESSUS.includes(p.cat)).length;
    return structuree && autres >= 2;
  },
  "haut-bas-veste": (ps) => ps.some((p) => DESSUS.includes(p.cat)) && ps.some((p) => HAUTS.includes(p.cat)) && ps.some((p) => BAS.includes(p.cat)),
  minimaliste: (ps) => ps.length >= 2 && ps.length <= 3 && !ps.some((p) => DESSUS.includes(p.cat)),
};

/**
 * Le template d'une tenue, ou null (repli : le moteur actuel). Déterministe : ne dépend que des catégories (et, pour reconnaître un blazer,
 * du sous-type et du nom). Une catégorie inconnue n'est comptée nulle part : elle ne casse rien et n'ouvre aucun template.
 */
export function choisirTemplate(pieces: readonly PieceTemplate[], hierarchie: readonly TemplateFlatLay[] = HIERARCHIE_TEMPLATES): TemplateFlatLay | null {
  // Une catégorie inconnue n'est comptée nulle part : la tenue se juge sur les pièces que le moteur sait poser.
  const ps = pieces.filter((p) => CONNUES.includes(p.cat));
  for (const t of hierarchie) if (CONDITIONS[t](ps)) return t;
  return null;
}

export type GabaritTemplate = Partial<Record<RoleFlatLay, Ref>>;

/**
 * Où se pose chaque RÔLE, par template (rôles de flatLay.ts : hero = la pièce héro — robe, combinaison, manteau, veste, sinon le bas ou le haut —,
 * secondaire = le haut sous une veste ou la surcouche d'une robe, bas, chaussures, sac, couche, accessoire). Un rôle absent d'un template
 * retombe sur le gabarit du contexte. ARBITRAGE ÉDITORIAL : ces emplacements, à valider en rendu réel (docs/flat-lay.md).
 */
export const GABARITS_TEMPLATES: Record<TemplateFlatLay, GabaritTemplate> = {
  // 1 — haut + bas + veste : le haut en haut à gauche, le bas dessous au centre, la veste derrière avec un décalage latéral.
  "haut-bas-veste": {
    secondaire: { x: 26, y: 24, l: 44, angle: 0 },
    hero: { x: 70, y: 28, l: 50, angle: 0 },
    bas: { x: 46, y: 78, l: 40, angle: 0 },
    chaussures: { x: 82, y: 96, l: 32, angle: 0 },
    sac: { x: 16, y: 92, l: 28, angle: 0 },
  },
  // 2 — robe : dominante, au centre ; chaussures en bas ; sac sur un côté ; surcouche derrière.
  robe: {
    hero: { x: 50, y: 46, l: 56, angle: 0 },
    secondaire: { x: 80, y: 26, l: 38, angle: 0 },
    chaussures: { x: 36, y: 96, l: 34, angle: 0 },
    sac: { x: 84, y: 76, l: 28, angle: 0 },
  },
  // 3 — combinaison : centrée et dominante, la silhouette entière ; chaussures en bas, sac sur un côté.
  combinaison: {
    hero: { x: 50, y: 48, l: 50, angle: 0 },
    secondaire: { x: 82, y: 26, l: 36, angle: 0 },
    chaussures: { x: 32, y: 96, l: 32, angle: 0 },
    sac: { x: 84, y: 78, l: 28, angle: 0 },
  },
  // 4 — veste structurée dominante : au centre et à l'arrière, grande ; le haut à gauche et le bas à droite restent identifiables.
  "veste-dominante": {
    hero: { x: 52, y: 38, l: 60, angle: 0 },
    secondaire: { x: 22, y: 34, l: 34, angle: 0 },
    bas: { x: 70, y: 72, l: 36, angle: 0 },
    chaussures: { x: 28, y: 90, l: 30, angle: 0 },
    sac: { x: 86, y: 94, l: 24, angle: 0 },
  },
  // 5 — blazer + haut + chaussures + sac (+ bas, + accessoires) : le blazer à l'arrière et décalé sur un côté, le haut au premier plan du côté
  // opposé, les chaussures en bas, le sac en bas sur le côté — jamais sur un vêtement. Un bas, s'il y en a un, prend le centre bas.
  "blazer-chic": {
    hero: { x: 70, y: 26, l: 52, angle: 0 },
    secondaire: { x: 28, y: 32, l: 44, angle: 0 },
    bas: { x: 48, y: 80, l: 38, angle: 0 },
    chaussures: { x: 18, y: 98, l: 30, angle: 0 },
    sac: { x: 86, y: 94, l: 26, angle: 0 },
  },
  // 6 — minimaliste : deux ou trois pièces au centre, beaucoup d'air ; chaussures et sac dans l'espace libre, sans grossir.
  minimaliste: {
    hero: { x: 50, y: 56, l: 38, angle: 0 },
    secondaire: { x: 50, y: 24, l: 38, angle: 0 },
    chaussures: { x: 50, y: 90, l: 28, angle: 0 },
    sac: { x: 82, y: 58, l: 22, angle: 0 },
  },
};

/** Ce qu'un template change du réglage du contexte, en plus des emplacements. */
export const REGLAGES_TEMPLATES: Partial<Record<TemplateFlatLay, { agrandissementMax?: number }>> = {
  // « Ne pas agrandir artificiellement les pièces pour remplir le canevas » : jamais d'agrandissement, la composition garde son air.
  minimaliste: { agrandissementMax: 1 },
};

/**
 * CORRECTIONS PONCTUELLES, par identifiant de pièce : quand un article rend mal dans le gabarit générique. Tous les champs sont facultatifs ;
 * le tableau est vide aujourd'hui, local au code (aucune migration, aucune donnée) et s'ajuste ici, à la main.
 *   echelle : multiplie la largeur de la pièce (1 = inchangée) ; dx, dy : décalage en parts de la largeur de la zone ;
 *   z : profondeur imposée. Appliquées seulement quand un template est utilisé : sans template, rien ne change.
 */
export interface CorrectionPiece {
  echelle?: number;
  dx?: number;
  dy?: number;
  z?: number;
}
export const CORRECTIONS_PIECES: Record<number, CorrectionPiece> = {};
