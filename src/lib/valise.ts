import { saisonCalendairePour, weatherForDay } from "./capsule";
import type { Weather } from "./data";
import { categoriesManquantes, clePrincipale, generateOutfitWithFallback } from "./logic";
import { composeWardrobePool } from "./selectors";
import type { CategoryKey, Item, OccasionKey } from "./types";

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
 * par la propriétaire). Chaussures, sacs et accessoires compris : tout ce qui
 * entre dans le bagage compte. Elle ne dépend que de la taille, quel que soit
 * le transport.
 */
export const BAGAGES: [TailleBagage, string, number][] = [
  ["S", "Cabine souple", 8],
  ["M", "Cabine", 12],
  // Libellés du brief de refonte (27/09/2026) : « Soute moyenne » et
  // « Grande soute » se lisaient mal (« Grande suite »). Capacités inchangées.
  ["L", "Grande valise", 18],
  ["XL", "Très grande valise", 24],
];

export const capaciteDe = (t: TailleBagage) => BAGAGES.find(([k]) => k === t)![2];
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
}

/**
 * Une situation = une occasion sous une météo. C'est ce que la valise doit
 * couvrir : au moins un look par situation, si le dressing le permet.
 */
export interface SituationValise {
  occasion: OccasionKey;
  meteo: Weather;
  jours: string[];
}

/**
 * Les jours de même météo (même saison de date, température à 3° près, même
 * condition) ne font qu'une situation par occasion : cinq jours de 20° au
 * soleil n'appellent pas cinq tenues de soirée différentes pour être couverts.
 */
export function situationsDuSejour(occasions: OccasionKey[], meteos: MeteoJour[]): SituationValise[] {
  const groupes = new Map<string, { meteo: Weather; jours: string[] }>();
  for (const m of meteos) {
    const saison = saisonCalendairePour(dateDe(m.jour));
    const cle = `${saison}|${Math.round(m.temp / 3)}|${m.label}`;
    const g = groupes.get(cle);
    if (g) g.jours.push(m.jour);
    else groupes.set(cle, { meteo: weatherForDay(m.temp, m.label, saison), jours: [m.jour] });
  }
  const out: SituationValise[] = [];
  for (const occasion of occasions) for (const g of groupes.values()) out.push({ occasion, meteo: g.meteo, jours: g.jours });
  return out;
}

/** Amplitude des températures prévues, ou null quand aucun jour n'a de prévision. */
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

export function generateurMoteur(couleurs: string[], genre: "femme" | "homme" | null): Generateur {
  return (pool, s) => {
    if (!pool.length) return null;
    const r = generateOutfitWithFallback(pool, s.meteo, s.occasion, "Présentiel", undefined, couleurs, genre);
    return r.noCompleteOutfit || !r.ids.length ? null : { ids: r.ids, elargie: r.occasionRelachee };
  };
}

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
 *
 * Seuils (un look par jour, deux looks par pièce) : ARBITRAGE ÉDITORIAL du
 * 27/09/2026, à revoir sur des dressings réels.
 */
export function composerValise(
  dressing: Item[],
  situations: SituationValise[],
  capacite: number,
  generer: Generateur,
  tirages = TIRAGES_PAR_SITUATION
): ResultatValise {
  const candidats = [...tirer(dressing, situations, generer, tirages).values()];
  const sac = new Set<number>();
  const couvertes = new Set<number>();

  // 1. Couvrir.
  for (;;) {
    let meilleur: Candidat | null = null;
    let score: [number, number] = [Infinity, -1];
    for (const c of candidats) {
      const gain = [...c.situations].filter((i) => !couvertes.has(i)).length;
      if (!gain) continue;
      const n = nouvelles(c.ids, sac);
      if (sac.size + n > capacite) continue;
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
      if (!n || sac.size + n > capacite) continue;
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
export function etatJauge(nbPieces: number, capacite: number): EtatJauge {
  if (nbPieces > capacite) return "depassee";
  const r = nbPieces / capacite;
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
export function allegement(pieceIds: number[], looks: LookValise[], capacite: number): { id: number; looksPerdus: number }[] {
  let restants = [...looks];
  let dans = [...pieceIds];
  const out: { id: number; looksPerdus: number }[] = [];
  while (dans.length > capacite) {
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
  tirages = 6
): { item: Item; looks: number }[] {
  const piece = dressing.find((p) => p.id === id);
  if (!piece) return [];
  const groupe = GROUPES_VALISE.find(([, cats]) => cats.includes(piece.cat))?.[1] ?? [piece.cat];
  return dressing
    .filter((p) => groupe.includes(p.cat) && !pieceIds.includes(p.id))
    .map((p) => ({
      item: p,
      looks: looksDeLaValise([...pieceIds.filter((x) => x !== id), p.id], dressing, situations, generer, [], tirages).looks.length,
    }))
    .sort((a, b) => b.looks - a.looks);
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
 * Le nom d'un look, fait de ses pièces : « Chemise · pantalon · mocassins ·
 * sac ». La maquette titre « City day » ou « Dîner en ville » : aucune donnée
 * ne fournit ces noms, on dit ce que le look contient. Le sous-type ou le
 * type de chaussure quand il est connu, la catégorie sinon.
 */
export function resumeLook(pieces: Item[]): string {
  const mots = [...pieces]
    .sort((a, b) => ORDRE_RESUME.indexOf(a.cat) - ORDRE_RESUME.indexOf(b.cat))
    .map((p) => (p.cat === "chaussures" ? p.shoeType : p.subtype) ?? CATEGORIE_COURTE[p.cat])
    .map((m) => m.toLowerCase());
  const uniques = [...new Set(mots)];
  if (!uniques.length) return "";
  const texte = uniques.join(" · ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Le conseil sous la météo prévue (étape 1) — ARBITRAGE ÉDITORIAL du
 * 27/09/2026, à partir des seules températures et conditions PRÉVUES : rien
 * n'est dit quand il n'y a pas de prévision.
 */
export function conseilMeteo(meteos: MeteoJour[]): string | null {
  const prevues = meteos.filter((m) => m.prevue);
  if (!prevues.length) return null;
  const min = Math.min(...prevues.map((m) => m.temp));
  const max = Math.max(...prevues.map((m) => m.temp));
  const pluie = prevues.some((m) => /pluie|pluvieux|averse|orage|bruine/i.test(m.label));
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
    out.push({ occasion: s.occasion, categories, capacite: categories.length === 0 });
  }
  return out;
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
export const MINIMUM_PIECES_VALISE = capaciteDe("S");

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
