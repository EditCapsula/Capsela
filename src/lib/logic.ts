import type { CapsuleSeason, CategoryKey, DateContext, Item, OccasionKey, OutfitFailureReason, ShoeType, WorkMode } from "./types";
import type { Weather } from "./data";
import { BAS_CATS, CATLABEL, FALLBACK_HEX, OCCASIONS, OCCASION_STYLE_PREFS, effectiveFormality, isRainy, isSunny } from "./data";
import { isCatalogId } from "./catalog";
import { capsuleSeasonBucket, currentSeasonKey } from "./capsule";
import {
  coupeOf,
  formalityOf,
  huesHarmonious,
  isMetallicFinish,
  isNeutralColor,
  isStatement,
  matiereOf,
  metalOf,
  rolePieceOf,
} from "./attributes";

const BOTTOMS: CategoryKey[] = [...BAS_CATS, "jupe"];
/** Catégories haut du corps concernées par le rôle base/calque (R-B8, R-S11/S12). Exporté pour CreateLookScreen (règle "jamais 2 pièces base", brief design section 4). */
export const TOP_LAYER_CATS: CategoryKey[] = ["haut", "pull"];
const TOP_OR_BOTTOM_CATS: CategoryKey[] = [...TOP_LAYER_CATS, ...BAS_CATS, "jupe"];
/** Pièces qui constituent une base valide sous une veste/un manteau (R-B9). */
const BASE_GARMENT_CATS: CategoryKey[] = ["haut", "robe", "combinaison"];
const OUTERWEAR_CATS: CategoryKey[] = ["veste", "manteau"];
/** Pièce unique remplaçant haut+bas (R-B5) — robe et combinaison, toujours équivalentes ici. */
const ONEPIECE_CATS: CategoryKey[] = ["robe", "combinaison"];

/** Catégories suivies pour l'anti-répétition (R-B7) et le calcul de formalité d'une tenue. Exporté pour CreateLookScreen (filtre dur du picker manuel, brief design section 4). */
export const CLOTHING_CATS: CategoryKey[] = [...TOP_LAYER_CATS, ...BAS_CATS, "jupe", "robe", "combinaison", "veste", "manteau"];
const ACCESSORY_CATS: CategoryKey[] = ["chaussures", "sac", "bijou", "accessoire"];
/** Types de chaussures ouvertes exclus s'il est prévu de la pluie (R-B21) — uniquement les valeurs explicitement des sandales, jamais une extrapolation vers d'autres types semi-ouverts (mules, espadrilles...) non nommés par la demande. */
const SANDAL_SHOE_TYPES: ShoeType[] = ["Sandales", "Sandales à talons"];

/**
 * Une veste/un manteau seul, sans pièce de base, n'est pas une tenue complète
 * (R-B9).
 *
 * Correctif 26/08/2026 (signalé : "un pull ne doit pas nécessairement être
 * porté avec un haut en dessous") — un pull comptait pour rien dans cette
 * règle, si bien que "col roulé + pantalon + manteau" était refusé à la
 * sauvegarde alors que c'est une tenue d'hiver parfaitement constituée. Un
 * pull dont le rôle est "base" (col roulé, col rond, col V...) vaut
 * désormais base à lui seul ; un pull "calque" (cardigan, gilet, maille
 * oversize) continue d'en exiger une sous lui, ce qui est bien le cas où le
 * layering est réellement obligatoire. La distinction vient de rolePieceOf(),
 * qui lit le rôle déclaré sur la pièce et retombe sinon sur la coupe — pas
 * d'heuristique de libellé ajoutée ici.
 */
function hasBaseGarment(items: Item[]): boolean {
  return items.some(
    (i) => BASE_GARMENT_CATS.includes(i.cat) || (i.cat === "pull" && rolePieceOf(i) === "base")
  );
}

/** R-B9 — vrai si la sélection contient une veste/un manteau sans pièce de base (haut, robe, combinaison) en dessous. */
export function violatesOuterwearRule(pieces: Item[]): boolean {
  return pieces.some((i) => OUTERWEAR_CATS.includes(i.cat)) && !hasBaseGarment(pieces);
}

/**
 * R-B11 (Sport, liste blanche stricte) + R-B12/R-B13/R-B14 (Cocooning,
 * exclusions symétriques) — jamais relâchées, quelle que soit la source du
 * pool. Extrait de generateOutfit pour être réutilisé tel quel par le
 * picker manuel de Création de looks (brief design section 4, correctif
 * 22/08/2026 : ces règles n'existaient jusqu'ici que côté génération
 * automatique). workMode par défaut "Présentiel" : CreateLookScreen n'a pas
 * de sous-contexte Présentiel/Télétravail sélectionnable, donc isHomeContext
 * s'y limite naturellement à Cocooning.
 */
export function applySportCocooningFilter(items: Item[], occasion: OccasionKey, workMode: WorkMode = "Présentiel"): Item[] {
  let r = items;
  // La gourde n'a de fonction qu'en Sport (recette 22/08/2026, "valable que
  // pour le sport") — exclue de toute autre occasion, y compris du picker
  // manuel de Création de looks (même portée que les autres règles ici).
  if (occasion !== "sport") {
    r = r.filter((i) => i.accessoireType !== "Gourde");
  }
  if (occasion === "sport") {
    // R-B11 — correspondance stricte, pas un seuil minimum : liste blanche
    // explicite par catégorie (section 22 du moteur de règles).
    // Correctif 22/08/2026 (signalé : ceinture proposée en Sport) — ceinture
    // et foulard n'ont aucune fonction sportive, contrairement à casquette/
    // lunettes/chaussettes hautes qui restent autorisées.
    // Correctif 22/08/2026 (signalé : "pour le sport ça doit toujours être
    // un sac de sport") — plus d'exception cabas/formalité 0 : seul le type
    // dédié "Sac de sport" est éligible, jamais relâché même si ça vide la
    // catégorie (même esprit que le reste de cette liste blanche).
    r = r.filter((i) => {
      if (i.cat === "chaussures") return formalityOf(i) === 0;
      if (i.cat === "sac") return i.sacType === "Sac de sport";
      if (i.cat === "bijou") return false;
      if (i.cat === "accessoire") return i.accessoireType !== "Ceinture" && i.accessoireType !== "Foulard";
      return formalityOf(i) === 0;
    });
  }
  // Contexte "à la maison" — Cocooning, ou Télétravail (sous-contexte de
  // travail_formel) : partagé par plusieurs règles (R-B13/R-B14/R-B17),
  // jamais en Présentiel.
  const isHomeContext = occasion === "cocooning" || (occasion === "travail_formel" && workMode === "Télétravail");
  if (occasion === "cocooning") {
    // R-B12 — pas de veste/manteau chez soi (Cocooning uniquement — en
    // Télétravail on peut porter un gilet/une veste, rien ne l'interdit).
    r = r.filter((i) => !OUTERWEAR_CATS.includes(i.cat));
  }
  if (isHomeContext) {
    // R-B13/R-B17 — chaussures d'intérieur uniquement à la maison
    // (Cocooning et Télétravail).
    r = r.filter((i) => i.cat !== "chaussures" || i.shoeType === "Chaussures d'intérieur");
  } else {
    // R-B13 — symétrique : une chaussure d'intérieur n'apparaît jamais hors de ce contexte.
    r = r.filter((i) => i.cat !== "chaussures" || i.shoeType !== "Chaussures d'intérieur");
  }
  // R-B14 — aucun sac n'a de fonction chez soi.
  if (isHomeContext) {
    r = r.filter((i) => i.cat !== "sac");
  }
  return r;
}

/** R-B10 — deux chemises/chemisiers ensemble, quel que soit leur rôle de superposition. */
function isShirtLike(it: Item): boolean {
  return it.subtype === "Chemise" || it.subtype === "Chemisier";
}

/**
 * Maille FERMÉE (arbitrage éditorial du 31/08/2026) — deux d'entre elles ne se
 * superposent pas, exactement au même titre que deux chemises (R-B10). Comme
 * R-B10, la règle vise les SOUS-TYPES et non la catégorie : `pull` recouvre
 * aussi "Gilet" et "Cardigan" (cf. data.ts), qui restent des calques
 * parfaitement légitimes par-dessus une maille fermée — c'est même le cas
 * d'usage que R-B8 cite en exemple ("gilet léger"). Une interdiction par
 * catégorie aurait donc annulé une partie de la règle qu'elle complète.
 */
function isClosedKnit(it: Item): boolean {
  return it.cat === "pull" && (it.subtype === "Pull" || it.subtype === "Col roulé");
}

/**
 * Leviers de MESURE (31/08/2026) — tous facultatifs, tous inertes par défaut :
 * non renseignés, la génération se comporte exactement comme avant leur
 * introduction. Ils existent pour qu'un audit compare un avant et un après
 * DANS LA MÊME EXÉCUTION sans dupliquer le pipeline (cf. AGENTS.md,
 * « Conséquence pratique pour les scripts d'audit »), comme `capsuleSeason`
 * avant eux. Aucun appelant de production ne les passe, et un test verrouille
 * que leur absence reproduit le comportement livré.
 */
export interface LeviersMesure {
  /**
   * P1 — le tirage du haut principal s'ouvre aux pulls au lieu de la seule
   * catégorie "haut".
   *
   * `"base"` restreint l'ouverture aux pulls dont le rôle est déjà `base`,
   * `"tous"` l'étend à tous les pulls y compris les `calque`. La distinction
   * n'est pas cosmétique : R-B9 exige un vêtement de base sous une veste, et
   * `hasBaseGarment` n'accepte un pull que s'il est `base`. Ouvrir à `"tous"`
   * laisse donc un cardigan devenir dessus principal puis recevoir une veste,
   * ce qui viole R-B9 — la seule règle qui empêche réellement une tenue
   * d'être sauvegardée. Mesuré : 395 violations sur 12 800 tenues, contre
   * zéro en production.
   */
  pullCommeHautPrincipal?: "tous" | "base";
  /**
   * Reproduit le comportement d'AVANT l'ouverture de la seconde couche aux
   * pulls (31/08/2026) : seul le rôle "calque" y donnait accès, donc jamais un
   * pull de coupe fine. Conservé pour qu'un audit retrouve la ligne de base.
   */
  pullNonSuperposable?: boolean;
  /** Reproduit le comportement d'AVANT la règle des mailles fermées, pour en mesurer le coût réel. */
  superpositionMaillesFermees?: boolean;
}

/** Exporté pour CreateLookScreen (filtre dur du picker manuel, brief design section 4). */
export function recentlyWorn(it: Item): boolean {
  return it.worn != null && it.worn <= 2;
}

function isDressy(occasion: OccasionKey, workMode: WorkMode = "Présentiel", dateContext: DateContext = "Verre"): boolean {
  return effectiveFormality(occasion, workMode, dateContext) >= 3;
}

/**
 * Probabilités d'inclusion des bijoux/accessoires facultatifs (recette
 * 19/08/2026) — jamais une obligation systématique, le contexte influence
 * leur pertinence (bijoux/accessoires habillés plus probables pour une
 * cérémonie). Le sac, lui, est devenu essentiel (recette 22/08/2026,
 * cf. l'appel à pick(["sac"], true) plus bas) et n'a donc plus de
 * probabilité ici.
 */
function accessoryProbabilities(occasion: OccasionKey, workMode: WorkMode): { bijou: number; accessoire: number } {
  if (occasion === "evenement_perso") return { bijou: 0.6, accessoire: 0.55 };
  if (occasion === "travail_formel" && workMode === "Présentiel") return { bijou: 0.35, accessoire: 0.3 };
  return { bijou: 0.35, accessoire: 0.3 };
}

/**
 * Probabilité d'inclure une veste/un blazer (correctif 21/08/2026, décidé —
 * option B, cf. OCCASION_STYLE_PREFS.entretien) : le seuil de formalité d'un
 * entretien reste business_casual, mais la tenue doit lire plus structurée
 * qu'une simple journée de bureau — la veste devient nettement plus probable
 * plutôt qu'un tirage à plat 30 %, jamais systématique pour autant.
 */
function vesteProbability(occasion: OccasionKey): number {
  if (occasion === "entretien") return 0.65;
  return 0.3;
}

/** Tournure au génitif désignant le contexte du jour, pour la phrase d'explication de la recommandation. */
function occasionPhrase(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext): string {
  switch (occasion) {
    case "quotidien":
      return "ta journée";
    case "travail_formel":
      return workMode === "Télétravail" ? "ta journée en télétravail" : "ta journée au bureau";
    case "entretien":
      return "ton rendez-vous important";
    case "date":
      return dateContext === "Restaurant / date romantique"
        ? "ton dîner"
        : dateContext === "Soirée festive"
          ? "ta soirée"
          : "ton rendez-vous";
    case "soiree":
      return "ta sortie";
    case "festive":
      return "ta soirée festive";
    case "sport":
      return "ta séance de sport";
    case "cocooning":
      return "ta journée cocooning";
    case "voyage":
      return "ton déplacement";
    case "evenement_perso":
      return "ta cérémonie";
    default:
      return "aujourd'hui";
  }
}

/** Qualificatif court associé à la température — deuxième "raison" de explainRecommendation ci-dessous. */
function weatherQualifier(t: number): string {
  if (t >= 27) return "légère et fraîche";
  if (t >= 20) return "légère et confortable";
  if (t >= 12) return "confortable, une couche en plus si besoin";
  return "chaude et enveloppante";
}

/**
 * Justification courte de la recommandation (brief design 22/08/2026,
 * remplace "Pensée pour ta journée et les X° prévus" par un format plus
 * direct et scannable : "X° aujourd'hui · qualificatif météo"), générée par
 * template — jamais d'IA, jamais de texte codé en dur indépendant du
 * contexte réel.
 *
 * Construite comme une liste de "raisons" jointes par " · " plutôt qu'une
 * phrase figée : architecture pensée pour accueillir plus tard d'autres
 * critères du moteur de recommandation (occasion, pièce mise en avant...)
 * en ajoutant simplement une entrée à `reasons`, sans revoir le format ni
 * les appelants (TenuesScreen, HomeScreen).
 */
export function explainRecommendation(
  occasion: OccasionKey,
  workMode: WorkMode,
  dateContext: DateContext,
  temp: number | null | undefined
): string {
  if (temp == null || !Number.isFinite(temp)) {
    return `Pensée pour ${occasionPhrase(occasion, workMode, dateContext)}.`;
  }
  const t = Math.round(temp);
  const reasons = [`${t}° aujourd'hui`, weatherQualifier(t)];
  return reasons.join(" · ");
}

/**
 * Une occasion explicitement déclarée sur une pièce (dressing réel,
 * AddScreen) exclut réellement — c'est un signal fiable, contrairement à
 * l'ancien filtre par mots-clés du nom/couleur retiré le 19/08/2026 (audit
 * moteur : produisait des associations accidentelles, ex. un pantalon noir
 * retenu pour "Sortie" uniquement parce que "noir" matchait la regex,
 * excluant à tort une jupe ou un jean de formalité identique). Sans
 * déclaration explicite, aucune restriction — laisse la formalité (R-B3)
 * décider seule.
 */
export function declaredOccasionOk(it: Item, occ: OccasionKey): boolean {
  return !it.occasion || !it.occasion.length || it.occasion.includes(occ);
}

/**
 * Resserre un pool de candidats pour qu'ils s'accordent avec les pièces déjà
 * retenues : couleur (au plus une teinte affirmée par tenue), formalité
 * (écart limité avec les pièces déjà choisies, esprit R-B2), coupe (évite le
 * double ajusté/double oversize haut+bas, esprit R-B4), puis style —
 * chaque critère ne s'applique que s'il laisse au moins une option, jamais
 * de blocage total pour une pièce essentielle.
 */
/** R-S15 — poids d'anti-répétition (jamais un filtre dur, cf. harmonize ci-dessous). */
function repetitionWeight(it: Item): number {
  if (!CLOTHING_CATS.includes(it.cat) || it.worn == null) return 0;
  if (it.worn <= 1) return 3;
  if (it.worn <= 3) return 2;
  if (it.worn <= 14) return 1;
  return 0;
}

