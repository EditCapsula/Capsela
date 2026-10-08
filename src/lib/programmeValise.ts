import { OCCASIONS } from "./data";
import type { Item, OccasionKey } from "./types";
import type { MeteoJour, TypeSejour } from "./valise";

/*
 * LE PROGRAMME D'UNE VALISE (phase A de la refonte du 04/10/2026) — « Capsela propose, l'utilisatrice ajuste ».
 *
 * UNE COUCHE, PAS UN SECOND RÉFÉRENTIEL. Les dix occasions de Capsela (OCCASIONS) restent la base du moteur et sont
 * toutes proposées telles quelles. Les SOUS-OCCASIONS du voyage (visites, plage, restaurant…) ne sont pas de nouvelles
 * clés d'occasion : chacune renvoie à son occasion MÈRE, la seule que le moteur de tenues reçoit — elle hérite donc de
 * ses règles, sans moteur parallèle. `occasionsDuProgramme` rend les mères ; c'est ce que reçoivent les situations.
 *
 * Rattachements arbitrés le 04/10/2026 : Plage et Piscine → Quotidien (contrainte « chaleur ») ; Spa → Cocooning ;
 * Restaurant, Dîner et Sortie en vacances → Soirée (Date reste une occasion à part, choisie comme telle) ;
 * Randonnée → Sport (contrainte « outdoor ») ; Trajet → Voyage ; Mariage / cérémonie → Événement / Cérémonie.
 * Les contraintes sont des DONNÉES portées par l'entrée ; la phase B les applique en filtrant le pool, jamais dans le moteur.
 *
 * LE MODÈLE JOUR + CRÉNEAU. Une journée a un créneau « jour » et un créneau « soir » ; plusieurs occasions peuvent
 * tomber le même jour. La fréquence d'une occasion est donc bornée PAR SON CRÉNEAU, jamais par la somme : « Visites 5
 * jours, Plage 3 jours, Restaurant 4 soirs » ne fait pas douze jours d'activité. Un trajet est borné à deux (aller,
 * retour). La phase A enregistre et affiche le programme ; son effet sur le planning jour par jour est la phase B.
 *
 * Les parts par type de séjour (programmeParDefaut) sont un ARBITRAGE ÉDITORIAL du 04/10/2026, à revoir sur de vrais
 * voyages : une proposition à corriger, pas une mesure.
 */

export type Creneau = "jour" | "soir" | "trajet";
export type Contrainte = "chaleur" | "marche" | "outdoor";

export interface ElementProgramme {
  id: string;
  libelle: string;
  mere: OccasionKey;
  creneau: Creneau;
  contrainte?: Contrainte;
  /** Vrai pour l'une des dix occasions de Capsela, faux pour une sous-occasion du voyage. */
  generique: boolean;
}

/** Les occasions de Capsela, et leur créneau dans un séjour. Aucune n'est retirée. */
const CRENEAU_GENERIQUE: Record<string, Creneau> = {
  quotidien: "jour",
  travail_formel: "jour",
  date: "soir",
  soiree: "soir",
  sport: "jour",
  cocooning: "jour",
  voyage: "trajet",
  evenement_perso: "jour",
};

const GENERIQUES: ElementProgramme[] = OCCASIONS.filter(([k]) => k !== "all").map(([k, libelle]) => ({
  id: k,
  libelle,
  mere: k,
  creneau: CRENEAU_GENERIQUE[k] ?? "jour",
  generique: true,
}));

const sous = (id: string, libelle: string, mere: OccasionKey, creneau: Creneau, contrainte?: Contrainte): ElementProgramme => ({
  id,
  libelle,
  mere,
  creneau,
  contrainte,
  generique: false,
});

