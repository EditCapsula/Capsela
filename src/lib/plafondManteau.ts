import type { CategoryKey, Item } from "./types";

/**
 * LE PLAFOND D'UN MANTEAU DU DRESSING, PAR SON SOUS-TYPE (19/11/2026, demandé : « si un utilisateur ajoute un manteau lui-même, le
 * sous-type de manteau permet d'appliquer la même règle que dans le moteur »).
 *
 * Au catalogue, chaque manteau porte son plafond de température (meteo_max_temp, vestiaire_universel) ; le moteur s'en sert pour l'admettre
 * ou non, et « Pour l'extérieur » pour retenir le plus chaud à la minimale du jour (coucheExterieure.ts). Un manteau du dressing n'avait
 * aucune borne : il passait partout, et par 2° un trench ajouté valait une doudoune. Il reçoit ici le plafond de son sous-type (SUBTYPES,
 * data.ts) — en mémoire seulement, jamais écrit en base (itemToRow ne le connaît pas). Sans sous-type, aucun plafond : rien n'est supposé.
 *
 * Valeurs : Trench 20° et Manteau 12° reprennent le catalogue (« trench 20°, manteau droit en laine 12° », logic.ts). Imperméable, Caban,
 * Parka et Doudoune sont un ARBITRAGE ÉDITORIAL à confronter aux plafonds du catalogue par sous-type (requête de contrôle dans le message
 * du 19/11/2026) : l'imperméable comme le trench, le caban comme le manteau de laine, la parka et la doudoune plus bas.
 */
export const PLAFOND_PAR_SOUS_TYPE: Record<string, number> = {
  Trench: 20,
  Imperméable: 20,
  // Coupe-vent, 20° (21/11/2026, arbitré par la propriétaire : plafond 20, plancher 12) — comme le trench.
  "Coupe-vent": 20,
  Manteau: 12,
  Caban: 12,
  Parka: 8,
  Doudoune: 5,
};

/**
 * Le sous-type d'un manteau pour ses bornes : celui déclaré ; sans lui, « Coupe-vent » quand le NOM le dit (coupe-vent, k-way —
 * 21/11/2026 : le sous-type n'existait pas au formulaire, les coupe-vent déjà ajoutés n'en ont pas). Rien d'autre n'est déduit du nom.
 */
export function sousTypeManteau(subtype: string | null | undefined, name?: string | null): string | undefined {
  if (subtype?.trim()) return subtype.trim();
  return name && /coupe[- ]?vent|k-?way/i.test(name) ? "Coupe-vent" : undefined;
}

/** Le plafond de température d'un manteau d'après son sous-type (ou son nom, sousTypeManteau), ou undefined (autre catégorie, inconnu). */
export function plafondDuSousType(cat: CategoryKey, subtype: string | null | undefined, name?: string | null): number | undefined {
  if (cat !== "manteau") return undefined;
  const st = sousTypeManteau(subtype, name);
  return st ? PLAFOND_PAR_SOUS_TYPE[st] : undefined;
}

/**
 * LE PLANCHER D'UN MANTEAU LÉGER (19/11/2026, demandé : « si le dressing ne contient qu'un trench il faudrait le dire : dans ton dressing,
 * il n'y a qu'un trench. Il te faut un manteau plus chaud »). Un manteau n'a qu'un PLAFOND au catalogue ; pour dire qu'il est trop léger, il
 * lui faut une température en dessous de laquelle il ne suffit plus. Seuls les deux sous-types légers en ont une :
 *   · Trench, 10° (19/11/2026, aligné sur le guide fourni par la propriétaire : « trench classique en coton : 10 à 20 °C », « 5 à 9 °C :
 *     limite », « moins de 5 °C : trop froid, privilégier un manteau chaud ») — 8° le même jour avant ce guide ; le plafond de 20° y est déjà.
 *     Le guide distingue trench doublé (7-16 °C) et trench léger (15-23 °C) : aucune donnée ne les distingue ici, la valeur est celle du
 *     trench classique ;
 *   · Imperméable, 8° — ARBITRAGE ÉDITORIAL à valider (le guide ne porte que sur le trench) ;
 *   · Coupe-vent, 12° (21/11/2026, arbitré par la propriétaire).
 * Les autres sous-types et un manteau sans sous-type n'en ont pas : rien ne dit qu'ils sont légers.
 *
 * Jamais écrit sur la pièce. Il sert à « Pour l'extérieur » (coucheExterieure.ts) et, depuis le 21/11/2026, au choix du manteau par
 * le froid dans le moteur (manteauxParChaleur, logic.ts) : un manteau trop léger n'y est retenu que faute d'autre.
 */
