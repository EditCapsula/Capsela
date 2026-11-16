import { BONUS_COUPES_PREFEREES_EN_PRODUCTION, bonusCoupesPreferees } from "./coupesPieces";
import type { CoupePreferee } from "./preferencesSilhouette";
import { coupeOf, matiereOf } from "./attributes";
import type { CategoryKey, Item } from "./types";

/*
 * LA SILHOUETTE RONDE (15/11/2026, brief « Évolution du moteur de recommandations – Gestion des silhouettes rondes »).
 *
 * Principe éditorial (le brief, ARBITRAGE ÉDITORIAL de la propriétaire) : habiller les formes, pas les dissimuler. La silhouette ronde
 * n'est pas une morphologie de plus : c'est un COMPLÉMENT qui se combine avec la morphologie déclarée. Arbitrages du 15/11/2026 :
 *   · les cinq morphologies restent telles quelles (« Garde comme aujourd'hui les morphologies ») ; X et 8 restent réunis dans
 *     « taille bien marquée » (f_sablier), faute de donnée ou de visuel pour les distinguer ;
 *   · la question « fine / moyenne / ronde » n'est PAS posée pour l'instant : `corpulence` n'est encore écrite nulle part. D'ici là, la
 *     seule silhouette ronde connue est la morphologie « plutôt ronde et régulière » (f_pomme), qui reçoit ces règles seule ;
 *   · effet : la sélection de la capsule (un rang, capsule.ts) et un BONUS de tenue (R-S20, computeLookScore) — jamais de malus,
 *     jamais de phrase affichée. Le score ne pénalise ni le près du corps, ni un volume, ni une couleur, ni une longueur.
 *
 * Ce module ne fait que LIRE les pièces : nom, sous-type, coupe, matière, longueur. Les colonnes longueur et couche du catalogue sont
 * vides au 15/11/2026 (scripts/silhouette-ronde.audit.ts) : la détection passe par les mots du nom, comme `coupesDeLaPiece`.
 */

export type Corpulence = "fine" | "moyenne" | "ronde";

/**
 * LE BONUS DE TENUE EN PRODUCTION, et le meilleur tirage de Planifier, de la valise et de la tenue sans historique. Activé le
 * 15/11/2026 après mesure (scripts/silhouette-ronde-moteur.audit.ts) ; le levier `silhouetteRonde` de computeLookScore le remplace pour
 * la mesure.
 */
export const BONUS_SILHOUETTE_RONDE_EN_PRODUCTION = true; // validé par la propriétaire le 15/11/2026 (runs 47 et 48)

/** La silhouette ronde est connue : déclarée (le jour où la question existera), ou la morphologie « plutôt ronde et régulière ». */
export function estSilhouetteRonde(morphology: string | null | undefined, corpulence?: Corpulence | null): boolean {
  return corpulence === "ronde" || morphology === "f_pomme";
}

/** Les familles de pièces que les règles favorisent (brief, section 2). Une pièce peut en porter plusieurs. */
export type CritereRonde =
  | "portefeuille" // robe portefeuille ou cache-cœur
  | "trapeze" // robe ou jupe trapèze, évasée
  | "bas_droit" // pantalon ou jean droit
  | "bas_evase" // bootcut, flare
  | "bas_large" // wide leg, palazzo
  | "jupe_droite" // jupe droite ou crayon
  | "encolure" // col V, ouvert, carré, cache-cœur
  | "blazer_structure" // blazer, veste structurée ou légèrement cintrée
  | "veste_ouverte" // veste ou gilet portés ouverts, kimono
  | "manteau_droit" // manteau droit
  | "manteau_ceinture" // manteau ceinturé, trench
  | "matiere_tenue" // matière fluide mais structurée, maille dense, légèrement extensible
  | "ajuste_doux"; // ajusté sans compression

const HAUTS: CategoryKey[] = ["haut", "pull", "robe", "combinaison"];
const BAS_PANTALON: CategoryKey[] = ["pantalon", "jean"];
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];

const texte = (it: Item) => `${it.name} ${it.subtype ?? ""}`.toLowerCase();