function harmonize(candidates: Item[], chosen: Item[], essential = true): Item[] {
  if (candidates.length <= 1) return candidates;
  let pool = candidates;

  // R-S15 (correctif 20/08/2026) : l'anti-répétition n'écarte plus aucune
  // pièce ici — toutes les pièces éligibles restent candidates, la
  // préférence pour les moins récemment portées s'exprime uniquement comme
  // une pondération dans le tirage aléatoire final (cf. rand()). L'ancienne
  // version filtrait déjà le pool au palier le plus frais présent : dans un
  // catalogue où `worn` ne change jamais en dehors d'un vrai "portée
  // aujourd'hui", ça revenait à une exclusion permanente de toute pièce
  // moins fraîche qu'au moins une autre de la même catégorie, jamais une
  // vraie préférence "molle".
  if (!chosen.length) return pool;

  // Couleur — au plus une teinte affirmée par tenue. Le bijou est un petit
  // accent métallique (or/argent) : il ne doit pas consommer à lui seul le
  // budget « une couleur affirmée par tenue ».
  const colorRelevant = chosen.filter((i) => i.cat !== "bijou");
  const accentPiece = colorRelevant.find((i) => !isNeutralColor(i.color));
  if (accentPiece) {
    const neutrals = pool.filter((i) => isNeutralColor(i.color));
    if (neutrals.length) {
      pool = neutrals;
    } else {
      // Aucune option neutre ici (ex. accessoires souvent tous colorés) :
      // on reprend la même teinte affirmée plutôt que d'en ajouter une autre.
      const echo = pool.filter((i) => i.color === accentPiece.color);
      if (echo.length) pool = echo;
      // Sinon, pour une pièce facultative on préfère l'omettre plutôt que
      // jurer avec la couleur déjà choisie ; les pièces essentielles, elles,
      // ne doivent jamais se retrouver bloquées à zéro option.
      else if (!essential) pool = [];
    }
  }
  if (!pool.length) return pool;

  // Formalité — écart limité avec la formalité moyenne déjà choisie (R-B2).
  if (pool.length > 1) {
    const formalities = chosen.map(formalityOf);
    const avg = formalities.reduce((a, b) => a + b, 0) / formalities.length;
    const close = pool.filter((i) => Math.abs(formalityOf(i) - avg) <= 2);
    if (close.length) pool = close;
  }

  // Coupe — évite un double ajusté ou double oversize sur haut+bas (R-B4).
  if (pool.length > 1) {
    const anchor = chosen.find((i) => TOP_OR_BOTTOM_CATS.includes(i.cat));
    if (anchor) {
      const anchorCoupe = coupeOf(anchor);
      if (anchorCoupe !== "regular") {
        const nonClashing = pool.filter(
          (i) => !(TOP_OR_BOTTOM_CATS.includes(i.cat) && coupeOf(i) === anchorCoupe)
        );
        if (nonClashing.length) pool = nonClashing;
      }
    }
  }

  // Correctif 19/08/2026 (audit moteur) : bestStyleFor() réduit une pièce à
  // un seul style deviné par mots-clés du nom (premier match dans un ordre
  // fixe) — une jupe est toujours "Romantique" (mot-clé "jupe"), jamais
  // compatible avec un t-shirt toujours "Minimaliste" (mot-clé "t-shirt"),
  // même à formalité et couleur identiques. Ce narrowing n'est fiable que
  // lorsque les pièces ont un style_tags explicitement déclaré (donnée
  // structurée, jamais une supposition) ; sans cette déclaration sur
  // l'ancre, on ne filtre plus par style plutôt que de risquer une
  // exclusion arbitraire.
  // Correctif 22/08/2026 : symétrique côté candidat — une pièce réelle du
  // dressing n'a jamais de style_tags déclaré (seul le catalogue en a),
  // donc l'ancien `i.styleTags && ...` l'excluait purement et simplement dès
  // qu'une ancre stylée était déjà choisie, alors qu'on ignore justement son
  // style. On ne filtre plus que les candidats dont le style_tags déclaré
  // s'oppose explicitement à celui de l'ancre ; une pièce sans déclaration
  // reste toujours candidate.
  const anchor = chosen[0];
  if (anchor.styleTags && anchor.styleTags.length) {
    const styleMatches = pool.filter(
      (i) => !i.styleTags || !i.styleTags.length || i.styleTags.some((s) => anchor.styleTags!.includes(s))
    );
    if (styleMatches.length) pool = styleMatches;
  }
  return pool;
}

/**
 * Tirage aléatoire pondéré (R-S15, correctif 20/08/2026) — préfère les
 * pièces les moins récemment portées SANS jamais réduire à zéro la chance
 * d'une pièce plus récente : poids 4 pour le palier le plus frais, jusqu'à
 * 1 pour le palier le plus récent (jamais 0). Remplace l'ancien filtrage en
 * dur de harmonize(), qui excluait purement et simplement toute pièce non
 * maximale en fraîcheur dès qu'une alternative plus fraîche co-existait.
 */
function rand(items: Item[]): Item | null {
  if (!items.length) return null;
  if (items.length === 1) return items[0];
  const weights = items.map((i) => 4 - repetitionWeight(i));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export interface GeneratedOutfit {
  ids: number[];
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). "bas" regroupe pantalon/jean/short. "chaud" (R-B18) : une pièce présente est sous son meteo_min_temp et aucun calque compatible n'a été trouvé pour compenser. */
  missingCats: (CategoryKey | "bas" | "chaud")[];
}

/**
 * Génère une tenue depuis le pool actif (dressing réel, ou capsule par
 * défaut tant qu'il est vide).
 * Pipeline de filtrage (ordre imposé) : saison (a) → anti-répétition ≤2j
 * sur haut/bas/jupe/robe/combinaison/manteau/pull (b, R-B7) → occasion (c).
 * Si le pool résultant est trop restreint (< 4 pièces), on relâche dans
 * l'ordre inverse : d'abord l'occasion, puis l'anti-répétition, la saison
 * en tout dernier recours. Les baskets sont ensuite reléguées si l'occasion
 * est habillée (R-B6), et les pièces choisies pour s'accorder entre elles
 * (couleur, formalité, coupe, style).
 */
