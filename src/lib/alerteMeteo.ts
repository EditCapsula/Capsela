import { isRainy } from "./data";
import { estDeSaison, type ContexteSaisonnier } from "./capsule";
import { CHAUSSURES_OUVERTES, declaredOccasionOk } from "./logic";
import type { Item, OccasionKey } from "./types";

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

/* ───────────── L'ADAPTATION : des modifications MINIMALES, prises dans le dressing ───────────── */

export interface ChangementAdaptation {
  type: "ajout" | "remplacement";
  piece: Item;
  remplace?: Item;
}

export interface PropositionAdaptation {
  /** Le look adapté : les pièces gardées, remplacées ou ajoutées. */
  ids: number[];
  changements: ChangementAdaptation[];
  /** true : plus aucune pièce hors borne ne reste dans le look adapté. */
  resolu: boolean;
}

const bornesOk = (p: Item, t: number): boolean => (p.meteoMinTemp == null || t >= p.meteoMinTemp) && (p.meteoMaxTemp == null || t <= p.meteoMaxTemp);
const bornesDeclarees = (p: Item): boolean => p.meteoMinTemp != null || p.meteoMaxTemp != null;

/** Meilleure pièce d'abord : bornes DÉCLARÉES et respectées, puis occasion déclarée, puis la moins portée récemment, puis l'id (déterministe). */
function classer(candidats: Item[], t: number, occasion: OccasionKey): Item[] {
  const note = (p: Item) => (bornesDeclarees(p) && bornesOk(p, t) ? 2 : 0) + (p.occasion?.includes(occasion) ? 1 : 0);
  return [...candidats].sort((a, b) => note(b) - note(a) || (b.worn ?? 1e6) - (a.worn ?? 1e6) || a.id - b.id);
}

/**
 * Ce qu'il faut changer au look pour la météo prévue, avec le moins de pièces possible, depuis le DRESSING :
 *  1. une pièce hors borne est remplacée par une pièce de la même catégorie dont les bornes sont respectées ;
 *  2. par temps frais, si le look n'a aucune veste ni manteau, on en ajoute un (manteau sous 10 °C, sinon veste) ;
 *  3. des chaussures ouvertes sous la pluie sont remplacées par des chaussures fermées.
 * Les pièces qui n'ont pas à bouger restent. null quand rien ne peut être changé : l'appelant mène alors à l'écran du plan, où la personne
 * ajuste elle-même. Ce n'est pas le moteur de tenues : il ne recompose rien, il n'écarte pas une pièce sur son style (limite assumée).
 */
export function proposerAdaptation(args: {
  pieces: readonly Item[];
  dressing: readonly Item[];
  meteo: MeteoDuPlan;
  occasion: OccasionKey;
  contexte: ContexteSaisonnier;
  ctx?: ContexteAlerte;
}): PropositionAdaptation | null {
  const { pieces, dressing, meteo, occasion, contexte } = args;
  const alerte = evaluerAlerteMeteo(pieces, meteo, args.ctx);
  if (!alerte) return null;
  const t = meteo.temp;
  const dejaLa = new Set(pieces.map((p) => p.id));
  const eligibles = dressing.filter((p) => !dejaLa.has(p.id) && declaredOccasionOk(p, occasion) && estDeSaison(p, contexte) && bornesOk(p, t));

  const ids = new Map(pieces.map((p) => [p.id, p] as const));
  const changements: ChangementAdaptation[] = [];
  const pris = new Set<number>();
  const remplacer = (hors: Item, candidats: Item[]): boolean => {
    const choix = classer(candidats.filter((c) => !pris.has(c.id)), t, occasion)[0];
    if (!choix) return false;
    ids.delete(hors.id);
    ids.set(choix.id, choix);
    pris.add(choix.id);
    changements.push({ type: "remplacement", piece: choix, remplace: hors });
    return true;
  };

  let nonResolues = 0;
  for (const id of alerte.pieceIds) {
    const hors = pieces.find((p) => p.id === id);
    if (!hors) continue;
    const memeCat = eligibles.filter((c) => c.cat === hors.cat);
    // Sous la pluie : seulement des chaussures fermées.
    const candidats = alerte.cause === "pluie" ? memeCat.filter((c) => c.shoeType && !CHAUSSURES_OUVERTES.includes(c.shoeType)) : memeCat;
    if (!remplacer(hors, candidats)) nonResolues++;
  }

  if (alerte.cause === "froid") {
    const aUneCouche = [...ids.values()].some((p) => (COUCHES as readonly string[]).includes(p.cat));
    if (!aUneCouche) {
      const cat = t < 10 ? "manteau" : "veste";
      const choix = classer(eligibles.filter((c) => c.cat === cat && !pris.has(c.id)), t, occasion)[0] ?? classer(eligibles.filter((c) => (COUCHES as readonly string[]).includes(c.cat) && !pris.has(c.id)), t, occasion)[0];
      if (choix) {
        ids.set(choix.id, choix);
        pris.add(choix.id);
        changements.push({ type: "ajout", piece: choix });
      }
    }
  }

  if (!changements.length) return null;
  return { ids: [...ids.keys()], changements, resolu: nonResolues === 0 };
}

/** Une ligne par changement, pour le dire à la personne : « Ajout : Veste en jean », « Cardigan beige à la place de T-shirt blanc ». */
export function libelleChangement(c: ChangementAdaptation): string {
  return c.type === "ajout" ? `Ajout : ${c.piece.name}` : `${c.piece.name} à la place de ${c.remplace?.name ?? "la pièce d'origine"}`;
}
