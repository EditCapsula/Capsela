import { EN } from "./traductions/en";

/*
 * LA LANGUE DE L'APP (05/11/2026, demandé : « l'app entièrement en anglais »). docs/traduction.md.
 *
 * LE FRANÇAIS EST LA CLÉ. Chaque texte reste écrit en français dans le code, passé à `t("…")` ; l'anglais est une table
 * (traductions/en.ts) dont les clés sont ces mêmes textes. Le code se lit toujours en français, et un texte que la table ne connaît
 * pas s'affiche en français plutôt que vide. Un test (langue.test.ts) relève chaque `t("…")`, `tn(…)` et `aTraduire("…")` des
 * sources et vérifie que la table les traduit tous.
 *
 * UNE LANGUE PAR LANCEMENT. Elle est fixée avant le premier rendu (`initialiserLangue`, appelée par App.tsx) ; en changer recharge
 * l'app. `t()` est donc une fonction simple, utilisable aussi dans les fonctions pures de src/lib. Elle ne s'appelle jamais au
 * chargement d'un module (la langue n'y est pas encore fixée) : une constante de module marque ses textes avec `aTraduire("…")`
 * et l'écran les passe à `t()` au rendu.
 *
 * L'ANGLAIS N'EST PROPOSÉ QU'UNE FOIS LA TRADUCTION FINIE : tant que NEXT_PUBLIC_ANGLAIS ne vaut pas « 1 » (Vercel, workflows mobiles),
 * l'app reste en français pour tout le monde, même sur un téléphone réglé en anglais — un écran à moitié traduit serait pire. En
 * mode démo, le choix est ouvert pour la vérification.
 */

export type Langue = "fr" | "en";

const CLE_CHOIX = "capsela.langue";

let courante: Langue = "fr";

/** La langue du lancement en cours. */
export const langue = (): Langue => courante;

/** L'anglais est-il proposé ? (variable de construction, ou mode démo). */
export function anglaisOuvert(): boolean {
  return process.env.NEXT_PUBLIC_ANGLAIS === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * La langue de départ : le choix fait dans les Préférences, sinon celle du téléphone (français s'il est réglé en français, anglais
 * pour toute autre langue). Anglais fermé : français.
 */
export function langueDeDepart(choix: string | null, langues: readonly string[], ouvert: boolean): Langue {
  if (!ouvert) return "fr";
  if (choix === "fr" || choix === "en") return choix;
  const premiere = (langues[0] || "fr").toLowerCase();
  return premiere.startsWith("fr") ? "fr" : "en";
}

function lireChoix(): string | null {
  try {
    return localStorage.getItem(CLE_CHOIX);
  } catch {
    return null;
  }
}

/** Fixe la langue du lancement, avant le premier rendu. */
export function initialiserLangue(): void {
  if (typeof window === "undefined") return;
  courante = langueDeDepart(lireChoix(), navigator.languages?.length ? navigator.languages : [navigator.language], anglaisOuvert());
  document.documentElement.lang = courante;
}

/** Le choix des Préférences : gardé sur l'appareil, puis l'app se recharge dans cette langue. */
export function choisirLangue(l: Langue): void {
  try {
    localStorage.setItem(CLE_CHOIX, l);
  } catch {
    // Stockage refusé : la langue vaut pour ce lancement seulement.
  }
  window.location.reload();
}

/** Pour les tests : fixe la langue sans navigateur. */
export function poserLangue(l: Langue): void {
  courante = l;
}

const manquants = new Set<string>();

function remplir(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Le texte dans la langue du lancement. `{nom}` est remplacé par `vars.nom`. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  if (courante === "fr") return remplir(fr, vars);
  const en = EN[fr];
  if (en === undefined && process.env.NODE_ENV !== "production" && !manquants.has(fr)) {
    manquants.add(fr);
    console.warn("[langue] sans traduction anglaise :", fr);
  }
  return remplir(en ?? fr, vars);
}

/**
 * Un texte qui dépend d'un nombre : `tn(n, "{n} pièce", "{n} pièces")`. Chaque langue a sa règle — en français 0 et 1 prennent
 * le singulier, en anglais 1 seulement.
 */
export function tn(n: number, un: string, plusieurs: string, vars?: Record<string, string | number>): string {
  const singulier = courante === "fr" ? Math.abs(n) < 2 : Math.abs(n) === 1;
  return t(singulier ? un : plusieurs, { n, ...vars });
}

/** Marque un texte d'une constante de module, traduit plus tard par `t()` au rendu. Rend le texte tel quel. */
export const aTraduire = (fr: string): string => fr;

/**
 * LE NOM AFFICHÉ D'UNE PIÈCE (06/11/2026, lot « Catalogue » de docs/traduction.md). En anglais, le nom anglais du catalogue quand il
 * existe (`nameEn`, colonne name_en) ; sinon, et toujours en français, le nom tel qu'il est. Une pièce du dressing garde le nom que la
 * personne lui a donné. Pour l'AFFICHAGE seulement : le moteur et ses accords lisent `name`.
 */
export function nomAffiche(piece: { name: string; nameEn?: string }): string {
  return courante === "en" && piece.nameEn ? piece.nameEn : piece.name;
}