export function generateOutfit(
  pool: Item[],
  weather: Weather,
  occasion: OccasionKey,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  preferredHexes: string[] = [],
  /** Genre du profil — la compensation robe/jupe/short trop fraîche par un collant (cf. plus bas) est un usage féminin, jamais proposée pour un profil homme. */
  gender: "femme" | "homme" | null = null,
  /** Palier de formalité explicite — remplace la déduction occasion/sous-contexte quand fourni (cf. generateOutfitWithFallback, repli progressif de formalité). */
  formalityOverride?: number,
  /**
   * Pièce imposée par l'appelant, exemptée de la seule priorité au réel de
   * pick() (correctif 26/08/2026, cf. son commentaire). Uniquement renseigné
   * par getOutfitsForItem : la tenue du jour n'a pas de pièce imposée et son
   * comportement est strictement inchangé. N'accorde aucun autre privilège —
   * la pièce reste soumise à toutes les règles dures (R-B3, R-B6, R-B11...)
   * et n'est jamais forcée dans la tenue, seulement rendue tirable.
   */
  pinnedId?: number,
  /**
   * Saison de la capsule dont `pool` est issu, quand il en existe une
   * (correctif 29/08/2026, défaut démontré). Le référentiel SAISONNIER vient
   * alors de la capsule, jamais de la température : `representativeWeatherFor`
   * dérive son bucket de la température (16 °C au printemps -> "Automne /
   * Hiver" via weatherSeasonBucket, seuil 20), tandis que la capsule Printemps
   * est bâtie sur "Printemps / Été" (capsuleSeasonBucket). Le filtre ci-dessous
   * écartait donc 20,4 % de la capsule de printemps, pour les dix occasions.
   *
   * La météo continue de gouverner tout le reste — température, bornes
   * meteo_min_temp/meteo_max_temp, pluie, soleil : une pièce de la bonne
   * saison mais hors de ses bornes thermiques reste exclue. Non renseigné,
   * le comportement météo d'origine est strictement conservé (tenue du jour).
   */
  capsuleSeason?: CapsuleSeason | null,
  /** Leviers de mesure — inertes par défaut, cf. LeviersMesure. */
  leviers?: LeviersMesure
): GeneratedOutfit {
  // Référentiel saisonnier : celui de la capsule quand il est connu, sinon
  // celui que la météo porte (tenue du jour sous météo réelle, inchangée).
  const seasonBucket = capsuleSeason ? capsuleSeasonBucket(capsuleSeason) : null;
  const seasonPool = seasonBucket
    ? pool.filter((i) => i.season === seasonBucket || i.season === "Toutes saisons")
    : pool.filter((i) => weather.seasons.includes(i.season));
  const seasonBase = seasonPool.length >= 4 ? seasonPool : pool;

  // R-S15 — l'anti-répétition n'exclut plus jamais une pièce du pool en
  // amont (ancien comportement R-B7, reclassé le 13/08/2026) : c'est
  // désormais harmonize() qui la préfère sans jamais bloquer une catégorie,
  // cf. plus bas.

  // Compatibilité catégorie × occasion (R-B11 Sport, R-B12/R-B13 Cocooning ↔
  // chaussures d'intérieur) — jamais relâchée, même si le pool résultant est
  // restreint ; appliquée à toute source de pool, y compris aux catégories
  // qui bypassent par ailleurs le simple filtre heuristique d'occasion (chaussures/sac).
  const hardCategoryFilter = (items: Item[], minFormalityOverride?: number): Item[] => {
    let r = applySportCocooningFilter(items, occasion, workMode);
    // R-B18 — aucun accessoire n'a de fonction en Télétravail (bijou/sac déjà
    // couverts ailleurs ; concerne ceinture, foulard, lunettes...).
    if (occasion === "travail_formel" && workMode === "Télétravail") {
      r = r.filter((i) => i.cat !== "accessoire");
    }
    // R-B3 — filtrage dur (section 1 du moteur de règles) : un vêtement dont
    // la formalité est sous le minimum requis par l'occasion est exclu, pas
    // seulement signalé après coup. Limité aux catégories vêtement
    // (CLOTHING_CATS) — chaussures/sacs/accessoires ont leurs propres règles
    // dédiées (R-B6, R-B11...), ne pas les y soumettre casserait par exemple
    // les baskets pour Quotidien (formalité 0 < minimum 1) alors qu'elles y
    // sont explicitement adaptées.
    // Correctif 19/08/2026 : le haut (TOP_LAYER_CATS) échappe à ce plancher
    // strict — sa formalité peut être compensée par une veste structurée
    // (ex. "t-shirt + blazer" = tenue bureau valide), décidé plus bas dans
    // generateOutfit. Le bas, lui, reste soumis au plancher plein : aucune
    // veste ne rend un jogging adapté au bureau.
    // Correctif 21/08/2026 (signalé : "T-shirt technique / Débardeur sport"
    // proposé hors sport) : l'exemption ne couvre plus la formalité 0
    // ("sport") — un haut purement technique n'est jamais "compensé" par une
    // veste, contrairement à un t-shirt basique (formalité >= 1) qui reste
    // exempté comme avant. Hors occasion Sport, un haut formalité 0 repasse
    // donc par le plancher plein comme n'importe quel autre vêtement.
    // Correctif 23/08/2026 (signalé : combinaison en coton explicitement
    // déclarée "Travail / Bureau" par l'utilisatrice, toujours exclue de
    // cette occasion) — une pièce réelle du dressing n'a pas de
    // niveauFormalite déclaré (seul le catalogue en a) : formalityOf() le
    // devine alors par mots-clés du nom (attributes.ts), une heuristique
    // forcément grossière qui ne reconnaît par exemple aucune "combinaison"
    // comme habillée. Dès qu'elle sous-estime la formalité réelle, ce
    // plancher contredisait silencieusement une occasion pourtant choisie
    // explicitement par l'utilisatrice sur cette pièce (AddScreen) — alors
    // que declaredOccasionOk (plus haut) traite déjà cette même déclaration
    // comme un signal fiable qui prime sur toute déduction. Par symétrie,
    // une occasion explicitement déclarée sur la pièce l'exempte aussi du
    // plancher de formalité pour cette occasion précise : la déduction ne
    // reprend la main que pour les pièces qui n'ont rien déclaré.
    if (occasion !== "all") {
      const minFormality = minFormalityOverride ?? effectiveFormality(occasion, workMode, dateContext);
      r = r.filter(
        (i) =>
          !CLOTHING_CATS.includes(i.cat) ||
          Boolean(i.occasion && i.occasion.includes(occasion)) ||
          (TOP_LAYER_CATS.includes(i.cat) && formalityOf(i) > 0) ||
          formalityOf(i) >= minFormality
      );
    }
    // R-B6 — les baskets ne sont jamais éligibles dès que l'occasion demande
    // au moins business_casual (habillée), quelle que soit la disponibilité
    // d'alternatives.
    if (isDressy(occasion, workMode, dateContext)) {
      r = r.filter((i) => i.cat !== "chaussures" || i.shoeType !== "Baskets");
    }
    // R-B15 — une pièce qui ne se justifie que par temps ensoleillé (ex.
    // lunettes de soleil) n'est jamais suggérée hors météo ensoleillée, dans
    // le pool des suggestions automatiques (Tenue du jour, capsules) — ne
    // s'applique pas au picker manuel de l'écran Création de looks (qui ne
    // passe pas par hardCategoryFilter).
    if (!isSunny(weather)) {
      r = r.filter((i) => !i.necessiteSoleil);
    }
    // R-B20 (25/08/2026, signalé) — un short (capsule ou dressing réel,
    // jamais de distinction de source) n'est jamais proposé dans la tenue
    // recommandée à 22°C ou moins, quelle que soit sa propre plage
    // meteo_min_temp/meteo_max_temp déclarée (souvent absente pour une
    // pièce du dressing réel, cf. dressing.ts) — règle de catégorie dure,
    // jamais relâchée, symétrique de R-B15/R-B6 ci-dessus.
    if (weather.temp <= 22) {
      r = r.filter((i) => i.cat !== "short");
    }
    // R-B21 (25/08/2026, signalé) — sandales jamais proposées s'il est
    // prévu de la pluie, capsule ou dressing réel (jamais de distinction
    // de source) : on privilégie les chaussures fermées. Règle de
    // catégorie dure, jamais relâchée — contrairement à R-B16 ci-dessus
    // (préférence molle sur les vestes/manteaux résistants à la pluie),
    // qui ne s'applique elle-même qu'à défaut d'alternative.
    if (isRainy(weather)) {
      r = r.filter((i) => i.cat !== "chaussures" || !i.shoeType || !SANDAL_SHOE_TYPES.includes(i.shoeType));
    }
    return r;
  };

  // Occasion explicitement déclarée sur la pièce (correctif 19/08/2026,
  // remplace l'ancien filtre par mots-clés — cf. déclarations plus haut).
  //
  // Sortie de hardCategoryFilter (correctif 26/08/2026, signalé : "Voyage /
  // Déplacement" systématiquement vide alors que sa formalité est la plus
  // basse), exactement comme applyTempFilter plus bas et pour la même raison :
  // ce filtre pouvait vider une catégorie essentielle sans aucun repli.
  // OCCASIONS_DEFAULT_BY_CAT (attributes.ts) ne propose jamais voyage,
  // entretien ni festive, et saveItem persiste cette suggestion automatique
  // telle quelle — toute pièce réelle se retrouve donc déclarée sur d'autres
  // occasions et exclue de ces trois-là, sans que l'utilisatrice n'ait rien
  // choisi. Compléter la table des défauts ne suffirait pas et se paierait
  // ailleurs : une occasion déclarée exempte aussi la pièce du plancher de
  // formalité (cf. R-B3 ci-dessus), donc y ajouter "entretien" rendrait au
  // passage n'importe quel t-shirt éligible à un entretien. Le repli ci-
  // dessous corrige la cause commune sans toucher à cette sémantique, et
  // couvre du même coup une liste restrictive réellement choisie à la main.
  const applyDeclaredOccasionFilter = (items: Item[]): Item[] =>
    occasion === "all" ? items : items.filter((i) => declaredOccasionOk(i, occasion));

  // Plage de température (meteo_min_temp/meteo_max_temp, source
  // vestiaire_universel) — une pièce n'est jamais suggérée si la météo du
  // jour sort de sa plage déclarée. Toutes catégories (contrairement à
  // R-B3, limitée au vêtement) : un manteau d'hiver ou une écharpe n'ont
  // pas plus leur place par forte chaleur qu'un haut trop léger par temps
  // froid. Sans valeur déclarée, jamais filtré sur ce critère. Sortie de
  // hardCategoryFilter (correctif 21/08/2026, signalé : tenues générées sans
  // aucun bas) pour pouvoir être retirée en dernier recours par poolFor —
  // contrairement aux autres filtres de cette fonction, celui-ci pouvait
  // vider une catégorie entière (ex. aucun bas de la capsule Été ne
  // supportant 15°) sans jamais aucun repli, contrairement à l'esprit
  // "jamais de blocage total pour une pièce essentielle" appliqué partout
  // ailleurs dans ce fichier (harmonize, R-S10, R-B16...).
  // R-B18 (nouveau 21/08/2026, précisé : seuil chemise 20°C — "en-dessous
  // de cette température, on ajoute une pièce calque dessus") : haut/pull/
  // robe ne sont plus jamais exclus pour être sous leur propre
  // meteo_min_temp — ils restent éligibles à toute température, la
  // compensation par un calque (plus bas dans generateOutfit) prend le
  // relais plutôt qu'une exclusion silencieuse. Sans cette exemption, une
  // chemise avec un seuil (20°) disparaîtrait purement et simplement du
  // pool sous ce seuil au lieu de rester proposée avec un calque —
  // contraire à l'objectif même de R-B18. Le plafond haute température
  // (meteo_max_temp) reste appliqué normalement à ces catégories : un pull
  // épais n'a pas sa place en pleine canicule.
  // Correctif 26/08/2026 (signalé sur la capsule Glamour Automne) : jupe et
  // short rejoignent la liste. La compensation par un collant existait déjà
  // plus bas (R-B19 : `b.cat === "jupe"` sous son meteo_min_temp, puis
  // `b.cat === "short"` hors Été), mais elle ne pouvait jamais se
  // déclencher — applyTempFilter retirait la jupe du pool avant même que le
  // bas soit tiré, rendant ces deux lignes inertes. Une mini-jupe à seuil
  // 16° disparaissait donc purement et simplement à 14° au lieu d'être
  // proposée avec des collants, exactement ce que R-B19 est censée éviter.
  // Même raisonnement que pour haut/pull/robe : jamais d'exclusion
  // silencieuse quand une autre pièce peut compenser. Le plafond
  // meteo_max_temp reste appliqué normalement.
  const TEMP_COMPENSATED_CATS: CategoryKey[] = [...TOP_LAYER_CATS, "robe", "combinaison", "jupe", "short"];
  const applyTempFilter = (items: Item[]): Item[] =>
    items.filter((i) => {
      if (i.meteoMinTemp != null && weather.temp < i.meteoMinTemp && !TEMP_COMPENSATED_CATS.includes(i.cat)) return false;
      if (i.meteoMaxTemp != null && weather.temp > i.meteoMaxTemp) return false;
      return true;
    });

  // Règles dures (R-B3/R-B6/R-B11...) — jamais relâchées, appliquées une
  // bonne fois pour toutes sur la base anti-répétition/saison.
  // formalityOverride propagé jusqu'au filtre dur (correctif 26/08/2026,
  // signalé : occasions restant vides sans que baisser la formalité n'y
  // change rien) — hardCategoryFilter acceptait ce paramètre depuis
  // toujours, mais aucun appelant ne le passait : R-B3 retombait donc
  // systématiquement sur effectiveFormality(occasion), y compris pendant le
  // repli progressif de FORMALITY_FALLBACK_CHAIN et pendant la sonde à
  // formalité 0 de generateOutfitWithFallback. Le repli était donc inerte
  // pour tout ce que R-B3 filtre (le bas au premier chef, le haut étant
  // exempté par ailleurs), et la sonde diagnostiquait "no_match" là où la
  // cause réelle était bien "formality_gap". Les paliers restent tentés dans
  // l'ordre, du plus formel au moins formel : une tenue qui passait déjà au
  // palier demandé est inchangée, seul le repli devient réellement effectif.
  const hardBaseNoOcc = hardCategoryFilter(seasonBase, formalityOverride);
  const hardBaseNoTemp = applyDeclaredOccasionFilter(hardBaseNoOcc);
  const hardBase = applyTempFilter(hardBaseNoTemp);
  // Dernier barreau du repli de poolFor — règles dures et météo appliquées,
  // seule l'occasion déclarée est relâchée.
  const hardBaseNoOccWithTemp = applyTempFilter(hardBaseNoOcc);

  // Chaussures/sacs/bijoux/accessoires restent toujours éligibles vis-à-vis du
  // filtrage d'occasion — conçus pour être reportés souvent, contrairement
  // aux vêtements filtrés plus strictement ci-dessous. Les règles dures
  // s'appliquent en revanche toujours, via hardCategoryFilter.
  //
  // Correctif 19/08/2026 (audit moteur) : l'ancien filtre heuristique par
  // mots-clés nom/couleur (occasionFit) produisait des associations
  // accidentelles plutôt que réellement pertinentes — ex. un pantalon
  // tailleur retenu pour "Sortie" uniquement parce qu'il était noir
  // (mot-clé de la regex "soiree"), tandis qu'une jupe ou un jean de
  // formalité identique étaient exclus faute de coïncidence lexicale.
  // La formalité par pièce (R-B3, déjà appliquée dans hardBase) est le
  // signal fiable — retiré, ne plus réintroduire de narrowing par
  // mots-clés ici.
  //
  // `essential` (correctif 26/08/2026) ouvre un dernier barreau de repli :
  // relâcher l'occasion déclarée plutôt que de laisser une catégorie
  // indispensable totalement vide. Réservé aux catégories dont l'absence
  // annule la tenue entière (haut, bas, robe/combinaison, chaussures) :
  // pour une veste ou un bijou, une catégorie vide est un résultat
  // acceptable, et réintroduire une pièce écartée y serait une régression.
  const poolFor = (cats: CategoryKey[], essential = false): Item[] => {
    if (cats.every((c) => ACCESSORY_CATS.includes(c))) {
      const seasonNoOcc = hardCategoryFilter(seasonPool, formalityOverride);
      const fullNoOcc = hardCategoryFilter(pool, formalityOverride);
      const seasonNoTemp = applyDeclaredOccasionFilter(seasonNoOcc);
      const fullNoTemp = applyDeclaredOccasionFilter(fullNoOcc);
      // Barreaux inchangés : saison+météo, saison seule (repli météo, cf.
      // commentaire applyTempFilter), puis hors saison. Les deux derniers
      // n'existent que pour une catégorie essentielle — chaussures : une
      // tenue sans chaussures après avoir relâché l'occasion sur le haut et
      // le bas serait incohérente.
      const ladder = [applyTempFilter(seasonNoTemp), seasonNoTemp, applyTempFilter(fullNoTemp), fullNoTemp];
      if (essential) ladder.push(applyTempFilter(fullNoOcc), fullNoOcc);
      for (const rung of ladder) {
        if (rung.filter((i) => cats.includes(i.cat)).length) return rung;
      }
      return ladder[ladder.length - 1];
    }
    const withTemp = hardBase.filter((i) => cats.includes(i.cat));
    if (withTemp.length) return withTemp;
    // Repli météo : jamais une catégorie essentielle (ex. le bas) totalement
    // vidée uniquement parce qu'aucune pièce de la capsule ne couvre la
    // météo du jour — cf. commentaire applyTempFilter.
    const noTemp = hardBaseNoTemp.filter((i) => cats.includes(i.cat));
    if (noTemp.length || !essential) return noTemp;
    // Repli occasion déclarée, en dernier — la météo reprend la priorité sur
    // ce barreau-ci, exactement comme au-dessus.
    const noOccWithTemp = hardBaseNoOccWithTemp.filter((i) => cats.includes(i.cat));
    return noOccWithTemp.length ? noOccWithTemp : hardBaseNoOcc.filter((i) => cats.includes(i.cat));
  };

  const chosen: Item[] = [];
  const pick = (cats: CategoryKey[], essential = true, extra?: (i: Item) => boolean) => {
    let base = poolFor(cats, essential).filter((i) => cats.includes(i.cat));
    // Priorité au réel sur un groupe de catégories fusionnées pour un même
    // tirage (correctif 22/08/2026, signalé : un jean réel ajouté au
    // dressing n'apparaissait presque jamais, noyé parmi les 20+ pantalons/
    // shorts/jupes suggérés de la capsule pour le même tirage "bas").
    // wardrobePool applique déjà "pièces réelles sinon capsule" catégorie
    // par catégorie exacte — mais BOTTOMS (pantalon+jean+short+jupe),
    // TOP_LAYER_CATS (haut+pull) et le groupe accessoire/bijou/sac d'un
    // remplacement manuel combinent plusieurs catégories dans un seul
    // tirage, où le réel d'une catégorie se retrouvait mélangé à parts
    // égales avec la capsule des autres. Dès qu'au moins une pièce réelle
    // existe dans ce groupe, la capsule est écartée pour CE tirage.
    //
    // Exception pour la pièce imposée (correctif 26/08/2026, signalé : un
    // article de la capsule n'affichait aucune idée de tenue dès qu'une pièce
    // réelle existait dans le même tirage). Sur "Les idées de tenues", la
    // question posée est "comment porter CETTE pièce" : l'écran l'ajoute au
    // pool, mais cette règle l'en réévinçait aussitôt, si bien qu'aucun des
    // 30 tirages × 10 occasions ne la contenait — écran vide, alors même que
    // la capsule regorgeait de pièces compatibles. Réintégrée ici comme
    // simple candidate à côté du réel (jamais à la place, jamais forcée) :
    // la priorité au réel reste entière pour toutes les autres pièces.
    // Affectait robes/combinaisons, bas, vestes, manteaux, sacs et bijoux —
    // les hauts et chaussures se tirent hors de pick() et y échappaient.
    const real = base.filter((i) => !isCatalogId(i.id));
    if (real.length) {
      const pinned = pinnedId != null && !real.some((i) => i.id === pinnedId) ? base.find((i) => i.id === pinnedId) : undefined;
      base = pinned ? [...real, pinned] : real;
    }
    // Préférence molle optionnelle passée par l'appelant (ex. R-S17
    // ci-dessous, "pas de robe chemise en sortie festive") — même esprit
    // que les autres filtres de cette fonction : jamais exclusive.
    if (extra) {
      const filtered = base.filter(extra);
      if (filtered.length) base = filtered;
    }
    // Préférence pluie (R-B16, recette 20/08/2026) — n'écarte rien, juste une
    // inclination pour une veste/un manteau qui résiste à la pluie quand il
    // pleut, seulement si ça laisse au moins une option (même esprit que
    // R-S10 ci-dessous, jamais de catégorie essentielle bloquée).
    if (isRainy(weather) && cats.some((c) => OUTERWEAR_CATS.includes(c))) {
      const rainResistant = base.filter((i) => i.resistePluie);
      if (rainResistant.length) base = rainResistant;
    }
    // Préférence pour la palette personnelle — n'écarte rien, juste une inclination
    // quand elle laisse assez d'options (R-S10, esprit "préférence molle, jamais exclusive").
    // Un article à FALLBACK_HEX (couleur jamais renseignée) échappe à ce
    // filtre (correctif 20/08/2026) : sinon il ne matche jamais la palette
    // et se fait donc écarter à CHAQUE tirage dès qu'une alternative dans
    // la palette existe — en pratique jamais choisi, pas juste "moins".
    const preferred = preferredHexes.length ? base.filter((i) => preferredHexes.includes(i.hex) || i.hex === FALLBACK_HEX) : [];
    const candidates = harmonize(preferred.length ? preferred : base, chosen, essential);
    const picked = rand(candidates);
    if (picked) chosen.push(picked);
    return picked;
  };
  const hasCat = (cats: CategoryKey[]) => pool.some((i) => cats.includes(i.cat));

  // minFormality suit formalityOverride quand fourni (cf. generateOutfitWithFallback)
  // — dressy (R-B6 baskets, layering habillé...) en découle directement,
  // plutôt que de rappeler isDressy() sur l'occasion brute, pour rester
  // cohérent avec le palier effectivement utilisé par ce tirage.
  const minFormality = formalityOverride ?? (occasion !== "all" ? effectiveFormality(occasion, workMode, dateContext) : 0);
  const dressy = minFormality >= 3;

  const ids: number[] = [];
  let compensatingVeste: Item | null = null;
  // Haut/robe retenu(e) trop frais(che) pour la météo (repli météo de
  // poolFor) — traqué pour la compensation R-B18 plus bas, une fois toutes
  // les couches probabilistes (veste, robeLayer, R-B8) déjà décidées.
  let primaryTop: Item | null = null;
  // Robe/jupe/short trop frais pour la météo (repli météo de poolFor,
  // cf. applyTempFilter) : compensé par un collant de saison plutôt que
  // simplement toléré tel quel — signalé le 21/08/2026 ("il faudrait
  // inciter à mettre un collant de la saison"), précisé ensuite : usage
  // féminin uniquement ("et que pour les femmes"), jamais pour un profil
  // homme (un short homme trop frais n'appelle pas de collant). Jamais non
  // plus pour un pantalon/jean (R-B19 — les collants ne se portent qu'avec
  // robe/jupe/short).
  //
  // Déclencheur élargi pour le short (26/08/2026, révision R-B19 — pas une
  // nouvelle règle) : en dehors de la période été (Automne/Hiver/Printemps),
  // un short reste possible (R-B20 ne l'exclut qu'en dessous de 22°C, pas
  // par saison) mais doit systématiquement être associé à un collant — plus
  // seulement dans le cas de repli météo. Jupe/robe gardent exactement
  // l'ancien déclencheur (repli météo uniquement), inchangé.
  let needsCollant = false;
  // Correctif 22/08/2026 (signalé : "aucune de mes combinaisons ne me soit
  // proposées dans les tenues recommandées") — ce tirage "pièce unique" ne
  // portait que sur la catégorie "robe", jamais "combinaison", alors que les
  // deux sont traitées comme équivalentes partout ailleurs dans ce fichier
  // (R-B5, compositionRoleOf côté écran...). Une combinaison réelle du
  // dressing n'avait donc littéralement aucune chance d'être choisie ici,
  // quel que soit le correctif harmonize() du 22/08/2026 sur le style — le
  // bug était en amont, dans la liste de catégories elle-même.
  const useRobe = Math.random() < 0.4 && poolFor(ONEPIECE_CATS, true).length > 0;
  if (useRobe) {
    // R-S17 (25/08/2026, signalé) — même principe que pour le haut ci-dessous :
    // pas de robe chemise en sortie festive, préférence molle.
    const r = pick(ONEPIECE_CATS, true, occasion === "festive" ? (i) => i.subtype !== "Chemise" : undefined);
    if (r) ids.push(r.id);
    primaryTop = r;
    // Collant seulement pour une robe (jambes nues) — une combinaison
    // couvre déjà les jambes comme un pantalon, R-B19 ne s'y applique pas.
    if (r && r.cat === "robe" && r.meteoMinTemp != null && weather.temp < r.meteoMinTemp) needsCollant = true;
  } else {
    // Formalité du haut compensée par une veste structurée (recette
    // 19/08/2026, audit moteur) : "t-shirt + blazer" doit pouvoir
    // constituer une tenue bureau valide. On ne cherche cette compensation
    // que si aucun haut n'atteint seul la formalité requise — jamais pour
    // le bas, qui doit rester autonome (poolFor(BOTTOMS) reste soumis au
    // plancher plein, cf. hardCategoryFilter).
    // P1 (levier de mesure, inerte par défaut) — sans lui la catégorie demandée
    // reste "haut" seule : aucun pull ne peut être haut principal.
    const ouverturePull = leviers?.pullCommeHautPrincipal;
    const hautCandidates = poolFor(ouverturePull ? TOP_LAYER_CATS : ["haut"], true).filter(
      (i) => i.cat !== "pull" || ouverturePull === "tous" || (ouverturePull === "base" && rolePieceOf(i) === "base")
    );
    // Correctif 26/08/2026 (signalé : un haut explicitement ouvert à
    // "festive" n'apparaissait jamais dans une tenue festive) — ce second
    // plancher rejouait formalityOf() brut sur le haut, sans reprendre
    // l'exemption que hardCategoryFilter accorde déjà à une occasion
    // déclarée sur la pièce (correctif 23/08/2026, R-B3). Une pièce que
    // R-B3 avait volontairement laissée passer était donc réexclue ici,
    // sauf à trouver une veste compensatrice — l'exemption n'avait plus
    // aucun effet là où elle comptait le plus. Le plancher reste entier
    // pour les pièces qui ne déclarent rien : la compensation par veste
    // garde tout son rôle, seule la déclaration explicite y échappe.
    const declaredForOccasion = (i: Item): boolean =>
      occasion !== "all" && Boolean(i.occasion && i.occasion.includes(occasion));
    const hautMeetingFloor = dressy
      ? hautCandidates.filter((i) => formalityOf(i) >= minFormality || declaredForOccasion(i))
      : hautCandidates;
    let hautPool = hautMeetingFloor;
    if (dressy && !hautMeetingFloor.length && hautCandidates.length) {
      const vesteCandidates = hardBase.filter((i) => i.cat === "veste" && formalityOf(i) >= minFormality);
      compensatingVeste = rand(harmonize(vesteCandidates, chosen, false));
      if (compensatingVeste) hautPool = hautCandidates;
    }
    // R-S17 (25/08/2026, signalé) — sortie festive : on privilégie un
    // haut, mais pas une chemise/chemisier (trop bureau/quotidien pour ce
    // contexte) — préférence molle, jamais exclusive : repli sur le pool
    // complet si aucune alternative n'existe.
    if (occasion === "festive") {
      const nonChemise = hautPool.filter((i) => !["Chemise", "Chemisier"].includes(i.subtype ?? ""));
      if (nonChemise.length) hautPool = nonChemise;
    }
    // Même exemption FALLBACK_HEX que dans pick() ci-dessus.
    const hautPreferred = preferredHexes.length ? hautPool.filter((i) => preferredHexes.includes(i.hex) || i.hex === FALLBACK_HEX) : [];
    const h = rand(harmonize(hautPreferred.length ? hautPreferred : hautPool, chosen, true));
    if (h) chosen.push(h);
    primaryTop = h;
    const b = pick(BOTTOMS);
    if (h) ids.push(h.id);
    if (b) ids.push(b.id);
    if (compensatingVeste) { chosen.push(compensatingVeste); ids.push(compensatingVeste.id); }
    if (b && b.cat === "jupe" && b.meteoMinTemp != null && weather.temp < b.meteoMinTemp) needsCollant = true;
    if (b && b.cat === "short" && currentSeasonKey() !== "Été") needsCollant = true;
  }
  if (needsCollant && gender === "femme") {
    // Recherche dédiée, jamais dérivée de poolFor (correctif 26/08/2026,
    // signalé) : l'échelle de replis des accessoires retient le premier
    // barreau contenant AU MOINS UN accessoire, pas nécessairement celui que
    // l'appelant cherche. Une ceinture — sans aucune contrainte de
    // température — validait donc le barreau filtré météo pour tout le
    // monde, et les collants, eux écartés par ce filtre sous leur
    // meteo_min_temp, disparaissaient avec lui. Mesuré : sur la capsule
    // Glamour Hiver, 100 % des pièces courtes sortaient avec collants à 2 °C
    // tant qu'ils étaient le seul accessoire, 0 % dès qu'on ajoutait une
    // ceinture. Une pièce sans rapport décidait du sort d'une autre.
    //
    // R-B19 étant une compensation thermique, la météo ne peut pas non plus
    // être un motif d'exclusion ici : on préfère la paire dont la plage
    // couvre la température du jour, mais on n'en laisse jamais aucune —
    // des jambes nues à 2 °C sont un défaut plus grave qu'un denier
    // imparfait.
    const allCollants = pool.filter((i) => i.cat === "accessoire" && i.accessoireType === "Collants");
    const inTemp = allCollants.filter(
      (i) =>
        (i.meteoMinTemp == null || weather.temp >= i.meteoMinTemp) && (i.meteoMaxTemp == null || weather.temp <= i.meteoMaxTemp)
    );
    const collantPool = inTemp.length ? inTemp : allCollants;
    const collant = rand(harmonize(collantPool, chosen, false));
    if (collant && !ids.includes(collant.id)) { chosen.push(collant); ids.push(collant.id); }
  }
  // Entretien + chemise : toujours un blazer/veste légère par-dessus,
  // peu importe météo/saison (nouveau 21/08/2026, décidé) — jamais
  // probabiliste comme vesteProbability pour le reste des occasions/hauts.
  const isChemise = (i: Item | null): boolean => !!i && !!i.subtype && i.subtype.toLowerCase().includes("chemise");
  const forceEntretienVeste = occasion === "entretien" && isChemise(primaryTop);

  // Veste décidée AVANT le calque haut/pull (correctif 21/08/2026, signalé :
  // veste + layering proposés ensemble) — une veste et un calque (chemise
  // ouverte, cardigan, gilet, sweat) jouent le même rôle de superposition ;
  // cumuler les deux est redondant et encombre visuellement la silhouette.
  let hasVeste = !!compensatingVeste;
  if (!hasVeste && (forceEntretienVeste || Math.random() < vesteProbability(occasion))) {
    const v = pick(["veste"], forceEntretienVeste);
    if (v) {
      hasVeste = true;
      if (!ids.includes(v.id)) ids.push(v.id);
    }
  }
  // Entretien + chemise, par temps froid : un manteau par-dessus (nouveau
  // 21/08/2026, décidé, "en hiver on met un manteau dessus"). Pas de
  // signal saison explicite disponible ici — la plage meteo_min_temp/
  // meteo_max_temp propre à chaque manteau fait déjà ce tri : si aucun
  // manteau de la capsule ne couvre la météo du jour, rien n'est ajouté,
  // jamais forcé hors de sa plage déclarée.
  if (forceEntretienVeste) {
    const manteau = pick(["manteau"], false);
    if (manteau && !ids.includes(manteau.id)) ids.push(manteau.id);
  }
  // R-B5 assoupli (nuance demandée le 19/08/2026) : une robe/combinaison
  // reste self-sufficient face à un haut/bas "base" (redondant), mais une
  // pièce role_piece = "calque" par-dessus (chemise ouverte, gilet léger)
  // est un vrai geste stylistique, jamais en contexte habillé — seulement
  // décontracté, jamais systématique, jamais non plus si une veste est déjà
  // dans la tenue (même rôle de superposition, cf. plus haut).
  if (useRobe && !dressy && !hasVeste && Math.random() < 0.3) {
    const robeLayerCandidates = hardBase.filter((i) => TOP_LAYER_CATS.includes(i.cat) && rolePieceOf(i) === "calque");
    const robeLayer = rand(harmonize(robeLayerCandidates, chosen, false));
    if (robeLayer) { chosen.push(robeLayer); ids.push(robeLayer.id); }
  }
  // R-B8 — superposition hauts/pulls_gilets (TOP_LAYER_CATS) : une 2e pièce
  // n'est ajoutée que si la 1ère (déjà choisie) est "base" et que la
  // candidate est "calque" — jamais 2 calques, jamais de calque en contexte
  // habillé sans validation manuelle (uniquement possible depuis le picker
  // manuel, pas ici), jamais non plus si une veste est déjà dans la tenue.
  if (!useRobe && !hasVeste && Math.random() < 0.35) {
    const firstLayer = chosen.find((c) => TOP_LAYER_CATS.includes(c.cat));
    if (firstLayer && rolePieceOf(firstLayer) === "base" && !dressy) {
      // La base déjà choisie ancre l'occasion : le calque n'a pas à repasser
      // par le narrowing heuristique d'occasion (son vocabulaire propre —
      // gilet, cardigan — ne recoupe pas forcément les mots-clés de
      // l'occasion), seulement par les règles dures (hardBase).
      // R-B10 (correctif 21/08/2026, signalé : "Chemise blanche" + "Chemise
      // oversize en lin" superposées) — evaluateBlocking() signale déjà deux
      // chemises/chemisiers ensemble, mais rien ne l'empêchait ici en amont :
      // la génération automatique est censée éviter ces combinaisons, pas
      // seulement les signaler après coup.
      const layerCandidates = hardBase.filter(
        (i) =>
          TOP_LAYER_CATS.includes(i.cat) &&
          !chosen.some((c) => c.id === i.id) &&
          // Un pull est superposable quelle que soit sa coupe (arbitrage
          // éditorial du 31/08/2026 : « un pull de coupe fine peut être proposé
          // par-dessus une chemise »). Le rôle "calque" reste la condition pour
          // un `haut` — un t-shirt ne se porte pas par-dessus une chemise, et
          // NEVER_LAYER_RE continue de l'en empêcher.
          //
          // Mesuré avant ouverture (audit pull-contrat, même exécution, 12 800
          // tenues par bras) : mortalité des pulls 53 -> 0, zéro nouvelle pièce
          // morte, couverture d'occasion 320/320 inchangée, violations de règles
          // dures 18,6 % contre 18,6 %, R-B9 à zéro, composition des tenues
          // inchangée. Aucun coût mesuré.
          //
          // Ce commentaire a d'abord affirmé « R-B8 et R-B5 en BAISSE ». RETIRÉ :
          // les bras de cette mesure ne partageaient pas leur flux aléatoire, et
          // ces deux écarts (696 -> 637, 15 -> 10) sont trop petits pour être
          // distingués du bruit. L'audit sème désormais ses tirages ; les cinq
          // constats ci-dessus, eux, tiennent — le premier parce qu'avant cette
          // ligne aucun chemin de code n'existait, donc la probabilité était
          // exactement nulle, et les autres parce qu'ils saturent ou portent sur
          // des écarts d'un ordre de grandeur.
          (rolePieceOf(i) === "calque" || (i.cat === "pull" && leviers?.pullNonSuperposable !== true)) &&
          !(isShirtLike(firstLayer) && isShirtLike(i)) &&
          // Mailles fermées — règle active par défaut (arbitrage 31/08/2026).
          (leviers?.superpositionMaillesFermees === true || !(isClosedKnit(firstLayer) && isClosedKnit(i)))
      );
      const layer = rand(harmonize(layerCandidates, chosen, false));
      if (layer) { chosen.push(layer); ids.push(layer.id); }
    }
  }
  // R-B18 (nouveau 21/08/2026, "en été si la température est en dessous du
  // min pour un débardeur, il faut porter un gilet dessus") : le haut/la
  // robe retenu(e) plus haut peut être sous son propre meteo_min_temp — cas
  // rare, seulement quand poolFor() a dû recourir à son repli météo faute
  // d'alternative. Compensation en dernier ressort, après les superpositions
  // probabilistes ci-dessus (veste, robeLayer, R-B8) : si l'une d'elles a
  // déjà ajouté une pièce calque/veste/manteau, la pièce est déjà couverte.
  // Sinon, on cherche explicitement un gilet/cardigan/pull calque ou une
  // veste/manteau dont le propre meteo_min_temp couvre la météo du jour, et
  // on l'ajoute d'office — jamais laissé tel quel silencieusement. Si
  // aucune pièce compatible n'existe dans le pool, signalé via missingCats
  // ("chaud"), même mécanisme que pour un bas manquant.
  let missingWarmth = false;
  if (primaryTop && primaryTop.meteoMinTemp != null && weather.temp < primaryTop.meteoMinTemp) {
    const alreadyCompensated = chosen.some(
      (c) => c.id !== primaryTop!.id && (c.cat === "pull" || OUTERWEAR_CATS.includes(c.cat))
    );
    if (!alreadyCompensated) {
      const compensationCandidates = hardBaseNoTemp.filter((i) => {
        if (chosen.some((c) => c.id === i.id)) return false;
        const isCalquePull = i.cat === "pull" && rolePieceOf(i) === "calque";
        if (!isCalquePull && !OUTERWEAR_CATS.includes(i.cat)) return false;
        return i.meteoMinTemp == null || weather.temp >= i.meteoMinTemp;
      });
      const compensation = rand(harmonize(compensationCandidates, chosen, false));
      if (compensation) { chosen.push(compensation); ids.push(compensation.id); }
      else missingWarmth = true;
    }
  }
  const sh = (() => {
    // Les baskets sont déjà exclues en amont si l'occasion est habillée (R-B6, hardCategoryFilter).
    let shoePool = poolFor(["chaussures"], true).filter((i) => i.cat === "chaussures");
    // Préférence de style par occasion (R-S16, recette 20/08/2026) — ex.
    // talons favorisés pour une sortie festive (cf. OCCASION_STYLE_PREFS) —
    // n'écarte rien, juste une inclination si ça laisse au moins une option
    // (même esprit que R-S10/R-B15/R-B16).
    const shoeTypePrefs = OCCASION_STYLE_PREFS[occasion]?.shoeTypes;
    if (shoeTypePrefs?.length) {
      const styled = shoePool.filter((i) => i.shoeType && shoeTypePrefs.includes(i.shoeType));
      if (styled.length) shoePool = styled;
    }
    const picked = rand(harmonize(shoePool, chosen, true));
    if (picked) chosen.push(picked);
    return picked;
  })();
  if (sh) ids.push(sh.id);
  // Bijou/accessoire restent facultatifs (recette 19/08/2026, sac passé
  // essentiel le 22/08/2026 — cf. plus bas) : le contexte influence leur
  // probabilité sans jamais devenir une obligation (accessoryProbabilities
  // ci-dessus) — bijoux/accessoires habillés plus pertinents pour une
  // cérémonie.
  const accProb = accessoryProbabilities(occasion, workMode);
  // Sac désormais essentiel (recette 22/08/2026, "pour chaque tenue
  // recommandée sauf télétravail et cocooning je devrais avoir un sac") —
  // essential=true, comme haut/bas/chaussures. Pas de garde explicite sur
  // le contexte "à la maison" : applySportCocooningFilter (R-B14) a déjà
  // vidé la catégorie sac du pool pour Cocooning/Télétravail, donc pick()
  // n'y renvoie naturellement rien. En Sport, applySportCocooningFilter
  // restreint déjà les candidats aux seuls Sac de sport (R-B11).
  const sac = pick(["sac"], true);
  if (sac && !ids.includes(sac.id)) ids.push(sac.id);
  // Gourde systématique en Sport (décidé 26/08/2026) — jamais probabiliste,
  // même esprit que la veste forcée d'un entretien avec chemise (cf.
  // forceEntretienVeste) : la gourde est fonctionnelle, pas un accessoire
  // esthétique tiré au sort. Hors harmonize() délibérément — en mode
  // facultatif, l'harmonisation couleur peut omettre la pièce sur un simple
  // conflit de teinte, ce qui casserait la garantie ; une gourde n'a pas à
  // s'accorder à la tenue. Déjà exclue de toutes les autres occasions par
  // applySportCocooningFilter, et retirée du tirage facultatif ci-dessous
  // pour ne jamais en proposer deux.
  if (occasion === "sport") {
    const gourde = rand(poolFor(["accessoire"]).filter((i) => i.cat === "accessoire" && i.accessoireType === "Gourde"));
    if (gourde && !ids.includes(gourde.id)) { chosen.push(gourde); ids.push(gourde.id); }
  }
  if (Math.random() < accProb.bijou) {
    const bijou = pick(["bijou"], false);
    if (bijou && !ids.includes(bijou.id)) ids.push(bijou.id);
  }
  if (Math.random() < accProb.accessoire) {
    // R-B19 — les collants ne se portent qu'avec une robe, une jupe ou un
    // short (jamais avec un pantalon/jean) : exclus du tirage sinon, sans
    // affecter les autres accessoires. La température reste prise en compte
    // séparément par le filtre générique meteo_min_temp/meteo_max_temp
    // (déjà appliqué à toutes les catégories, cf. hardCategoryFilter) — à
    // renseigner sur l'article Collants côté catalogue pour l'exclure par
    // temps chaud, quelle que soit la pièce du bas choisie.
    // R-B19 : useRobe seul ne suffit plus à autoriser les collants — il
    // couvre désormais aussi la combinaison (jambes déjà couvertes, cf.
    // plus haut), qui ne doit pas en déclencher.
    const hasRobeJupeOuShort = primaryTop?.cat === "robe" || chosen.some((c) => c.cat === "jupe" || c.cat === "short");
    const accessoireBase = poolFor(["accessoire"]).filter(
      (i) =>
        i.cat === "accessoire" &&
        (hasRobeJupeOuShort || i.accessoireType !== "Collants") &&
        // En Sport, la gourde est déjà ajoutée systématiquement ci-dessus.
        (occasion !== "sport" || i.accessoireType !== "Gourde")
    );
    const ac = rand(harmonize(accessoireBase, chosen, false));
    if (ac) chosen.push(ac);
    if (ac && !ids.includes(ac.id)) ids.push(ac.id);
  }

  // Sac/bijou désormais facultatifs (recette 19/08/2026) : leur absence
  // n'est plus jamais signalée comme un manque, seuls les éléments
  // structurants (haut+bas/robe, chaussures) le sont.
  const missingCats: (CategoryKey | "bas" | "chaud")[] = [];
  if (!useRobe) {
    if (!hasCat(["haut"])) missingCats.push("haut");
    if (!hasCat(BOTTOMS)) missingCats.push("bas");
  }
  if (!hasCat(["chaussures"])) missingCats.push("chaussures");
  if (missingWarmth) missingCats.push("chaud");

  return { ids: Array.from(new Set(ids)), missingCats };
}

