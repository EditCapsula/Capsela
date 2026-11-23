// La lecture du nom d'un événement de valise (22/10/2026, demandé : « lance la lecture IA ») — et, depuis le 22/11/2026, de l'occasion
// saisie librement dans Planifier (src/lib/occasionSaisie.ts, quand la lecture par mots-clés ne reconnaît rien).
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
    "Tu aides une application de garde-robe à habiller une personne pour un événement qu'elle prévoit (pendant un voyage, ou dans son agenda).",
    `Voici le nom que la personne a donné à l'événement : "${nom}".`,
    "Choisis l'occasion vestimentaire qui lui correspond le mieux, EXACTEMENT parmi :",
    "quotidien (journée simple, décontractée : brunch, pique-nique, marché, visite entre amis),",
    "travail_formel (contexte professionnel : réunion, conférence, salon, rendez-vous client, entretien),",
    "date (rendez-vous amoureux, dîner en tête-à-tête),",
    "soiree (sortie du soir : dîner entre amis, bar, concert, anniversaire, fête),",
    "sport (activité physique : randonnée, yoga, course, ski),",
    "cocooning (détente au calme : spa, journée à l'hôtel),",
    "evenement_perso (événement habillé : mariage, baptême, cérémonie, gala, remise de diplôme, communion).",
    'Réponds en JSON : {"occasion": "<une des clés>", "suggestions": ["<clé>", ...], "humeur": "<clé d\'humeur>"}.',
    '"occasion" : la clé si le nom permet de choisir avec une confiance raisonnable, sinon null.',
    '"suggestions" : de 1 à 3 clés de la liste, de la plus probable à la moins probable, MÊME si tu as répondu null — ce sont des pistes que la personne choisira elle-même (ex. « signature chez le notaire » : ["travail_formel", "quotidien"]). Liste vide seulement si le nom ne décrit aucune occasion.',
    '"humeur" : seulement si le nom dit le niveau d\'habillement ou l\'allure voulue, ou un CADRE qui la donne, la clé parmi : elegant (chic, habillé, dress code, gala), feminin (glamour), decontracte (décontracté, casual, simple ; cadre champêtre, campagne, jardin, guinguette), confortable (confort, beaucoup de marche), leger (chaleur, tenue légère ; plage, bord de mer) ; sinon null. L\'allure dite l\'emporte sur le cadre (« mariage chic à la campagne » : elegant). Ne la déduis jamais de l\'occasion seule (« mariage » : null).',
    "N'invente rien d'autre : pas de tenue, pas de vêtement, pas de commentaire.",
  ].join("\n");
}

/** La réponse du modèle, réduite à une occasion de la liste, ou null. */
export function occasionLue(reponse: unknown): OccasionEvenement | null {
  const o = (reponse as { occasion?: unknown } | null)?.occasion;
  return typeof o === "string" && (OCCASIONS_EVENEMENT as readonly string[]).includes(o) ? (o as OccasionEvenement) : null;
}

/**
 * LES PISTES (22/11/2026, demandé : « que le moteur fasse des recommandations d'occasions selon ce qui est saisi ») : jusqu'à trois
 * occasions de la liste, sans doublon, dans l'ordre du modèle. Ce ne sont que des propositions : l'écran les montre, la personne choisit.
 */
export function suggestionsLues(reponse: unknown): OccasionEvenement[] {
  const brut = (reponse as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(brut)) return [];
  const out: OccasionEvenement[] = [];
  for (const x of brut) {
    if (typeof x === "string" && (OCCASIONS_EVENEMENT as readonly string[]).includes(x) && !out.includes(x as OccasionEvenement)) out.push(x as OccasionEvenement);
    if (out.length === 3) break;
  }
  return out;
}

/** La nuance que le nom dit (22/11/2026, Planifier) : une clé de préférence connue, ou null. « audacieux » n'est plus proposé. */
export const HUMEURS_LISIBLES = ["elegant", "feminin", "decontracte", "confortable", "leger"] as const;
export function humeurLue(reponse: unknown): (typeof HUMEURS_LISIBLES)[number] | null {
  const h = (reponse as { humeur?: unknown } | null)?.humeur;
  return typeof h === "string" && (HUMEURS_LISIBLES as readonly string[]).includes(h) ? (h as (typeof HUMEURS_LISIBLES)[number]) : null;
}
