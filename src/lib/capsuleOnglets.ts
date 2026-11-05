import { huesHarmonious, isStatement, rolePieceOf } from "./attributes";
import { morphologieOrienteLaSelection, styleFit, temperatureDeSaison } from "./capsule";
import { CATS } from "./data";
import { libelleStyles, paletteColorName, paletteHexes, silhouetteForme, STYLE_ID_TO_CATALOG_LABEL, styleLabel, stylesLabels, type Profile, type StyleId } from "./profile";
import { raisonsSuggestion } from "./capsuleEcran";
import { isColRoule } from "./logic";
import type { CapsuleSeason, CategoryKey, Item } from "./types";

/*
 * LES QUATRE ONGLETS DE « MA CAPSULE » (refonte du 01/11/2026, maquettes de la propriétaire : Composer, Explorer, Pièces clés,
 * Détails).
 *
 * Comme capsuleEcran.ts, rien ici ne choisit une pièce de la capsule : `computeDefaultCapsule` le fait et n'est pas touché. Ces
 * fonctions rangent ce qu'il a rendu (et les pièces du dressing de la saison) pour l'afficher, et n'écrivent jamais une phrase
 * qu'une donnée ne rend pas vraie. Pures, donc testées.
 */

/** Une pièce montrée par l'écran : une suggestion de la capsule, ou une pièce du dressing de la saison. */
export interface EntreeCapsule {
  item: Item;
  possedee: boolean;
}

/** Clé d'une entrée, unique même si un identifiant du dressing croise un identifiant du catalogue (favoris, listes React). */
export const cleEntree = (e: EntreeCapsule): string => `${e.possedee ? "d" : "c"}${e.item.id}`;

// ---------------------------------------------------------------------------------------------------------------------------
// COMPOSER
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Les emplacements de la composition, dans l'ordre des tuiles. Un emplacement montre UNE pièce à la fois ; ses flèches ne
 * changent que lui (brief, 3.2 : « les autres catégories conservent leur sélection »).
 *
 * `facultatif` : l'emplacement peut rester vide (« Sans »), position -1. Les hauts, les bas et les chaussures font la silhouette ;
 * la robe la remplace (une robe choisie retire le haut et le bas de la planche, un haut ou un bas choisi retire la robe).
 */
export type CleEmplacement = "haut" | "bas" | "robe" | "maille" | "dessus" | "chaussures" | "sac" | "bijou" | "accessoire";

export interface DefEmplacement {
  cle: CleEmplacement;
  libelle: string;
  cats: CategoryKey[];
  facultatif: boolean;
}

export const EMPLACEMENTS: DefEmplacement[] = [
  { cle: "haut", libelle: "Hauts", cats: ["haut"], facultatif: false },
  { cle: "bas", libelle: "Bas", cats: ["pantalon", "jean", "jupe", "short"], facultatif: false },
  { cle: "robe", libelle: "Robes", cats: ["robe", "combinaison"], facultatif: true },
  { cle: "maille", libelle: "Mailles", cats: ["pull"], facultatif: true },
  { cle: "dessus", libelle: "Vestes", cats: ["veste", "manteau"], facultatif: true },
  { cle: "chaussures", libelle: "Chaussures", cats: ["chaussures"], facultatif: false },
  { cle: "sac", libelle: "Sacs", cats: ["sac"], facultatif: true },
  // Bijoux et accessoires séparés (05/11/2026, demandé : un collier sous la tuile « Accessoires » et ses lunettes prêtait à confusion).
  { cle: "bijou", libelle: "Bijoux", cats: ["bijou"], facultatif: true },
  { cle: "accessoire", libelle: "Accessoires", cats: ["accessoire"], facultatif: true },
];

export const emplacementDe = (cat: CategoryKey): CleEmplacement | null => EMPLACEMENTS.find((e) => e.cats.includes(cat))?.cle ?? null;