/**
 * Repli progressif de formalité (nouveau 21/08/2026, décidé) : le
 * niveau_formalite ciblé par l'occasion est une CIBLE, pas une condition
 * bloquante — quand aucune tenue complète (haut+bas, ou robe/combinaison)
 * n'existe au palier idéal, on redescend d'un palier et on relance TOUTE
 * la génération (pas seulement la pièce en défaut), jusqu'à trouver une
 * tenue complète ou épuiser les paliers autorisés par FORMALITY_FALLBACK_CHAIN
 * (décontracté et sport n'ont aucun repli). Les autres critères (genre,
 * saison, météo, occasion, style, règles de composition...) restent
 * intacts à chaque palier — seul niveau_formalite change, via
 * formalityOverride passé à generateOutfit. Remplace le patch posé plus
 * tôt le même jour (haut/veste/bas assouplis séparément, un seul palier) :
 * ici la formalité redescend pour LA TENUE ENTIÈRE en une fois, jamais
 * pièce par pièce, pour éviter de dupliquer la même règle à deux endroits.
 */
const FORMALITY_FALLBACK_CHAIN: Record<number, number[]> = {
  4: [4, 3, 1], // habillé -> business_casual -> décontracté
  3: [3, 1], // business_casual -> décontracté
  1: [1], // décontracté : aucun repli
  0: [0], // sport : aucun repli
};

/** Une tenue a un socle vestimentaire valide : haut+bas, ou une pièce robe/combinaison — jamais seulement chaussures/accessoires (section 5, "lunettes + mocassins ≠ tenue valide"). */
function hasCoreOutfit(ids: number[], pool: Item[], leviers?: LeviersMesure): boolean {
  const items = ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  if (items.some((i) => i.cat === "robe" || i.cat === "combinaison")) return true;
  // Second verrou de P1, distinct du tirage lui-même : sans le levier, un
  // socle "pull + bas" n'est PAS reconnu comme une tenue valide, donc
  // attemptCoreOutfit le rejette et retente jusqu'à retomber sur un haut ou
  // une robe. Mesurer P1 sans ouvrir aussi ce point ne mesure pas P1 : cela
  // mesure son échec, et déplace massivement la composition vers la robe.
  const ouverturePull = leviers?.pullCommeHautPrincipal;
  const estSocle = (i: Item) =>
    i.cat === "haut" ||
    (i.cat === "pull" && (ouverturePull === "tous" || (ouverturePull === "base" && rolePieceOf(i) === "base")));
  return items.some(estSocle) && items.some((i) => BOTTOMS.includes(i.cat));
}

export interface GeneratedOutfitWithFallback extends GeneratedOutfit {
  /** Palier de formalité initialement visé par l'occasion (0 sport / 1 décontracté / 3 business_casual / 4 habillé). */
  requestedFormality: number;
  /** Palier effectivement utilisé pour produire cette tenue. */
  resolvedFormality: number;
  /** true si resolvedFormality < requestedFormality — badge "Meilleure alternative" côté UI plutôt que "Recommandé". */
  formalityDowngraded: boolean;
  /** true si aucun palier autorisé n'a permis de constituer une tenue complète — ids vide volontairement, état vide à afficher côté UI plutôt qu'une tenue chaussures/accessoires seuls. */
  noCompleteOutfit: boolean;
  /** Raison structurée de l'échec (cf. OutfitFailureReason) — toujours défini quand noCompleteOutfit est true, jamais sinon. */
  reason?: OutfitFailureReason;
}

/**
 * Nombre de tirages retentés par palier avant d'abandonner ce palier
 * (correctif 23/08/2026, signalé : "Travail / Bureau" resté vide malgré une
 * combinaison réelle explicitement éligible et une capsule bien fournie,
 * après plusieurs correctifs qui réglaient chacun un vrai problème sans
 * jamais être la cause de CE symptôme précis) — useRobe (plus bas dans
 * generateOutfit) ne tente le chemin robe/combinaison qu'un tirage sur 2,5
 * en moyenne (Math.random() < 0.4). Un seul appel par palier, comme avant ce
 * correctif, faisait donc échouer ~60% du temps un pool où SEUL ce chemin
 * est valide (aucun haut+bas complet) — un pur coup de malchance, jamais un
 * problème de règles. Même esprit que getOutfitsForItem (30 tentatives) :
 * aucune règle relâchée, seulement assez d'essais pour que le hasard
 * n'invente pas un échec qui n'existe pas dans les données.
 */
