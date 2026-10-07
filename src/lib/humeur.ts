import type { ColorimetrieMoteur } from "./colorimetrieMoteur";
import type { Weather } from "./data";
import { formalityOf } from "./attributes";
import { MARGE_PERTINENCE } from "./diversite";
import { computeLookScore, generateOutfitWithFallback, type GeneratedOutfitWithFallback } from "./logic";
import type { DateContext, Item, OccasionKey, WorkMode } from "./types";

/*
 * « UNE DERNIÈRE PRÉFÉRENCE ? » (07/10/2026, refonte du parcours Planifier). L'humeur d'un événement — élégante, féminine,
 * décontractée, audacieuse, confortable — n'est PAS un style du profil : elle ne se mémorise pas et ne change rien à
 * ce que le moteur autorise. Elle ne fait que DÉPARTAGER, tout en bas de la hiérarchie, des tenues que le moteur
 * a déjà jugées compatibles (météo, occasion, formalité, règles) et dont le score est proche — le même schéma que la
 * diversité (diversite.ts).
 *
 * Elle ne lit que des attributs DÉCLARÉS des pièces (formalité, catégorie, matière, coupe, type de chaussure, intensité
 * de couleur) : aucune logique sur la personne, sa morphologie, son âge ou son genre. « Féminine » désigne des pièces
 * (robe, jupe, matières fluides, chaussures à talon ou plates fines), pas une personne.
 *
 * Plafond du bonus : BONUS_HUMEUR_MAX, strictement sous MARGE_PERTINENCE — une tenue nettement moins bien notée ne peut
 * jamais passer devant sur la seule humeur.
 */

export type Humeur = "elegant" | "feminin" | "decontracte" | "audacieux" | "confortable";

export const HUMEURS: { key: Humeur; label: string }[] = [
  { key: "elegant", label: "Élégant(e)" },
  { key: "feminin", label: "Féminin(e)" },
  { key: "decontracte", label: "Décontracté(e)" },
  { key: "audacieux", label: "Audacieux(se)" },
  { key: "confortable", label: "Confortable" },
];

export const LIBELLE_HUMEUR: Record<Humeur, string> = Object.fromEntries(HUMEURS.map((h) => [h.key, h.label])) as Record<Humeur, string>;

export const BONUS_HUMEUR_MAX = 6;
/** Tirages du moteur départagés par l'humeur — moins que la diversité : la latence se paie à chaque « Une autre tenue ». */
export const CANDIDATS_HUMEUR = 10;

const ACCESSOIRES = new Set(["accessoire", "bijou", "sac"]);
const CHAUSSURES_FEMININES = new Set(["Escarpins", "Sandales à talons", "Slingbacks", "Ballerines"]);
const CHAUSSURES_CONFORT = new Set(["Baskets", "Ballerines", "Mocassins", "Espadrilles", "Mules", "Sandales"]);
const MATIERES_FLUIDES = new Set(["Soie", "Viscose"]);
const MATIERES_DOUCES = new Set(["Coton", "Lin", "Laine", "Cachemire"]);

/** Saturation HSL d'une teinte hex, 0 à 1 — une pièce neutre (gris, noir, blanc, beige) vaut près de 0. */
function saturation(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

function convient(p: Item, h: Humeur): boolean {
  switch (h) {
    case "elegant":
      return formalityOf(p) >= 3;
    case "feminin":
      return (
        p.cat === "robe" ||
        p.cat === "jupe" ||
        (p.matiere != null && MATIERES_FLUIDES.has(p.matiere)) ||
        (p.shoeType != null && CHAUSSURES_FEMININES.has(p.shoeType))
      );
    case "decontracte":
      return formalityOf(p) <= 1;
    case "audacieux":
      return p.intensiteCouleur === "intense" || p.intensiteCouleur === "lumineuse" || saturation(p.hex) >= 0.55;
    case "confortable":
      return (
        p.coupe === "Ample" ||
        (p.shoeType != null && CHAUSSURES_CONFORT.has(p.shoeType)) ||
        (p.matiere != null && MATIERES_DOUCES.has(p.matiere))
      );
  }
}

/** La part des pièces de la tenue (accessoires, sacs et bijoux exclus) qui répondent à l'humeur, de 0 à 1. */
export function affiniteHumeur(pieces: Item[], h: Humeur): number {
  const cles = pieces.filter((p) => !ACCESSOIRES.has(p.cat));
  if (!cles.length) return 0;
  return cles.filter((p) => convient(p, h)).length / cles.length;
}

export interface CandidatHumeur {
  ids: number[];
  score: number;
}

/**
 * Parmi des tenues déjà compatibles, l'index de celle qui maximise score + bonus d'humeur, entre les assez pertinentes
 * (à `MARGE_PERTINENCE` du meilleur score). Égalité : la première générée — sans signal, le tirage d'origine.
 */
export function choisirParHumeur(candidats: CandidatHumeur[], pool: Item[], humeur: Humeur): number {
  if (!candidats.length) return -1;
  const meilleur = Math.max(...candidats.map((c) => c.score));
  let index = 0;
  let final = -Infinity;
  candidats.forEach((c, i) => {
    if (c.score < meilleur - MARGE_PERTINENCE) return;
    const pieces = c.ids.map((id) => pool.find((x) => x.id === id)).filter((x): x is Item => Boolean(x));
    const f = c.score + BONUS_HUMEUR_MAX * affiniteHumeur(pieces, humeur);
    if (f > final) {
      final = f;
      index = i;
    }
  });
  return index;
}

export interface ParametresHumeur {
  pool: Item[];
  weather: Weather;
  occasion: OccasionKey;
  workMode: WorkMode;
  dateContext: DateContext;
  preferredHexes: string[];
  gender: "femme" | "homme" | null;
  morphology: string | null;
  colorimetrie?: ColorimetrieMoteur | null;
  humeur: Humeur | null;
}

/** Le moteur unique (generateOutfitWithFallback), tiré plusieurs fois quand une humeur est choisie ; sinon un seul tirage, inchangé. */
export function genererTenueHumeur(p: ParametresHumeur): GeneratedOutfitWithFallback {
  const tirer = () =>
    generateOutfitWithFallback(p.pool, p.weather, p.occasion, p.workMode, p.dateContext, p.preferredHexes, p.gender, undefined, undefined, p.colorimetrie);
  const premier = tirer();
  if (!p.humeur || premier.noCompleteOutfit) return premier;
  const resultats: GeneratedOutfitWithFallback[] = [premier];
  for (let i = 1; i < CANDIDATS_HUMEUR; i++) {
    const r = tirer();
    if (!r.noCompleteOutfit && !resultats.some((x) => x.ids.length === r.ids.length && x.ids.every((id) => r.ids.includes(id)))) resultats.push(r);
  }
  const notes: CandidatHumeur[] = resultats.map((r) => {
    const pieces = r.ids.map((id) => p.pool.find((x) => x.id === id)).filter((x): x is Item => Boolean(x));
    const { score } = computeLookScore(pieces, p.occasion, p.preferredHexes, p.morphology, new Set(), p.weather, p.workMode, p.dateContext, p.pool, p.colorimetrie);
    return { ids: r.ids, score };
  });
  return resultats[Math.max(0, choisirParHumeur(notes, p.pool, p.humeur))];
}