/** Les pièces de chaque emplacement : celles du dressing d'abord, puis les suggestions (même ordre que l'écran d'avant). */
export function piecesParEmplacement(entrees: EntreeCapsule[]): Record<CleEmplacement, EntreeCapsule[]> {
  const out = Object.fromEntries(EMPLACEMENTS.map((e) => [e.cle, [] as EntreeCapsule[]])) as Record<CleEmplacement, EntreeCapsule[]>;
  for (const e of [...entrees.filter((x) => x.possedee), ...entrees.filter((x) => !x.possedee)]) {
    const cle = emplacementDe(e.item.cat);
    if (cle) out[cle].push(e);
  }
  return out;
}

/** Position choisie dans chaque emplacement (-1 : « Sans »). */
export type SelectionComposer = Partial<Record<CleEmplacement, number>>;

/*
 * LE COL ROULÉ SE PORTE SEUL (02/11/2026, signalé sur la planche d'automne : un cache-cœur posé sous un col roulé). Composer ne
 * passe pas par le moteur ; il reprend donc ici, telle quelle, la règle arbitrée le 02/10/2026 dans logic.ts (`isColRoule`) : un
 * col roulé fait le haut, un top dessous ne se verrait pas. Limitée au col roulé comme dans le moteur — les autres pulls restent
 * superposables.
 *
 * Le haut devient facultatif (« Sans ») quand un pull qui fait le haut à lui seul est posé : rôle « base » (`rolePieceOf`, la
 * règle R-B9 du moteur depuis le 26/08/2026). Un pull « calque » (cardigan, gilet, maille oversize) garde un haut dessous.
 */

/** Le pull posé sur la planche (aucun si « Sans » ou si une robe remplace le haut et le bas). */
function maillePosee(groupes: Record<CleEmplacement, EntreeCapsule[]>, sel: SelectionComposer): Item | null {
  const p = position(sel, "maille", groupes.maille.length);
  return p >= 0 ? groupes.maille[p].item : null;
}

/** Vrai si l'emplacement peut rester vide dans cette composition : toujours pour un facultatif, pour le haut sous un pull « base ». */
export function emplacementFacultatif(cle: CleEmplacement, groupes: Record<CleEmplacement, EntreeCapsule[]>, sel: SelectionComposer): boolean {
  if (EMPLACEMENTS.find((e) => e.cle === cle)!.facultatif) return true;
  if (cle !== "haut") return false;
  const pull = maillePosee(groupes, sel);
  return pull !== null && rolePieceOf(pull) === "base";
}

/**
 * La composition d'arrivée. ARBITRAGE ÉDITORIAL (01/11/2026) : la première pièce de chaque emplacement indispensable ; la robe
 * seulement s'il manque un haut ou un bas ; la maille en automne et en hiver ; la veste hors été ; le sac et l'accessoire pour
 * finir la tenue, comme sur la maquette. Un col roulé posé d'office arrive sans haut (02/11/2026, ci-dessus).
 */
export function selectionDeDepart(groupes: Record<CleEmplacement, EntreeCapsule[]>, saison: CapsuleSeason): SelectionComposer {
  const froid = saison === "Automne" || saison === "Hiver";
  const aBase = groupes.haut.length > 0 && groupes.bas.length > 0;
  const sel: SelectionComposer = {};
  for (const e of EMPLACEMENTS) {
    if (!groupes[e.cle].length) continue;
    let actif = true;
    if (e.cle === "robe") actif = !aBase;
    if (e.cle === "maille") actif = froid;
    if (e.cle === "dessus") actif = saison !== "Été";
    sel[e.cle] = actif ? 0 : -1;
  }
  const pull = maillePosee(groupes, sel);
  if (pull && isColRoule(pull) && (sel.haut ?? -1) >= 0) sel.haut = -1;
  return sel;
}

/** La position d'un emplacement, bornée à ses pièces (une capsule recalculée peut en avoir moins). */
export function position(sel: SelectionComposer, cle: CleEmplacement, n: number): number {
  const p = sel[cle] ?? -1;
  return p >= n ? n - 1 : p;
}