export const SOUS_OCCASIONS: ElementProgramme[] = [
  sous("visites", "Visites / découverte", "quotidien", "jour", "marche"),
  sous("balade", "Balade / promenade", "quotidien", "jour", "marche"),
  sous("shopping", "Shopping", "quotidien", "jour"),
  sous("excursion", "Excursion", "quotidien", "jour", "marche"),
  sous("plage", "Plage", "quotidien", "jour", "chaleur"),
  sous("piscine", "Piscine", "quotidien", "jour", "chaleur"),
  sous("spa", "Spa / détente", "cocooning", "jour"),
  sous("randonnee", "Randonnée", "sport", "jour", "outdoor"),
  sous("restaurant", "Restaurant", "soiree", "soir"),
  sous("diner", "Dîner", "soiree", "soir"),
  sous("sortie_vacances", "Sortie en vacances", "soiree", "soir"),
  sous("travail_reunion", "Travail / réunion", "travail_formel", "jour"),
  sous("ceremonie", "Mariage / cérémonie", "evenement_perso", "jour"),
  sous("trajet", "Voyage / trajet", "voyage", "trajet"),
];

export const TOUS_LES_ELEMENTS: ElementProgramme[] = [...SOUS_OCCASIONS, ...GENERIQUES];

/** Une valise enregistrée avant le 08/10/2026 peut porter « soiree_festive » (sous-occasion supprimée avec « Sortie festive ») : elle se lit comme « Soirée ». */
const ANCIENS_ELEMENTS: Record<string, string> = { soiree_festive: "soiree" };

export const elementProgramme = (id: string): ElementProgramme | undefined => {
  const cible = ANCIENS_ELEMENTS[id] ?? id;
  return TOUS_LES_ELEMENTS.find((e) => e.id === cible);
};

export interface ItemProgramme {
  id: string;
  frequence: number;
}

/** Les occasions MÈRES d'un programme, sans doublon, dans l'ordre : ce que reçoivent les situations (et le moteur). */
export function occasionsDuProgramme(programme: readonly ItemProgramme[]): OccasionKey[] {
  const out: OccasionKey[] = [];
  for (const it of programme) {
    const e = elementProgramme(it.id);
    if (e && !out.includes(e.mere)) out.push(e.mere);
  }
  return out;
}

/** Le plafond d'une fréquence : les jours du séjour pour un jour ou un soir, deux pour un trajet (aller, retour). */
export function plafondFrequence(creneau: Creneau, nbJours: number): number {
  const jours = Math.max(1, nbJours);
  return creneau === "trajet" ? Math.min(2, jours) : jours;
}

export const borneFrequence = (n: number, creneau: Creneau, nbJours: number): number => Math.max(1, Math.min(plafondFrequence(creneau, nbJours), Math.round(n)));

/** « 5 jours », « 3 soirs », « 2 trajets » — accordé. */
export function libelleFrequence(creneau: Creneau, n: number): string {
  const pluriel = n > 1;
  if (creneau === "soir") return `${n} ${pluriel ? "soirs" : "soir"}`;
  if (creneau === "trajet") return `${n} ${pluriel ? "trajets" : "trajet"}`;
  return `${n} ${pluriel ? "jours" : "jour"}`;
}

// ── Proposition par type de séjour ───────────────────────────────────────

/** Une entrée : sa part des jours du séjour (0 à 1), ou un nombre fixe (trajets). */
type Part = number | { fixe: number };

