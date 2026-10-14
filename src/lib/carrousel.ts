import type { OccasionKey } from "./types";

/*
 * LE CARROUSEL DE L'ACCUEIL (14/10/2026) — trois propositions par occasion à la place d'une tenue unique : pour le travail, pour
 * le quotidien, pour la soirée, dans cet ordre fixe. Module pur ; le tirage des tenues reste celui du moteur (regen, store.tsx).
 *
 *   · La tenue du jour du store (state.outfit — celle qui porte l'avis, le quota, le plan appliqué) occupe la slide de SON occasion
 *     quand elle en a une. Une tenue planifiée pour aujourd'hui prend la PREMIÈRE slide, quelle que soit son occasion.
 *   · Les autres slides sont des propositions du moteur, tirées pour leur occasion, qui évitent les tenues déjà montrées.
 *   · Une slide sans tenue valide n'est pas affichée ; deux slides ne montrent jamais la même tenue (garde ci-dessous).
 */

export type SlideId = "travail" | "quotidien" | "soiree";

export const SLIDES: readonly { id: SlideId; occasion: OccasionKey; surtitre: string }[] = [
  { id: "travail", occasion: "travail_formel", surtitre: "Pour le travail" },
  { id: "quotidien", occasion: "quotidien", surtitre: "Pour ton quotidien" },
  { id: "soiree", occasion: "soiree", surtitre: "Pour ta soirée" },
];

/** La slide d'une occasion du store (« date » est une sortie du soir, comme la soirée) ; null pour sport, cocooning, voyage… */
export function slideDeLOccasion(occasion: OccasionKey | null | undefined): SlideId | null {
  if (occasion === "travail_formel") return "travail";
  if (occasion === "quotidien") return "quotidien";
  if (occasion === "soiree" || occasion === "date") return "soiree";
  return null;
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
}

export function composerSlides({ tenueDuJour, occasion, planAujourdhui, propositions }: EntreeCarrousel): SlideCarrousel[] {
  const aLaTenue = tenueDuJour.length > 0;
  const slideDuJour: SlideId | null = !aLaTenue ? null : planAujourdhui ? "travail" : slideDeLOccasion(occasion);
  // La tenue du jour est montrée d'abord : une proposition identique à elle s'efface, jamais l'inverse.
  const vues = new Set<string>(slideDuJour ? [cleTenue(tenueDuJour)] : []);
  const slides: SlideCarrousel[] = [];
  for (const def of SLIDES) {
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
  return slides;
}
