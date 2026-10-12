import { CHALEUR_HORS_SAISON, weatherForDay } from "./capsule";
import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import { isRainy, type Weather } from "./data";
import { CHAUSSURES_OUVERTES, candidatsDeRemplacement, computeLookScore, evaluateBlocking } from "./logic";
import type { CapsuleSeason, CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "./types";

/*
 * L'ALERTE MÉTÉO D'UN LOOK PLANIFIÉ, ET SON ADAPTATION (12/10/2026, demandé : un vrai conseil stylistique à la place de « plus frais que ce
 * que certaines pièces de cette tenue supportent », avec une action « Adapter mon look »).
 *
 * LE CONSTAT NE REPOSE QUE SUR DES DONNÉES : les bornes de température DÉCLARÉES d'une pièce (meteoMinTemp / meteoMaxTemp, colonnes du
 * catalogue), la pluie annoncée et les chaussures ouvertes. Aucune pièce n'est jugée « trop légère » sur son nom ou sa catégorie : sans
 * borne déclarée, pas d'alerte (« Ne suppose jamais qu'un t-shirt a une température minimale de port »). La météo est celle du LIEU et du
 * MOMENT du plan (useMeteoDuPlan), jamais la météo actuelle de l'accueil ; sans elle, l'appelant n'appelle pas cette fonction.
 *
 * Deux niveaux, un seuil explicite et testé (ECART_FORT) : l'écart entre la température prévue et la borne déclarée la plus éloignée.
 *   · légère : un peu hors borne (< ECART_FORT) — « Un peu plus frais que prévu » ;
 *   · forte : très hors borne (>= ECART_FORT), ou au moins deux pièces hors borne — « Ton look mérite un ajustement ».
 * ARBITRAGE ÉDITORIAL : 5 °C ; aucune mesure ne le fonde.
 */
export const ECART_FORT = 5;

export type CauseAlerte = "froid" | "chaud" | "pluie";

export interface MeteoDuPlan {
  temp: number;
  label: string;
}

export interface AlerteMeteo {
  niveau: "legere" | "forte";
  cause: CauseAlerte;
  titre: string;
  message: string;
  cta: string;
  /** Écart en °C avec la borne déclarée la plus éloignée (0 pour la pluie). */
  ecart: number;
  /** Les pièces hors borne (ou les chaussures ouvertes). */
  pieceIds: number[];
}

export interface ContexteAlerte {
  /** La ville du plan, quand il y en a une. */
  ville?: string;
  /** Le moment du plan (« Soirée », « Matin »…). */
  moment?: string;
}

const COUCHES = ["veste", "manteau"] as const;

/** « ta soirée », « ta matinée »… pour la phrase ; « ta journée » sans moment précis. */
function momentDit(moment?: string): string {
  if (moment === "Soirée") return "ta soirée";
  if (moment === "Matin") return "ta matinée";
  if (moment === "Après-midi") return "ton après-midi";
  return "ta journée";
}

const tempDite = (t: number, ville?: string) => `${Math.round(t)} °C ${ville ? `prévus à ${ville}` : "prévus ce jour-là"}`;

/**
 * Le constat, ou null. Priorité : le froid ou le chaud (des bornes déclarées non respectées), puis la pluie sur des chaussures ouvertes.
 * Un haut sous une veste ou un manteau dont la borne est respectée n'est pas jugé : il n'est pas exposé.
 */
export function evaluerAlerteMeteo(pieces: readonly Item[], meteo: MeteoDuPlan, ctx: ContexteAlerte = {}): AlerteMeteo | null {
  if (!pieces.length || !Number.isFinite(meteo.temp)) return null;
  const t = meteo.temp;
  const couche = pieces.some((p) => (COUCHES as readonly string[]).includes(p.cat) && (p.meteoMinTemp == null || t >= p.meteoMinTemp));
  const exposee = (p: Item) => !(couche && p.cat === "haut");

  const froides = pieces.filter((p) => p.meteoMinTemp != null && t < p.meteoMinTemp && exposee(p));
  const chaudes = pieces.filter((p) => p.meteoMaxTemp != null && t > p.meteoMaxTemp && exposee(p));
  const ecartFroid = Math.max(0, ...froides.map((p) => (p.meteoMinTemp as number) - t));
  const ecartChaud = Math.max(0, ...chaudes.map((p) => t - (p.meteoMaxTemp as number)));

  const lieuDit = ctx.ville ? ` à ${ctx.ville}` : "";
  if (froides.length && ecartFroid >= ecartChaud) {
    const forte = ecartFroid >= ECART_FORT || froides.length >= 2;
    return forte
      ? {
          niveau: "forte",
          cause: "froid",
          titre: "Ton look mérite un ajustement",
          message: `Les températures prévues (${Math.round(t)} °C${lieuDit}) risquent d'être trop fraîches pour cette tenue. Découvre une alternative plus adaptée.`,
          cta: "Trouver une alternative",
          ecart: ecartFroid,
          pieceIds: froides.map((p) => p.id),
        }
      : {
          niveau: "legere",
          cause: "froid",
          titre: "Un peu plus frais que prévu",
          message: `${tempDite(t, ctx.ville)} : prévois une couche chaude pour profiter de ${momentDit(ctx.moment)}.`,
          cta: "Adapter mon look",
          ecart: ecartFroid,
          pieceIds: froides.map((p) => p.id),
        };
  }
  if (chaudes.length) {
    const forte = ecartChaud >= ECART_FORT || chaudes.length >= 2;
    return forte
      ? {
          niveau: "forte",
          cause: "chaud",
          titre: "Ton look mérite un ajustement",
          message: `Les températures prévues (${Math.round(t)} °C${lieuDit}) risquent d'être trop élevées pour cette tenue. Découvre une alternative plus légère.`,
          cta: "Trouver une alternative",
          ecart: ecartChaud,
          pieceIds: chaudes.map((p) => p.id),
        }
      : {
          niveau: "legere",
          cause: "chaud",
          titre: "Un peu plus chaud que prévu",
          message: `${tempDite(t, ctx.ville)} : choisis des pièces plus légères pour profiter de ${momentDit(ctx.moment)}.`,
          cta: "Adapter mon look",
          ecart: ecartChaud,
          pieceIds: chaudes.map((p) => p.id),
        };
  }
  const ouvertes = pieces.filter((p) => p.cat === "chaussures" && p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType));
  if (isRainy({ label: meteo.label }) && ouvertes.length) {
    return {
      niveau: "legere",
      cause: "pluie",
      titre: "De la pluie est annoncée",
      message: `De la pluie est annoncée${lieuDit} : des chaussures fermées seraient plus sûres pour ${momentDit(ctx.moment)}.`,
      cta: "Adapter mon look",
      ecart: 0,
      pieceIds: ouvertes.map((p) => p.id),
    };
  }
  return null;
}

