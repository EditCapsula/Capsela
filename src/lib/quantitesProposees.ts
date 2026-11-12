import type { CreneauPlanning } from "./planningValise";
import { BAGAGES, capaciteDe, unitesDe, type LookValise, type SituationValise, type TailleBagage } from "./valise";
import type { Item } from "./types";

/*
 * LES QUANTITÉS PROPOSÉES D'UNE VALISE (12/11/2026, étape 3 du brief « Création de l'occasion Vacances », section 6 ; arbitrages de la
 * propriétaire du même jour). Module PUR, mesuré par scripts/valise-quantites.audit.ts ; branché le 12/11/2026 (option 3 retenue par la propriétaire : les looks
 * restent, le linge compte dans le remplissage, et une valise trop pleine le dit avec la taille qui conviendrait).
 *
 *   · Une TABLE DE RÈGLES UNIQUE (REGLES_PIECES, REGLES_LINGE), la première qui s'applique décide.
 *   · Les quantités se calculent sur les JOURS D'UTILISATION RÉELS dans le planning, chaque jour compté une fois même si la pièce
 *     sert à plusieurs activités ce jour-là (brief : « ne pas additionner les quantités d'une même pièce entre plusieurs sous-occasions »).
 *   · Un réglage fait à la main passe TOUJOURS devant (avecReglagesManuels).
 *   · Le LAVAGE (« Pourras-tu laver tes vêtements pendant ton séjour ? », oui / non) : oui, les besoins sont comptés sur un cycle de
 *     CYCLE_LAVAGE jours ; non, sur toute la durée du séjour, sans plafond (arbitré : « le plafond de 7 jours ne doit pas s'appliquer
 *     lorsqu'il n'y a aucune possibilité de lavage »). Sans réponse (valise d'avant), le plafond par défaut.
 *   · La DIVERSITÉ ne recule jamais : les quantités s'appliquent APRÈS la composition, les looks ne changent pas. Si elles font déborder
 *     le bagage, les exemplaires en plus sont retirés (ajusterALaCapacite), jamais une tenue.
 *
 * Seuils et cycle : ARBITRAGE ÉDITORIAL du 12/11/2026, à confirmer sur la mesure.
 */

/** Une journée chaude : chaque jour d'un t-shirt y compte pour un t-shirt entier (arbitré : « tenir compte de la chaleur »). */
export const SEUIL_CHALEUR = 25;
/** Avec lavage, les besoins se comptent sur ce nombre de jours, puis on lave. */
export const CYCLE_LAVAGE = 4;
/** Sans réponse sur le lavage, le linge se compte au plus sur une semaine. */
export const PLAFOND_LINGE_SANS_REPONSE = 7;
/** T-shirts et débardeurs : au plus 3 par défaut (arbitré). Sans lavage, pas de plafond : la durée réelle du séjour. */
export const PLAFOND_TSHIRTS = 3;
/** Au-delà de ce nombre de jours, un maillot, une robe de plage, un short léger passent à 2 (brief). */
export const SEUIL_DEUXIEME_EXEMPLAIRE = 5;

/** Les activités physiques : chaque jour d'un t-shirt y compte pour un t-shirt entier (arbitré : « les activités sportives »). */
const SOUS_IDS_SPORT = new Set(["activite_sportive", "randonnee", "sport"]);
const SOUS_IDS_BAIGNADE = new Set(["plage", "piscine", "spa"]);

export type Lavage = boolean | null;

/** Ce qu'une pièce fait pendant le séjour, lu sur le planning : ses jours, et parmi eux les jours chauds, sportifs, de baignade, de plage. */
export interface UsagePiece {
  jours: Set<string>;
  chauds: Set<string>;
  sport: Set<string>;
  baignade: Set<string>;
  plage: Set<string>;
}