export const PLANCHER_PAR_SOUS_TYPE: Record<string, number> = {
  Trench: 10,
  Imperméable: 8,
  "Coupe-vent": 12,
};

/** La température en dessous de laquelle un manteau est trop léger : sa borne déclarée, sinon celle de son sous-type, sinon undefined. */
export function plancherManteau(m: Pick<Item, "cat" | "subtype" | "meteoMinTemp"> & { name?: string }): number | undefined {
  if (m.cat !== "manteau") return undefined;
  if (m.meteoMinTemp != null) return m.meteoMinTemp;
  const st = sousTypeManteau(m.subtype, m.name);
  return st ? PLANCHER_PAR_SOUS_TYPE[st] : undefined;
}

/** Vrai quand ce manteau est trop léger pour `temperature` (plancher connu et non atteint). */
export function manteauTropLeger(m: Pick<Item, "cat" | "subtype" | "meteoMinTemp"> & { name?: string }, temperature: number): boolean {
  const p = plancherManteau(m);
  return p != null && temperature < p;
}

const ARTICLE: Record<string, string> = { Trench: "un trench", Imperméable: "un imperméable", "Coupe-vent": "un coupe-vent" };

/**
 * « Dans ton dressing, il n'y a qu'un trench. Il te faut un manteau plus chaud pour aujourd'hui. » — quand le dressing a des manteaux et
 * qu'ils sont TOUS trop légers pour la température de la couche ; sinon null (pas de manteau du tout : rien à dire de plus qu'avant).
 */
export function phraseManteauTropLeger(dressing: readonly Item[], temperature: number | null | undefined, moment: "aujourd'hui" | "cette journée" | "cette soirée"): string | null {
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) return null;
  const manteaux = dressing.filter((i) => i.cat === "manteau");
  if (!manteaux.length || !manteaux.every((m) => manteauTropLeger(m, temperature))) return null;
  const types = new Set(manteaux.map((m) => sousTypeManteau(m.subtype, m.name) ?? ""));
  const debut =
    manteaux.length === 1 && ARTICLE[[...types][0]]
      ? `Dans ton dressing, il n'y a qu'${ARTICLE[[...types][0]]}.`
      : "Dans ton dressing, il n'y a que des manteaux légers.";
  return `${debut} Il te faut un manteau plus chaud pour ${moment}.`;
}

/** Le moment que dit la phrase : la soirée (occasion Soirée ou créneau du soir), sinon aujourd'hui, sinon « cette journée » (un autre jour). */
export function momentDeLaCouche(a: { decalage: number; occasion?: string | null; moment?: string | null }): "aujourd'hui" | "cette journée" | "cette soirée" {
  if (a.moment === "Soirée" || a.occasion === "soiree") return "cette soirée";
  return a.decalage === 0 ? "aujourd'hui" : "cette journée";
}

/** Le plafond de température d'un manteau, ou +∞ s'il n'en a pas. */
const plafond = (m: Item): number => m.meteoMaxTemp ?? Number.POSITIVE_INFINITY;

/**
 * Les manteaux admis à `temperature`, du plus chaud (plafond le plus bas) au plus léger ; ordre d'origine à plafond égal. Un manteau TROP
 * LÉGER pour cette température (plancher, ci-dessus — 19/11/2026) passe en dernier : il n'est retenu que faute d'autre. Partagé par
 * « Pour l'extérieur » (coucheExterieure.ts) et le moteur (logic.ts, LE MANTEAU PAR LE FROID) depuis le 21/11/2026 : la tenue et la
 * couche extérieure choisissent le même manteau.
 */
export function manteauxParChaleur(candidats: Item[], temperature: number): Item[] {
  return candidats
    .map((c, i) => ({ c, i, leger: manteauTropLeger(c, temperature) ? 1 : 0 }))
    .filter(({ c }) => (c.meteoMaxTemp == null || temperature <= c.meteoMaxTemp) && (c.meteoMinTemp == null || temperature >= c.meteoMinTemp))
    .sort((a, b) => a.leger - b.leger || plafond(a.c) - plafond(b.c) || a.i - b.i)
    .map(({ c }) => c);
}
