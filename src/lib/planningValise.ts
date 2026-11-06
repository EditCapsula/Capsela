import { creneauDuMoment, evenementsDuSejour, libelleEvenement, sousIdEvenement, type EvenementValise, type MomentEvenement } from "./evenementsValise";
import { elementProgramme, type Creneau, type ItemProgramme } from "./programmeValise";
import type { LookValise, SituationValise } from "./valise";
import type { ValiseGardee } from "./valises";

/*
 * LE PLANNING JOUR PAR JOUR D'UNE VALISE (phase B, 04/10/2026) — « Tes looks jour par jour ».
 *
 * Il ne COMPOSE rien : les looks viennent de la valise (composerValise, le moteur de tenues). Il répartit le programme sur
 * les jours, puis choisit pour chaque créneau, PARMI LES LOOKS DÉJÀ DE LA VALISE, celui qui répond à son occasion — en
 * variant : un look déjà porté ne revient qu'à défaut d'un autre. Pur, déterministe (aucun tirage) : recalculé à chaque
 * affichage depuis le programme et les looks, il ne se stocke pas et ne peut pas diverger de la valise.
 *
 *   · un trajet : le jour du départ (et celui du retour pour le second) ;
 *   · un événement daté (22/10/2026, evenementsValise.ts) : SON jour et SON moment, placé avant le reste, qui évite ce créneau ;
 *   · une occasion de jour, ou de soir : ses jours, étalés sur le séjour, en préférant les jours les moins chargés —
 *     plusieurs occasions peuvent tomber le même jour (deux looks ce jour-là : le jour, puis le soir, ou deux moments) ;
 *   · sauf quand la personne a déplacé ses activités (06/11/2026, demandé : « L'utilisateur devrait pouvoir les modifier avec un
 *     glisser déposer » ; seules les activités réparties automatiquement se déplacent, arbitré le même jour) : leurs jours gardés
 *     (`placements`) priment, tant qu'ils restent valables pour le séjour et le programme — sinon l'étalement reprend.
 *
 * Un créneau sans look (aucun look de la valise ne répond à cette occasion, ce jour-là) reste sans look : jamais un
 * faux look.
 */

export interface CreneauPlanning {
  /** AAAA-MM-JJ */
  jour: string;
  creneau: Creneau;
  sousId: string;
  libelle: string;
  /** L'indice dans `looks` (la liste passée à planningDuProgramme), ou null quand aucun look ne répond. */
  look: number | null;
  /** Vrai pour un événement daté : l'écran le distingue des activités réparties. */
  evenement?: boolean;
  /** Le moment d'un événement daté (Matin, Journée, Soirée, Toute la journée), que l'écran affiche. */
  moment?: MomentEvenement;
  /** Vrai pour une activité répartie (ni trajet, ni événement daté) : la seule que la personne peut déplacer. */
  deplacable?: boolean;
}

/** Les jours choisis par la personne pour ses activités réparties : l'id de l'activité → ses jours (AAAA-MM-JJ). */
export type PlacementsPlanning = Record<string, string[]>;

/** Des jours gardés valables : autant que la fréquence (bornée par le séjour), distincts, tous dans le séjour. */
function joursGardes(gardes: readonly string[] | undefined, frequence: number, jours: readonly string[]): number[] | null {
  if (!gardes) return null;
  const idx = gardes.map((j) => jours.indexOf(j));
  if (idx.length !== Math.min(frequence, jours.length) || idx.some((d) => d < 0) || new Set(idx).size !== idx.length) return null;
  return idx;
}

const ORDRE_CRENEAU: Record<Creneau, number> = { trajet: 0, jour: 1, soir: 2 };