/* ───────────── L'ADAPTATION : les règles du moteur, le dressing d'abord ───────────── */

export interface ChangementAdaptation {
  type: "ajout" | "remplacement";
  piece: Item;
  remplace?: Item;
  /** D'où vient la pièce : le dressing de la personne, ou la capsule (suggestion), prise seulement quand le dressing n'a rien de convenable. */
  source: "dressing" | "capsule";
}

export interface PropositionAdaptation {
  /** Le look adapté : les pièces gardées, remplacées ou ajoutées. */
  ids: number[];
  changements: ChangementAdaptation[];
  /** true : plus aucune pièce hors borne ne reste dans le look adapté. */
  resolu: boolean;
  /** La note du moteur (computeLookScore : couleur, palette, morphologie, formalité…) du look adapté. */
  score: number;
}

/** Ce que le moteur a besoin de savoir de la personne et du plan pour juger un look (les mêmes entrées que la composition d'une tenue). */
export interface ContexteMoteur {
  workMode?: WorkMode;
  dateContext?: DateContext;
  soireeHabillee?: boolean;
  paletteHexes?: string[];
  morphology?: string | null;
  colorimetrie?: ColorimetrieMoteur | null;
}

const bornesOk = (p: Item, t: number): boolean => (p.meteoMinTemp == null || t >= p.meteoMinTemp) && (p.meteoMaxTemp == null || t <= p.meteoMaxTemp);
const bornesDeclarees = (p: Item): boolean => p.meteoMinTemp != null || p.meteoMaxTemp != null;
const aUnIndice = (p: Item, w: Weather): boolean => bornesDeclarees(p) || Boolean(p.saisons?.length && p.saisons.some((x) => w.saisons?.includes(x))) || p.season !== "Toutes saisons";

/** Écart de formalité maximal toléré entre une pièce et celle qu'elle remplace (paliers 0, 1, 3, 4) : au-delà, le look change de registre. */
export const ECART_FORMALITE_MAX = 2;
/** Nombre de candidates départagées par la note du moteur (la note d'un look complet coûte ; les meilleures d'abord). */
const CANDIDATES_NOTEES = 8;