const MAX_ATTEMPTS_PER_TIER = 20;

function attemptCoreOutfit(
  pool: Item[],
  weather: Weather,
  occasion: OccasionKey,
  workMode: WorkMode,
  dateContext: DateContext,
  preferredHexes: string[],
  gender: "femme" | "homme" | null,
  formalityOverride: number,
  capsuleSeason?: CapsuleSeason | null,
  leviers?: LeviersMesure
): GeneratedOutfit {
  let result = generateOutfit(pool, weather, occasion, workMode, dateContext, preferredHexes, gender, formalityOverride, undefined, capsuleSeason, leviers);
  for (let attempt = 1; attempt < MAX_ATTEMPTS_PER_TIER && !hasCoreOutfit(result.ids, pool, leviers); attempt++) {
    result = generateOutfit(pool, weather, occasion, workMode, dateContext, preferredHexes, gender, formalityOverride, undefined, capsuleSeason, leviers);
  }
  return result;
}

export function generateOutfitWithFallback(
  pool: Item[],
  weather: Weather,
  occasion: OccasionKey,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  preferredHexes: string[] = [],
  gender: "femme" | "homme" | null = null,
  /**
   * Saison de la capsule dont `pool` est issu, quand il en existe une
   * (correctif 29/08/2026, défaut démontré). Le référentiel SAISONNIER vient
   * alors de la capsule, jamais de la température : `representativeWeatherFor`
   * dérive son bucket de la température (16 °C au printemps -> "Automne /
   * Hiver" via weatherSeasonBucket, seuil 20), tandis que la capsule Printemps
   * est bâtie sur "Printemps / Été" (capsuleSeasonBucket). Le filtre ci-dessous
   * écartait donc 20,4 % de la capsule de printemps, pour les dix occasions.
   *
   * La météo continue de gouverner tout le reste — température, bornes
   * meteo_min_temp/meteo_max_temp, pluie, soleil : une pièce de la bonne
   * saison mais hors de ses bornes thermiques reste exclue. Non renseigné,
   * le comportement météo d'origine est strictement conservé (tenue du jour).
   */
  capsuleSeason?: CapsuleSeason | null,
  /** Leviers de mesure — inertes par défaut, cf. LeviersMesure. */
  leviers?: LeviersMesure
): GeneratedOutfitWithFallback {
  const requestedFormality = occasion !== "all" ? effectiveFormality(occasion, workMode, dateContext) : 0;
  const chain = FORMALITY_FALLBACK_CHAIN[requestedFormality] ?? [requestedFormality];
  for (const tier of chain) {
    const result = attemptCoreOutfit(pool, weather, occasion, workMode, dateContext, preferredHexes, gender, tier, capsuleSeason, leviers);
    if (hasCoreOutfit(result.ids, pool, leviers)) {
      return { ...result, requestedFormality, resolvedFormality: tier, formalityDowngraded: tier !== requestedFormality, noCompleteOutfit: false };
    }
  }
  // Section 7 — aucun palier autorisé n'a produit de tenue complète :
  // jamais afficher une fausse combinaison chaussures/accessoires seuls,
  // ids vide pour que l'UI affiche un état vide explicite.
  //
  // Raison structurée (recette 22/08/2026, brief design "empty state" —
  // remplace le message générique unique par un message pertinent à la
  // cause réelle, sans jamais inventer un diagnostic côté frontend) :
  // dérivée de deux vérifications bon marché, jamais une réécriture du
  // moteur.
  // 1. missing_required_category : le pool n'a structurellement AUCUN
  //    haut+bas ni robe/combinaison, indépendamment de tout filtre —
  //    il manque une catégorie indispensable, pas juste une pièce adaptée
  //    à cette occasion précise.
  // 2. formality_gap : sinon, une sonde à formalité 0 (jamais tentée par
  //    FORMALITY_FALLBACK_CHAIN pour une occasion non-sport, par choix
  //    produit délibéré) — si elle réussit, le seul obstacle réel était le
  //    plancher de formalité, pas une absence de pièces.
  // 3. no_match : repli générique (le plus souvent occasion déclarée sur
  //    les pièces, ou conflit météo — non distingués plus finement ici
  //    pour ne pas inventer une cause non vérifiée).
  const hasAnyTop = pool.some((i) => i.cat === "haut");
  const hasAnyBottom = pool.some((i) => BOTTOMS.includes(i.cat));
  const hasAnyOnepiece = pool.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const hasStructuralOption = (hasAnyTop && hasAnyBottom) || hasAnyOnepiece;
  let reason: OutfitFailureReason;
  if (!hasStructuralOption) {
    reason = "missing_required_category";
  } else {
    const probe = attemptCoreOutfit(pool, weather, occasion, workMode, dateContext, preferredHexes, gender, 0, capsuleSeason, leviers);
    reason = hasCoreOutfit(probe.ids, pool, leviers) ? "formality_gap" : "no_match";
  }
  return {
    ids: [],
    missingCats: ["haut", "bas"],
    requestedFormality,
    resolvedFormality: requestedFormality,
    formalityDowngraded: false,
    noCompleteOutfit: true,
    reason,
  };
}

/**
 * Remplace une pièce de la tenue par une autre de la même famille de
 * catégorie, en priorité une qui s'accorde avec le reste de la tenue.
 * Les baskets sont écartées du tirage si l'occasion est habillée (R-B6).
 */
export function swapOutfitPiece(
  outfitItems: Item[],
  pool: Item[],
  pieceId: number,
  cat: CategoryKey,
  occasion: OccasionKey = "all",
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  weather?: Weather
): number[] {
  const catGroup: CategoryKey[] =
    BAS_CATS.includes(cat) ? BOTTOMS : cat === "accessoire" ? ["accessoire", "bijou", "sac"] : [cat];
  let candidates = pool.filter((i) => catGroup.includes(i.cat) && i.id !== pieceId);
  // Priorité au réel sur le groupe accessoire/bijou/sac — même correctif
  // 22/08/2026 que dans generateOutfit (cf. son commentaire) : pas
  // seulement à la génération automatique, aussi lors d'un remplacement manuel.
  const realCandidates = candidates.filter((i) => !isCatalogId(i.id));
  if (realCandidates.length) candidates = realCandidates;
  // Correctif 21/08/2026 (signalé : deux sacs dans la même tenue) — "sac" est
  // regroupé avec accessoire/bijou pour élargir les options d'échange, mais
  // jamais si un sac est déjà présent ailleurs dans la tenue.
  if (catGroup.includes("sac") && outfitItems.some((i) => i.cat === "sac" && i.id !== pieceId)) {
    candidates = candidates.filter((i) => i.cat !== "sac");
  }
  // R-B11/R-B12/R-B13/R-B14 — jamais relâchées, y compris sur un échange
  // manuel (fonction partagée avec generateOutfit, un seul endroit à tenir à jour).
  candidates = applySportCocooningFilter(candidates, occasion, workMode);
  // R-B18 — symétrique du filtre appliqué dans generateOutfit.
  if (occasion === "travail_formel" && workMode === "Télétravail") {
    candidates = candidates.filter((i) => i.cat !== "accessoire");
  }
  // R-B3 — symétrique du filtre appliqué dans generateOutfit, avec la même
  // compensation "haut sous veste structurée" (correctif 19/08/2026) : si
  // le reste de la tenue comporte déjà une veste assez formelle, le haut de
  // remplacement n'est pas soumis au plancher de formalité — jamais le bas.
  // Correctif 23/08/2026 : même exemption qu'à la génération automatique
  // (cf. son commentaire) pour une pièce dont l'occasion a été déclarée
  // explicitement — sinon un remplacement manuel pouvait exclure une pièce
  // que l'utilisatrice avait pourtant explicitement associée à cette occasion.
  if (occasion !== "all") {
    const minFormality = effectiveFormality(occasion, workMode, dateContext);
    const hasCompensatingVeste = outfitItems.some(
      (i) => i.id !== pieceId && i.cat === "veste" && formalityOf(i) >= minFormality
    );
    candidates = candidates.filter(
      (i) =>
        !CLOTHING_CATS.includes(i.cat) ||
        Boolean(i.occasion && i.occasion.includes(occasion)) ||
        (TOP_LAYER_CATS.includes(i.cat) && hasCompensatingVeste) ||
        formalityOf(i) >= minFormality
    );
    // Occasion explicitement déclarée sur la pièce (correctif 19/08/2026).
    // Relâchée plutôt que de ne proposer aucune alternative (correctif
    // 26/08/2026, symétrique du repli de poolFor à la génération) : la tenue
    // affichée peut désormais contenir une pièce retenue justement parce que
    // ce filtre avait vidé sa catégorie, "changer cette pièce" ne doit pas
    // se retrouver sans candidat pour cette même raison.
    const declaredOk = candidates.filter((i) => declaredOccasionOk(i, occasion));
    if (declaredOk.length) candidates = declaredOk;
  }
  // R-B6 — symétrique du filtre appliqué dans generateOutfit, jamais relâchée.
  if (isDressy(occasion, workMode, dateContext)) {
    candidates = candidates.filter((i) => i.cat !== "chaussures" || i.shoeType !== "Baskets");
  }
  // R-B15 — symétrique du filtre appliqué dans generateOutfit.
  if (weather && !isSunny(weather)) {
    candidates = candidates.filter((i) => !i.necessiteSoleil);
  }
  // R-B20 — symétrique du filtre appliqué dans generateOutfit, jamais relâchée.
  if (weather && weather.temp <= 22) {
    candidates = candidates.filter((i) => i.cat !== "short");
  }
  // R-B21 — symétrique du filtre appliqué dans generateOutfit, jamais relâchée.
  if (weather && isRainy(weather)) {
    candidates = candidates.filter((i) => i.cat !== "chaussures" || !i.shoeType || !SANDAL_SHOE_TYPES.includes(i.shoeType));
  }
  // R-B16 — symétrique de la préférence pluie appliquée dans generateOutfit,
  // molle jamais exclusive : ne filtre que s'il reste au moins une option.
  if (weather && isRainy(weather) && OUTERWEAR_CATS.includes(cat)) {
    const rainResistant = candidates.filter((i) => i.resistePluie);
    if (rainResistant.length) candidates = rainResistant;
  }
  // R-S16 — symétrique de la préférence de style par occasion appliquée
  // dans generateOutfit (cf. OCCASION_STYLE_PREFS), molle jamais exclusive.
  if (cat === "chaussures") {
    const shoeTypePrefs = OCCASION_STYLE_PREFS[occasion]?.shoeTypes;
    if (shoeTypePrefs?.length) {
      const styled = candidates.filter((i) => i.shoeType && shoeTypePrefs.includes(i.shoeType));
      if (styled.length) candidates = styled;
    }
  }
  // R-S17 — symétrique du filtre appliqué dans generateOutfit : pas de
  // chemise/chemisier (haut) ni de robe chemise en sortie festive, molle
  // jamais exclusive.
  if (occasion === "festive" && (cat === "haut" || cat === "robe" || cat === "combinaison")) {
    const nonChemise = candidates.filter((i) => !["Chemise", "Chemisier"].includes(i.subtype ?? ""));
    if (nonChemise.length) candidates = nonChemise;
  }
  // Plage de température — symétrique du filtre appliqué dans generateOutfit.
  if (weather) {
    candidates = candidates.filter((i) => {
      if (i.meteoMinTemp != null && weather.temp < i.meteoMinTemp) return false;
      if (i.meteoMaxTemp != null && weather.temp > i.meteoMaxTemp) return false;
      return true;
    });
  }
  // R-B19 — symétrique du filtre appliqué dans generateOutfit : les collants
  // ne remplacent jamais un accessoire si le reste de la tenue ne comporte
  // ni robe, ni jupe, ni short. La température reste gérée séparément par
  // le filtre générique meteo_min_temp/meteo_max_temp ci-dessus.
  if (cat === "accessoire") {
    const hasRobeJupeOuShort = outfitItems.some(
      (i) => i.id !== pieceId && (i.cat === "robe" || i.cat === "jupe" || i.cat === "short")
    );
    if (!hasRobeJupeOuShort) {
      candidates = candidates.filter((i) => i.cat !== "accessoire" || i.accessoireType !== "Collants");
    }
  }
  if (!candidates.length) return outfitItems.map((i) => i.id);
  const rest = outfitItems.filter((i) => i.id !== pieceId);
  const next = rand(harmonize(candidates, rest));
  if (!next) return outfitItems.map((i) => i.id);
  return outfitItems.map((i) => (i.id === pieceId ? next.id : i.id));
}

/** Une règle bloquante déclenchée, avec son message en langage simple (jamais le nom technique côté UI). */
export interface BlockingHit {
  id: string;
  message: string;
  /** R-B9 uniquement : bloque réellement la sauvegarde (contrairement aux autres règles, juste signalées). */
  hard?: boolean;
}

/**
 * Évalue les 10 règles bloquantes (R-B1 à R-B10) sur un ensemble de pièces.
 * Sauf R-B9, aucune n'empêche la sauvegarde : sert uniquement à afficher un
 * bandeau doux, non alarmant, quand une règle est contournée manuellement
 * (Création de looks). La génération automatique, elle, évite ces
 * combinaisons en amont via generateOutfit/harmonize.
 */
export function evaluateBlocking(
  pieces: Item[],
  occasion: OccasionKey,
  weather: Weather,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre"
): BlockingHit[] {
  const hits: BlockingHit[] = [];
  const clothing = pieces.filter((i) => CLOTHING_CATS.includes(i.cat));

  if (pieces.some((i) => i.season !== "Toutes saisons" && !weather.seasons.includes(i.season))) {
    hits.push({ id: "R-B1", message: "Une pièce n'est pas vraiment de saison aujourd'hui." });
  }

  if (clothing.length >= 2) {
    const formalities = clothing.map(formalityOf);
    if (Math.max(...formalities) - Math.min(...formalities) > 2) {
      hits.push({ id: "R-B2", message: "Le niveau habillé de cette tenue est assez contrasté d'une pièce à l'autre." });
    }
  }

  if (occasion !== "all" && clothing.length) {
    const minFormalityRequired = effectiveFormality(occasion, workMode, dateContext);
    // Correctif 19/08/2026 : une veste structurée compense la formalité du
    // haut (ex. "t-shirt + blazer" pour le bureau), cf. generateOutfit —
    // exclut le haut du calcul quand une telle veste est présente, jamais
    // le bas.
    const hasCompensatingVeste = pieces.some((i) => i.cat === "veste" && formalityOf(i) >= minFormalityRequired);
    const relevant = hasCompensatingVeste ? clothing.filter((i) => !TOP_LAYER_CATS.includes(i.cat)) : clothing;
    const minFormality = relevant.length ? Math.min(...relevant.map(formalityOf)) : minFormalityRequired;
    if (minFormality < minFormalityRequired) {
      hits.push({ id: "R-B3", message: "Cette tenue est peut-être un peu trop décontractée pour l'occasion choisie." });
    }
  }

  const hasRobeOrCombi = pieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const topBottom = clothing.filter((i) => TOP_OR_BOTTOM_CATS.includes(i.cat));
  if (!hasRobeOrCombi && topBottom.length === 2) {
    const [a, b] = topBottom;
    const ca = coupeOf(a);
    const cb = coupeOf(b);
    if (ca === cb && ca !== "regular") {
      hits.push({
        id: "R-B4",
        message:
          ca === "oversize"
            ? "Haut et bas très amples ensemble, essaie d'équilibrer avec une pièce plus près du corps."
            : "Haut et bas très ajustés ensemble, essaie d'apporter un peu de volume.",
      });
    }
  }

  // R-B5 assoupli (nuance demandée le 19/08/2026, cf. generateOutfit) : un
  // bas, ou un haut "base", n'a pas de sens à côté d'une robe/combinaison —
  // mais un haut "calque" (chemise ouverte, gilet léger) en contexte
  // décontracté est un vrai geste stylistique, jamais signalé.
  if (hasRobeOrCombi) {
    const dressy = isDressy(occasion, workMode, dateContext);
    const offending = pieces.some((i) => {
      if (!TOP_OR_BOTTOM_CATS.includes(i.cat)) return false;
      if (!TOP_LAYER_CATS.includes(i.cat)) return true; // un bas n'a jamais de sens ici
      return dressy || rolePieceOf(i) !== "calque";
    });
    if (offending) {
      hits.push({ id: "R-B5", message: "Une robe ou une combinaison se suffit à elle-même, sans haut ni bas en plus." });
    }
  }

  const dressy = isDressy(occasion, workMode, dateContext);
  if (dressy && pieces.some((i) => i.cat === "chaussures" && i.shoeType === "Baskets")) {
    hits.push({ id: "R-B6", message: "Les baskets sont peut-être trop décontractées pour cette occasion." });
  }

  if (clothing.some(recentlyWorn)) {
    hits.push({ id: "R-B7", message: "Une pièce de cette tenue a déjà été portée il y a moins de 2 jours." });
  }

  const tops = pieces.filter((i) => TOP_LAYER_CATS.includes(i.cat));
  if (tops.length) {
    const roles = tops.map(rolePieceOf);
    const calqueCount = roles.filter((r) => r === "calque").length;
    if (calqueCount >= 2) {
      hits.push({ id: "R-B8", message: "Deux pièces amples superposées en même temps, essaie d'en retirer une." });
    } else if (calqueCount === 1 && dressy) {
      hits.push({ id: "R-B8", message: "Une pièce ample en superposition dans un contexte habillé, à valider toi-même." });
    }
  }

  // R-B9 — une veste ou un manteau seul ne fait pas une tenue complète.
  // Seule règle qui bloque réellement la sauvegarde (cf. section 6 du brief).
  if (violatesOuterwearRule(pieces)) {
    hits.push({
      id: "R-B9",
      message: "Ajoute un haut, une robe ou une combinaison sous ta veste pour compléter la tenue.",
      hard: true,
    });
  }

  // R-B10 — deux chemises/chemisiers en même temps, quel que soit leur rôle.
  const shirtLike = pieces.filter((i) => i.subtype === "Chemise" || i.subtype === "Chemisier");
  if (shirtLike.length >= 2) {
    hits.push({ id: "R-B10", message: "Deux chemises dans la même tenue, essaie d'en retirer une." });
  }

  return hits;
}

