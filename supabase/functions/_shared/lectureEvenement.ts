// La lecture du nom d'un événement de valise (22/10/2026, demandé : « lance la lecture IA »).
//
// Le moteur de tenues ne lit pas de texte libre : un événement de type « Autre » nommé « gala de charité » ou « brunch entre amies »
// recevait l'occasion Quotidien, quel que soit son nom. Cette lecture traduit le NOM en l'une des occasions que le moteur connaît, et
// rien d'autre : elle ne compose aucune tenue, ne choisit aucune pièce. Une réponse hors de la liste, ou un doute, donne null : l'app
// garde alors l'occasion du type choisi.
//
// Module pur (aucun accès à Deno) : testé côté app (src/lib/__tests__/lectureEvenement.test.ts).

/** Les occasions qu'un événement peut prendre — celles du moteur, sans Voyage (un trajet n'est pas un événement). */
export const OCCASIONS_EVENEMENT = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "evenement_perso"] as const;
export type OccasionEvenement = (typeof OCCASIONS_EVENEMENT)[number];

export const NOM_MAX = 40;

/** Le nom tel qu'il part vers le modèle : sans saut de ligne ni guillemet, borné. Vide : rien à lire. */
export function nomPropre(brut: unknown): string {
  return String(brut ?? "")
    .replace(/[\r\n"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOM_MAX);
}

export function invite(nom: string): string {
  return [
    "Tu aides une application de garde-robe à habiller une personne pour un événement prévu pendant un voyage.",
    `Voici le nom que la personne a donné à l'événement : "${nom}".`,
    "Choisis l'occasion vestimentaire qui lui correspond le mieux, EXACTEMENT parmi :",
    "quotidien (journée simple, décontractée : brunch, pique-nique, marché, visite entre amis),",
    "travail_formel (contexte professionnel : réunion, conférence, salon, rendez-vous client, entretien),",
    "date (rendez-vous amoureux, dîner en tête-à-tête),",
    "soiree (sortie du soir : dîner entre amis, bar, concert, anniversaire, fête),",
    "sport (activité physique : randonnée, yoga, course, ski),",
    "cocooning (détente au calme : spa, journée à l'hôtel),",
    "evenement_perso (événement habillé : mariage, baptême, cérémonie, gala, remise de diplôme, communion).",
    'Réponds en JSON : {"occasion": "<une des clés>"} ; si le nom ne permet pas de choisir avec une confiance raisonnable, {"occasion": null}.',
    "N'invente rien d'autre : pas de tenue, pas de vêtement, pas de commentaire.",
  ].join("\n");
}

/** La réponse du modèle, réduite à une occasion de la liste, ou null. */
export function occasionLue(reponse: unknown): OccasionEvenement | null {
  const o = (reponse as { occasion?: unknown } | null)?.occasion;
  return typeof o === "string" && (OCCASIONS_EVENEMENT as readonly string[]).includes(o) ? (o as OccasionEvenement) : null;
}
