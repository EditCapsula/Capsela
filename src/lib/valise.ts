import { previsionPour, type Prevision } from "./prevision";
import { elementProgramme, filtrerParContrainte, type Contrainte, type ItemProgramme } from "./programmeValise";
import { CHALEUR_HORS_SAISON, saisonCalendairePour, saisonCapsuleDuJour, weatherForDay } from "./capsule";
import type { Weather } from "./data";
import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import { candidatsDeRemplacement, categoriesManquantes, clePrincipale, generateOutfitWithFallback } from "./logic";
import { composeWardrobePool } from "./selectors";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey, ShoeType } from "./types";

/*
 * PRÉPARER SA VALISE — module pur (lot 1, 27/09/2026, docs/valise.md).
 *
 * Le principe de la maquette : « Une valise. Plus de looks. Moins de pièces. »
 * Ce module choisit QUELLES PIÈCES DU DRESSING emporter ; les looks, eux,
 * viennent toujours du moteur unique (`generateOutfitWithFallback`), appelé
 * sur ces pièces. Il n'y a donc pas de second moteur de tenues : il y a un
 * choix de pièces, puis le moteur existant qui compose avec elles.
 *
 * Tout ce qui s'affiche est COMPTÉ, jamais estimé : « 12 pièces · 9 looks »,
 * ce sont 9 tenues réellement produites par le moteur avec ces 12 pièces
 * (la formule combinatoire « N looks possibles » a été retirée de Capsule le
 * 22/09/2026 pour s'être trompée de ×0,5 à ×1,7).
 */

// ── Bagages ──────────────────────────────────────────────────────────────

export type TailleBagage = "S" | "M" | "L" | "XL";

/**
 * CAPACITÉ PAR TAILLE — ARBITRAGE ÉDITORIAL du 27/09/2026 (proposé, validé
 * par la propriétaire), révisé le 09/10/2026 : la capacité n'est plus un
 * nombre de pièces mais un VOLUME, en unités d'encombrement (t-shirt plié = 1,
 * cf. UNITES_PAR_CATEGORIE). Chaussures, sacs et accessoires compris : tout ce
 * qui entre dans le bagage compte. Elle ne dépend que de la taille, quel que
 * soit le transport.
 *
 * Le troisième terme de BAGAGES est le nombre de pièces ORDINAIRES que la
 * valise contient environ (1,8 unité par pièce en moyenne) : c'est lui que
 * l'écran annonce, en « environ ». Il ne gouverne rien.
 */
export const BAGAGES: [TailleBagage, string, number][] = [
  ["S", "Cabine souple", 8],
  ["M", "Cabine", 12],
  // Libellés du brief de refonte (27/09/2026) : « Soute moyenne » et
  // « Grande soute » se lisaient mal (« Grande suite »). Capacités inchangées.
  ["L", "Grande valise", 18],
  ["XL", "Très grande valise", 24],
];

/**
 * L'ENCOMBREMENT D'UNE PIÈCE — ARBITRAGE ÉDITORIAL du 09/10/2026 (barème
 * proposé puis validé par la propriétaire, ordres de grandeur : ni mesuré ni
 * pesé). Unité : un t-shirt plié. Une catégorie ne se généralise pas : un
 * manteau pèse plus qu'un blazer, des chaussures plus qu'un sac.
 */
export const UNITES_PAR_CATEGORIE: Record<CategoryKey, number> = {
  haut: 1,
  short: 1,
  jupe: 1,
  bijou: 0.25,
  accessoire: 0.5,
  robe: 1.5,
  combinaison: 1.5,
  pantalon: 2,
  jean: 2,
  pull: 2,
  sac: 2,
  veste: 2.5,
  chaussures: 3,
  manteau: 4,
};

export const unitesDe = (cat: CategoryKey): number => UNITES_PAR_CATEGORIE[cat];

/** Le volume d'un ensemble de pièces, en unités. */
export const volumeDe = (pieces: Pick<Item, "cat">[]): number => pieces.reduce((t, p) => t + unitesDe(p.cat), 0);

/** Unités moyennes d'une pièce : sert seulement à dire « environ N pièces » à partir d'un volume. */
export const UNITES_MOYENNES_PAR_PIECE = 1.8;

/** Capacité en unités : S 14, M 22, L 32, XL 44 — la même place qu'avant pour un mélange moyen de pièces. */
export const CAPACITE_UNITES: Record<TailleBagage, number> = { S: 14, M: 22, L: 32, XL: 44 };

export const capaciteDe = (t: TailleBagage) => CAPACITE_UNITES[t];

/** Nombre de pièces ordinaires que contient environ une valise — l'affichage, jamais le calcul. */
export const piecesTypiques = (t: TailleBagage) => BAGAGES.find(([k]) => k === t)![2];

/**
 * LA CIBLE D'UNE VALISE (04/10/2026, demandée : « on est partie sur un nombre de pièces par type de valise »).
 * Jusqu'ici la capacité n'était qu'un plafond, et l'écran disait « prête » pour 1 pièce sur 18. Elle devient aussi une
 * cible : une valise n'est dite « prête » qu'à partir de 70 % de sa capacité, arrondie au supérieur — depuis le
 * 09/10/2026 en unités de volume (S 10, M 16, L 23, XL 31). Le 70 % est une PROPOSITION du 04/10/2026, à confirmer :
 * ARBITRAGE ÉDITORIAL, pas une mesure. Le plafond, lui, ne change pas (« On allège un peu ? » au-delà).
 */
export const PART_CIBLE_VALISE = 0.7;
export const cibleDeVolume = (t: TailleBagage) => Math.ceil(capaciteDe(t) * PART_CIBLE_VALISE);
export const libelleBagage = (t: TailleBagage) => BAGAGES.find(([k]) => k === t)![1];

// ── Types de séjour ──────────────────────────────────────────────────────

export type TypeSejour =
  | "plage"
  | "city_break"
  | "nature"
  | "week_end"
  | "professionnel"
  | "road_trip"
  | "evenement"
  | "montagne"
  | "detente"
  | "multi_activites"
  | "autre";

/**
 * Visuels éditoriaux des types de séjour (fournis le 27/09/2026, unisexes,
 * sans texte intégré). « Autre » n'en a pas. Ici plutôt que dans l'écran
 * Valise depuis le 28/09/2026 : la carte de « Mes planifications » les montre
 * aussi (demandé : « un visuel édito illustrant le type de vacances choisi »).
 */
export const VISUEL_SEJOUR: Partial<Record<TypeSejour, string>> = {
  plage: "/editorial/sejours/sejour_plage.webp",
  city_break: "/editorial/sejours/sejour_city_break.webp",
  nature: "/editorial/sejours/sejour_nature.webp",
  week_end: "/editorial/sejours/sejour_week_end.webp",
  professionnel: "/editorial/sejours/sejour_professionnel.webp",
  road_trip: "/editorial/sejours/sejour_road_trip.webp",
  evenement: "/editorial/sejours/sejour_evenement.webp",
  montagne: "/editorial/sejours/sejour_montagne.webp",
  detente: "/editorial/sejours/sejour_detente.webp",
  multi_activites: "/editorial/sejours/sejour_multi_activites.webp",
};