/** Pièce suivante (pas = 1) ou précédente (-1) d'un emplacement, en boucle ; « Sans » fait partie de la boucle s'il est facultatif. */
export function avancer(sel: SelectionComposer, cle: CleEmplacement, groupes: Record<CleEmplacement, EntreeCapsule[]>, pas: 1 | -1): SelectionComposer {
  const n = groupes[cle].length;
  if (n === 0) return sel;
  const min = emplacementFacultatif(cle, groupes, sel) ? -1 : 0;
  const taille = n - min;
  const actuelle = Math.max(position(sel, cle, n), min);
  const suivante = ((actuelle - min + pas + taille) % taille) + min;
  return exclusivite({ ...sel, [cle]: suivante }, cle, groupes);
}

/**
 * LES FLÈCHES ENCHAÎNENT LES CATÉGORIES (05/11/2026, demandé : « si j'ai fini d'explorer les pièces d'une catégorie je bascule à la
 * suivante »). Tant qu'il reste des pièces dans l'emplacement actif, la flèche les fait défiler, comme `avancer` ; arrivé au bout (la
 * dernière pièce en avançant, la première — ou « Sans » — en reculant), elle active l'emplacement voisin et y montre la pièce
 * suivante, ou la précédente. Les emplacements se parcourent en boucle : après le dernier vient le premier.
 */
export function avancerOuChanger(
  sel: SelectionComposer,
  actif: CleEmplacement,
  presents: readonly CleEmplacement[],
  groupes: Record<CleEmplacement, EntreeCapsule[]>,
  pas: 1 | -1
): { sel: SelectionComposer; actif: CleEmplacement } {
  const n = groupes[actif].length;
  const min = emplacementFacultatif(actif, groupes, sel) ? -1 : 0;
  const actuelle = Math.max(position(sel, actif, n), min);
  const auBout = pas === 1 ? actuelle >= n - 1 : actuelle <= min;
  const i = presents.indexOf(actif);
  if (!auBout || presents.length < 2 || i < 0) return { sel: avancer(sel, actif, groupes, pas), actif };
  const voisin = presents[(i + pas + presents.length) % presents.length];
  return { sel: avancer(sel, voisin, groupes, pas), actif: voisin };
}

/** Place une pièce précise dans son emplacement (« Composer avec cette pièce »), les autres emplacements gardant la leur. */
export function choisir(sel: SelectionComposer, cle: CleEmplacement, index: number, groupes: Record<CleEmplacement, EntreeCapsule[]>): SelectionComposer {
  return exclusivite({ ...sel, [cle]: index }, cle, groupes);
}

/**
 * Ce qui s'exclut, en gardant ce que l'on vient de toucher :
 *   - la robe et le duo haut + bas ;
 *   - le col roulé et le haut (02/11/2026) : poser un col roulé retire le haut, poser un haut retire le col roulé ;
 *   - un haut laissé vide revient dès que plus aucun pull « base » ne le remplace (pull retiré, ou cardigan à sa place).
 */
function exclusivite(sel: SelectionComposer, touche: CleEmplacement, groupes: Record<CleEmplacement, EntreeCapsule[]>): SelectionComposer {
  let out = sel;
  if (touche === "robe" && (out.robe ?? -1) >= 0) return out;
  if ((touche === "haut" || touche === "bas") && (out.robe ?? -1) >= 0) out = { ...out, robe: -1 };
  const pull = maillePosee(groupes, out);
  const hautPose = (out.haut ?? -1) >= 0;
  if (touche === "maille" && pull && isColRoule(pull) && hautPose) out = { ...out, haut: -1 };
  if (touche === "haut" && hautPose && pull && isColRoule(pull)) out = { ...out, maille: -1 };
  if ((out.haut ?? -1) < 0 && groupes.haut.length > 0 && !emplacementFacultatif("haut", groupes, out)) out = { ...out, haut: 0 };
  return out;
}