/** Résultat du scoring d'une tenue complète (R-S1 à R-S11, plus suggestions proactives R-S12 à R-S14). */
export interface LookScore {
  score: number;
  badge: "recommande" | "neutre" | "ajuster";
  /** Message ciblé sur la règle de scoring la plus pénalisante, seulement si badge === "ajuster". */
  adjustMessage: string;
  /** Suggestions proactives dismissibles (R-S12/R-S13/R-S14) — indépendantes, plusieurs peuvent s'afficher à la fois. */
  proactives: {
    key: string;
    text: string;
    /** Pièce concrète du catalogue à suggérer (R-S13/R-S14 uniquement, recette 23/08/2026) — présent seulement si une pièce avec lien_affiliation a été trouvée dans le pool ; jamais pour R-S12 (layering). */
    suggestedId?: number;
  }[];
}

/**
 * Calcule le score d'une tenue complète (R-S1 à R-S11). Non bloquant :
 * une tenue reste toujours proposable quel que soit son score. Seuils :
 * ≥80 recommandé, 50-79 neutre, <50 bandeau d'ajustement ciblé sur la
 * règle la plus pénalisante (jamais cumulé, jamais le nom technique).
 */
export function computeLookScore(
  pieces: Item[],
  occasion: OccasionKey,
  paletteHexList: string[],
  morphology: string | null,
  dismissed: Set<string>,
  weather: Weather,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  /**
   * Pool actif (recette 23/08/2026, extension du mécanisme d'achat aux
   * suggestions R-S13/R-S14) — sert uniquement à identifier une pièce
   * concrète du catalogue à suggérer (avec lien_affiliation) pour ces deux
   * cartes ; jamais consulté ailleurs dans cette fonction. Facultatif : les
   * autres appelants (CreateLookScreen, getOutfitsForItem) n'ont pas besoin
   * de cette suggestion et continuent de fonctionner sans y toucher.
   */
  pool: Item[] = []
): LookScore {
  const clothing = pieces.filter((i) => CLOTHING_CATS.includes(i.cat));
  const accessories = pieces.filter((i) => ACCESSORY_CATS.includes(i.cat));
  const penalties: [number, string][] = [];
  const bonuses: number[] = [];

  // R-S1 — sobriété chromatique
  const nonNeutralClothingHex = new Set(clothing.filter((i) => !isNeutralColor(i.color)).map((i) => i.hex));
  if (nonNeutralClothingHex.size > 3) {
    penalties.push([10, "Cette tenue a beaucoup de couleurs, essaie d'en retirer une."]);
  }

  // R-S2 — harmonie cercle chromatique (bijou exclu, simple accent métallique)
  const nonNeutralAll = pieces.filter((i) => i.cat !== "bijou" && !isNeutralColor(i.color));
  let harmonious = false;
  for (let i = 0; i < nonNeutralAll.length && !harmonious; i++) {
    for (let j = i + 1; j < nonNeutralAll.length; j++) {
      if (nonNeutralAll[i].hex !== nonNeutralAll[j].hex && huesHarmonious(nonNeutralAll[i].hex, nonNeutralAll[j].hex)) {
        harmonious = true;
        break;
      }
    }
  }
  if (harmonious) bonuses.push(15);

  // R-S3 — règle 60/30/10 (approximation sur poids par catégorie, pas de vraie surface)
  const WEIGHT: Partial<Record<CategoryKey, number>> = {
    haut: 3, pantalon: 3, jean: 3, short: 3, robe: 3, combinaison: 3, jupe: 3, pull: 3, veste: 3, manteau: 3,
    chaussures: 1, sac: 1, bijou: 1, accessoire: 1,
  };
  const colorWeights = new Map<string, number>();
  pieces.forEach((i) => colorWeights.set(i.hex, (colorWeights.get(i.hex) || 0) + (WEIGHT[i.cat] || 1)));
  const totalW = [...colorWeights.values()].reduce((a, b) => a + b, 0);
  const sortedW = [...colorWeights.values()].sort((a, b) => b - a);
  const topShare = totalW ? sortedW[0] / totalW : 0;
  const secondShare = totalW && sortedW[1] ? sortedW[1] / totalW : 0;
  if (topShare >= 0.5 && secondShare <= 0.35) bonuses.push(10);

  // R-S4 — mélange de métaux
  const metals = new Set(pieces.map(metalOf).filter((m) => m !== "aucun"));
  if (metals.size > 1) penalties.push([5, "Tes bijoux mélangent or et argent."]);

  // R-S5 — une seule pièce statement
  const statementCount = pieces.filter(isStatement).length;
  if (statementCount >= 2) {
    penalties.push([15, "Deux pièces qui attirent l'œil en même temps, essaie d'en adoucir une."]);
  }

  // R-S6 — cohérence chaussures/tenue
  const shoe = pieces.find((i) => i.cat === "chaussures");
  if (shoe && (isNeutralColor(shoe.color) || clothing.some((i) => i.hex === shoe.hex))) {
    bonuses.push(10);
  }

  // R-S7 — compétition sac/chaussures
  const bag = pieces.find((i) => i.cat === "sac");
  if (bag && shoe && isStatement(bag) && isStatement(shoe)) {
    penalties.push([10, "Ton sac et tes chaussures sont tous les deux très affirmés."]);
  }

  // R-S8 — variété de matières (bijou exclu, pas de "matière" tissu pertinente)
  const matieres = new Set(pieces.filter((i) => i.cat !== "bijou").map(matiereOf));
  if (matieres.size > 1) bonuses.push(5);

  // R-S9 — RETIRÉE le 29/08/2026. Elle reposait sur morphoFit / morphoVigilance,
  // c'est-à-dire sur les mêmes expressions régulières que la sélection de
  // capsule vient d'abandonner : aucune des 623 pièces du catalogue n'a la
  // colonne `morphologies` renseignée, donc le signal n'a jamais reposé sur
  // une donnée déclarée. Le garder ici aurait laissé le score récompenser un
  // signal que la sélection ne croit plus, et sa branche négative affichait la
  // seule phrase morphologique de l'application — une phrase qui porte un
  // jugement sur la silhouette de l'utilisatrice à partir d'une regex sur un
  // nom de produit.
  //
  // Le score ne comporte donc plus aucun terme morphologique. Le modèle V2
  // (garmentEffect) reste hors production et hors du score : il décrit l'effet
  // des vêtements, jamais le corps, et son branchement éventuel se fera dans
  // la sélection, pas ici.

  // R-S10 — palette personnelle du profil (préférence molle, jamais exclusive)
  if (paletteHexList.length && pieces.some((i) => paletteHexList.includes(i.hex))) bonuses.push(10);

  // R-S11 — layering réussi (base + calque en contexte décontracté)
  const tops = pieces.filter((i) => TOP_LAYER_CATS.includes(i.cat));
  const roles = tops.map(rolePieceOf);
  const dressy = isDressy(occasion, workMode, dateContext);
  const hasBase = roles.includes("base");
  const hasCalque = roles.includes("calque");
  if (hasBase && hasCalque && !dressy) bonuses.push(10);

  // R-S15 — anti-répétition graduée (reclassifiée depuis l'ex-R-B7 bloquant,
  // cf. moteur de règles section 20) : jamais un filtre dur qui exclurait
  // une pièce du pool, seulement une pénalité de score sur la tenue
  // complète — une combinaison récemment portée reste toujours proposable,
  // simplement moins favorisée. Uniquement les catégories vêtement
  // (CLOTHING_CATS) — jamais chaussures/sacs/bijoux/accessoires, qui se
  // réutilisent librement d'un look à l'autre.
  const mostRecentWorn = clothing.reduce<number | null>(
    (min, i) => (i.worn == null ? min : min == null ? i.worn : Math.min(min, i.worn)),
    null
  );
  if (mostRecentWorn != null) {
    if (mostRecentWorn <= 1) penalties.push([30, "Cette tenue ressemble beaucoup à celle d'hier, essaie de varier une pièce."]);
    else if (mostRecentWorn <= 3) penalties.push([15, "Cette tenue a été portée il y a peu, une petite variation la rafraîchirait."]);
    else if (mostRecentWorn <= 14) penalties.push([5, "Cette tenue a déjà été portée récemment."]);
  }

  let score = 100;
  penalties.forEach(([w]) => { score -= w; });
  bonuses.forEach((w) => { score += w; });
  score = Math.max(0, Math.min(120, score));

  penalties.sort((a, b) => b[0] - a[0]);
  const badge: LookScore["badge"] = score >= 80 ? "recommande" : score < 50 ? "ajuster" : "neutre";
  const adjustMessage = badge === "ajuster" && penalties.length ? penalties[0][1] : "";

  // R-S12/R-S13/R-S14 — suggestions proactives, indépendantes les unes des
  // autres (plusieurs peuvent s'afficher en même temps, chacune dismissible séparément).
  const proactives: LookScore["proactives"] = [];

  // R-S12 — layering : un seul haut, effectivement un calque ouvert (chemise
  // oversize, gilet léger...), contexte décontracté.
  // Correctif 22/08/2026 (signalé : cartouche affiché avec une combinaison +
  // une chemise oversize) — "il te manque un débardeur ou un t-shirt" n'a de
  // sens que si ce haut EST la base de la tenue (structure haut+bas) : avec
  // une robe/combinaison déjà présente, ce même haut oversize est un calque
  // porté par-dessus une pièce qui couvre déjà tout le corps, jamais un haut
  // ouvert cherchant une base dessous.
  // Correctif 23/08/2026 (signalé : "T-shirt ample" — un haut fermé, jamais
  // porté ouvert par-dessus quoi que ce soit — déclenchait la suggestion
  // aussi souvent qu'une vraie chemise oversize ouverte) — l'ancien
  // /oversize|ample|chemise/i confondait la coupe du vêtement avec son rôle
  // réel. rolePieceOf (attributes.ts, déjà la source de vérité de R-S11 pour
  // la même distinction) exclut justement les t-shirts/débardeurs/polos de
  // "calque" quelle que soit leur coupe (NEVER_LAYER_RE) — seul un vrai
  // calque ouvert (chemise oversize, gilet léger...) a un intérêt réel à
  // porter quelque chose dessous.
  const hasOnepiece = pieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  if (
    tops.length === 1 &&
    !hasOnepiece &&
    dressy === false &&
    rolePieceOf(tops[0]) === "calque" &&
    !dismissed.has("layer")
  ) {
    proactives.push({
      key: "layer",
      text: "Un débardeur ou un t-shirt dessous compléterait cette tenue.",
    });
  }

  // Pièce concrète à suggérer pour R-S13/R-S14 (recette 23/08/2026) —
  // uniquement une pièce du catalogue avec lien_affiliation renseigné : sans
  // ce lien, la carte reste le texte seul d'aujourd'hui, comportement
  // inchangé (extension du mécanisme d'achat déjà utilisé sur l'écran
  // Capsule, jamais une nouvelle logique parallèle). Jamais une pièce déjà
  // présente dans la tenue affichée. Le lien_affiliation n'est plus une
  // condition d'affichage de la pièce elle-même (correctif 23/08/2026,
  // signalé : la card doit toujours montrer un visuel de la capsule avec
  // "Ajouter à la tenue") — seul le bouton "Acheter cette pièce" reste
  // conditionné à sa présence, côté rendu (TenuesScreen).
  const pieceIds = new Set(pieces.map((i) => i.id));
  // Jamais une pièce dont le "rôle" (accessoireType/bijouType/sacType) est
  // déjà tenu par une pièce de la tenue affichée (correctif 23/08/2026,
  // signalé : une deuxième paire de lunettes de soleil suggérée alors que la
  // tenue en porte déjà une) — sans intérêt réel, même si l'id diffère.
  // Limité aux pièces au sous-type connu des deux côtés : sans sous-type
  // déclaré, on ne sait pas si les rôles se recoupent, donc on ne bloque pas
  // par excès de prudence plutôt que de risquer d'exclure une suggestion
  // valable (ex. une ceinture déjà présente ne doit pas empêcher de
  // suggérer des lunettes, même toutes deux catégorie "accessoire").
  const hasSameSlot = (candidate: Item): boolean =>
    pieces.some((p) => {
      if (p.cat !== candidate.cat) return false;
      if (candidate.accessoireType) return p.accessoireType === candidate.accessoireType;
      if (candidate.bijouType) return p.bijouType === candidate.bijouType;
      if (candidate.sacType) return p.sacType === candidate.sacType;
      return false;
    });
  const findSuggestedPiece = (cats: CategoryKey[], extra: (i: Item) => boolean): number | undefined =>
    pool.find((i) => cats.includes(i.cat) && isCatalogId(i.id) && !pieceIds.has(i.id) && !hasSameSlot(i) && extra(i))?.id;

  // Un bijou doré/argenté/cuivré (palette PALETTE_BIJOU, data.ts) n'est pas
  // une "touche de couleur" — c'est une finition métallique, pas plus
  // chromatique qu'un neutre (correctif 23/08/2026, signalé : une bague
  // argentée suggérée pour R-S13). isNeutralColor (attributes.ts) ne
  // couvre que les neutres vêtement (blanc/noir/gris/camel...), jamais ces
  // teintes bijou — exclues séparément ici, dans le déclencheur ET la
  // sélection, pour rester cohérent des deux côtés. Une couleur absente
  // (jamais renseignée) n'est pas non plus une touche de couleur réelle —
  // sans ce garde-fou, isNeutralColor("") passe à tort (absente de la liste
  // des neutres nommés), laissant filtrer une pièce dont la couleur réelle
  // est simplement inconnue.
  // Correspondance par sous-chaîne plutôt qu'égalité stricte (correctif
  // 26/08/2026) : "Doré vieilli" et "Argent vieilli" existent en base et
  // échappaient à la liste exacte, donc une manchette dorée patinée était
  // encore proposée comme touche de couleur — exactement le cas que le
  // correctif du 23/08 visait. Même logique que isNeutralColor depuis le
  // 24/08, pour que les deux garde-fous se comportent pareil.
  const isColorAccent = (color: string): boolean => Boolean(color) && !isNeutralColor(color) && !isMetallicFinish(color);

  // R-S13 — contraste : total look noir sans accessoire coloré.
  const allBlack = clothing.length > 0 && clothing.every((i) => /noir/i.test(i.color));
  const hasColorAccessory = accessories.some((i) => isColorAccent(i.color));
  if (allBlack && !hasColorAccessory && !dismissed.has("color")) {
    proactives.push({
      key: "color",
      text: "Une touche de couleur réveillerait ce total look noir.",
      suggestedId: findSuggestedPiece(["bijou", "accessoire"], (i) => isColorAccent(i.color)),
    });
  }

  // R-S14 — soirée fraîche : exclue en Cocooning (R-B12), pas de sens à suggérer une veste chez soi.
  const hasOuterwear = pieces.some((i) => i.cat === "veste" || i.cat === "manteau");
  if (occasion !== "cocooning" && weather.temp <= 21 && !hasOuterwear && !dismissed.has("veste_soir")) {
    // Occasion sport (recette 25/08/2026, signalé : blazer structuré
    // suggéré sur une tenue baskets + short cycliste) — préférence molle
    // pour une veste décontractée (formalityOf <= 1, ex. coupe-vent/
    // bomber) plutôt qu'un blazer structuré, jamais exclusive : repli sur
    // n'importe quelle veste si le pool n'a aucune option décontractée
    // (même esprit que R-B16/R-S16, findSuggestedPiece ne permettant pas
    // ce classement par préférence).
    const vesteManteauCandidates = pool.filter(
      (i) =>
        (i.cat === "veste" || i.cat === "manteau") &&
        isCatalogId(i.id) &&
        !pieceIds.has(i.id) &&
        !hasSameSlot(i) &&
        weather.seasons.includes(i.season)
    );
    const decontracte = occasion === "sport" ? vesteManteauCandidates.filter((i) => formalityOf(i) <= 1) : [];
    proactives.push({
      key: "veste_soir",
      text: "N'hésite pas à compléter cette tenue avec une veste, il va faire frais ce soir.",
      suggestedId: (decontracte.length ? decontracte : vesteManteauCandidates)[0]?.id,
    });
  }

  return { score, badge, adjustMessage, proactives };
}

/**
 * Tenue complète obligatoire (module "Comment porter cette pièce ?",
 * précision 13/08/2026 du brief 19/08/2026) : jamais un "look" incomplet
 * (ex. chaussures+sac+bijou seuls, haut+accessoire seul). Structure
 * minimale requise : haut/pull + bas, OU robe/combinaison + chaussures —
 * veste/sac/bijou/accessoire viennent toujours en complément éventuel,
 * jamais en substitut. Ce filtre détermine directement le comptage
 * "occasion couverte" (une occasion n'est couverte que si au moins une
 * tenue complète existe pour elle, jamais une compatibilité seulement
 * théorique).
 */