const ecartFormalite = (a: Item, b: Item): number | null => (a.niveauFormalite != null && b.niveauFormalite != null ? Math.abs(a.niveauFormalite - b.niveauFormalite) : null);

/** Ordre de préférence avant la note : proximité de formalité, bornes DÉCLARÉES respectées, occasion déclarée, moins portée récemment, id (déterministe). */
function pretri(candidats: Item[], t: number, occasion: OccasionKey, reference: readonly Item[]): Item[] {
  const ecart = (p: Item): number => {
    const e = reference.map((r) => ecartFormalite(p, r)).filter((x): x is number => x != null);
    return e.length ? Math.min(...e) : 0;
  };
  const note = (p: Item) => (bornesDeclarees(p) && bornesOk(p, t) ? 2 : 0) + (p.occasion?.includes(occasion) ? 1 : 0);
  return candidats
    .filter((p) => ecart(p) <= ECART_FORMALITE_MAX)
    .sort((a, b) => ecart(a) - ecart(b) || note(b) - note(a) || (b.worn ?? 1e6) - (a.worn ?? 1e6) || a.id - b.id);
}

/**
 * Ce qu'il faut changer au look pour la météo prévue, avec le moins de pièces possible, en suivant LES MÊMES RÈGLES QUE LE MOTEUR (12/10/2026,
 * demandé : « tenir compte des règles du moteur : dressing en priorité, puis pièces de la capsule avec morphologie, météo, couleur, occasions ») :
 *  · les candidates viennent de `candidatsDeRemplacement` (logic.ts), la fonction que partage « Changer cette pièce » : saison, occasion et
 *    plancher de formalité, baskets en tenue habillée, soleil, shorts, chaussures ouvertes sous la pluie et d'été sous 15°, bornes de
 *    température, puis harmonize (une teinte affirmée par tenue, formalité, coupe, style) ;
 *  · le pool est celui que Planifier compose déjà (composeWardrobePool) : le DRESSING d'abord, la capsule de la saison (déjà choisie sur le style
 *    et la morphologie du profil) en complément — jamais pour un plan « dressing seul » ;
 *  · les candidates restantes sont départagées par la note du moteur du look complet (computeLookScore : couleur, palette, colorimétrie,
 *    morphologie…), puis par l'ordre de préférence ci-dessus ;
 *  · une pièce n'est candidate contre le froid ou le chaud que s'il y a un INDICE de sa tenue à cette température (bornes ou saisons choisies).
 * Les pièces qui n'ont pas à bouger restent. null quand rien ne peut être changé : l'appelant mène alors à l'écran du plan.
 * LIMITE : la pièce proposée suit les règles du moteur, mais ce n'est pas un nouveau tirage du moteur : le reste du look est conservé tel quel.
 */