/** Les pièces posées sur la planche, dans l'ordre des emplacements. Une robe choisie remplace le haut et le bas. */
export function piecesComposees(groupes: Record<CleEmplacement, EntreeCapsule[]>, sel: SelectionComposer): EntreeCapsule[] {
  const robe = position(sel, "robe", groupes.robe.length) >= 0;
  const out: EntreeCapsule[] = [];
  for (const e of EMPLACEMENTS) {
    if (robe && (e.cle === "haut" || e.cle === "bas")) continue;
    const p = position(sel, e.cle, groupes[e.cle].length);
    if (p >= 0) out.push(groupes[e.cle][p]);
  }
  return out;
}

/**
 * « Pourquoi cette tenue ? » de Composer. La composition est faite par l'utilisatrice, pas par le moteur : on ne dit donc que ce
 * que les données de SES pièces rendent vrai, sans score ni compatibilité inventés (brief, 3.4). Aucune raison : la zone ne
 * s'affiche pas.
 *   - style : toutes les pièces vêtements sont dans un style du profil (`styleFit`, le filtre de la capsule) ;
 *   - palette : les pièces dont la teinte exacte est une couleur choisie du profil ;
 *   - couleurs : chaque paire de pièces principales (haut, bas, robe, maille, veste) a des teintes voisines ou complémentaires
 *     (`huesHarmonious`, la règle d'harmonie du moteur) ;
 *   - indispensables : au moins deux pièces indispensables (`estBasiqueCapsule`).
 */
export function raisonsComposition(pieces: Item[], profile: Profile): string[] {
  const raisons: string[] = [];
  const vetements = pieces.filter((it) => !["chaussures", "sac", "bijou", "accessoire"].includes(it.cat));
  const style = (profile.styles || []).find((id) => {
    const libelle = STYLE_ID_TO_CATALOG_LABEL[id as StyleId];
    return libelle && vetements.length > 0 && vetements.every((it) => styleFit(it, libelle));
  });
  if (style) raisons.push(`Toutes ses pièces sont dans ton style ${styleLabel(style, profile.gender)}.`);
  const palette = new Set(paletteHexes(profile).map((h) => h.toLowerCase()));
  const dansPalette = pieces.filter((it) => palette.has(it.hex.toLowerCase())).length;
  if (dansPalette > 0) raisons.push(dansPalette > 1 ? `${dansPalette} pièces aux couleurs de ta palette.` : "Une pièce aux couleurs de ta palette.");
  if (vetements.length >= 2 && vetements.every((a, i) => vetements.slice(i + 1).every((b) => huesHarmonious(a.hex, b.hex)))) {
    raisons.push("Des couleurs voisines ou complémentaires, qui s'accordent.");
  }
  const indispensables = pieces.filter((it) => it.estBasiqueCapsule).length;
  if (indispensables >= 2) raisons.push(`Construite sur ${indispensables} indispensables, faciles à associer.`);
  return raisons;
}

/*
 * « UNE SÉLECTION PENSÉE POUR TOI » (05/11/2026, brief « Évolution UX/UI – Onglet Composer ») : remplace « Pourquoi cette tenue ? »,
 * dont l'intitulé laissait croire à une tenue complète. Le panneau dit ce qui a RÉELLEMENT orienté la sélection de la capsule
 * (`computeDefaultCapsule`, capsule.ts), et seulement ce qui s'applique à ce profil :
 *
 *   · le style — la capsule retient en priorité les pièces du catalogue associées à ses styles (repli sur tout le catalogue sous 18) ;
 *   · les couleurs — la palette DÉCLARÉE (couleurs, ton, intensité), via `paletteFit`. PAS la colorimétrie : le questionnaire de
 *     colorimétrie oriente les tenues (colorimetrieMoteur.ts), jamais la sélection de la capsule ; l'écrire ici serait faux ;
 *   · la saison — pièces déclarées pour elle (ou toutes saisons), adaptées à sa température représentative ;
 *   · la silhouette — seulement si elle oriente la sélection (`morphologieOrienteLaSelection`, la même liste que le moteur) ;
 *   · le dressing — les chiffres réels des pièces montrées.
 */