const PROPOSITION: Record<TypeSejour, { retenues: [string, Part][]; proposees: string[] }> = {
  plage: { retenues: [["visites", 0.4], ["plage", 0.25], ["piscine", 0.15], ["restaurant", 0.3], ["trajet", { fixe: 2 }]], proposees: ["soiree", "sport", "shopping"] },
  city_break: { retenues: [["visites", 0.5], ["restaurant", 0.3], ["shopping", 0.15], ["trajet", { fixe: 2 }]], proposees: ["soiree", "sport", "balade"] },
  nature: { retenues: [["randonnee", 0.4], ["balade", 0.3], ["restaurant", 0.2], ["trajet", { fixe: 2 }]], proposees: ["sport", "cocooning", "visites"] },
  week_end: { retenues: [["visites", 0.4], ["restaurant", 0.4], ["trajet", { fixe: 2 }]], proposees: ["soiree", "shopping", "balade"] },
  professionnel: { retenues: [["travail_reunion", 0.6], ["restaurant", 0.3], ["trajet", { fixe: 2 }]], proposees: ["soiree", "sport", "visites"] },
  road_trip: { retenues: [["balade", 0.4], ["visites", 0.3], ["restaurant", 0.3], ["trajet", { fixe: 2 }]], proposees: ["randonnee", "sport", "soiree"] },
  evenement: { retenues: [["ceremonie", 0.2], ["visites", 0.3], ["restaurant", 0.2], ["trajet", { fixe: 2 }]], proposees: ["soiree", "restaurant", "shopping"] },
  montagne: { retenues: [["sport", 0.5], ["balade", 0.2], ["spa", 0.2], ["restaurant", 0.25], ["trajet", { fixe: 2 }]], proposees: ["cocooning", "randonnee", "soiree"] },
  detente: { retenues: [["spa", 0.3], ["piscine", 0.2], ["balade", 0.2], ["restaurant", 0.25], ["trajet", { fixe: 2 }]], proposees: ["plage", "visites", "soiree"] },
  multi_activites: { retenues: [["visites", 0.3], ["sport", 0.2], ["restaurant", 0.3], ["soiree", 0.2], ["trajet", { fixe: 2 }]], proposees: ["plage", "shopping", "randonnee"] },
  autre: { retenues: [["quotidien", 0.5], ["trajet", { fixe: 2 }]], proposees: ["soiree", "sport", "visites"] },
};

/** Le programme proposé pour un séjour : ce que Capsela retient d'emblée, avec une fréquence bornée par la durée. */
export function programmeParDefaut(sejour: TypeSejour | null, nbJours: number): ItemProgramme[] {
  const modele = PROPOSITION[sejour ?? "autre"];
  const out: ItemProgramme[] = [];
  for (const [id, part] of modele.retenues) {
    const e = elementProgramme(id);
    if (!e) continue;
    const brut = typeof part === "number" ? part * nbJours : part.fixe;
    out.push({ id, frequence: borneFrequence(Math.round(brut), e.creneau, nbJours) });
  }
  return out;
}

/** Les occasions proposées en second, à cocher d'un tap : celles du modèle qui ne sont pas déjà retenues. */
export function occasionsProposees(sejour: TypeSejour | null, programme: readonly ItemProgramme[]): ElementProgramme[] {
  const modele = PROPOSITION[sejour ?? "autre"];
  return modele.proposees.map((id) => elementProgramme(id)).filter((e): e is ElementProgramme => !!e && !programme.some((p) => p.id === e.id));
}

/** La fréquence d'une occasion ajoutée à la main : un créneau — ou deux jours pour un trajet — sans plus. */
export const frequenceAjoutee = (e: ElementProgramme, nbJours: number): number => borneFrequence(e.creneau === "trajet" ? 2 : 1, e.creneau, nbJours);

/**
 * Le programme d'une valise gardée AVANT la refonte, qui n'a que ses occasions mères : une entrée par occasion, au
 * minimum. Aucune fréquence n'est inventée au-delà de ce qu'une occasion seule dit.
 */
export function programmeDepuisOccasions(occasions: readonly OccasionKey[], nbJours: number): ItemProgramme[] {
  return occasions
    .map((o) => elementProgramme(o))
    .filter((e): e is ElementProgramme => !!e)
    .map((e) => ({ id: e.id, frequence: frequenceAjoutee(e, nbJours) }));
}

// ── Couverture de la météo ───────────────────────────────────────────────

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const numeroDuMois = (jour: string) => `${Number(jour.slice(8, 10))}`;