/**
 * LE TYPE DE SÉJOUR NE FAIT QU'UNE CHOSE : présélectionner les occasions de
 * la question suivante (« Qu'est-ce qui est prévu ? »), qui restent toutes
 * modifiables. Il n'entre pas dans le moteur, qui ne connaît que des
 * occasions — le dire autrement serait faux.
 *
 * ARBITRAGE ÉDITORIAL du 27/09/2026, type par type (liste de la maquette,
 * « provisoire, à valider ») : il ne s'étend pas à un type ajouté plus tard
 * sans le même examen.
 */
export const SEJOURS: [TypeSejour, string, OccasionKey[]][] = [
  ["plage", "Plage / resort", ["quotidien", "soiree"]],
  ["city_break", "City break", ["quotidien", "soiree"]],
  ["nature", "Nature / randonnée", ["quotidien", "sport"]],
  ["week_end", "Week-end", ["quotidien", "soiree"]],
  ["professionnel", "Professionnel", ["travail_formel"]],
  ["road_trip", "Road trip", ["quotidien"]],
  ["evenement", "Événement", ["evenement_perso", "quotidien"]],
  ["montagne", "Montagne / ski", ["quotidien", "sport", "cocooning"]],
  ["detente", "Détente", ["quotidien", "cocooning"]],
  ["multi_activites", "Multi-activités", ["quotidien", "sport", "soiree"]],
  ["autre", "Autre", []],
];

export const libelleSejour = (t: TypeSejour) => SEJOURS.find(([k]) => k === t)![1];

/** Occasions présélectionnées pour un type de séjour. */
export const occasionsDuSejour = (t: TypeSejour | null): OccasionKey[] => (t ? [...SEJOURS.find(([k]) => k === t)![2]] : []);

/** Ce que le moteur reçoit quand la question des occasions est passée : la présélection du séjour, sinon le quotidien. */
export function occasionsRetenues(choisies: OccasionKey[], sejour: TypeSejour | null): OccasionKey[] {
  if (choisies.length) return choisies;
  const defaut = occasionsDuSejour(sejour);
  return defaut.length ? defaut : ["quotidien"];
}

// ── Dates ────────────────────────────────────────────────────────────────

/** AAAA-MM-JJ → Date locale à midi (à l'abri des changements d'heure). */
export const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);