/** Étale `n` jours sur `nbJours`, en préférant les moins chargés puis les plus proches d'une répartition régulière. */
function etaler(n: number, nbJours: number, charge: number[]): number[] {
  const choisis: number[] = [];
  for (let k = 0; k < n; k++) {
    const cible = Math.floor(((k + 0.5) * nbJours) / n);
    let meilleur = -1;
    let score: [number, number] = [Infinity, Infinity];
    for (let d = 0; d < nbJours; d++) {
      if (choisis.includes(d)) continue;
      const s: [number, number] = [charge[d], Math.abs(d - cible)];
      if (s[0] < score[0] || (s[0] === score[0] && s[1] < score[1])) {
        meilleur = d;
        score = s;
      }
    }
    if (meilleur < 0) break;
    choisis.push(meilleur);
    charge[meilleur]++;
  }
  return choisis;
}

export function planningDuProgramme(
  programme: readonly ItemProgramme[],
  jours: readonly string[],
  situations: readonly SituationValise[],
  looks: readonly LookValise[],
  evenements: readonly EvenementValise[] = [],
  placements: PlacementsPlanning = {}
): CreneauPlanning[] {
  const nb = jours.length;
  if (!nb) return [];
  const creneaux: { jourIdx: number; creneau: Creneau; sousId: string; libelle: string; evenement?: boolean; moment?: MomentEvenement; deplacable?: boolean }[] = [];
  const chargeJour = new Array(nb).fill(0);
  const chargeSoir = new Array(nb).fill(0);

  const elements = programme.flatMap((it) => {
    const e = elementProgramme(it.id);
    return e ? [{ e, frequence: it.frequence }] : [];
  });

  // 1. Les trajets : le départ, puis le retour.
  for (const { e, frequence } of elements.filter((x) => x.e.creneau === "trajet")) {
    const idx = frequence >= 2 && nb > 1 ? [0, nb - 1] : [0];
    for (const d of idx) creneaux.push({ jourIdx: d, creneau: "trajet", sousId: e.id, libelle: e.libelle });
  }
  // 2. Les événements datés : leur jour, leur moment. Le créneau compte comme pris : les activités étalées l'évitent si elles le peuvent.
  for (const ev of evenementsDuSejour(evenements, jours)) {
    const d = jours.indexOf(ev.jour);
    const creneau = creneauDuMoment(ev.moment);
    (creneau === "soir" ? chargeSoir : chargeJour)[d]++;
    // Toute la journée : la soirée est prise aussi, les sorties du soir étalées l'évitent si elles le peuvent.
    if (ev.moment === "journee_entiere") chargeSoir[d]++;
    creneaux.push({ jourIdx: d, creneau, sousId: sousIdEvenement(ev), libelle: libelleEvenement(ev), evenement: true, moment: ev.moment });
  }
  // 3. Le reste. D'abord les activités que la personne a placées, à leurs jours ; puis les autres, les plus fréquentes d'abord,
  //    étalées sur les jours (ou les soirs) les moins chargés.
  const parFrequence = (a: { frequence: number }, b: { frequence: number }) => b.frequence - a.frequence;
  for (const creneau of ["jour", "soir"] as const) {
    const charge = creneau === "soir" ? chargeSoir : chargeJour;
    const liste = elements.filter((x) => x.e.creneau === creneau).sort(parFrequence);
    const places = liste.map(({ e, frequence }) => joursGardes(placements[e.id], frequence, jours));
    places.forEach((idx) => idx?.forEach((d) => charge[d]++));
    liste.forEach(({ e, frequence }, i) => {
      for (const d of places[i] ?? etaler(Math.min(frequence, nb), nb, charge))
        creneaux.push({ jourIdx: d, creneau, sousId: e.id, libelle: e.libelle, deplacable: true });
    });
  }
  creneaux.sort((a, b) => a.jourIdx - b.jourIdx || ORDRE_CRENEAU[a.creneau] - ORDRE_CRENEAU[b.creneau]);

  // 4. Un look de la valise pour chaque créneau : celui qui répond à l'occasion ce jour-là, le moins porté d'abord. Les événements
  //    choisissent EN PREMIER, et les autres créneaux évitent ensuite leurs looks quand un autre look leur répond (22/10/2026) : le look
  //    du mariage ne revient pas chaque soir si la valise en a un autre pour les soirées. Sans autre look, il est partagé, jamais retiré.
  const usage = new Array(looks.length).fill(0);
  const reserves = new Set<number>();
  const choix = new Array<number | null>(creneaux.length).fill(null);
  const choisir = (idx: number) => {
    const c = creneaux[idx];
    const jour = jours[c.jourIdx];
    const i = situations.findIndex((s) => (s.sousIds ?? []).includes(c.sousId) && s.jours.includes(jour));
    if (i < 0) return;
    let meilleur: number | null = null;
    const cle = (k: number): [number, number] => [reserves.has(k) ? 1 : 0, usage[k]];
    for (let k = 0; k < looks.length; k++) {
      if (!looks[k].situations.includes(i)) continue;
      if (meilleur == null) meilleur = k;
      else {
        const [a1, a2] = cle(k);
        const [b1, b2] = cle(meilleur);
        if (a1 < b1 || (a1 === b1 && a2 < b2)) meilleur = k;
      }
    }
    if (meilleur == null) return;
    usage[meilleur]++;
    if (c.evenement) reserves.add(meilleur);
    choix[idx] = meilleur;
  };
  creneaux.forEach((c, idx) => c.evenement && choisir(idx));
  creneaux.forEach((c, idx) => !c.evenement && choisir(idx));
  return creneaux.map((c, idx) => ({
    jour: jours[c.jourIdx],
    creneau: c.creneau,
    sousId: c.sousId,
    libelle: c.libelle,
    look: choix[idx],
    ...(c.evenement ? { evenement: true, moment: c.moment } : {}),
    ...(c.deplacable ? { deplacable: true } : {}),
  }));
}

