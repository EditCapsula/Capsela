import type { OccasionKey } from "./types";

/*
 * LE CARROUSEL DE L'ACCUEIL (14/10/2026) — une proposition par occasion à la place d'une tenue unique, dans l'ordre du
 * jour (slidesDuJour, 17/10/2026 : travail d'abord un jour travaillé, jamais un jour de repos), sauf la slide de la tenue du jour, toujours en tête. Module pur ; le tirage des tenues reste celui du moteur (regen, store.tsx).
 *
 *   · La tenue du jour du store (state.outfit — celle qui porte l'avis, le quota, le plan appliqué) occupe la slide de SON occasion
 *     quand elle en a une. Une tenue planifiée pour aujourd'hui est montrée EN PREMIER ; depuis le 15/10/2026 (signalé : « il manque une
 *     tenue Soirée, il n'y a que deux slides »), elle occupe la slide de son occasion, déplacée en tête, et non plus celle du travail :
 *     un plan « Soirée » prenait la place de la proposition Travail, puis la proposition Soirée tombait, ses pièces principales étant
 *     celles du plan — deux slides au lieu de trois. Un plan d'une autre occasion (sport, voyage…) garde la première place.
 *   · Les autres slides sont des propositions du moteur, tirées pour leur occasion, qui évitent les tenues déjà montrées.
 *   · Une slide sans tenue valide n'est pas affichée ; deux slides ne montrent jamais la même tenue (garde ci-dessous).
 */

export type SlideId = "travail" | "quotidien" | "sport" | "soiree" | "date" | "voyage" | "cocooning" | "ceremonie";

export const SLIDES: readonly { id: SlideId; occasion: OccasionKey; surtitre: string }[] = [
  { id: "travail", occasion: "travail_formel", surtitre: "Pour le travail" },
  { id: "quotidien", occasion: "quotidien", surtitre: "Pour ton quotidien" },
  { id: "sport", occasion: "sport", surtitre: "Pour ton sport" },
  { id: "soiree", occasion: "soiree", surtitre: "Pour ta soirée" },
  { id: "date", occasion: "date", surtitre: "Pour ton rendez-vous" },
  { id: "voyage", occasion: "voyage", surtitre: "Pour ton voyage" },
  { id: "cocooning", occasion: "cocooning", surtitre: "Pour ton cocooning" },
  { id: "ceremonie", occasion: "evenement_perso", surtitre: "Pour une cérémonie" },
];

export type TypeDeJour = "travail" | "repos" | "conges";

/** Le type du jour, lu sur l'occasion par défaut de « Mon rythme » (occasionParDefaut) : travail, cocooning en congés, sinon repos. */
export function typeDeJour(occasionParDefaut: OccasionKey): TypeDeJour {
  if (occasionParDefaut === "travail_formel") return "travail";
  if (occasionParDefaut === "cocooning") return "conges";
  return "repos";
}

/**
 * L'ORDRE DES SLIDES DU JOUR (17/10/2026, demandé : « pendant les congés et/ou le week-end, le carrousel doit pousser d'autres
 * occasions : quotidien, sport, soirée », puis une slide par occasion, ordre validé le même jour). Les trois premières sont tirées à
 * l'ouverture (NB_SLIDES_INITIALES) ; les suivantes, une à une, quand on arrive sur l'avant-dernière slide (etendreCarrousel, store) :
 * l'ouverture de l'Accueil garde le coût de trois slides. Le travail n'est jamais proposé un jour de repos ou de congés.
 */
export function slidesDuJour(type: TypeDeJour): readonly SlideId[] {
  if (type === "travail") return ["travail", "quotidien", "soiree", "date", "sport", "voyage", "cocooning", "ceremonie"];
  if (type === "conges") return ["quotidien", "cocooning", "sport", "soiree", "date", "voyage", "ceremonie"];
  return ["quotidien", "sport", "soiree", "date", "cocooning", "voyage", "ceremonie"];
}

export const NB_SLIDES_INITIALES = 3;

/** La slide d'une occasion du store ; null pour « all ». */
export function slideDeLOccasion(occasion: OccasionKey | null | undefined): SlideId | null {
  return SLIDES.find((d) => d.occasion === occasion)?.id ?? null;
}

export type SourceSlide = "plan" | "jour" | "proposition";

export interface SlideCarrousel {
  id: SlideId;
  occasion: OccasionKey;
  surtitre: string;
  ids: number[];
  source: SourceSlide;
}

export const cleTenue = (ids: readonly number[]) => [...ids].sort((a, b) => a - b).join(",");

export interface EntreeCarrousel {
  /** La tenue du jour du store, déjà reconnue valide (socle résolu) par l'appelant ; vide sinon. */
  tenueDuJour: number[];
  /** L'occasion de cette tenue. */
  occasion: OccasionKey | null | undefined;
  /** Vrai quand la tenue du jour est la tenue planifiée pour aujourd'hui. */
  planAujourdhui: boolean;
  /** Les propositions du moteur, par slide. */
  propositions: Partial<Record<SlideId, number[]>>;
  /** Le type du jour selon « Mon rythme » (slidesDuJour) ; « travail » par défaut. */
  jour?: TypeDeJour;
}

export function composerSlides({ tenueDuJour, occasion, planAujourdhui, propositions, jour = "travail" }: EntreeCarrousel): SlideCarrousel[] {
  const aLaTenue = tenueDuJour.length > 0;
  const ordre = slidesDuJour(jour);
  const slideDuJour: SlideId | null = !aLaTenue ? null : (slideDeLOccasion(occasion) ?? (planAujourdhui ? ordre[0] : null));
  // Une tenue du jour choisie hors du jeu du jour (le travail un samedi, à la main) garde sa slide : on ne la retire jamais.
  const ids = slideDuJour && !ordre.includes(slideDuJour) ? [slideDuJour, ...ordre] : ordre;
  const defs = ids.map((id) => SLIDES.find((d) => d.id === id)!);
  // La tenue du jour est montrée d'abord : une proposition identique à elle s'efface, jamais l'inverse.
  const vues = new Set<string>(slideDuJour ? [cleTenue(tenueDuJour)] : []);
  const slides: SlideCarrousel[] = [];
  for (const def of defs) {
    const duJour = def.id === slideDuJour;
    const ids = duJour ? tenueDuJour : (propositions[def.id] ?? []);
    if (ids.length === 0) continue;
    if (!duJour) {
      const cle = cleTenue(ids);
      if (vues.has(cle)) continue;
      vues.add(cle);
    }
    slides.push({
      id: def.id,
      // Une tenue planifiée garde l'occasion de son plan ; une proposition, celle de sa slide.
      occasion: duJour && occasion && occasion !== "all" ? occasion : def.occasion,
      surtitre: def.surtitre,
      ids,
      source: duJour ? (planAujourdhui ? "plan" : "jour") : "proposition",
    });
  }
  // Le plan d'aujourd'hui en tête, sinon la tenue du jour ; les autres slides dans leur ordre. La tenue du jour en tête (17/10/2026,
  // signalé : « nous sommes samedi, j'ai indiqué travailler du lundi au vendredi, pourquoi me pousser en premier le travail ? ») :
  // l'ordre fixe mettait le Travail devant même un jour non travaillé. La tenue du jour porte l'occasion de la date (« Mon rythme »,
  // occasionParDefaut) ou celle choisie : c'est elle qui ouvre le carrousel — Quotidien le samedi, Travail en semaine.
  const i = slides.findIndex((x) => x.source !== "proposition");
  if (i > 0) slides.unshift(...slides.splice(i, 1));
  return slides;
}