function isCompleteOutfit(items: Item[]): boolean {
  const cats = new Set(items.map((i) => i.cat));
  if (!cats.has("chaussures")) return false;
  if (cats.has("robe") || cats.has("combinaison")) return true;
  const hasTop = cats.has("haut") || cats.has("pull");
  const hasBottom = BOTTOMS.some((c) => cats.has(c));
  return hasTop && hasBottom;
}

/**
 * Dimension par laquelle une idée se distingue des idées déjà retenues de sa
 * section (cf. selectDiverseVariations). Sert deux fois : à départager les
 * candidats à score équivalent, et à titrer la card sur une différence
 * réellement observable plutôt que sur un rang de formalité (recette
 * 26/08/2026, signalé : trois idées perçues comme la même tenue).
 */
export type DiversityAxis = "layer" | "bottom" | "color" | "shoes" | null;

/** Une combinaison valide autour d'une pièce pivot, pour une occasion donnée. */
export interface ItemOutfitVariation {
  occasion: OccasionKey;
  ids: number[];
  score: number;
  /** Renseigné par la sélection finale — null pour la première idée d'une section (retenue sur son seul score). */
  axis?: DiversityAxis;
}

/**
 * Écart de score toléré pour préférer un look plus diversifié (recette
 * 26/08/2026). Mesuré sur la section "Quotidien" d'un t-shirt, capsule Été :
 * au meilleur score strict, 6 candidats mais UNE SEULE famille de bas — la
 * diversité y est mathématiquement impossible ; à 5 points près, 18
 * candidats couvrant les 4 familles. 10 points n'apporteraient qu'un type de
 * chaussures de plus pour le double de concession. La dégradation maximale
 * est donc bornée à 5 points sur 115, soit 4,3%, et n'est jamais consentie
 * sans contrepartie : à diversité égale, c'est toujours le score qui tranche.
 */
const DIVERSITY_SCORE_TOLERANCE = 5;

/** Famille de pièce structurante — dérivée de la seule catégorie, aucune donnée catalogue ajoutée. */
function bottomFamilyOf(items: Item[]): string | null {
  const onepiece = items.find((it) => it.cat === "robe" || it.cat === "combinaison");
  if (onepiece) return "onepiece";
  return items.find((it) => BOTTOMS.includes(it.cat))?.cat ?? null;
}

/** Famille de chaussures — le shoeType déjà porté par la pièce (catalogue statique comme vestiaire_universel). */
function shoeFamilyOf(items: Item[]): string | null {
  return items.find((it) => it.cat === "chaussures")?.shoeType ?? null;
}

