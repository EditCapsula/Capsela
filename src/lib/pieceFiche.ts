import { OCC_LABELS } from "./data";
import type { CapsuleSeason, Item, OccasionKey } from "./types";
import { isCoupeApplicable, isSizeApplicable } from "./attributes";
import { ordonnerSaisons, QUATRE_SAISONS } from "./saisons";

/*
 * LA FICHE D'UNE PIÈCE, « EN VITRINE » (10/10/2026, maquette « Fiche d'une pièce », piste 1B retenue) — les dérivés d'affichage,
 * purs et testés. Aucune phrase n'affirme autre chose que ce que la pièce porte : saisons et occasions enregistrées, rien d'inventé.
 */

const EN_SAISON: Record<CapsuleSeason, string> = { Printemps: "au printemps", Été: "en été", Automne: "en automne", Hiver: "en hiver" };

/** « Au printemps et en automne », « Toute l'année ». */
export function phraseSaisons(saisons: readonly CapsuleSeason[]): string {
  const liste = ordonnerSaisons(saisons);
  if (liste.length === 0 || liste.length === QUATRE_SAISONS.length) return "Toute l'année";
  const mots = liste.map((s) => EN_SAISON[s]);
  const phrase = mots.length === 1 ? mots[0] : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** « Au printemps et en automne — quotidien / décontracté, week-end. » Sans occasion enregistrée : les saisons seules. */
export function phraseQuandPorter(saisons: readonly CapsuleSeason[], occasions: readonly OccasionKey[] | undefined): string {
  const quand = phraseSaisons(saisons);
  const occ = (occasions ?? []).filter((o) => o !== "all" && OCC_LABELS[o]).map((o) => minuscule(OCC_LABELS[o]));
  return occ.length ? `${quand} — ${occ.join(", ")}.` : `${quand}.`;
}

/**
 * Le titre en deux temps (second temps en italique terracotta, design system) : « Veste en daim » → « Veste » + « en daim ».
 * Un nom d'un seul mot reste entier.
 */
export function titreEnDeuxTemps(nom: string): { debut: string; fin: string } {
  const mots = nom.trim().split(/\s+/);
  if (mots.length < 2) return { debut: nom.trim(), fin: "" };
  const coupe = mots.length >= 3 ? 1 : mots.length - 1;
  return { debut: mots.slice(0, coupe).join(" "), fin: mots.slice(coupe).join(" ") };
}

/** Ce qui manque à la fiche et que la personne peut renseigner (matière, coupe et taille quand elles s'appliquent). */
export function champsManquants(p: Pick<Item, "cat" | "matiere" | "coupe" | "size">): string[] {
  const m: string[] = [];
  if (!p.matiere) m.push("matière");
  if (isCoupeApplicable(p.cat) && !p.coupe) m.push("coupe");
  if (isSizeApplicable(p.cat) && !p.size) m.push(p.cat === "chaussures" ? "pointure" : "taille");
  return m;
}