/** « 20–23 oct. », « 30 sept. – 2 oct. », « 20 oct. » — pour une suite de jours consécutifs. */
function libellePlage(jours: string[]): string {
  const a = jours[0];
  const b = jours[jours.length - 1];
  const moisA = MOIS[Number(a.slice(5, 7)) - 1];
  const moisB = MOIS[Number(b.slice(5, 7)) - 1];
  if (a === b) return `${numeroDuMois(a)} ${moisA}`;
  return moisA === moisB ? `${numeroDuMois(a)}–${numeroDuMois(b)} ${moisB}` : `${numeroDuMois(a)} ${moisA} – ${numeroDuMois(b)} ${moisB}`;
}

/** Regroupe des jours triés en suites consécutives. */
function suites(jours: string[]): string[][] {
  const out: string[][] = [];
  for (const j of jours) {
    const derniere = out[out.length - 1];
    const veille = derniere ? new Date(`${derniere[derniere.length - 1]}T12:00:00`) : null;
    if (veille) veille.setDate(veille.getDate() + 1);
    const attendu = veille ? `${veille.getFullYear()}-${String(veille.getMonth() + 1).padStart(2, "0")}-${String(veille.getDate()).padStart(2, "0")}` : "";
    if (derniere && attendu === j) derniere.push(j);
    else out.push([j]);
  }
  return out;
}

export interface CouvertureMeteo {
  /** Les plages de jours avec une vraie prévision, « 20–23 oct. ». */
  avecPrevision: string[];
  /** Les plages de jours sans prévision : la saison fait contexte, jamais une température. */
  sansPrevision: string[];
}

/** Ce que la météo connaît du séjour : une vraie prévision ou non, jour par jour — jamais une valeur de repli présentée comme prévue. */
export function couvertureMeteo(meteos: readonly MeteoJour[]): CouvertureMeteo {
  const tries = [...meteos].sort((a, b) => a.jour.localeCompare(b.jour));
  return {
    avecPrevision: suites(tries.filter((m) => m.prevue).map((m) => m.jour)).map(libellePlage),
    sansPrevision: suites(tries.filter((m) => !m.prevue).map((m) => m.jour)).map(libellePlage),
  };
}

// ── Contraintes : ce qu'une sous-occasion demande au pool ────────────────

/**
 * Le pool d'une situation, filtré par la contrainte de sa sous-occasion (phase B, 04/10/2026). Un filtre sur le POOL, jamais
 * une règle du moteur : le moteur reçoit un dressing sans les pièces qui n'ont pas leur place ici, et compose comme il le
 * fait toujours. Seulement des constats lisibles sur les pièces (catégorie, saison, type de chaussures) ; une pièce dont le
 * type n'est pas renseigné reste — rien n'est deviné. Il n'y a pas de maillot de bain ni de vêtement de plage dans le
 * modèle : « chaleur » écarte ce qui est fait pour le froid, rien de plus.
 */
const CHAUSSURES_PAS_POUR_LA_MARCHE = ["Escarpins", "Sandales à talons", "Chaussures d'intérieur"];
const CHAUSSURES_DE_PLEIN_AIR = ["Baskets", "Bottines", "Bottes"];
const CHAUSSURES_PAS_POUR_LA_CHALEUR = ["Bottes", "Bottines", "Chaussures d'intérieur"];

export function filtrerParContrainte(pool: Item[], contrainte?: Contrainte): Item[] {
  if (!contrainte) return pool;
  return pool.filter((it) => {
    if (contrainte === "chaleur") {
      if (["manteau", "pull", "veste"].includes(it.cat)) return false;
      if (it.season === "Automne / Hiver") return false;
      if (it.cat === "chaussures" && it.shoeType && CHAUSSURES_PAS_POUR_LA_CHALEUR.includes(it.shoeType)) return false;
      return true;
    }
    if (it.cat !== "chaussures" || !it.shoeType) return true;
    if (contrainte === "marche") return !CHAUSSURES_PAS_POUR_LA_MARCHE.includes(it.shoeType);
    return CHAUSSURES_DE_PLEIN_AIR.includes(it.shoeType); // outdoor
  });
}