export interface CritereSelection {
  cle: "style" | "couleurs" | "saison" | "silhouette" | "dressing";
  titre: string;
  valeur: string;
  texte: string;
}

/** « adaptées à l'automne », « au printemps » : la préposition et l'article de chaque saison (textes du 05/11/2026). */
const A_LA_SAISON: Record<CapsuleSeason, string> = { Printemps: "au printemps", Été: "à l'été", Automne: "à l'automne", Hiver: "à l'hiver" };

export function criteresDeSelection(p: {
  profile: Profile;
  /** Le style exploré (« Aperçu du style … »), sinon null : la capsule est alors celle d'un autre style. */
  styleExplore: string | null;
  saison: CapsuleSeason;
  possedees: number;
  suggestions: number;
}): CritereSelection[] {
  const { profile, styleExplore, saison } = p;
  const out: CritereSelection[] = [];
  const styles = styleExplore ? [styleExplore] : profile.styles || [];
  const libelle = libelleStyles(styles, profile.gender);
  if (libelle) {
    out.push({
      cle: "style",
      titre: styleExplore ? "Le style exploré" : stylesLabels(styles, profile.gender).length > 1 ? "Tes styles" : "Ton style",
      valeur: libelle,
      texte:
        (styleExplore ? "Un aperçu d'un autre style que le tien. " : "") +
        "Des pièces sélectionnées en priorité dans tes univers de style. Si nécessaire, la sélection s'ouvre à d'autres styles pour composer une capsule suffisamment variée.",
    });
  }
  const noms = paletteHexes(profile).map(paletteColorName).filter((n): n is string => Boolean(n));
  if (noms.length || profile.paletteAffinite || profile.paletteIntensite) {
    out.push({
      cle: "couleurs",
      titre: "Ta palette",
      valeur: noms.length ? noms.slice(0, 4).join(", ") + (noms.length > 4 ? ` et ${noms.length - 4} autre${noms.length > 5 ? "s" : ""}` : "") : "Tes préférences de ton et d'intensité",
      texte:
        "Tes préférences de couleurs guident la sélection. Les pièces aux nuances ou intensités moins adaptées à ta palette sont écartées lorsque le catalogue le permet.",
    });
  }
  out.push({
    cle: "saison",
    titre: "La saison",
    valeur: `${saison} · Environ ${temperatureDeSaison(saison)} °C`,
    texte: `Des pièces adaptées ${A_LA_SAISON[saison]}, privilégiant celles prévues pour cette saison ou portables toute l'année.`,
  });
  if (!styleExplore && morphologieOrienteLaSelection(profile.morphology)) {
    out.push({
      cle: "silhouette",
      titre: "Ta silhouette",
      valeur: silhouetteForme(profile.morphology),
      texte: "Entre deux pièces proches, la sélection retient les coupes conseillées pour ta silhouette.",
    });
  }
  const total = p.possedees + p.suggestions;
  if (total > 0) {
    const pl = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;
    out.push({
      cle: "dressing",
      titre: "Ton dressing",
      valeur: `${pl(p.possedees, "pièce")} intégrée${p.possedees > 1 ? "s" : ""} · ${pl(p.suggestions, "suggestion")} Capsela`,
      texte: styleExplore
        ? "Aperçu d'un autre style : les pièces de ton dressing n'entrent pas dans cette sélection."
        : p.possedees > 0
          ? "Tes propres pièces rejoignent la sélection. Capsela les complète avec de nouvelles suggestions pour enrichir chaque catégorie."
          : "Aucune pièce de ton dressing pour cette saison pour l'instant : la sélection repose sur les suggestions Capsela.",
    });
  }
  return out;
}