export function proposerAdaptation(args: {
  pieces: readonly Item[];
  /**
   * Le POOL du moteur pour ce plan, tel que Planifier le compose (composeWardrobePool) : les pièces du dressing d'abord, catégorie par
   * catégorie, complétées par les pièces de la capsule de la saison du plan quand le dressing n'a rien de convenable pour l'occasion. Un plan
   * « dressing seul » ne reçoit que le dressing. Ce mécanisme existe déjà : l'adaptation ne le refait pas.
   */
  pool: readonly Item[];
  /** Les ids qui sont dans le dressing de la personne : les autres pièces du pool sont des suggestions de la capsule (dites comme telles). */
  dressingIds: ReadonlySet<number>;
  meteo: MeteoDuPlan;
  occasion: OccasionKey;
  /** La météo telle que le moteur la construit pour ce jour (weatherForDay), pour ses règles de saison : saison calendaire du plan. */
  saisonDuPlan: CapsuleSeason;
  moteur?: ContexteMoteur;
  ctx?: ContexteAlerte;
}): PropositionAdaptation | null {
  const { pieces, meteo, occasion, saisonDuPlan } = args;
  const m = args.moteur ?? {};
  const alerte = evaluerAlerteMeteo(pieces, meteo, args.ctx);
  if (!alerte) return null;
  const t = meteo.temp;
  const weather: Weather = weatherForDay(t, meteo.label, saisonDuPlan, CHALEUR_HORS_SAISON);
  const regles = { workMode: m.workMode ?? ("Présentiel" as WorkMode), dateContext: m.dateContext ?? ("Verre" as DateContext), soiree: Boolean(m.soireeHabillee) };

  const courant = new Map(pieces.map((p) => [p.id, p] as const));
  const changements: ChangementAdaptation[] = [];
  const pris = new Set<number>();
  const note = (items: Item[]): number =>
    computeLookScore(items, occasion, m.paletteHexes ?? [], m.morphology ?? null, new Set(), weather, regles.workMode, regles.dateContext, [], m.colorimetrie ?? null).score;

  /** Les meilleures candidates pour un emplacement, prises dans le pool du moteur (dressing d'abord, capsule en complément). */
  const choisir = (hors: Item | null, cat: CategoryKey, reference: readonly Item[]): { piece: Item; source: "dressing" | "capsule" } | null => {
    const tenue = [...courant.values()];
    const pool = args.pool.filter((p) => !courant.has(p.id) || p.id === hors?.id) as Item[];
    let candidates = candidatsDeRemplacement(tenue, pool, hors?.id ?? -1, cat, occasion, regles.workMode, regles.dateContext, weather, regles.soiree)
      .filter((c) => !pris.has(c.id) && bornesOk(c, t));
    if (alerte.cause === "pluie") candidates = candidates.filter((c) => c.cat !== "chaussures" || (c.shoeType && !CHAUSSURES_OUVERTES.includes(c.shoeType)));
    else candidates = candidates.filter((c) => aUnIndice(c, weather));
    const ordre = pretri(candidates, t, occasion, reference).slice(0, CANDIDATES_NOTEES);
    // Jamais une pièce qui fait déclencher à la tenue une règle bloquante du moteur (R-B1 à R-B10 : saison, contraste de formalité, robe
    // avec haut ou bas…) que la tenue actuelle ne déclenchait pas — y compris la saison d'une pièce du catalogue, que le simple échange
    // du moteur ne contrôle pas (audit du 12/10/2026).
    const dejaDeclenchees = new Set(evaluateBlocking(tenue, occasion, weather, regles.workMode, regles.dateContext).map((h) => h.id));
    const sains = ordre.filter((c) => {
      const apres = tenue.filter((x) => x.id !== hors?.id).concat(c);
      return evaluateBlocking(apres, occasion, weather, regles.workMode, regles.dateContext).every((h) => dejaDeclenchees.has(h.id));
    });
    if (!sains.length) return null;
    const notes = sains.map((c, i) => {
      const apres = tenue.filter((x) => x.id !== hors?.id).concat(c);
      return { c, i, n: note(apres) };
    });
    notes.sort((a, b) => b.n - a.n || a.i - b.i);
    return { piece: notes[0].c, source: args.dressingIds.has(notes[0].c.id) ? "dressing" : "capsule" };
  };

  let nonResolues = 0;
  for (const id of alerte.pieceIds) {
    const hors = pieces.find((p) => p.id === id);
    if (!hors) continue;
    const choix = choisir(hors, hors.cat, [hors]);
    if (!choix) {
      nonResolues++;
      continue;
    }
    courant.delete(hors.id);
    courant.set(choix.piece.id, choix.piece);
    pris.add(choix.piece.id);
    changements.push({ type: "remplacement", piece: choix.piece, remplace: hors, source: choix.source });
  }

  if (alerte.cause === "froid" && ![...courant.values()].some((p) => (COUCHES as readonly string[]).includes(p.cat))) {
    const reste = [...courant.values()];
    const choix = (t < 10 ? choisir(null, "manteau", reste) : choisir(null, "veste", reste)) ?? choisir(null, t < 10 ? "veste" : "manteau", reste);
    if (choix) {
      courant.set(choix.piece.id, choix.piece);
      pris.add(choix.piece.id);
      changements.push({ type: "ajout", piece: choix.piece, source: choix.source });
    }
  }

  if (!changements.length) return null;
  const ids = [...courant.keys()];
  return { ids, changements, resolu: nonResolues === 0, score: note([...courant.values()]) };
}

/** Une ligne par changement, pour le dire à la personne : « Ajout : Veste en jean », « Cardigan beige à la place de T-shirt blanc ». */
export function libelleChangement(c: ChangementAdaptation): string {
  const suffixe = c.source === "capsule" ? " (suggestion de ta capsule)" : "";
  return (c.type === "ajout" ? `Ajout : ${c.piece.name}` : `${c.piece.name} à la place de ${c.remplace?.name ?? "la pièce d'origine"}`) + suffixe;
}
