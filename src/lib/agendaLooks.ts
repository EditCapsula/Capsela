import { composerPlanche } from "./compositionEditoriale";
import { occasionShortLabel } from "./data";
import { describeOutfitVariation } from "./logic";
import { jourLocal } from "./outfitFeedback";
import type { TenuePlanifiee } from "./planifier";
import type { MomentJournee } from "./prevision";
import type { Item, OccasionKey } from "./types";
import type { Planification, ValiseGardee } from "./valises";

/*
 * « MES LOOKS À VENIR » — l'agenda de looks de Planifier (30/09/2026, brief
 * « Refonte premium de la page Mes planifications »). La page cessait d'être
 * une liste de cartes identiques : elle dit d'abord LE prochain look, puis les
 * suivants, puis le reste, et range les voyages en contexte.
 *
 * Ces fonctions ne décident rien sur les données : elles ordonnent ce que
 * repartirPlanifications a déjà réparti (à venir / passées, triés par date),
 * et mettent en mots ce que la tenue enregistrée contient.
 */

/**
 * « Demain », « Dans 3 jours », ou rien (déplacé de PlanifierScreen le
 * 30/09/2026, inchangé). L'indicateur NE DOUBLE JAMAIS LA DATE au-delà d'une
 * semaine : « DANS 24 JOURS » à côté de « DIM. 19 OCT. » est deux fois la même
 * information, et la moins utile des deux gagne en place.
 */