/**
 * Déplace une activité répartie d'un jour à un autre. Rend les placements de TOUTES les activités réparties, telles que le planning
 * les montre, avec ce seul changement : rien d'autre ne bouge sous les yeux de la personne. null quand le déplacement est impossible
 * (un trajet, un événement daté, le même jour, ou un jour qui a déjà cette activité).
 */
export function deplacerActivite(planning: readonly CreneauPlanning[], sousId: string, de: string, vers: string): PlacementsPlanning | null {
  if (de === vers) return null;
  const siens = planning.filter((c) => c.deplacable && c.sousId === sousId);
  if (!siens.some((c) => c.jour === de) || siens.some((c) => c.jour === vers)) return null;
  const out: PlacementsPlanning = {};
  for (const c of planning) if (c.deplacable) (out[c.sousId] ??= []).push(c.sousId === sousId && c.jour === de ? vers : c.jour);
  return out;
}

/** Les jours où une activité répartie peut aller : ceux du séjour qui ne l'ont pas déjà. */
export function joursPossibles(planning: readonly CreneauPlanning[], sousId: string, jours: readonly string[]): string[] {
  const pris = new Set(planning.filter((c) => c.deplacable && c.sousId === sousId).map((c) => c.jour));
  return jours.filter((j) => !pris.has(j));
}

/**
 * Le planning d'une valise gardée, tel que l'écran Valise et la tenue du jour le lisent (un seul calcul pour les deux). Vide pour une
 * valise composée avant le planning jour par jour (ni programme ni événement, ou des situations sans leurs occasions).
 */
export function planningDeLaValise(
  v: Pick<ValiseGardee, "programme" | "situations" | "evenements" | "placements">,
  jours: readonly string[],
  looks: readonly LookValise[]
): CreneauPlanning[] {
  if (!(v.programme?.length || v.evenements?.length) || !v.situations.some((s) => s.sousIds?.length)) return [];
  return planningDuProgramme(v.programme ?? [], jours, v.situations, looks, v.evenements ?? [], v.placements ?? {});
}

/** La pièce la plus réutilisée de la valise, et combien de looks l'utilisent — pour « 1 pièce utilisée jusqu'à 4 fois » ; null s'il n'y en a pas d'au moins deux. */
export function pieceLaPlusUtilisee(parPiece: ReadonlyMap<number, number>): { id: number; fois: number } | null {
  let meilleur: { id: number; fois: number } | null = null;
  for (const [id, fois] of parPiece) if (fois >= 2 && (!meilleur || fois > meilleur.fois)) meilleur = { id, fois };
  return meilleur;
}