/** L'accroche du composant : les critères présents, dans l'ordre du brief (« ton style, ta palette de couleurs et la saison »). */
export function accrocheSelection(criteres: readonly CritereSelection[]): string {
  const morceaux = [
    criteres.some((c) => c.cle === "style") && "ton style",
    criteres.some((c) => c.cle === "couleurs") && "ta palette de couleurs",
    criteres.some((c) => c.cle === "saison") && "la saison",
  ].filter((m): m is string => Boolean(m));
  if (!morceaux.length) return "";
  const liste = morceaux.length > 1 ? `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}` : morceaux[0];
  return `Des pièces choisies pour ${liste}.`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// EXPLORER
// ---------------------------------------------------------------------------------------------------------------------------

export type TriExplorer = "capsule" | "dressing" | "suggestions" | "nom";

export interface FiltresExplorer {
  /** "toutes", "favoris" ou une catégorie. */
  categorie: "toutes" | "favoris" | CategoryKey;
  /** Nom de couleur (Item.color), ou null. */
  couleur: string | null;
  tri: TriExplorer;
}

export const FILTRES_PAR_DEFAUT: FiltresExplorer = { categorie: "toutes", couleur: null, tri: "capsule" };

/** Les catégories présentes, dans l'ordre de CATS, avec leur nombre de pièces. Jamais une catégorie vide (brief, 4.2). */
export function categoriesPresentes(entrees: EntreeCapsule[]): { cat: CategoryKey; libelle: string; n: number }[] {
  return CATS.map(([cat, , pluriel]) => ({ cat, libelle: pluriel, n: entrees.filter((e) => e.item.cat === cat).length })).filter((c) => c.n > 0);
}

/** Les couleurs présentes, de la plus représentée à la moins, avec leur teinte. Une pièce sans nom de couleur n'en ajoute pas. */
export function couleursPresentes(entrees: EntreeCapsule[]): { nom: string; hex: string; n: number }[] {
  const parNom = new Map<string, { nom: string; hex: string; n: number }>();
  for (const { item } of entrees) {
    const nom = (item.color || "").trim();
    if (!nom) continue;
    const cle = nom.toLowerCase();
    const c = parNom.get(cle);
    if (c) c.n += 1;
    else parNom.set(cle, { nom, hex: item.hex, n: 1 });
  }
  return [...parNom.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, "fr"));
}

export function filtrerExplorer(entrees: EntreeCapsule[], f: FiltresExplorer, favoris: ReadonlySet<string>): EntreeCapsule[] {
  const gardees = entrees.filter(
    (e) =>
      (f.categorie === "toutes" || (f.categorie === "favoris" ? favoris.has(cleEntree(e)) : e.item.cat === f.categorie)) &&
      (!f.couleur || (e.item.color || "").trim().toLowerCase() === f.couleur.toLowerCase())
  );
  const rangCat = (e: EntreeCapsule) => CATS.findIndex(([c]) => c === e.item.cat);
  const ordre = new Map(entrees.map((e, i) => [cleEntree(e), i]));
  const capsule = (a: EntreeCapsule, b: EntreeCapsule) => rangCat(a) - rangCat(b) || ordre.get(cleEntree(a))! - ordre.get(cleEntree(b))!;
  const tris: Record<TriExplorer, (a: EntreeCapsule, b: EntreeCapsule) => number> = {
    capsule,
    dressing: (a, b) => Number(b.possedee) - Number(a.possedee) || capsule(a, b),
    suggestions: (a, b) => Number(a.possedee) - Number(b.possedee) || capsule(a, b),
    nom: (a, b) => a.item.name.localeCompare(b.item.name, "fr"),
  };
  return [...gardees].sort(tris[f.tri]);
}