export function usageDesPieces(planning: readonly CreneauPlanning[], looks: readonly Pick<LookValise, "ids">[], situations: readonly SituationValise[]): Map<number, UsagePiece> {
  const out = new Map<number, UsagePiece>();
  for (const c of planning) {
    if (c.look == null) continue;
    const s = situations.find((x) => (x.sousIds ?? []).includes(c.sousId) && x.jours.includes(c.jour));
    const chaud = (s?.meteo.temp ?? 0) >= SEUIL_CHALEUR;
    for (const id of looks[c.look]?.ids ?? []) {
      const u = out.get(id) ?? { jours: new Set<string>(), chauds: new Set<string>(), sport: new Set<string>(), baignade: new Set<string>(), plage: new Set<string>() };
      u.jours.add(c.jour);
      if (chaud) u.chauds.add(c.jour);
      if (SOUS_IDS_SPORT.has(c.sousId)) u.sport.add(c.jour);
      if (SOUS_IDS_BAIGNADE.has(c.sousId)) u.baignade.add(c.jour);
      if (c.sousId === "plage") u.plage.add(c.jour);
      out.set(id, u);
    }
  }
  return out;
}

/** Les jours comptés quand on peut laver : un cycle au plus. Sans lavage : tous. */
const joursComptes = (n: number, lavage: Lavage) => (lavage === true ? Math.min(n, CYCLE_LAVAGE) : n);

export const estTshirt = (it: Pick<Item, "cat" | "name" | "subtype">): boolean =>
  it.cat === "haut" && /t-?shirt|tee-?shirt|débardeur|debardeur|\btop\b/i.test(`${it.name} ${it.subtype ?? ""}`);
const estTenueDeBain = (it: Pick<Item, "subtype">) => it.subtype === "Maillot de bain" || it.subtype === "Short de bain";

export interface RegleQuantite {
  id: string;
  libelle: string;
  sApplique: (it: Item) => boolean;
  quantite: (u: UsagePiece, lavage: Lavage) => number;
}

/** LA TABLE DES PIÈCES, dans l'ordre : la première règle qui s'applique décide ; aucune ne s'applique, 1. */
export const REGLES_PIECES: readonly RegleQuantite[] = [
  {
    id: "bain",
    libelle: "Maillot ou short de bain : 1, puis 2 au-delà de 5 jours de baignade",
    sApplique: estTenueDeBain,
    quantite: (u) => (u.baignade.size > SEUIL_DEUXIEME_EXEMPLAIRE ? 2 : 1),
  },
  {
    id: "robe_plage",
    libelle: "Robe de plage : 1, puis 2 au-delà de 5 jours de plage",
    sApplique: (it) => it.subtype === "Robe de plage",
    quantite: (u) => (u.plage.size > SEUIL_DEUXIEME_EXEMPLAIRE ? 2 : 1),
  },
  {
    id: "tshirt",
    libelle: "T-shirt, débardeur : 1 pour 2 jours (1 par jour chaud ou sportif), au plus 3 ; sans lavage, sur toute la durée",
    sApplique: estTshirt,
    quantite: (u, lavage) => {
      const pleins = new Set([...u.chauds, ...u.sport]).size;
      const demi = u.jours.size - pleins;
      // Avec lavage, les jours se comptent sur un cycle, dans la même proportion de jours pleins.
      const total = u.jours.size;
      const comptes = joursComptes(total, lavage);
      const part = total ? comptes / total : 0;
      const besoin = Math.max(1, Math.ceil(pleins * part + (demi * part) / 2));
      return lavage === false ? besoin : Math.min(PLAFOND_TSHIRTS, besoin);
    },
  },
  {
    id: "short",
    libelle: "Short léger : 1, puis 2 au-delà de 5 jours d'utilisation",
    sApplique: (it) => it.cat === "short" && !estTenueDeBain(it),
    quantite: (u, lavage) => (joursComptes(u.jours.size, lavage) > SEUIL_DEUXIEME_EXEMPLAIRE ? 2 : 1),
  },
];

/** La quantité proposée d'une pièce : la première règle qui s'applique, sinon 1 (une pièce se réutilise). */
export function quantiteProposee(it: Item, u: UsagePiece | undefined, lavage: Lavage): number {
  if (!u) return 1;
  const regle = REGLES_PIECES.find((r) => r.sApplique(it));
  return regle ? regle.quantite(u, lavage) : 1;
}