/** Luminance relative d'un hex — sert uniquement à séparer les neutres entre eux (cf. colorFamilyOf). */
function luminanceOf(hex: string): number {
  const n = Number.parseInt((hex || "").replace("#", ""), 16);
  if (!Number.isFinite(n)) return 0.5;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/**
 * Famille de couleur du bas, dérivée du seul hex — aucune donnée ajoutée.
 * isNeutralColor() ne suffit pas ici : Sable, Crème et Taupe sont TOUS
 * neutres, donc indistinguables par ce test, alors que c'est précisément
 * entre eux que se joue le problème signalé ("trois looks beiges"). Une
 * pièce non neutre est identifiée par son nom de couleur ; une pièce neutre
 * l'est par sa bande de clarté, ce qui sépare Crème (L=0,87) de Taupe
 * (L=0,60) et de Marine (L=0,25), mais regroupe bien Sable (0,80) et Crème
 * — deux beiges que rien ne distingue à l'œil sur une vignette.
 */
function colorFamilyOf(items: Item[]): string | null {
  const bas = items.find((it) => it.cat === "robe" || it.cat === "combinaison") ?? items.find((it) => BOTTOMS.includes(it.cat));
  if (!bas) return null;
  if (!isNeutralColor(bas.color)) return "teinte:" + bas.color.toLowerCase();
  const l = luminanceOf(bas.hex);
  return "neutre:" + (l >= 0.7 ? "clair" : l >= 0.45 ? "moyen" : "foncé");
}

/** Présence d'une couche supplémentaire (veste/manteau). */
function hasLayer(items: Item[]): boolean {
  return items.some((it) => OUTERWEAR_CATS.includes(it.cat));
}

/**
 * Sélection finale des idées affichées (recette 26/08/2026) — remplace un
 * simple "3 meilleurs scores", qui produisait trois quasi-jumelles : la
 * déduplication par structuralKeyOf garantit au moins une pièce différente,
 * jamais une différence PERCEPTIBLE, et les scores sont très souvent ex
 * æquo (6 candidats à 115 sur une même section), si bien que l'ordre retenu
 * n'était en pratique que l'ordre de tirage.
 *
 * Ordre de priorité strict — validité, puis qualité, puis diversité :
 * 1. les candidats sont ceux déjà produits, validés et scorés par le moteur ;
 *    rien n'est composé, modifié ou complété ici ;
 * 2. seuls les candidats à DIVERSITY_SCORE_TOLERANCE près du meilleur sont
 *    éligibles, la première idée restant la mieux scorée comme avant ;
 * 3. entre éligibles, on maximise la distance de diversité ; à distance
 *    égale c'est le score qui tranche, puis l'ordre de tirage.
 *
 * Les quatre dimensions sont pondérées 8/4/2/1 pour être strictement
 * lexicographiques (8 > 4+2+1) dans l'ordre demandé : famille de bas,
 * famille de chaussures, famille de couleur, présence d'une couche.
 *
 * Une distance nulle signifie "ce look ne se distingue par aucune dimension
 * perceptible" : il est écarté, quitte à ne retourner qu'une ou deux idées.
 * Jamais de troisième quasi-doublon pour atteindre un compte rond.
 */
function selectDiverseVariations(
  candidates: ItemOutfitVariation[],
  pool: Item[],
  limit: number
): ItemOutfitVariation[] {
  if (candidates.length <= 1) return candidates.slice(0, limit);
  const itemsOf = (v: ItemOutfitVariation) => v.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  const traits = new Map(
    candidates.map((v) => {
      const items = itemsOf(v);
      return [v, { bottom: bottomFamilyOf(items), shoes: shoeFamilyOf(items), color: colorFamilyOf(items), layer: hasLayer(items) }];
    })
  );

  const byScore = [...candidates].sort((a, b) => b.score - a.score);
  const floor = byScore[0].score - DIVERSITY_SCORE_TOLERANCE;
  const eligible = byScore.filter((v) => v.score >= floor);

  const used = new Set<ItemOutfitVariation>([byScore[0]]);
  const selected: ItemOutfitVariation[] = [{ ...byScore[0], axis: null }];
  const taken = [traits.get(byScore[0])!];

  while (selected.length < limit) {
    // `eligible` est trié par score décroissant : le premier candidat de
    // distance maximale rencontré est donc déjà le mieux scoré à cette
    // distance — le tri fait office de départage, sans second critère.
    let best: { v: ItemOutfitVariation; axis: DiversityAxis; d: number } | null = null;
    for (const v of eligible) {
      if (used.has(v)) continue;
      const t = traits.get(v)!;
      // Une dimension compte comme nouvelle si AUCUNE idée déjà retenue ne la partage.
      const newBottom = t.bottom != null && taken.every((x) => x.bottom !== t.bottom);
      const newShoes = t.shoes != null && taken.every((x) => x.shoes !== t.shoes);
      const newColor = t.color != null && taken.every((x) => x.color !== t.color);
      const newLayer = taken.every((x) => x.layer !== t.layer);
      const d = (newBottom ? 8 : 0) + (newShoes ? 4 : 0) + (newColor ? 2 : 0) + (newLayer ? 1 : 0);
      if (d === 0) continue;
      // Les poids classent les candidats dans l'ordre de priorité demandé
      // (bas > chaussures > couleur > couche) ; l'axe retenu pour le TITRE
      // suit un autre ordre, celui de ce qui se raconte le mieux : une veste
      // en plus se voit avant un changement de type de chaussures.
      const axis: DiversityAxis = newLayer ? "layer" : newBottom ? "bottom" : newColor ? "color" : "shoes";
      if (!best || d > best.d) best = { v, axis, d };
    }
    if (!best) break;
    used.add(best.v);
    selected.push({ ...best.v, axis: best.axis });
    taken.push(traits.get(best.v)!);
  }
  return selected;
}

/**
 * Génère plusieurs combinaisons valides autour d'une pièce pivot,
 * regroupées par occasion (module "Comment porter cette pièce ?", recette
 * 19/08/2026). Réutilise generateOutfit tel quel — jamais un second moteur
 * — en tirant plusieurs fois par occasion et en ne retenant que les
 * résultats contenant la pièce pivot. Dédoublonne par ensemble de pièces
 * STRUCTURANTES (haut/bas/robe/veste/manteau/chaussures) : deux looks ne
 * différant que par un sac/bijou/accessoire comptent comme le même look.
 * Jamais de permutations exhaustives : plafonds configurables, par défaut
 * 3 looks max par occasion, 18 au total.
 */
export function getOutfitsForItem(
  pivotId: number,
  pool: Item[],
  weather: Weather,
  preferredHexes: string[] = [],
  opts: { maxPerOccasion?: number; maxTotal?: number; attemptsPerOccasion?: number } = {},
  gender: "femme" | "homme" | null = null,
  /** Saison de la capsule dont `pool` est issu — cf. generateOutfit. L'écran « Comment porter cette pièce ? » raisonne toujours sur une saison de capsule explicite. */
  capsuleSeason?: CapsuleSeason | null
): ItemOutfitVariation[] {
  const pivot = pool.find((i) => i.id === pivotId);
  if (!pivot) return [];

  const maxPerOccasion = opts.maxPerOccasion ?? 3;
  const maxTotal = opts.maxTotal ?? 18;
  // 30 -> 60 (recette 26/08/2026) : sert UNIQUEMENT à enrichir le vivier de
  // candidats offert au reclassement par diversité, jamais à modifier la
  // génération, la validation ou le scoring — chaque tirage passe exactement
  // les mêmes filtres qu'avant. Sans cela, les occasions peu couvertes
  // n'offrent pas de quoi diversifier : "Voyage" passe de 2 à 6 candidats.
  // Coût mesuré à l'ouverture de l'écran (10 occasions, une passe mémoïsée) :
  // 23 ms -> 37 ms.
  const attemptsPerOccasion = opts.attemptsPerOccasion ?? 60;
  const structuralCats: CategoryKey[] = [...CLOTHING_CATS, "chaussures"];

  // La préférence de palette (R-S10) n'est censée être qu'une inclination
  // molle dans generateOutfit — mais ici, où l'on ne retient que les tirages
  // contenant précisément pivotId, elle devient de fait un blocage dur dès
  // que la couleur du pivot n'est pas dans la palette et qu'une alternative
  // de la palette existe dans sa catégorie : hautPreferred (et équivalents)
  // exclut alors systématiquement le pivot à CHAQUE tentative, sur toutes
  // les occasions — d'où "pas encore assez de combinaisons" même avec un
  // dressing par ailleurs bien fourni. On traite donc la teinte du pivot
  // comme faisant partie de la palette pour cet appel uniquement, sans
  // changer le comportement de generateOutfit lui-même.
  const effectiveHexes = pivot.hex && !preferredHexes.includes(pivot.hex) ? [...preferredHexes, pivot.hex] : preferredHexes;

  const structuralKeyOf = (ids: number[]): string =>
    ids
      .filter((id) => {
        const it = pool.find((p) => p.id === id);
        return it && structuralCats.includes(it.cat);
      })
      .sort((a, b) => a - b)
      .join(",");

  const results: ItemOutfitVariation[] = [];
  const seenKeys = new Set<string>();

  for (const [occasion] of OCCASIONS) {
    if (results.length >= maxTotal) break;
    const candidates: ItemOutfitVariation[] = [];
    const localSeen = new Set<string>();
    for (let attempt = 0; attempt < attemptsPerOccasion; attempt++) {
      const { ids } = generateOutfit(pool, weather, occasion, "Présentiel", "Verre", effectiveHexes, gender, undefined, pivotId, capsuleSeason);
      if (!ids.includes(pivotId)) continue;
      const key = structuralKeyOf(ids);
      if (seenKeys.has(key) || localSeen.has(key)) continue;
      const outfitItems = ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
      if (!isCompleteOutfit(outfitItems)) continue;
      localSeen.add(key);
      const { score } = computeLookScore(outfitItems, occasion, preferredHexes, null, new Set(), weather, "Présentiel", "Verre");
      candidates.push({ occasion, ids, score });
    }
    const top = selectDiverseVariations(candidates, pool, Math.min(maxPerOccasion, maxTotal - results.length));
    top.forEach((c) => seenKeys.add(structuralKeyOf(c.ids)));
    results.push(...top);
  }

  return results;
}

/**
 * Titres différenciants par occasion, du plus décontracté au plus habillé
 * (recette 26/08/2026, "Idées de tenues" section 4 — signalé : plusieurs
 * variantes d'une même occasion affichaient exactement le même titre,
 * ex. "Une touche soignée" répété 3 fois sous "Date"). Choisis par
 * styleTitleFor() selon le rang de formalité réel de chaque variante parmi
 * ses semblables (outfitFormality), jamais par index arbitraire : le titre
 * reflète une vraie différence entre les tenues plutôt qu'une rotation
 * cosmétique.
 */
const OCCASION_STYLE_TITLES: Partial<Record<OccasionKey, string[]>> = {
  quotidien: ["Simple et facile à porter", "Décontractée mais affirmée", "Un cran plus habillée"],
  travail_formel: ["Structurée sans rigidité", "Professionnelle et posée", "Formelle et affirmée"],
  entretien: ["Posée et accessible", "Sérieuse et maîtrisée", "Rigoureuse et formelle"],
  date: ["Décontractée chic", "Féminine et minimaliste", "Plus habillée"],
  soiree: ["Décontractée du soir", "Chic sans en faire trop", "Sophistiquée"],
  festive: ["Décontractée mais festive", "Chic et affirmée", "Prête à sortir de l'ordinaire"],
  sport: ["Confortable avant tout", "Technique et soignée", "Prête à performer"],
  cocooning: ["Relâchée à la maison", "Confortable et structurée", "Cocooning chic"],
  voyage: ["Pratique avant tout", "Confortable et soignée", "Prête pour toutes les étapes"],
  evenement_perso: ["Soignée sans excès", "Féminine et posée", "À la hauteur de l'occasion"],
};

const DEFAULT_STYLE_TITLES = ["Une tenue simple", "Une tenue équilibrée", "Une tenue plus habillée"];

/**
 * Formalité moyenne des pièces vêtement/chaussures d'un look, hors pivot
 * (recette 26/08/2026) — sert uniquement à classer entre elles les
 * variantes d'une même occasion, de la plus décontractée à la plus
 * habillée, pour leur attribuer des titres réellement différenciants.
 */
export function outfitFormality(items: Item[], pivotId: number): number {
  const clothingLike = items.filter((it) => it.id !== pivotId && (CLOTHING_CATS.includes(it.cat) || it.cat === "chaussures"));
  if (!clothingLike.length) {
    const pivot = items.find((it) => it.id === pivotId);
    return pivot ? formalityOf(pivot) : 0;
  }
  return clothingLike.reduce((sum, it) => sum + formalityOf(it), 0) / clothingLike.length;
}

/**
 * Titre d'une idée (recette 26/08/2026 — signalé : "Simple et facile à
 * porter" / "Décontractée mais affirmée" attribués à deux tenues de
 * formalité STRICTEMENT identique). L'ancienne version dérivait le titre du
 * seul rang de formalité ; sur valeurs égales, le tri est arbitraire, et
 * l'écran annonçait donc un dégradé que les données ne portaient pas.
 *
 * Le titre décrit désormais la différence par laquelle l'idée a été retenue
 * (`axis`, cf. selectDiverseVariations) — donc toujours quelque chose
 * d'observable dans la composition affichée. Le repli sur la formalité n'est
 * conservé que pour un écart RÉEL (≥ 1 point), jamais entre ex æquo. La
 * première idée d'une section (axis null) garde le libellé neutre de son
 * occasion, sans promesse de progression.
 */
function styleTitleFor(occasion: OccasionKey, axis: DiversityAxis, items: Item[], pivotId: number, formalityGap: number): string {
  const tiers = OCCASION_STYLE_TITLES[occasion] || DEFAULT_STYLE_TITLES;
  const neutral = tiers[1] ?? tiers[0];
  const others = items.filter((it) => it.id !== pivotId);

  if (axis === "layer") {
    const layer = others.find((it) => OUTERWEAR_CATS.includes(it.cat));
    if (layer) return `Avec ${indefiniteArticle(layer)} ${pieceBase(layer)}`;
  }
  if (axis === "bottom") {
    const bas = others.find((it) => it.cat === "robe" || it.cat === "combinaison") ?? others.find((it) => BOTTOMS.includes(it.cat));
    if (bas) return `Avec ${indefiniteArticle(bas)} ${pieceBase(bas)}`;
  }
  if (axis === "color") {
    const bas = others.find((it) => it.cat === "robe" || it.cat === "combinaison") ?? others.find((it) => BOTTOMS.includes(it.cat));
    if (bas) {
      if (!isNeutralColor(bas.color)) return "Version plus contrastée";
      const l = luminanceOf(bas.hex);
      return l >= 0.7 ? "Version claire" : l >= 0.45 ? "Version tout en nuances" : "Version plus foncée";
    }
  }
  if (axis === "shoes") {
    const sh = others.find((it) => it.cat === "chaussures");
    if (sh?.shoeType) return `Version ${sh.shoeType.toLowerCase()}`;
  }
  // Écart de formalité réel uniquement — jamais un titre de progression
  // inventé entre deux tenues de formalité identique.
  if (formalityGap >= 1) return "Version plus habillée";
  if (formalityGap <= -1) return "Version plus décontractée";
  return neutral;
}

/** Repli minimal par occasion (phrase) — cas rare où même une description par énumération n'a rien à dire (pivot + chaussures seuls). */
const OCCASION_VARIATION_BASE: Partial<Record<OccasionKey, string>> = {
  quotidien: "Simple et facile à porter au quotidien.",
  travail_formel: "Structurée pour le bureau.",
  entretien: "Sérieuse et posée pour un rendez-vous important.",
  date: "Une touche soignée pour un rendez-vous.",
  soiree: "Parfaite pour une sortie entre amis.",
  festive: "Prête pour une soirée qui sort de l'ordinaire.",
  sport: "Confortable et technique.",
  cocooning: "Décontractée, pensée pour la maison.",
  voyage: "Pratique et confortable pour se déplacer.",
  evenement_perso: "À la hauteur d'une cérémonie.",
};

/** Clôture de phrase par occasion, plusieurs variantes pour éviter la répétition entre les looks d'une même section (précision 13/08/2026 du brief 19/08/2026). */
const OCCASION_CLOSERS: Partial<Record<OccasionKey, string[]>> = {
  quotidien: ["pour un look simple et facile à porter.", "pour une allure décontractée au quotidien."],
  travail_formel: ["pour une allure structurée au bureau.", "pour un rendu soigné et professionnel."],
  entretien: ["pour une présentation sérieuse et posée."],
  date: ["pour une touche plus soignée pour ce rendez-vous.", "pour une allure élégante sans être trop habillée."],
  soiree: ["pour une sortie entre amis.", "pour une allure plus détendue en soirée."],
  festive: ["pour une soirée qui sort de l'ordinaire."],
  sport: ["confortable et technique."],
  cocooning: ["pour une allure relâchée à la maison."],
  voyage: ["pratique et confortable pour se déplacer."],
  evenement_perso: ["à la hauteur de l'occasion."],
};

/** Catégories dont le sous-type est déjà un nom complet (ex. "Chemise", "Blazer", "Sandales plates") — jamais préfixé par le libellé générique de la catégorie, contrairement aux catégories à sous-type "modificateur" (ex. jupe: "Midi"). */
const NOUN_SUBTYPE_CATS = new Set<CategoryKey>(["haut", "pull", "veste", "manteau", "chaussures", "sac", "bijou", "accessoire", "combinaison"]);

/** Nom compact d'une pièce, sans couleur (ex. "t-shirt", "pantalon fluide"). */
function pieceBase(it: Item): string {
  const catLabel = (CATLABEL[it.cat] || it.name).toLowerCase();
  const subtypeLower = it.subtype?.trim().toLowerCase();
  if (subtypeLower && NOUN_SUBTYPE_CATS.has(it.cat)) {
    return subtypeLower;
  }
  if (subtypeLower && (subtypeLower === catLabel || subtypeLower.startsWith(catLabel + " "))) {
    // Évite le doublon "pantalon pantalon(...)" — non seulement quand le
    // sous-type EST le nom générique de la catégorie (ex. "Pantalon"), mais
    // aussi quand il commence par ce nom (ex. "Pantalon fluide" pour la
    // catégorie pantalon, correctif 20/08/2026 : la vérification d'égalité
    // stricte seule laissait passer "pantalon pantalon fluide").
    return subtypeLower;
  }
  if (subtypeLower) return `${catLabel} ${subtypeLower}`;
  return catLabel;
}

/**
 * Genre/nombre grammatical d'une pièce (recette 22/08/2026, brief design
 * "Comment porter cette pièce" section 6 — accord naturel plutôt que "en
 * {couleur}" invariable). Dérivé des données structurées (cat/subtype),
 * jamais d'une analyse du texte généré — fiable même sur un nom de pièce
 * imprévisible. Pour les catégories où le sous-type MODIFIE le nom
 * générique (ex. "jean droit"), le genre reste celui de la catégorie
 * (tête du groupe nominal). Pour celles où le sous-type REMPLACE le nom
 * générique (NOUN_SUBTYPE_CATS), chaque sous-type a son propre genre.
 */
type Gender = "m" | "f";
interface NounInfo { gender: Gender; plural?: boolean }

const CAT_GENDER: Record<CategoryKey, NounInfo> = {
  haut: { gender: "m" }, pull: { gender: "m" }, pantalon: { gender: "m" }, jean: { gender: "m" },
  jupe: { gender: "f" }, short: { gender: "m" }, robe: { gender: "f" }, combinaison: { gender: "f" },
  veste: { gender: "f" }, manteau: { gender: "m" }, chaussures: { gender: "f", plural: true },
  sac: { gender: "m" }, bijou: { gender: "m" }, accessoire: { gender: "m" },
};

const SUBTYPE_GENDER: Partial<Record<CategoryKey, Record<string, NounInfo>>> = {
  haut: {
    "t-shirt": { gender: "m" }, top: { gender: "m" }, "débardeur": { gender: "m" }, chemise: { gender: "f" },
    chemisier: { gender: "m" }, blouse: { gender: "f" }, polo: { gender: "m" }, sweat: { gender: "m" },
  },
  pull: { pull: { gender: "m" }, gilet: { gender: "m" }, cardigan: { gender: "m" }, "col roulé": { gender: "m" } },
  veste: {
    blazer: { gender: "m" }, "veste légère": { gender: "f" }, perfecto: { gender: "m" },
    "veste en jean": { gender: "f" }, surchemise: { gender: "f" },
  },
  manteau: {
    manteau: { gender: "m" }, trench: { gender: "m" }, caban: { gender: "m" },
    doudoune: { gender: "f" }, parka: { gender: "f" }, "imperméable": { gender: "m" },
  },
  chaussures: {
    baskets: { gender: "f", plural: true }, bottines: { gender: "f", plural: true }, bottes: { gender: "f", plural: true },
    escarpins: { gender: "m", plural: true }, sandales: { gender: "f", plural: true }, "sandales à talons": { gender: "f", plural: true },
    espadrilles: { gender: "f", plural: true }, mocassins: { gender: "m", plural: true }, ballerines: { gender: "f", plural: true },
    "chaussures d'intérieur": { gender: "f", plural: true },
  },
  sac: {
    "sac à main": { gender: "m" }, cabas: { gender: "m" }, "bandoulière": { gender: "f" },
    pochette: { gender: "f" }, "sac à dos": { gender: "m" }, "sac de sport": { gender: "m" },
  },
  bijou: {
    collier: { gender: "m" }, "boucles d'oreilles": { gender: "f", plural: true }, bracelet: { gender: "m" },
    bague: { gender: "f" }, montre: { gender: "f" },
  },
  accessoire: {
    ceinture: { gender: "f" }, foulard: { gender: "m" }, "écharpe": { gender: "f" }, chapeau: { gender: "m" },
    casquette: { gender: "f" }, lunettes: { gender: "f", plural: true }, collants: { gender: "m", plural: true },
    "chaussettes hautes": { gender: "f", plural: true }, gourde: { gender: "f" },
  },
  combinaison: { combinaison: { gender: "f" }, combishort: { gender: "m" }, salopette: { gender: "f" } },
};

/** Genre grammatical d'une pièce, exposé (recette 26/08/2026, "Jamais porté" → accord au vêtement, PieceScreen) — même détection que le reste des descriptions de tenues, jamais un second moteur d'accord. */
export function nounInfoOf(it: Item): NounInfo {
  const catInfo = CAT_GENDER[it.cat] || { gender: "m" as const };
  if (!NOUN_SUBTYPE_CATS.has(it.cat)) return catInfo;
  const sub = it.subtype?.trim().toLowerCase();
  const info = sub && SUBTYPE_GENDER[it.cat]?.[sub];
  return info || catInfo;
}

/**
 * Accord des rares couleurs qui sont de vrais adjectifs variables en
 * français (blanc/noir/gris, doré/argenté/cuivré). Toutes les autres
 * couleurs de la palette Capsela sont des noms employés comme couleur
 * (kaki, marine, corail, terracotta, chocolat, moutarde, camel, taupe,
 * denim, prune, bordeaux, crème, sable, brique, perle, bronze...) ou des
 * couleurs composées (ex. "blanc cassé", "vert sauge", "gris clair") —
 * grammaticalement invariables dans les deux cas, jamais accordées.
 */
const COLOR_AGREEMENT: Record<string, { m: string; f: string; mp: string; fp: string }> = {
  blanc: { m: "blanc", f: "blanche", mp: "blancs", fp: "blanches" },
  noir: { m: "noir", f: "noire", mp: "noirs", fp: "noires" },
  gris: { m: "gris", f: "grise", mp: "gris", fp: "grises" },
  "doré": { m: "doré", f: "dorée", mp: "dorés", fp: "dorées" },
  "argenté": { m: "argenté", f: "argentée", mp: "argentés", fp: "argentées" },
  "cuivré": { m: "cuivré", f: "cuivrée", mp: "cuivrés", fp: "cuivrées" },
};

function agreeColor(colorName: string, info: NounInfo): string {
  const forms = COLOR_AGREEMENT[colorName.trim().toLowerCase()];
  if (!forms) return colorName.toLowerCase();
  if (info.plural) return info.gender === "f" ? forms.fp : forms.mp;
  return info.gender === "f" ? forms.f : forms.m;
}

/** Accord d'une couleur partagée par plusieurs pièces jointes par "et" — toujours pluriel ; masculin dès qu'au moins une pièce est masculine ("le masculin l'emporte", règle standard du français). */
function agreeColorForGroup(colorName: string, items: Item[]): string {
  const gender: Gender = items.every((it) => nounInfoOf(it).gender === "f") ? "f" : "m";
  return agreeColor(colorName, { gender, plural: true });
}

/**
 * Articles accordés (correctif 26/08/2026, signalé : "le chaussures taupe").
 * L'accord de couleur était déjà géré par agreeColor, mais l'article restait
 * codé en dur dans les gabarits de phrase, ce qui produisait un masculin
 * systématique sur les pièces féminines ou plurielles. Élision devant
 * voyelle ou h muet pour l'article défini ("l'écharpe").
 */
function definiteArticle(it: Item, noun: string): string {
  const info = nounInfoOf(it);
  if (info.plural) return "les ";
  // Élision devant voyelle uniquement, jamais devant h : le français ne
  // permet pas de deviner l'aspiration depuis la graphie, et les noms de
  // pièces concernés sont aspirés ("le haut", pas "l'haut"). Un éventuel h
  // muet donnerait "le ..." — correct à l'usage, contrairement à l'inverse.
  if (/^[aeiouyàâäéèêëîïôöùûü]/i.test(noun)) return "l'";
  return info.gender === "f" ? "la " : "le ";
}

function indefiniteArticle(it: Item): string {
  const info = nounInfoOf(it);
  if (info.plural) return "des";
  return info.gender === "f" ? "une" : "un";
}

/** Libellé compact d'une pièce, toujours dérivé de ses données réelles — accord naturel de couleur ("pantalon noir", "baskets blanches"), jamais la construction invariable "en {couleur}". */
function pieceLabel(it: Item): string {
  const base = pieceBase(it);
  return it.color ? `${base} ${agreeColor(it.color, nounInfoOf(it))}` : base;
}

/**
 * Ordre de priorité pour choisir les 1-2 pièces les plus distinctives d'un
 * look (hors pivot) — la veste/le manteau et le bas/la robe sont ce qui
 * différencie le plus deux propositions autour d'une même pièce pivot.
 * Sac/bijou/accessoire en repli (recette 26/08/2026, "Idées de tenues"
 * section 6 : la description doit pouvoir citer concrètement "un sac noir"
 * ou "des bijoux dorés", pas seulement du vêtement) — seulement utilisés
 * quand aucune pièce vêtement/chaussures plus distinctive n'est disponible.
 */
const DESCRIPTION_PRIORITY: CategoryKey[] = [
  "veste", "manteau", "robe", "combinaison", "jupe", "pantalon", "jean", "short", "haut", "pull", "chaussures",
  "sac", "bijou", "accessoire",
];

/** Conseil de style d'un look (titre court + phrase), affiché en Zone 2 de la card (brief design 22/08/2026, section 5/7). */
export interface OutfitStyleInsight {
  title: string;
  sentence: string;
}

/**
 * Conseil de style court par look (titre + 1 phrase), généré par template
 * déterministe (jamais OpenAI) à partir des caractéristiques réelles des
 * pièces — jamais de texte générique type "Une alternative tout aussi
 * adaptée.", jamais une caractéristique non présente dans les données
 * (brief design 22/08/2026, section 7 : "ne pas inventer").
 *
 * Quand un vrai contraste de formalité existe entre deux pièces du look
 * (ex. un blazer structuré + des baskets), le conseil explique POURQUOI la
 * combinaison fonctionne plutôt que de simplement énumérer les pièces —
 * c'est la seule "raison" que les données permettent d'établir de façon
 * fiable (formalityOf, déjà la source de vérité du moteur pour R-B2/R-B3).
 * Sans ce contraste, repli sur une description par énumération (comme
 * avant). Le titre, lui, est toujours choisi séparément par styleTitleFor
 * à partir du rang de formalité réel de la variante parmi les `groupSize`
 * variantes de sa section occasion (`styleRank`, 0 = la plus décontractée)
 * — jamais le même titre générique répété pour plusieurs variantes d'une
 * même occasion (recette 26/08/2026, section 4). `styleRank` sert aussi à
 * faire varier la clôture de phrase entre les looks d'une même section.
 */
export function describeOutfitVariation(
  variation: ItemOutfitVariation,
  items: Item[],
  pivotId: number,
  styleRank: number,
  groupSize: number,
  /** Écart de formalité de cette variante à la moyenne de sa section — repli de titrage, seulement s'il est réel (cf. styleTitleFor). */
  formalityGap = 0
): OutfitStyleInsight {
  const pivot = items.find((it) => it.id === pivotId);
  const others = items.filter((it) => it.id !== pivotId);
  const title = styleTitleFor(variation.occasion, variation.axis ?? null, items, pivotId, formalityGap);

  // Contraste de formalité (structurant vs décontracté) parmi les pièces
  // vêtement/chaussures, hors pivot — les accessoires/bijoux ne
  // "structurent" ni ne "décontractent" un look au sens courant du terme.
  const clothingLike = others.filter((it) => CLOTHING_CATS.includes(it.cat) || it.cat === "chaussures");
  if (pivot && clothingLike.length >= 2) {
    const withFormality = clothingLike.map((it) => ({ it, f: formalityOf(it) }));
    const maxF = Math.max(...withFormality.map((x) => x.f));
    const minF = Math.min(...withFormality.map((x) => x.f));
    if (maxF - minF >= 2) {
      const structurer = withFormality.find((x) => x.f === maxF)!.it;
      const casual = withFormality.find((x) => x.f === minF)!.it;
      if (structurer.id !== casual.id) {
        // Articles ET verbes accordés (correctif 26/08/2026) : le gabarit
        // portait un article masculin singulier et un verbe au singulier en
        // dur, d'où "le chaussures taupe" puis "les chaussures blanches
        // garde". L'accord suit nounInfoOf, déjà utilisé par agreeColor.
        const artS = definiteArticle(structurer, pieceBase(structurer));
        const verbS = nounInfoOf(structurer).plural ? "structurent" : "structure";
        const verbC = nounInfoOf(casual).plural ? "gardent" : "garde";
        const sentence =
          `${artS.charAt(0).toUpperCase()}${artS.slice(1)}${pieceLabel(structurer)} ${verbS} ` +
          `${definiteArticle(pivot, pieceBase(pivot))}${pieceBase(pivot)}, tandis que ` +
          `${definiteArticle(casual, pieceBase(casual))}${pieceLabel(casual)} ${verbC} le look décontracté.`;
        return { title, sentence };
      }
    }
  }

  // Repli : description par énumération des 1-2 pièces les plus distinctives.
  const picked: Item[] = [];
  for (const cat of DESCRIPTION_PRIORITY) {
    if (picked.length >= 2) break;
    const found = others.find((it) => it.cat === cat);
    if (found) picked.push(found);
  }

  const closers = OCCASION_CLOSERS[variation.occasion] || ["une combinaison bien assortie."];
  const closer = closers[styleRank % closers.length];

  if (!picked.length) {
    return { title, sentence: OCCASION_VARIATION_BASE[variation.occasion] || "Une combinaison bien assortie." };
  }

  // Couleur partagée entre les 2 pièces (correctif 20/08/2026) : évite la
  // répétition "t-shirt blanc et baskets blanches" — mentionnée une seule
  // fois à la fin plutôt qu'après chaque pièce.
  const sameColor =
    picked.length === 2 && picked[0].color && picked[1].color && picked[0].color.toLowerCase() === picked[1].color.toLowerCase();
  const piecesText = sameColor
    ? `${picked.map(pieceBase).join(" et ")} ${agreeColorForGroup(picked[0].color!, picked)}`
    : picked.map(pieceLabel).join(" et ");
  return { title, sentence: `Avec ${piecesText}, ${closer}` };
}