// ---------------------------------------------------------------------------------------------------------------------------
// PIÈCES CLÉS
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Deux familles (arbitré par la propriétaire le 01/11/2026 : « stratégique on enlève ») :
 *   - Indispensable : `estBasiqueCapsule`, la donnée du catalogue que la sélection lit comme départage ;
 *   - Signature : `isStatement`, la lecture qui réserve sa place à une pièce de caractère dans la sélection.
 * Une pièce qui serait les deux est Signature (ce qu'elle a de plus distinctif).
 */
export type FamilleCle = "indispensable" | "signature";

export interface PieceCle {
  item: Item;
  famille: FamilleCle;
  /** Une phrase vraie : ce que dit la famille, puis la première raison que la sélection a lue pour cette pièce. */
  explication: string;
}

const PHRASE_FAMILLE: Record<FamilleCle, string> = {
  indispensable: "Une base facile à associer.",
  signature: "Elle donne du caractère à tes tenues.",
};

/**
 * 5 à 8 pièces au plus, PARMI les suggestions de la capsule. Les pièces clés de saison déjà retenues (`piecesCles`) passent devant
 * si elles qualifient ; ensuite une pièce par catégorie avant d'en prendre une seconde, pour que la sélection couvre la silhouette ;
 * 3 signatures au plus, pour rester une sélection. Sans aucune pièce qualifiée, la liste est vide et l'onglet le dit.
 */
export function piecesClesParFamille(capsule: Item[], prioritaires: Item[], profile: Profile, max = 8): PieceCle[] {
  const familleDe = (it: Item): FamilleCle | null => (isStatement(it) ? "signature" : it.estBasiqueCapsule ? "indispensable" : null);
  const candidates = [...prioritaires.filter((p) => capsule.some((c) => c.id === p.id)), ...capsule].filter(
    (it, i, arr) => arr.findIndex((x) => x.id === it.id) === i && familleDe(it)
  );
  const retenues: Item[] = [];
  const signatures = () => retenues.filter((it) => familleDe(it) === "signature").length;
  for (const passe of [0, 1]) {
    for (const it of candidates) {
      if (retenues.length >= max) break;
      if (retenues.includes(it)) continue;
      if (familleDe(it) === "signature" && signatures() >= 3) continue;
      if (passe === 0 && retenues.some((r) => r.cat === it.cat)) continue;
      retenues.push(it);
    }
  }
  return retenues.map((item) => {
    const famille = familleDe(item)!;
    const raison = raisonsSuggestion(item, profile).find((r) => r.cle !== "indispensable");
    return { item, famille, explication: raison ? `${PHRASE_FAMILLE[famille]} ${raison.texte}.` : PHRASE_FAMILLE[famille] };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// DÉTAILS
// ---------------------------------------------------------------------------------------------------------------------------

export interface DetailsCapsule {
  pieces: number;
  couleurs: number;
  categories: number;
  palette: { nom: string; hex: string; n: number }[];
  composition: { cat: CategoryKey; libelle: string; n: number }[];
  dansLeDressing: number;
  suggestions: number;
  indispensables: number;
  signatures: number;
}

/**
 * Les chiffres de l'onglet Détails, tous COMPTÉS sur les pièces affichées. Pas de nombre d'associations : la formule
 * combinatoire a été retirée le 22/09/2026, l'audit l'ayant trouvée fausse de ×0,5 à ×1,7 (cf. compteur-looks.audit.ts).
 */
export function detailsCapsule(entrees: EntreeCapsule[]): DetailsCapsule {
  const palette = couleursPresentes(entrees);
  const composition = categoriesPresentes(entrees);
  const suggestions = entrees.filter((e) => !e.possedee).map((e) => e.item);
  return {
    pieces: entrees.length,
    couleurs: palette.length,
    categories: composition.length,
    palette,
    composition,
    dansLeDressing: entrees.filter((e) => e.possedee).length,
    suggestions: suggestions.length,
    indispensables: suggestions.filter((it) => it.estBasiqueCapsule && !isStatement(it)).length,
    signatures: suggestions.filter((it) => isStatement(it)).length,
  };
}