export function echeanceCourte(jour: string, aujourdhui: string): string | null {
  const a = Date.parse(`${jour}T12:00:00`);
  const b = Date.parse(`${aujourdhui}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const n = Math.round((a - b) / 86400000);
  if (n < 0) return null;
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n <= 7) return `Dans ${n} jours`;
  return null;
}

/** Looks montrés avec leur image dans la frise, après le prochain ; au-delà, une ligne par look. */
export const SUIVANTS_AVEC_IMAGE = 3;
/** Looks passés montrés avec leur image avant la liste compacte. */
export const PASSEES_AVEC_IMAGE = 4;

export interface AgendaLooks {
  /** Les voyages (valises), en contexte : ils ne concurrencent pas le look. */
  voyages: ValiseGardee[];
  /** Le prochain look, héros de la page — jamais pour les passées. */
  prochain: TenuePlanifiee | null;
  /** La frise : les looks suivants, avec leur image. */
  suivants: TenuePlanifiee[];
  /** Le reste, en lignes compactes : une page de cartes identiques n'a pas de fin. */
  plusTard: TenuePlanifiee[];
}

export function composerAgenda(liste: readonly Planification[], vue: "up" | "past"): AgendaLooks {
  const voyages = liste.flatMap((p) => (p.type === "valise" ? [p.valise] : []));
  const tenues = liste.flatMap((p) => (p.type === "tenue" ? [p.tenue] : []));
  if (vue === "past") {
    return { voyages, prochain: null, suivants: tenues.slice(0, PASSEES_AVEC_IMAGE), plusTard: tenues.slice(PASSEES_AVEC_IMAGE) };
  }
  const [prochain = null, ...reste] = tenues;
  return { voyages, prochain, suivants: reste.slice(0, SUIVANTS_AVEC_IMAGE), plusTard: reste.slice(SUIVANTS_AVEC_IMAGE) };
}

/** « 4 occasions préparées » — tenues et voyages à venir ; rien à zéro (l'état vide parle alors). */
export function sousTitreAgenda(nbAVenir: number): string | null {
  if (nbAVenir <= 0) return null;
  return `${nbAVenir} ${nbAVenir > 1 ? "occasions préparées" : "occasion préparée"}`;
}

/** Les occasions d'un voyage, telles que choisies à sa préparation (« Plage · Dîner… »), quatre au plus. */
export function occasionsDuVoyage(v: Pick<ValiseGardee, "occasions">): string[] {
  return [...new Set(v.occasions)].slice(0, 4).map((o) => occasionShortLabel(o));
}

/** Looks d'une valise dont toutes les pièces sont encore dans le dressing — même compte que la carte valise. */
export function looksDisponibles(v: Pick<ValiseGardee, "looks">, dressing: readonly Pick<Item, "id">[]): number {
  return v.looks.filter((l) => l.ids.every((id) => dressing.some((i) => i.id === id))).length;
}

/**
 * « LE DÉTAIL CAPSELA » — le conseil de style du look, JAMAIS un texte écrit
 * pour l'occasion : describeOutfitVariation, le gabarit déterministe des idées
 * de looks, lu sur les pièces réelles de la tenue enregistrée (contraste de
 * formalité quand il existe — « Le blazer structure la robe, tandis que… » —,
 * sinon les pièces les plus distinctives). La pièce de référence est le héros
 * de la planche (robe, haut photographié, sinon haut) : celle que l'image met
 * en avant. Moins de deux pièces : rien — une phrase sur une pièce seule ne
 * conseille rien, et l'appelant se replie sur la phrase de l'occasion.
 */
export function detailCapsela(pieces: Item[], occasion: OccasionKey): string | null {
  if (pieces.length < 2) return null;
  const heros = composerPlanche(pieces).pieces.find((p) => p.role === "hero")?.item ?? pieces[0];
  const { sentence } = describeOutfitVariation({ occasion, ids: pieces.map((p) => p.id), score: 0 }, pieces, heros.id, 0, 1);
  return sentence.trim() || null;
}

// ── L'AGENDA, LE JOUR, LA LISTE (17/10/2026, brief « Refonte UX/UI de la page Planifier en agenda éditorial premium ») ──────
//
// CORRESPONDANCE AVEC LES DONNÉES, établie avant d'écrire (rien n'est ajouté au modèle) :
//   · une planification de tenue (`planned_outfits`) porte UN look, pour un jour ET un moment : `unique (user_id, jour, moment)`
//     (migration 0030). Un même jour peut donc porter jusqu'à quatre looks — Matin, Après-midi, Soirée, Toute la journée ;
//   · une valise couvre un séjour (départ → retour) et porte plusieurs looks : elle marque chacun de ses jours ;
//   · « N looks préparés » n'existe que pour une valise (ses looks encore complets dans le dressing) ; une tenue en est un.
// Les dates sont des jours locaux « AAAA-MM-JJ » (jourLocal) : jamais d'heure UTC, donc pas de décalage de jour.

/** L'ordre des moments dans une journée : la tenue de toute la journée d'abord, puis le fil des heures. */
export const ORDRE_MOMENTS: readonly MomentJournee[] = ["Toute la journée", "Matin", "Après-midi", "Soirée"];

export interface JourAgenda {
  tenues: TenuePlanifiee[];
  valises: ValiseGardee[];
}

const dateMidi = (jour: string) => new Date(`${jour}T12:00:00`);

/** Le jour décalé de `n` jours (local, midi : jamais de bascule d'heure d'été). */
export function jourDecale(jour: string, n: number): string {
  const d = dateMidi(jour);
  return jourLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12));
}

/** Les planifications rangées par jour : une tenue sur son jour, une valise sur chaque jour de son séjour. Tenues dans l'ordre des moments. */
export function planificationsParJour(tenues: readonly TenuePlanifiee[], valises: readonly ValiseGardee[]): Map<string, JourAgenda> {
  const parJour = new Map<string, JourAgenda>();
  const du = (jour: string) => {
    let j = parJour.get(jour);
    if (!j) parJour.set(jour, (j = { tenues: [], valises: [] }));
    return j;
  };
  for (const t of tenues) du(t.jour).tenues.push(t);
  for (const v of valises) {
    // Un séjour mal formé (retour avant le départ) ne marque que son départ ; jamais plus de 60 jours, par prudence.
    for (let jour = v.depart, n = 0; n < 60 && (n === 0 || jour <= v.retour); jour = jourDecale(jour, 1), n++) du(jour).valises.push(v);
  }
  for (const j of parJour.values()) j.tenues.sort((a, b) => ORDRE_MOMENTS.indexOf(a.moment) - ORDRE_MOMENTS.indexOf(b.moment));
  return parJour;
}

/** Ce qu'une case du calendrier signale : rien, un look, plusieurs looks ; et le voyage à part, pour ne pas le compter comme un look. */
export function marqueDuJour(j: JourAgenda | undefined): { looks: "aucun" | "un" | "plusieurs"; voyage: boolean } {
  const n = j?.tenues.length ?? 0;
  return { looks: n === 0 ? "aucun" : n === 1 ? "un" : "plusieurs", voyage: (j?.valises.length ?? 0) > 0 };
}

/** Les jours du sélecteur de la vue Jour : le jour choisi au centre, `rayon` jours de part et d'autre. */
export function joursAutour(jour: string, rayon = 3): string[] {
  return Array.from({ length: rayon * 2 + 1 }, (_, i) => jourDecale(jour, i - rayon));
}

/** Les moments encore libres d'un jour — ceux où un autre look peut être planifié (contrainte d'unicité de la base). */
export function momentsLibres(tenues: readonly Pick<TenuePlanifiee, "moment">[]): MomentJournee[] {
  const pris = new Set(tenues.map((t) => t.moment));
  return ORDRE_MOMENTS.filter((m) => !pris.has(m));
}

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « Octobre 2026 ». */
export function libelleMoisAnnee(jour: string): string {
  const d = dateMidi(jour);
  const m = MOIS_LONGS[d.getMonth()];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
}

/** La vue Liste : les planifications groupées par mois, dans l'ordre reçu (à venir : chronologique ; passées : la plus récente d'abord). */
export function groupesParMois(liste: readonly Planification[]): { cle: string; libelle: string; items: Planification[] }[] {
  const groupes: { cle: string; libelle: string; items: Planification[] }[] = [];
  for (const p of liste) {
    const jour = p.type === "tenue" ? p.tenue.jour : p.valise.depart;
    const cle = jour.slice(0, 7);
    let g = groupes.find((x) => x.cle === cle);
    if (!g) groupes.push((g = { cle, libelle: libelleMoisAnnee(jour), items: [] }));
    g.items.push(p);
  }
  return groupes;
}

/** « Dans 2 jours », « Demain », « Aujourd'hui » ; au-delà d'une semaine, « Dans 12 jours » reste utile sous un calendrier (pas de date à côté). */
export function echeanceLongue(jour: string, aujourdhui: string): string | null {
  const n = Math.round((dateMidi(jour).getTime() - dateMidi(aujourdhui).getTime()) / 86_400_000);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Demain";
  return `Dans ${n} jours`;
}
