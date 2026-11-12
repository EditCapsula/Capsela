import { DUREE_MAX_JOURS, unitesDe } from "./valise";
import type { Item } from "./types";

/*
 * LES QUANTITÉS DE LA VALISE (07/11/2026, brief « Refonte UX de l'écran de synthèse de la valise » : « la quantité doit être modifiable
 * directement depuis la carte, avec un contrôle + / − »). Module pur.
 *
 * Une quantité par pièce (et par indispensable), 1 par défaut : une pièce de la valise compte pour une, comme avant. La personne la
 * change ; ce qu'elle a réglé est gardé avec la valise (calcul jsonb : aucune migration) et compte dans le remplissage. Une quantité
 * revenue à 1 n'est plus écrite. Les règles qui proposeront une quantité initiale (« 1, puis 2 au-delà de 5 jours de baignade ») sont
 * l'étape suivante : elles ne passeront jamais devant un réglage de la personne.
 */

export const QUANTITE_MIN = 1;
/** Jusqu'à un par jour du plus long séjour (12/11/2026 : sans lavage, le linge se compte sur toute la durée, au plus DUREE_MAX_JOURS). */
export const QUANTITE_MAX = DUREE_MAX_JOURS;

export type Quantites = Readonly<Record<string, number>>;

/** La quantité d'une pièce ou d'un indispensable : celle que la personne a réglée, sinon 1. */
export function quantiteDe(quantites: Quantites | undefined, cle: string | number): number {
  const q = quantites?.[String(cle)];
  return typeof q === "number" && Number.isInteger(q) ? Math.min(QUANTITE_MAX, Math.max(QUANTITE_MIN, q)) : QUANTITE_MIN;
}

/** La quantité ajustée de `delta`, bornée ; un retour à 1 efface l'entrée. Undefined quand plus rien n'est réglé. */
export function ajusterQuantite(quantites: Quantites | undefined, cle: string | number, delta: number): Record<string, number> | undefined {
  const suivante = Math.min(QUANTITE_MAX, Math.max(QUANTITE_MIN, quantiteDe(quantites, cle) + delta));
  const out: Record<string, number> = { ...(quantites ?? {}) };
  if (suivante === QUANTITE_MIN) delete out[String(cle)];
  else out[String(cle)] = suivante;
  return Object.keys(out).length ? out : undefined;
}

/**
 * La quantité RÉGLÉE À LA MAIN (12/11/2026, quantités proposées) : la valeur exacte est écrite, 1 compris, car elle passe devant la
 * quantité que Capsela propose (quantitesProposees.ts) — un « 1 » choisi ne doit pas redevenir les 3 t-shirts proposés.
 */
export function reglerQuantite(quantites: Quantites | undefined, cle: string | number, valeur: number): Record<string, number> {
  return { ...(quantites ?? {}), [String(cle)]: Math.min(QUANTITE_MAX, Math.max(QUANTITE_MIN, Math.round(valeur))) };
}

/** Les quantités des seules clés encore présentes (une pièce retirée de la valise n'y garde pas la sienne). */
export function quantitesValides(quantites: Quantites | undefined, cles: readonly (string | number)[]): Record<string, number> | undefined {
  if (!quantites) return undefined;
  const gardees = new Set(cles.map(String));
  const out = Object.fromEntries(Object.entries(quantites).filter(([k]) => gardees.has(k)));
  return Object.keys(out).length ? out : undefined;
}

/** Le volume de la valise, chaque pièce comptée autant de fois que sa quantité : le remplissage suit ce qui est réellement emporté. */
export function volumeAvecQuantites(pieces: readonly Pick<Item, "id" | "cat">[], quantites: Quantites | undefined): number {
  return pieces.reduce((t, p) => t + unitesDe(p.cat) * quantiteDe(quantites, p.id), 0);
}

/** Le nombre de pièces à emporter, quantités comprises. */
export const nombreDePieces = (pieces: readonly Pick<Item, "id">[], quantites: Quantites | undefined): number =>
  pieces.reduce((t, p) => t + quantiteDe(quantites, p.id), 0);

/** « 1 pièce », « 3 pièces ». */
export const libelleQuantite = (n: number): string => `${n} ${n > 1 ? "pièces" : "pièce"}`;
