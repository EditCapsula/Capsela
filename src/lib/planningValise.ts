import { elementProgramme, type Creneau, type ItemProgramme } from "./programmeValise";
import type { LookValise, SituationValise } from "./valise";

/*
 * LE PLANNING JOUR PAR JOUR D'UNE VALISE (phase B, 04/10/2026) — « Tes looks jour par jour ».
 *
 * Il ne COMPOSE rien : les looks viennent de la valise (composerValise, le moteur de tenues). Il répartit le programme sur
 * les jours, puis choisit pour chaque créneau, PARMI LES LOOKS DÉJÀ DE LA VALISE, celui qui répond à son occasion — en
 * variant : un look déjà porté ne revient qu'à défaut d'un autre. Pur, déterministe (aucun tirage) : recalculé à chaque
 * affichage depuis le programme et les looks, il ne se stocke pas et ne peut pas diverger de la valise.
 *
 *   · un trajet : le jour du départ (et celui du retour pour le second) ;
 *   · une occasion de jour, ou de soir : ses jours, étalés sur le séjour, en préférant les jours les moins chargés —
 *     plusieurs occasions peuvent tomber le même jour (deux looks ce jour-là : le jour, puis le soir, ou deux moments).
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
  looks: readonly LookValise[]
): CreneauPlanning[] {
  const nb = jours.length;
  if (!nb) return [];
  const creneaux: { jourIdx: number; creneau: Creneau; sousId: string; libelle: string }[] = [];
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
  // 2. Le reste, les plus fréquentes d'abord, étalées sur les jours (ou les soirs) les moins chargés.
  const parFrequence = (a: { frequence: number }, b: { frequence: number }) => b.frequence - a.frequence;
  for (const { e, frequence } of elements.filter((x) => x.e.creneau === "jour").sort(parFrequence)) {
    for (const d of etaler(Math.min(frequence, nb), nb, chargeJour)) creneaux.push({ jourIdx: d, creneau: "jour", sousId: e.id, libelle: e.libelle });
  }
  for (const { e, frequence } of elements.filter((x) => x.e.creneau === "soir").sort(parFrequence)) {
    for (const d of etaler(Math.min(frequence, nb), nb, chargeSoir)) creneaux.push({ jourIdx: d, creneau: "soir", sousId: e.id, libelle: e.libelle });
  }
  creneaux.sort((a, b) => a.jourIdx - b.jourIdx || ORDRE_CRENEAU[a.creneau] - ORDRE_CRENEAU[b.creneau]);

  // 3. Un look de la valise pour chaque créneau : celui qui répond à l'occasion ce jour-là, le moins porté d'abord.
  const usage = new Array(looks.length).fill(0);
  return creneaux.map((c) => {
    const jour = jours[c.jourIdx];
    const i = situations.findIndex((s) => (s.sousIds ?? []).includes(c.sousId) && s.jours.includes(jour));
    let choix: number | null = null;
    if (i >= 0) {
      for (let k = 0; k < looks.length; k++) {
        if (!looks[k].situations.includes(i)) continue;
        if (choix == null || usage[k] < usage[choix]) choix = k;
      }
    }
    if (choix != null) usage[choix]++;
    return { jour, creneau: c.creneau, sousId: c.sousId, libelle: c.libelle, look: choix };
  });
}

/** La pièce la plus réutilisée de la valise, et combien de looks l'utilisent — pour « 1 pièce utilisée jusqu'à 4 fois » ; null s'il n'y en a pas d'au moins deux. */
export function pieceLaPlusUtilisee(parPiece: ReadonlyMap<number, number>): { id: number; fois: number } | null {
  let meilleur: { id: number; fois: number } | null = null;
  for (const [id, fois] of parPiece) if (fois >= 2 && (!meilleur || fois > meilleur.fois)) meilleur = { id, fois };
  return meilleur;
}