/** Les jours du séjour, départ et retour compris. */
export function joursDuSejour(depart: string, retour: string): string[] {
  const out: string[] = [];
  const d = dateDe(depart);
  const fin = dateDe(retour);
  const deux = (n: number) => String(n).padStart(2, "0");
  while (d <= fin && out.length < DUREE_MAX_JOURS) {
    out.push(`${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Au-delà, la valise n'est plus une valise : un séjour de trois semaines se prépare autrement. */
export const DUREE_MAX_JOURS = 21;

/** « 5 jours · 4 nuits », « 1 jour ». */
export function libelleDuree(nbJours: number): string {
  if (nbJours <= 1) return "1 jour";
  const nuits = nbJours - 1;
  return `${nbJours} jours · ${nuits} ${nuits > 1 ? "nuits" : "nuit"}`;
}

// ── Situations ───────────────────────────────────────────────────────────

/** La météo d'un jour du séjour, et si elle vient d'une prévision sur place. */
export interface MeteoJour {
  jour: string;
  temp: number;
  label: string;
  prevue: boolean;
  /**
   * Vrai quand ce jour a reçu les TEMPÉRATURES HABITUELLES du lieu à cette date (climatologie, moyenne des cinq années précédentes,
   * fetchClimat) et non une prévision (31/10/2026) : l'écran peut alors les dire, comme telles, pour des dates passées ou hors de
   * l'horizon de prévision. Absent : prévision, ou repli sur la météo d'aujourd'hui (rien de vrai à dire du lieu).
   */
  habituelle?: boolean;
  /** Les températures habituelles basse et haute de ce jour (avec `habituelle`). */
  tempMin?: number;
  tempMax?: number;
}

/**
 * Une situation = une occasion sous une météo. C'est ce que la valise doit
 * couvrir : au moins un look par situation, si le dressing le permet.
 */
export interface SituationValise {
  occasion: OccasionKey;
  meteo: Weather;
  jours: string[];
  /** La contrainte des sous-occasions qu'elle sert (chaleur, marche, outdoor) — filtre du pool, jamais une règle du moteur. */
  contrainte?: Contrainte;
  /** Les occasions du programme que ce look-type sert : plage et piscine partagent une situation, pas deux tenues. */
  sousIds?: string[];
}

/**
 * Les jours de même météo (même saison de date, température à 3° près, même
 * condition) ne font qu'une situation par occasion : cinq jours de 20° au
 * soleil n'appellent pas cinq tenues de soirée différentes pour être couverts.
 */
/** Les jours de même météo, regroupés (saison de date, température à 3° près, condition). */
export function groupesMeteo(meteos: MeteoJour[]): { meteo: Weather; jours: string[] }[] {
  const groupes = new Map<string, { meteo: Weather; jours: string[] }>();
  for (const m of meteos) {
    const saison = saisonCalendairePour(dateDe(m.jour));
    const cle = `${saison}|${Math.round(m.temp / 3)}|${m.label}`;
    const g = groupes.get(cle);
    if (g) g.jours.push(m.jour);
    else groupes.set(cle, { meteo: weatherForDay(m.temp, m.label, saison, CHALEUR_HORS_SAISON), jours: [m.jour] });
  }
  return [...groupes.values()];
}

export function situationsDuSejour(occasions: OccasionKey[], meteos: MeteoJour[]): SituationValise[] {
  const out: SituationValise[] = [];
  for (const occasion of occasions) for (const g of groupesMeteo(meteos)) out.push({ occasion, meteo: g.meteo, jours: g.jours });
  return out;
}

/**
 * LES SITUATIONS D'UN PROGRAMME (phase B, 04/10/2026). Les occasions du programme qui partagent la même mère ET la même
 * contrainte ne font QU'UNE situation par météo : plage et piscine (Quotidien, chaleur) demandent une tenue, pas deux — le
 * moteur ne compose pas une tenue complète différente pour chaque occasion. Un trajet ne se joue que le jour du départ et
 * celui du retour : sa météo est celle de ces deux jours. Programme vide : le repli d'avant (situationsDuSejour).
 */
export function situationsDuProgramme(programme: readonly ItemProgramme[], meteos: MeteoJour[], repli: OccasionKey[]): SituationValise[] {
  const elements = programme.flatMap((it) => {
    const e = elementProgramme(it.id);
    return e ? [e] : [];
  });
  if (!elements.length) return situationsDuSejour(repli, meteos);
  const tries = [...meteos].sort((a, b) => a.jour.localeCompare(b.jour));
  const extremes = tries.length ? [tries[0], tries[tries.length - 1]].filter((m, i, l) => l.findIndex((x) => x.jour === m.jour) === i) : [];
  const parGroupe = new Map<string, { mere: OccasionKey; contrainte?: Contrainte; trajet: boolean; sousIds: string[] }>();
  for (const e of elements) {
    const cle = `${e.mere}|${e.contrainte ?? ""}|${e.creneau === "trajet" ? "t" : ""}`;
    const g = parGroupe.get(cle);
    if (g) g.sousIds.push(e.id);
    else parGroupe.set(cle, { mere: e.mere, contrainte: e.contrainte, trajet: e.creneau === "trajet", sousIds: [e.id] });
  }
  const out: SituationValise[] = [];
  for (const g of parGroupe.values()) {
    for (const m of groupesMeteo(g.trajet ? extremes : tries)) {
      out.push({ occasion: g.mere, meteo: m.meteo, jours: m.jours, ...(g.contrainte ? { contrainte: g.contrainte } : {}), sousIds: g.sousIds });
    }
  }
  return out;
}

/** Amplitude des températures prévues, ou null quand aucun jour n'a de prévision. */
/** Les températures habituelles du séjour (jours `habituelle`), de la plus basse à la plus haute ; null s'il n'y en a pas. */
export function amplitudeHabituelle(meteos: MeteoJour[]): { min: number; max: number; jours: number } | null {
  const h = meteos.filter((m) => m.habituelle);
  if (!h.length) return null;
  return { min: Math.min(...h.map((m) => m.tempMin ?? m.temp)), max: Math.max(...h.map((m) => m.tempMax ?? m.temp)), jours: h.length };
}

export function amplitudePrevue(meteos: MeteoJour[]): { min: number; max: number; jours: number } | null {
  const prevues = meteos.filter((m) => m.prevue);
  if (!prevues.length) return null;
  const t = prevues.map((m) => m.temp);
  return { min: Math.min(...t), max: Math.max(...t), jours: prevues.length };
}

// ── Composition ──────────────────────────────────────────────────────────

/** Une tenue produite par le moteur : ses pièces, et si l'occasion a dû être élargie (à dire à l'écran). */
export interface TenueMoteur {
  ids: number[];
  elargie: boolean;
}

/** Tire une tenue pour une situation dans un pool donné — le moteur par défaut, remplaçable en test. */
export type Generateur = (pool: Item[], s: SituationValise) => TenueMoteur | null;

/**
 * PAS DE MOCASSINS NI DE DERBIES EN VACANCES (19/10/2026, demandé : « c'est trop sérieux pour des vacances s'il n'y a pas d'événements
 * professionnels », précisé : « ce sont les mocassins et derbies qui sont concernés »). Dans une valise, ces deux types de chaussures
 * ne servent qu'aux looks d'un événement professionnel (Travail · Bureau) ; pour toute autre situation (quotidien, voyage, soirée…), ils
 * sortent du pool avant le moteur — ils ne sont donc emportés que si le séjour compte un événement professionnel. Lus sur le type de
 * chaussure déclaré. ARBITRAGE ÉDITORIAL, instruit sur ces deux types : les babies, escarpins, bottines… ne sont pas concernés sans
 * nouvel examen (AGENTS.md, point 7).
 */
const TROP_SERIEUSES_EN_VACANCES: readonly ShoeType[] = ["Mocassins", "Derbies"];
export const tropSerieusePourLesVacances = (i: Item): boolean =>
  i.cat === "chaussures" && Boolean(i.shoeType && TROP_SERIEUSES_EN_VACANCES.includes(i.shoeType));
export const sansChaussuresSerieusesHorsTravail = (pool: Item[], occasion: OccasionKey): Item[] =>
  occasion === "travail_formel" ? pool : pool.filter((i) => !tropSerieusePourLesVacances(i));

export function generateurMoteur(
  couleurs: string[],
  genre: "femme" | "homme" | null,
  /** Colorimétrie du profil (30/09/2026) — cf. generateOutfit. */
  colorimetrie: ColorimetrieMoteur | null = null
): Generateur {
  return (poolComplet, s) => {
    // La contrainte de la situation (chaleur, marche, outdoor) restreint le pool ; le moteur, lui, ne change pas.
    const pool = sansChaussuresSerieusesHorsTravail(filtrerParContrainte(poolComplet, s.contrainte), s.occasion);
    if (!pool.length) return null;
    const r = generateOutfitWithFallback(pool, s.meteo, s.occasion, "Présentiel", undefined, couleurs, genre, undefined, undefined, colorimetrie);
    if (r.noCompleteOutfit || !r.ids.length) return null;
    // Les chaussures et le sac ajoutés suivent les règles du moteur (météo, occasion, couleur, saison) : 12/10/2026, demandé « tenir compte des règles du moteur ».
    const ids = completerChaussuresEtSac(r.ids, pool, undefined, { occasion: s.occasion, meteo: s.meteo });
    return ids ? { ids, elargie: r.occasionRelachee } : null;
  };
}

/**
 * UN LOOK DE VALISE A TOUJOURS UNE PAIRE DE CHAUSSURES ET UN SAC (04/10/2026, demandé : « pour les looks de valise, il faut
 * toujours une paire de chaussures et un sac » — un look « Top · midi » sans chaussures ni sac ne se porte pas en voyage).
 * Le moteur reste celui des tenues du jour ; la valise exige davantage : si sa tenue manque de chaussures ou de sac, une
 * pièce de ce type, prise dans la valise (le pool), la complète. Sans pièce de ce type, la tenue n'est pas un look de valise
 * (null) — « Optimise ta valise » dit alors ce qui manque. La pièce ajoutée est tirée au hasard parmi celles du pool, comme
 * le moteur tire ses tenues : plusieurs tirages font apparaître plusieurs paires.
 */
export function completerChaussuresEtSac(
  ids: number[],
  pool: Item[],
  hasard: () => number = Math.random,
  /**
   * Avec ce contexte (12/10/2026, demandé : « tenir compte des règles du moteur »), les candidates sont celles que le moteur accepterait pour
   * cette pièce (candidatsDeRemplacement : météo, occasion, saison, couleur, formalité, coupe, style) et non plus n'importe quelle paire ou
   * sac du pool — qui pouvait être des sandales sous la pluie ou des baskets avec une tenue habillée. Aucune candidate acceptée : pas de look.
   * Sans contexte, comportement d'origine.
   */
  moteur?: { occasion: OccasionKey; meteo: Weather }
): number[] | null {
  const sortie = [...ids];
  for (const cat of ["chaussures", "sac"] as const) {
    if (sortie.some((id) => pool.find((p) => p.id === id)?.cat === cat)) continue;
    const dejaLa = pool.filter((p) => sortie.includes(p.id));
    const candidats = moteur
      ? candidatsDeRemplacement(dejaLa, pool.filter((p) => !sortie.includes(p.id)), -1, cat, moteur.occasion, "Présentiel", "Verre", moteur.meteo).filter((p) => p.cat === cat)
      : pool.filter((p) => p.cat === cat && !sortie.includes(p.id));
    if (!candidats.length) return null;
    sortie.push(candidats[Math.min(candidats.length - 1, Math.floor(hasard() * candidats.length))].id);
  }
  return sortie;
}

/** Une tenue qui a des chaussures ET un sac — la règle des looks de valise (valises gardées avant le 04/10/2026 comprises). */
export const lookAChaussuresEtSac = (ids: number[], pieces: Item[]): boolean =>
  (["chaussures", "sac"] as const).every((cat) => ids.some((id) => pieces.find((p) => p.id === id)?.cat === cat));

export interface LookValise {
  ids: number[];
  /** Occasions (indices de situations) auxquelles ce look répond. */
  situations: number[];
  elargie: boolean;
}

interface Candidat {
  cle: string;
  ids: number[];
  situations: Set<number>;
  elargie: boolean;
}

/** Tirages par situation : le moteur est aléatoire, plusieurs tirages font apparaître les combinaisons réelles. */
export const TIRAGES_PAR_SITUATION = 10;
/** Étape 4 de composerValise : au plus deux pièces nouvelles par look ajouté, un look pour deux jours. ARBITRAGE ÉDITORIAL du 22/10/2026. */
export const VARIETE_PIECES_MAX = 2;

function tirer(pool: Item[], situations: SituationValise[], generer: Generateur, tirages: number): Map<string, Candidat> {
  const candidats = new Map<string, Candidat>();
  situations.forEach((s, i) => {
    for (let n = 0; n < tirages; n++) {
      const t = generer(pool, s);
      if (!t) continue;
      const ids = [...new Set(t.ids)].filter((id) => pool.some((p) => p.id === id)).sort((a, b) => a - b);
      if (!ids.length) continue;
      // Deux tenues qui ne diffèrent que par un accessoire sont le même look.
      const cle = clePrincipale(ids, pool) || ids.join(",");
      const c = candidats.get(cle);
      if (c) {
        c.situations.add(i);
        c.elargie = c.elargie && t.elargie;
      } else candidats.set(cle, { cle, ids, situations: new Set([i]), elargie: t.elargie });
    }
  });
  return candidats;
}

const nouvelles = (ids: number[], sac: Set<number>) => ids.filter((id) => !sac.has(id)).length;
/** Le volume ajouté au sac par ces pièces, en unités. */
const volumeNouveau = (ids: number[], sac: Set<number>, poids: Map<number, number>) =>
  ids.filter((id) => !sac.has(id)).reduce((t, id) => t + (poids.get(id) ?? 1), 0);
const volumeDuSac = (sac: Set<number>, poids: Map<number, number>) => [...sac].reduce((t, id) => t + (poids.get(id) ?? 1), 0);
const contenu = (ids: number[], sac: Set<number>) => ids.every((id) => sac.has(id));

export interface ResultatValise {
  pieceIds: number[];
  looks: LookValise[];
  /** Situations qu'aucun look ne couvre avec ces pièces. */
  situationsSansLook: number[];
}

/**
 * Les looks d'un ensemble de pièces : de nouveaux tirages du moteur sur ces
 * seules pièces, plus les tenues déjà tirées qui y tiennent entièrement.
 * Sert au résultat comme au retrait d'une pièce.
 */
export function looksDeLaValise(
  pieceIds: number[],
  dressing: Item[],
  situations: SituationValise[],
  generer: Generateur,
  dejaTires: Iterable<{ ids: number[]; situations: Iterable<number>; elargie: boolean }> = [],
  tirages = TIRAGES_PAR_SITUATION
): ResultatValise {
  const sac = new Set(pieceIds);
  const pool = dressing.filter((i) => sac.has(i.id));
  const candidats = tirer(pool, situations, generer, tirages);
  for (const t of dejaTires) {
    if (!contenu(t.ids, sac)) continue;
    const cle = clePrincipale(t.ids, pool) || [...t.ids].sort((a, b) => a - b).join(",");
    const c = candidats.get(cle);
    if (c) for (const i of t.situations) c.situations.add(i);
    else candidats.set(cle, { cle, ids: [...t.ids], situations: new Set(t.situations), elargie: t.elargie });
  }
  const looks = [...candidats.values()]
    .map((c) => ({ ids: c.ids, situations: [...c.situations].sort((a, b) => a - b), elargie: c.elargie }))
    // Par situation d'abord (l'ordre des occasions choisies), les looks
    // francs avant les élargis.
    .sort((a, b) => a.situations[0] - b.situations[0] || Number(a.elargie) - Number(b.elargie));
  const couvertes = new Set(looks.flatMap((l) => l.situations));
  return {
    pieceIds: [...sac].filter((id) => pool.some((p) => p.id === id)),
    looks,
    situationsSansLook: situations.map((_, i) => i).filter((i) => !couvertes.has(i)),
  };
}

/**
 * CHOIX DES PIÈCES — glouton, en trois temps.
 *
 * 1. COUVRIR. Tant qu'une situation n'a pas de look, on ajoute la tenue qui
 *    en couvre une en ajoutant le MOINS de pièces nouvelles (à égalité, celle
 *    qui couvre le plus de situations d'un coup). Jamais au-delà de la
 *    capacité : une situation qui n'y tient pas reste sans look, et l'écran
 *    le dit.
 * 2. ALLÉGER. Le glouton peut garder une pièce devenue inutile (la robe
 *    prise pour la soirée avant que le pantalon du quotidien ne la couvre
 *    aussi). On retire toute pièce dont l'absence garde chaque situation
 *    couverte et ne coûte pas plus d'un look.
 * 3. ENRICHIR. Tant que la valise a moins d'un look par jour du séjour, on
 *    ajoute la tenue qui rapporte le plus de looks par pièce ajoutée (au
 *    moins un). Au-delà, seulement si elle en rapporte au moins deux par
 *    pièce — « plus de looks, moins de pièces ». La capacité est un plafond,
 *    pas un objectif : une valise légère qui couvre tout est une bonne valise.
 * 4. VARIER (22/10/2026). Une occasion de plusieurs jours reçoit des looks jusqu'à un look pour deux jours, chacun pour au plus
 *    deux pièces nouvelles et dans la capacité.
 *
 * Seuils (un look par jour, deux looks par pièce) : ARBITRAGE ÉDITORIAL du
 * 27/09/2026, à revoir sur des dressings réels.
 */
export function composerValise(
  dressing: Item[],
  situations: SituationValise[],
  capacite: number,
  generer: Generateur,
  tirages = TIRAGES_PAR_SITUATION,
  /** Couture d'audit (22/10/2026) : `sansVariete` reproduit la composition d'avant l'étape 4. La production ne la renseigne jamais. */
  leviers?: { sansVariete?: boolean }
): ResultatValise {
  const candidats = [...tirer(dressing, situations, generer, tirages).values()];
  const sac = new Set<number>();
  const couvertes = new Set<number>();
  // La capacité est un volume (unités d'encombrement) ; les ratios « looks par pièce » restent comptés en pièces.
  const poids = new Map(dressing.map((i) => [i.id, unitesDe(i.cat)]));

  // 1. Couvrir.
  for (;;) {
    let meilleur: Candidat | null = null;
    let score: [number, number] = [Infinity, -1];
    for (const c of candidats) {
      const gain = [...c.situations].filter((i) => !couvertes.has(i)).length;
      if (!gain) continue;
      const n = nouvelles(c.ids, sac);
      if (volumeDuSac(sac, poids) + volumeNouveau(c.ids, sac, poids) > capacite) continue;
      if (n < score[0] || (n === score[0] && gain > score[1])) {
        meilleur = c;
        score = [n, gain];
      }
    }
    if (!meilleur) break;
    meilleur.ids.forEach((id) => sac.add(id));
    meilleur.situations.forEach((i) => couvertes.add(i));
  }

  const looksDans = (ens: Set<number>) => candidats.filter((c) => contenu(c.ids, ens));
  const couvre = (ens: Set<number>) => {
    const cov = new Set(looksDans(ens).flatMap((c) => [...c.situations]));
    return [...couvertes].every((i) => cov.has(i));
  };

  // 2. Alléger : d'abord les pièces qui coûtent le moins de looks.
  for (;;) {
    const nbAvant = looksDans(sac).length;
    let retiree: number | null = null;
    let perte = Infinity;
    for (const id of sac) {
      const essai = new Set([...sac].filter((x) => x !== id));
      if (!couvre(essai)) continue;
      const p = nbAvant - looksDans(essai).length;
      if (p <= 1 && p < perte) {
        retiree = id;
        perte = p;
      }
    }
    if (retiree == null) break;
    sac.delete(retiree);
  }

  // 3. Enrichir.
  const objectif = new Set(situations.flatMap((s) => s.jours)).size;
  for (;;) {
    const nbLooks = looksDans(sac).length;
    const seuil = nbLooks < objectif ? 1 : 2;
    let meilleur: Candidat | null = null;
    let ratio = 0;
    for (const c of candidats) {
      const n = nouvelles(c.ids, sac);
      if (!n || volumeDuSac(sac, poids) + volumeNouveau(c.ids, sac, poids) > capacite) continue;
      const essai = new Set([...sac, ...c.ids]);
      const gain = candidats.filter((x) => !contenu(x.ids, sac) && contenu(x.ids, essai)).length;
      if (gain / n > ratio) {
        meilleur = c;
        ratio = gain / n;
      }
    }
    if (!meilleur || ratio < seuil) break;
    meilleur.ids.forEach((id) => sac.add(id));
  }

  // 4. VARIER (22/10/2026, signalé : la même tenue du soir chaque soir). Une occasion qui revient sur plusieurs jours reçoit des looks
  //    jusqu'à un look pour deux jours, chacun pour au plus VARIETE_PIECES_MAX pièces nouvelles et dans la capacité : le moins coûteux,
  //    à égalité celui qui sert le plus de ses situations. L'étape 3 ne les ajoutait pas, car un look de plus pour deux pièces reste sous
  //    son seuil de deux looks par pièce.
  if (!leviers?.sansVariete) {
    const occasions = [...new Set(situations.map((s) => s.occasion))];
    for (const occ of occasions) {
      const siennes = situations.flatMap((s, i) => (s.occasion === occ ? [i] : []));
      const jours = new Set(siennes.flatMap((i) => situations[i].jours));
      if (jours.size < 2) continue;
      const servent = (c: Candidat) => siennes.some((i) => c.situations.has(i));
      // Un look pour deux jours au plus : la cible de l'occasion. Une occasion sans aucun look n'est pas l'affaire de cette étape.
      const cible = Math.ceil(jours.size / 2);
      for (;;) {
        const nb = looksDans(sac).filter(servent).length;
        if (nb === 0 || nb >= cible) break;
        let meilleur: Candidat | null = null;
        let score: [number, number] = [Infinity, -1];
        for (const c of candidats) {
          if (!servent(c) || contenu(c.ids, sac)) continue;
          const n = nouvelles(c.ids, sac);
          if (n > VARIETE_PIECES_MAX || volumeDuSac(sac, poids) + volumeNouveau(c.ids, sac, poids) > capacite) continue;
          const gain = siennes.filter((i) => c.situations.has(i)).length;
          if (n < score[0] || (n === score[0] && gain > score[1])) {
            meilleur = c;
            score = [n, gain];
          }
        }
        if (!meilleur) break;
        meilleur.ids.forEach((id) => sac.add(id));
      }
    }
  }

  // Une pièce qui ne figure dans aucun look final (un accessoire tiré avec
  // une tenue dont le moteur a ensuite rendu la variante sans lui) ne gagne
  // pas sa place dans le bagage : on la laisse au placard.
  const r = looksDeLaValise([...sac], dressing, situations, generer, candidats, tirages);
  const utiles = new Set(r.looks.flatMap((l) => l.ids));
  if (r.pieceIds.every((id) => utiles.has(id))) return r;
  return { ...r, pieceIds: r.pieceIds.filter((id) => utiles.has(id)) };
}

// ── Lecture du résultat ──────────────────────────────────────────────────

/** Dans combien de looks de la valise figure chaque pièce. */
export function looksParPiece(looks: LookValise[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of looks) for (const id of l.ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/** Une pièce « polyvalente » revient dans au moins 3 looks de la valise — définition affichée telle quelle. */
export const SEUIL_POLYVALENTE = 3;

export function nbPolyvalentes(looks: LookValise[]): number {
  return [...looksParPiece(looks).values()].filter((n) => n >= SEUIL_POLYVALENTE).length;
}

export type EtatJauge = "legere" | "optimisee" | "presque_pleine" | "depassee";

/** Les 4 états de la jauge (maquette 06b). Aucun n'est une alerte : même dépassée, on propose d'alléger. */
export function etatJauge(volume: number, capacite: number): EtatJauge {
  if (volume > capacite) return "depassee";
  const r = volume / capacite;
  if (r <= 0.5) return "legere";
  if (r <= 0.85) return "optimisee";
  return "presque_pleine";
}

export const LIBELLE_JAUGE: Record<EtatJauge, string> = {
  legere: "Valise légère",
  optimisee: "Optimisée",
  presque_pleine: "Presque pleine",
  depassee: "Capacité dépassée",
};

/** Groupes de l'onglet Pièces, dans l'ordre de la maquette. */
export const GROUPES_VALISE: [string, CategoryKey[]][] = [
  ["Hauts", ["haut", "pull"]],
  ["Bas", ["pantalon", "jean", "jupe", "short"]],
  ["Robes & combinaisons", ["robe", "combinaison"]],
  ["Vestes & manteaux", ["veste", "manteau"]],
  ["Chaussures", ["chaussures"]],
  ["Sacs", ["sac"]],
  ["Bijoux & accessoires", ["bijou", "accessoire"]],
];

// ── Ajuster la valise ────────────────────────────────────────────────────

/**
 * ALLÉGER UNE VALISE TROP PLEINE (« Optimiser », après un ajout qui dépasse
 * la capacité) : on retire, une à une, la pièce qui figure dans le moins de
 * looks, jusqu'à revenir à la capacité. Rend les pièces à retirer, dans
 * l'ordre, avec les looks que chacune emporte avec elle.
 */
export function allegement(
  pieceIds: number[],
  looks: LookValise[],
  capacite: number,
  /** Le volume d'une pièce, en unités ; une unité par pièce à défaut. */
  poids: (id: number) => number = () => 1
): { id: number; looksPerdus: number }[] {
  let restants = [...looks];
  let dans = [...pieceIds];
  const out: { id: number; looksPerdus: number }[] = [];
  while (dans.reduce((t, id) => t + poids(id), 0) > capacite) {
    const parPiece = looksParPiece(restants);
    const id = dans.reduce((m, x) => ((parPiece.get(x) ?? 0) < (parPiece.get(m) ?? 0) ? x : m));
    const looksPerdus = restants.filter((l) => l.ids.includes(id)).length;
    out.push({ id, looksPerdus });
    restants = restants.filter((l) => !l.ids.includes(id));
    dans = dans.filter((x) => x !== id);
  }
  return out;
}

/**
 * REMPLACER une pièce : les pièces du dressing du même groupe (Hauts, Bas…)
 * absentes de la valise, chacune avec le nombre de looks que la valise
 * aurait en l'échangeant — compté par le moteur, pas estimé. Les meilleures
 * d'abord.
 */
export function alternatives(
  id: number,
  pieceIds: number[],
  dressing: Item[],
  situations: SituationValise[],
  generer: Generateur,
  tirages = 6,
  /** La capacité de la valise (unités) : une pièce qui la ferait dépasser est rendue avec `tient: false`, jamais acceptée en silence. */
  capacite?: number
): { item: Item; looks: number; tient: boolean }[] {
  const piece = dressing.find((p) => p.id === id);
  if (!piece) return [];
  const groupe = GROUPES_VALISE.find(([, cats]) => cats.includes(piece.cat))?.[1] ?? [piece.cat];
  const reste = pieceIds.filter((x) => x !== id);
  const volumeReste = reste.reduce((n, x) => n + unitesDe(dressing.find((p) => p.id === x)?.cat ?? "haut"), 0);
  return dressing
    .filter((p) => groupe.includes(p.cat) && !pieceIds.includes(p.id))
    .map((p) => ({
      item: p,
      looks: looksDeLaValise([...reste, p.id], dressing, situations, generer, [], tirages).looks.length,
      tient: capacite === undefined || volumeReste + unitesDe(p.cat) <= capacite,
    }))
    .sort((a, b) => Number(b.tient) - Number(a.tient) || b.looks - a.looks);
}

// ── Présentation du résultat (refonte du 27/09/2026) ─────────────────────

/** Les occasions d'un look : celles des situations auxquelles il répond, dans l'ordre, sans doublon. */
export function occasionsDuLook(l: LookValise, situations: SituationValise[]): OccasionKey[] {
  return [...new Set(l.situations.map((i) => situations[i]?.occasion).filter((o): o is OccasionKey => !!o))];
}

/** Les occasions que la valise couvre réellement : au moins un look pour chacune. */
export function occasionsCouvertes(looks: LookValise[], situations: SituationValise[]): OccasionKey[] {
  return [...new Set(looks.flatMap((l) => occasionsDuLook(l, situations)))];
}

/** Les occasions auxquelles une pièce sert : celles des looks où elle figure. */
export function occasionsDeLaPiece(id: number, looks: LookValise[], situations: SituationValise[]): OccasionKey[] {
  return occasionsCouvertes(
    looks.filter((l) => l.ids.includes(id)),
    situations
  );
}

const CATEGORIE_COURTE: Record<CategoryKey, string> = {
  haut: "haut",
  pull: "pull",
  pantalon: "pantalon",
  jean: "jean",
  jupe: "jupe",
  short: "short",
  robe: "robe",
  combinaison: "combinaison",
  veste: "veste",
  manteau: "manteau",
  chaussures: "chaussures",
  sac: "sac",
  bijou: "bijou",
  accessoire: "accessoire",
};
const ORDRE_RESUME: CategoryKey[] = ["robe", "combinaison", "haut", "pull", "pantalon", "jean", "jupe", "short", "veste", "manteau", "chaussures", "sac", "bijou", "accessoire"];

/**
 * Le nom d'un look, fait de ses pièces : « Chemise · Pantalon · Mocassins ·
 * Sac ». La maquette titre « City day » ou « Dîner en ville » : aucune donnée
 * ne fournit ces noms, on dit ce que le look contient. Le sous-type ou le
 * type de chaussure quand il est connu, la catégorie sinon.
 *
 * 19/10/2026 (demandé : « la jupe ne s'appelle que midi, ce n'est pas très clair ») : pour une jupe, une robe, un short, un pantalon
 * ou une combinaison, un sous-type qui ne nomme pas la pièce (« Midi », « Chemise ») est précédé de sa catégorie : « Jupe midi »,
 * « Robe chemise ». Et chaque pièce prend une majuscule : « T-shirt · Jupe midi · Mocassins · Sac ».
 */
const CATEGORIE_A_NOMMER: CategoryKey[] = ["jupe", "robe", "short", "pantalon", "combinaison"];
function nomDansLeLook(p: Item): string {
  if (p.cat === "chaussures") return (p.shoeType ?? CATEGORIE_COURTE.chaussures).toLowerCase();
  const sousType = p.subtype?.toLowerCase();
  if (!sousType) return CATEGORIE_COURTE[p.cat];
  const categorie = CATEGORIE_COURTE[p.cat];
  return CATEGORIE_A_NOMMER.includes(p.cat) && !sousType.includes(categorie) ? `${categorie} ${sousType}` : sousType;
}
export function resumeLook(pieces: Item[]): string {
  const mots = [...pieces].sort((a, b) => ORDRE_RESUME.indexOf(a.cat) - ORDRE_RESUME.indexOf(b.cat)).map(nomDansLeLook);
  return [...new Set(mots)].map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" · ");
}

/**
 * Le conseil sous la météo prévue (étape 1) — ARBITRAGE ÉDITORIAL du
 * 27/09/2026, à partir des seules températures et conditions PRÉVUES : rien
 * n'est dit quand il n'y a pas de prévision.
 */
/**
 * LA MÉTÉO PRÉVUE DU SÉJOUR, TELLE QU'ELLE EST AUJOURD'HUI (04/10/2026, signalé : « sois juste sur la météo »).
 *
 * `valise.meteos` est la météo figée AU CALCUL de la valise — c'est ce que le moteur a reçu, et on n'y touche pas.
 * Mais ce qu'on AFFICHE comme prévision doit venir de la prévision du moment : une valise ouverte trois jours après
 * son calcul ne présente plus comme « prévus » des jours qui sont passés, ni une température d'avant-hier.
 * Seuls les jours que la prévision couvre rendent une entrée ; un jour passé, ou au-delà de l'horizon, n'en rend
 * aucune — jamais une valeur de repli. Sans prévision (hors ligne, mode démo, ville inconnue) : liste vide.
 */
export function meteosPrevuesDuSejour(prevision: Prevision | null, jours: string[]): MeteoJour[] {
  if (!prevision) return [];
  return jours.flatMap((jour) => {
    const m = previsionPour(prevision, jour, "Toute la journée");
    return m ? [{ jour, temp: m.temp, label: m.label, prevue: true }] : [];
  });
}

/** De la pluie dans la PRÉVISION du séjour (jamais dans une météo de repli) : faux quand aucun jour n'est prévu ou que le ciel est sec. */
export function pluieAnnoncee(meteos: MeteoJour[]): boolean {
  return meteos.some((m) => m.prevue && /pluie|pluvieux|averse|orage|bruine/i.test(m.label));
}

export function conseilMeteo(meteos: MeteoJour[]): string | null {
  const prevues = meteos.filter((m) => m.prevue);
  if (!prevues.length) return null;
  const min = Math.min(...prevues.map((m) => m.temp));
  const max = Math.max(...prevues.map((m) => m.temp));
  const pluie = pluieAnnoncee(meteos);
  const base =
    max < 8
      ? "Temps froid, prévois des pièces chaudes."
      : max < 15
        ? "Temps frais, prévois des couches."
        : min >= 23
          ? "Temps chaud, privilégie les matières légères."
          : "Températures douces, prévois des couches légères.";
  return pluie ? `${base} De la pluie est prévue.` : base;
}

// ── Compléter le dressing (27/09/2026) ───────────────────────────────────

const TOUTES_CATEGORIES: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau", "chaussures", "sac", "bijou", "accessoire"];

export interface Manque {
  occasion: OccasionKey;
  /** Catégories que le moteur a dû prendre dans la capsule pour composer ce look — ce qui manque au dressing. */
  categories: CategoryKey[];
  /**
   * Les pièces de la capsule elles-mêmes (11/10/2026, « option A ») : des SUGGESTIONS, pas des pièces possédées. Elles ne sont jamais dans la
   * valise ni dans son volume ; l'écran les montre « à ajouter ».
   */
  pieces: Item[];
  /** Le dressing a de quoi, mais pas la valise : c'est la capacité qui manque, pas une pièce. */
  capacite: boolean;
}

/**
 * CE QUI MANQUE AU DRESSING, pour chaque occasion restée sans look.
 *
 * La valise ne puise que dans le dressing. Pour dire quoi ajouter sans
 * l'inventer, on demande au moteur le look de cette situation dans le pool
 * habituel de l'app (composeWardrobePool : la capsule complète les catégories
 * que le dressing n'a pas, ou pas pour cette occasion). Les catégories des
 * pièces venues de la capsule sont ce qui manque. Si le moteur compose le
 * look avec le dressing seul, c'est la place qui a manqué dans la valise.
 */
export function categoriesPourCompleter(
  dressing: Item[],
  capsule: Item[],
  situations: SituationValise[],
  indicesSansLook: number[],
  generer: Generateur
): Manque[] {
  const out: Manque[] = [];
  const idsDressing = new Set(dressing.map((i) => i.id));
  for (const i of indicesSansLook) {
    const s = situations[i];
    if (!s || out.some((m) => m.occasion === s.occasion)) continue;
    const pool = composeWardrobePool(dressing, capsule, TOUTES_CATEGORIES, { completerPourOccasion: s.occasion });
    const t = generer(pool, s);
    if (!t) continue;
    const venues = t.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => !!p && !idsDressing.has(p.id));
    const categories = [...new Set(venues.map((p) => p.cat))];
    out.push({ occasion: s.occasion, categories, pieces: venues, capacite: categories.length === 0 });
  }
  return out;
}

/**
 * La part maximale de suggestions de capsule par rapport aux pièces possédées de la valise (la moitié, arrondie au-dessus) : la capsule ne
 * doit pas devenir la valise. ARBITRAGE ÉDITORIAL du 11/10/2026, à revoir sur des dressings réels.
 */
export const PLAFOND_SUGGESTIONS = 0.5;

export interface ValiseCompletee extends ResultatValise {
  /** Les pièces de la CAPSULE entrées dans la valise parce que le dressing ne suffisait pas — jamais des pièces possédées. */
  suggestionIds: number[];
}

/**
 * COMPLÉTER LA VALISE AVEC LA CAPSULE QUAND LE DRESSING NE SUFFIT PAS (11/10/2026, demandé : « capsule dans la valise si les pièces du
 * dressing ne permettent pas de compléter une valise »).
 *
 * Le déclencheur est exact : une occasion du séjour qu'AUCUN look du dressing ne couvre. Pour chacune, le moteur compose le look dans le
 * pool habituel de l'app (composeWardrobePool : la capsule complète ce que le dressing n'a pas) ; les pièces de ce look entrent dans la
 * valise si le volume le permet, celles de la capsule étant marquées comme suggestions (`suggestionIds`). Un dressing qui couvre tout :
 * rien n'est ajouté, la valise reste faite de pièces possédées. Si le moteur compose le look avec le dressing seul, c'est la place qui
 * manque, pas une pièce : rien n'est ajouté non plus.
 *
 * Les suggestions comptent dans le volume (une fois ajoutées au dressing, elles prendront de la place) ; l'écran les dit « à ajouter ».
 */
export function completerAvecCapsule(
  dressing: Item[],
  capsule: Item[],
  situations: SituationValise[],
  r: ResultatValise,
  capacite: number,
  generer: Generateur
): ValiseCompletee {
  const rien: ValiseCompletee = { ...r, suggestionIds: [] };
  // Une occasion « faiblement couverte » : tous ses looks sont ÉLARGIS (le dressing n'a pas de pièce déclarée pour elle). La capsule peut
  // la compléter, à condition d'apporter au moins une pièce que le dressing n'a pas (le look composé reste dit « élargi » si le moteur
  // l'a relâché : le drapeau du moteur ne dit pas si la capsule améliore la couverture, il n'est donc pas un critère).
  const faibles = new Set<number>();
  situations.forEach((_, i) => {
    const siens = r.looks.filter((l) => l.situations.includes(i));
    if (siens.length > 0 && siens.every((l) => l.elargie)) faibles.add(i);
  });
  const aTraiter = [...r.situationsSansLook, ...faibles];
  if (aTraiter.length === 0 || capsule.length === 0) return rien;
  const idsDressing = new Set(dressing.map((i) => i.id));
  const tous = new Map([...capsule, ...dressing].map((i) => [i.id, i]));
  const sac = new Set(r.pieceIds);
  const suggerees = new Set<number>();
  const tirees: { ids: number[]; situations: number[]; elargie: boolean }[] = [];
  const dites = new Set<OccasionKey>();
  const volumeDe_ = (ids: Iterable<number>) => [...ids].reduce((n, id) => n + unitesDe(tous.get(id)?.cat ?? "haut"), 0);
  for (const i of aTraiter) {
    const s = situations[i];
    if (!s || dites.has(s.occasion)) continue;
    dites.add(s.occasion);
    // D'abord avec ce que la valise a déjà (dressing + suggestions déjà retenues) : une pièce de capsule déjà ajoutée pour une autre
    // occasion est réutilisée plutôt que doublée par une seconde, redondante.
    const dejaLa = [...dressing, ...[...suggerees].map((id) => tous.get(id)!)];
    const reuse = suggerees.size ? generer(dejaLa, s) : null;
    const pool = reuse ? dejaLa : composeWardrobePool(dressing, capsule, TOUTES_CATEGORIES, { completerPourOccasion: s.occasion });
    const t = reuse ?? generer(pool, s);
    if (!t) continue;
    const nouveaux = t.ids.filter((id) => !sac.has(id));
    const venues = nouveaux.filter((id) => !idsDressing.has(id) && tous.has(id));
    // Le dressing seul compose ce look : c'est la place qui manque, la capsule n'y change rien. (Un look refait avec des suggestions
    // déjà retenues n'ajoute aucune pièce de capsule, mais couvre l'occasion : il entre dans la valise.)
    if (venues.length === 0 && !reuse) continue;
    if (volumeDe_(sac) + volumeDe_(nouveaux) > capacite) continue;
    // La capsule COMPLÈTE, elle ne remplace pas le dressing : jamais plus de suggestions que la moitié des pièces possédées de la valise.
    const possedees = [...sac, ...nouveaux].filter((id) => idsDressing.has(id)).length;
    const dejaSuggerees = suggerees.size + venues.filter((id) => !suggerees.has(id)).length;
    if (dejaSuggerees > Math.ceil(possedees * PLAFOND_SUGGESTIONS)) continue;
    nouveaux.forEach((id) => sac.add(id));
    venues.forEach((id) => suggerees.add(id));
    const siennes = situations.map((x, k) => (x.occasion === s.occasion ? k : -1)).filter((k) => k >= 0);
    tirees.push({ ids: t.ids, situations: siennes, elargie: t.elargie });
  }
  if (suggerees.size === 0) return rien;
  const pool = [...dressing, ...[...suggerees].map((id) => tous.get(id)!)];
  const refait = looksDeLaValise([...sac], pool, situations, generer, [...r.looks, ...tirees]);
  return { ...refait, suggestionIds: [...suggerees].filter((id) => refait.pieceIds.includes(id)) };
}

/** Le pool de la valise : le dressing, plus les suggestions de capsule qu'elle porte (cherchées dans `sources`). */
export function poolDeLaValise(dressing: Item[], suggestionIds: readonly number[] | undefined, sources: Item[]): Item[] {
  if (!suggestionIds?.length) return dressing;
  const deja = new Set(dressing.map((i) => i.id));
  const voulues = new Set(suggestionIds);
  const extra = new Map<number, Item>();
  for (const i of sources) if (voulues.has(i.id) && !deja.has(i.id) && !extra.has(i.id)) extra.set(i.id, i);
  return [...dressing, ...extra.values()];
}

/** Nom court d'une catégorie, pour « Ajouter : veste, chaussures ». */
export const nomCategorie = (c: CategoryKey) => CATEGORIE_COURTE[c];

// ── Le minimum pour préparer une valise (27/09/2026) ─────────────────────

/**
 * POUR PRÉPARER UNE VALISE, IL FAUT DE QUOI REMPLIR LA PLUS PETITE (demandé
 * le 27/09/2026) : autant de pièces que la capacité d'une valise S, et la
 * base d'une tenue — un haut et un bas (ou une robe, une combinaison), et
 * des chaussures. En dessous, la valise ne pourrait qu'être à moitié vide :
 * l'écran le dit et mène à l'ajout, plutôt que de composer quand même.
 */
export const MINIMUM_PIECES_VALISE = piecesTypiques("S");

export interface PretPourValise {
  pret: boolean;
  /** Pièces qui manquent pour atteindre la capacité d'une valise S. */
  manquePieces: number;
  /** La base d'une tenue qui manque au dressing (règle d'isCompleteOutfit). */
  manqueBase: ("haut" | "bas" | "chaussures")[];
}

export function pretPourUneValise(dressing: Item[]): PretPourValise {
  const manquePieces = Math.max(0, MINIMUM_PIECES_VALISE - dressing.length);
  const manqueBase = categoriesManquantes(dressing);
  return { pret: manquePieces === 0 && manqueBase.length === 0, manquePieces, manqueBase };
}

/**
 * LA CAPSULE DU SÉJOUR (22/10/2026, demandé : « lorsque tu identifies que la température est élevée il faut que tu en tiennes compte et
 * que tu pioches dans les bonnes capsules »). La valise se complétait avec la capsule de la tenue du jour, bâtie sur la météo d'AUJOURD'HUI
 * chez soi : une plage à 30° préparée un jour d'automne à 14° recevait des pièces d'automne. Désormais une capsule par saison que les
 * situations du séjour appellent — la saison de leur météo, bornée par le calendrier sous la vraie chaleur (saisonCapsuleDuJour, la règle
 * de la tenue du jour) —, réunies sans doublon. Le moteur trie ensuite chaque situation selon sa propre météo, comme avant.
 */
export function capsuleDuSejour(
  situations: readonly SituationValise[],
  construire: (meteo: Weather, saison: CapsuleSeason) => Item[]
): Item[] {
  const parSaison = new Map<CapsuleSeason, Weather>();
  for (const s of situations) {
    const jour = s.jours[0];
    if (!jour) continue;
    const saison = saisonCapsuleDuJour(s.meteo.temp, saisonCalendairePour(dateDe(jour)));
    const deja = parSaison.get(saison);
    // Pour une même saison, la situation la plus chaude décide de la météo de référence : c'est elle que la capsule doit pouvoir habiller.
    if (!deja || s.meteo.temp > deja.temp) parSaison.set(saison, s.meteo);
  }
  const vues = new Set<number>();
  const out: Item[] = [];
  for (const [saison, meteo] of parSaison) {
    for (const it of construire(meteo, saison)) {
      if (vues.has(it.id)) continue;
      vues.add(it.id);
      out.push(it);
    }
  }
  return out;
}