/** LE LINGE (indispensables « Sous-vêtements », « Chaussettes ») : un par jour du séjour, sur un cycle avec lavage, sans plafond sans lavage. */
export const LINGE_PAR_JOUR: readonly string[] = ["sous_vetements", "chaussettes"];
export function quantiteLinge(joursSejour: number, lavage: Lavage): number {
  if (lavage === true) return Math.max(1, Math.min(joursSejour, CYCLE_LAVAGE));
  if (lavage === false) return Math.max(1, joursSejour);
  return Math.max(1, Math.min(joursSejour, PLAFOND_LINGE_SANS_REPONSE));
}

/** Les quantités proposées de toutes les pièces, les réglages manuels passant devant. Seules les quantités différentes de 1 sont écrites. */
export function avecReglagesManuels(proposees: Readonly<Record<string, number>>, manuelles: Readonly<Record<string, number>> | undefined): Record<string, number> {
  return { ...proposees, ...(manuelles ?? {}) };
}

/**
 * Les exemplaires EN PLUS retirés tant que le bagage déborde, les t-shirts d'abord (les plus nombreux), jamais sous 1 et jamais une pièce
 * réglée à la main : les looks ne changent pas. Rend les quantités et le nombre d'exemplaires retirés.
 */
export function ajusterALaCapacite(
  pieces: readonly Pick<Item, "id" | "cat">[],
  quantites: Readonly<Record<string, number>>,
  capacite: number,
  unites: (cat: Item["cat"]) => number,
  manuelles: Readonly<Record<string, number>> = {},
  volumeEnPlus = 0
): { quantites: Record<string, number>; retires: number } {
  const q: Record<string, number> = { ...quantites };
  const volume = () => pieces.reduce((t, p) => t + unites(p.cat) * (q[String(p.id)] ?? 1), 0) + volumeEnPlus;
  let retires = 0;
  for (;;) {
    if (volume() <= capacite) break;
    const candidates = pieces.filter((p) => (q[String(p.id)] ?? 1) > 1 && manuelles[String(p.id)] == null);
    if (!candidates.length) break;
    const p = candidates.sort((a, b) => (q[String(b.id)] ?? 1) - (q[String(a.id)] ?? 1))[0];
    q[String(p.id)] = (q[String(p.id)] ?? 1) - 1;
    retires++;
  }
  for (const k of Object.keys(q)) if (q[k] === 1) delete q[k];
  return { quantites: q, retires };
}

/** Un article de linge dans le remplissage : un quart d'un haut (option 3, 12/11/2026). ARBITRAGE ÉDITORIAL. */
export const UNITE_LINGE = 0.25;

/**
 * LES QUANTITÉS DE LA VALISE AFFICHÉE : proposées d'après le planning et le lavage, les réglages à la main devant, puis les exemplaires
 * en plus retirés si le bagage déborde (le linge compté). Les looks ne changent jamais.
 */
export function quantitesDeLaValise(p: {
  pieces: readonly Item[];
  planning: readonly CreneauPlanning[];
  looks: readonly Pick<LookValise, "ids">[];
  situations: readonly SituationValise[];
  lavage: Lavage;
  manuelles: Readonly<Record<string, number>> | undefined;
  capacite: number;
  volumeLinge: number;
}): { quantites: Record<string, number>; retires: number } {
  const usage = usageDesPieces(p.planning, p.looks, p.situations);
  const proposees: Record<string, number> = {};
  for (const it of p.pieces) {
    const q = quantiteProposee(it, usage.get(it.id), p.lavage);
    if (q > 1) proposees[String(it.id)] = q;
  }
  const manuelles = p.manuelles ?? {};
  return ajusterALaCapacite(p.pieces, avecReglagesManuels(proposees, manuelles), p.capacite, unitesDe, manuelles, p.volumeLinge);
}

/** La plus petite valise où tient ce volume, plus grande que l'actuelle ; null si aucune (même la plus grande déborde). */
export function bagageQuiConvient(volume: number, actuelle: TailleBagage): TailleBagage | null {
  const rang = BAGAGES.findIndex(([t]) => t === actuelle);
  return BAGAGES.slice(rang + 1).find(([t]) => capaciteDe(t) >= volume)?.[0] ?? null;
}