/** Ce que la pièce est, d'après ses données. Rien n'est déduit du corps : uniquement du vêtement. */
export function criteresRonde(it: Item): Set<CritereRonde> {
  const c = new Set<CritereRonde>();
  if (!VETEMENTS.includes(it.cat)) return c;
  const t = texte(it);
  const compression = /moulant|seconde peau|gainant|compress|bodycon/.test(t);
  if ((it.cat === "robe" || it.cat === "combinaison" || it.cat === "haut") && /portefeuille|cache-c(œ|oe)ur|croisée?|wrap/.test(t)) c.add("portefeuille");
  if ((it.cat === "robe" || it.cat === "jupe") && /trapèze|trapeze|évasée?|evasee?|patineuse|corolle|a-line/.test(t)) c.add("trapeze");
  if (BAS_PANTALON.includes(it.cat) && /droit|straight|cigarette/.test(t)) c.add("bas_droit");
  if (BAS_PANTALON.includes(it.cat) && /bootcut|flare|évasé|evase|patte d'(é|e)ph/.test(t)) c.add("bas_evase");
  if ((BAS_PANTALON.includes(it.cat) || it.cat === "jupe") && /wide|large|palazzo|jupe-culotte/.test(t)) c.add("bas_large");
  if (it.cat === "jupe" && /crayon|droite|tube/.test(t)) c.add("jupe_droite");
  if (HAUTS.includes(it.cat) && /col v|col en v|encolure v|décolleté|decollete|col carré|encolure carrée|col ouvert|col tunisien|cache-c(œ|oe)ur|portefeuille/.test(t)) c.add("encolure");
  if (it.cat === "veste" && (/blazer|tailleur|structur|cintr/.test(t) || it.couche === "structuree")) c.add("blazer_structure");
  if ((it.cat === "veste" || it.cat === "pull") && /ouvert|kimono|gilet long|cardigan long|duster|long gilet/.test(t)) c.add("veste_ouverte");
  if (it.cat === "manteau" && /droit|mi-long|redingote/.test(t) && !/oversize/.test(t)) c.add("manteau_droit");
  if ((it.cat === "manteau" || it.cat === "veste") && /ceintur|trench|portefeuille/.test(t)) c.add("manteau_ceinture");
  const mat = `${String(it.matiere ?? matiereOf(it))} ${t}`.toLowerCase();
  if (/crêpe|crepe|jersey|milano|punto|maille dense|viscose|élasthanne|elasthanne|stretch|cachemire|mérinos|merinos/.test(mat) && !compression) c.add("matiere_tenue");
  if ((it.coupe === "Ajusté" || /cintr|ajusté|ajuste/.test(t)) && !compression && it.coupe !== "Serré") c.add("ajuste_doux");
  return c;
}

/**
 * LA COMBINAISON AVEC LA MORPHOLOGIE (brief, section 3). La morphologie choisit, parmi les familles, celles qui servent SON équilibre ;
 * une famille qui ne la sert pas n'est simplement pas favorisée (jamais pénalisée). Ainsi le wide leg n'est pas recommandé à toutes
 * les silhouettes rondes : il l'est pour équilibrer des épaules plus larges (V), pour une silhouette ronde seule (lignes verticales),
 * pas pour des hanches plus marquées (A) ni une taille bien marquée (X / 8), où il ajoute du volume là où l'équilibre n'en demande pas.
 *   A (f_poire)            : l'équilibre épaules / hanches — encolures et épaules structurées, bas droits ou légèrement évasés ;
 *   V (f_triangle_inverse) : du volume en bas si souhaité — bas larges, évasés, jupes trapèze ; pas d'épaules structurées en plus ;
 *   H (f_rectangle)        : une structure à la taille si souhaité — portefeuille, ceinturé, cintré, trapèze ;
 *   X / 8 (f_sablier)      : la taille marquée accompagnée — portefeuille, ceinturé, ajusté sans compression, jupe crayon ;
 *   ronde seule (f_pomme)  : des lignes verticales — encolures, pièces ouvertes, manteaux droits, bas droits ou larges, tombé.
 * Les morphologies A et V gardent par ailleurs leur règle propre, prioritaire dans la sélection (valeurDirection, capsule.ts, rangée
 * avant celle-ci) : la règle ronde ne départage qu'à égalité de cette direction.
 */
const FAVORISES: Record<string, readonly CritereRonde[]> = {
  f_poire: ["encolure", "blazer_structure", "veste_ouverte", "bas_droit", "bas_evase", "trapeze", "portefeuille", "matiere_tenue", "manteau_droit"],
  f_triangle_inverse: ["bas_large", "bas_evase", "trapeze", "encolure", "portefeuille", "veste_ouverte", "matiere_tenue", "manteau_droit"],
  f_rectangle: ["portefeuille", "manteau_ceinture", "ajuste_doux", "trapeze", "blazer_structure", "bas_droit", "bas_evase", "encolure", "matiere_tenue"],
  f_sablier: ["portefeuille", "manteau_ceinture", "ajuste_doux", "jupe_droite", "bas_evase", "bas_droit", "encolure", "matiere_tenue", "blazer_structure"],
  f_pomme: ["encolure", "veste_ouverte", "manteau_droit", "bas_droit", "bas_large", "bas_evase", "portefeuille", "trapeze", "matiere_tenue", "jupe_droite", "blazer_structure"],
};

/** Les familles favorisées pour cette combinaison morphologie + silhouette ronde ; vide si la silhouette ronde n'est pas connue. */
export function criteresFavorises(morphology: string | null | undefined, corpulence?: Corpulence | null): readonly CritereRonde[] {
  if (!estSilhouetteRonde(morphology, corpulence)) return [];
  // Silhouette ronde déclarée sans morphologie : les règles de la silhouette ronde seule.
  return FAVORISES[morphology ?? "f_pomme"] ?? FAVORISES.f_pomme;
}

/** 1 si la pièce porte au moins une famille favorisée pour ce profil, 0 sinon — jamais négatif. */
export function compatibiliteRonde(it: Item, morphology: string | null | undefined, corpulence?: Corpulence | null): 0 | 1 {
  const favorises = criteresFavorises(morphology, corpulence);
  if (!favorises.length) return 0;
  const c = criteresRonde(it);
  return favorises.some((f) => c.has(f)) ? 1 : 0;
}

/**
 * LE BONUS DE TENUE (R-S20). Deux pièces compatibles ou plus : +6 ; une seule : +3. ÉVITER L'ACCUMULATION DE VOLUMES (brief, section
 * « Composition des looks ») : deux vêtements amples ou plus dans la tenue retirent le bonus — ce n'est jamais un malus, la tenue garde
 * le score qu'elle aurait eu sans la règle. Aucune couleur n'intervient : ni sombre imposé, ni monochrome obligatoire.
 */
export function bonusSilhouetteRonde(pieces: readonly Item[], morphology: string | null | undefined, corpulence?: Corpulence | null): number {
  if (!estSilhouetteRonde(morphology, corpulence)) return 0;
  const vetements = pieces.filter((p) => VETEMENTS.includes(p.cat));
  if (vetements.filter((p) => coupeOf(p) === "oversize").length >= 2) return 0;
  const n = vetements.filter((p) => compatibiliteRonde(p, morphology, corpulence) === 1).length;
  return n >= 2 ? 6 : n === 1 ? 3 : 0;
}

/**
 * LA RÈGLE DANS TOUS LES PARCOURS DE TENUE (15/11/2026, demandé : « Planifier et valise doivent appliquer les règles morphologiques »).
 * Le bonus R-S20 ne joue que là où le score départage plusieurs tirages : la tenue du jour avec un historique récent, Planifier avec
 * une humeur. Partout ailleurs — Planifier sans humeur, la valise, la tenue du jour sans historique — le moteur ne tirait qu'une fois.
 * Pour une silhouette ronde, et seulement elle, on tire TIRAGES_MORPHOLOGIQUES fois le MÊME moteur et on garde la tenue qui sert le
 * mieux la règle ; à égalité, le premier tirage, celui d'avant. Jamais un second moteur : toutes les tentatives sont des tenues du
 * moteur, avec ses contraintes (météo, occasion, règles). Sans silhouette ronde, ou règle éteinte : un seul tirage, comme avant.
 */
export const TIRAGES_MORPHOLOGIQUES = 6;

export function meilleurTirageMorphologique<T extends { ids: number[]; noCompleteOutfit?: boolean }>(
  tirer: () => T,
  pool: readonly Item[],
  morphology: string | null | undefined,
  corpulence?: Corpulence | null,
  actif: boolean = BONUS_SILHOUETTE_RONDE_EN_PRODUCTION,
  /** Les coupes préférées du profil (16/11/2026, coupesPieces.ts) : comptent avec la silhouette ronde quand leur règle est allumée. */
  coupes?: readonly CoupePreferee[] | null,
  coupesActif: boolean = BONUS_COUPES_PREFEREES_EN_PRODUCTION
): T {
  const premier = tirer();
  const ronde = actif && estSilhouetteRonde(morphology, corpulence);
  const parCoupes = coupesActif && !!coupes?.length;
  if ((!ronde && !parCoupes) || premier.noCompleteOutfit || !premier.ids.length) return premier;
  const note = (r: T) => {
    const pieces = r.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => !!p);
    return (ronde ? bonusSilhouetteRonde(pieces, morphology, corpulence) : 0) + (parCoupes ? bonusCoupesPreferees(pieces, coupes) : 0);
  };
  const plafond = (ronde ? 6 : 0) + (parCoupes ? 6 : 0);
  let meilleur = premier;
  let meilleureNote = note(premier);
  for (let i = 1; i < TIRAGES_MORPHOLOGIQUES && meilleureNote < plafond; i++) {
    const r = tirer();
    if (r.noCompleteOutfit || !r.ids.length) continue;
    const n = note(r);
    if (n > meilleureNote) {
      meilleur = r;
      meilleureNote = n;
    }
  }
  return meilleur;
}
