// Les idées d'activités pour une destination (30/10/2026, brief « Refonte UX de l'étape Activités »).
//
// Servies par la fonction `lire-evenement`, qui lisait déjà un nom d'événement : même protection, même clé, même modèle — aucune
// infrastructure nouvelle. Seul le NOM de la destination part chez OpenAI. Chaque idée est réduite à un libellé court, une famille
// (pour les filtres de l'écran) et l'une des activités que le moteur de tenues connaît déjà : la lecture ne compose aucune tenue.
// Toute idée hors des listes fermées est écartée ; une réponse inutilisable donne une liste vide, et l'app propose ses idées de repli.
//
// Module pur (aucun accès à Deno) : testé côté app (src/lib/__tests__/ideesSejour.test.ts).

export const CATEGORIES = ["culture", "detente", "nature", "gastronomie", "sorties", "travail"] as const;
/** Miroir de ActiviteSejour (src/lib/programmeValise.ts) — un test le verrouille. */
export const ACTIVITES = ["plage", "ville", "nature", "randonnee", "detente", "soiree", "travail", "sport", "evenement"] as const;

export const DESTINATION_MAX = 80;
export const IDEES_MAX = 16;
const LIBELLE_MAX = 60;

export interface IdeeLue {
  libelle: string;
  categorie: (typeof CATEGORIES)[number];
  activite: (typeof ACTIVITES)[number];
}

/** La destination telle qu'elle part vers le modèle : une ligne, sans guillemet, bornée. Vide : rien à lire. */
export function destinationPropre(brut: unknown): string {
  return String(brut ?? "")
    .replace(/[\r\n"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DESTINATION_MAX);
}

export function inviteIdees(destination: string): string {
  return [
    "Tu aides une application de garde-robe à préparer la valise d'une personne qui part en voyage.",
    `Destination : "${destination}".`,
    "Propose entre 10 et 14 idées d'activités variées pour ce séjour : culture, détente, nature, gastronomie, sorties, et une idée de travail seulement si la destination s'y prête.",
    "Règles :",
    "- un libellé court en français, à l'infinitif, sans point final (ex. « Explorer les souks », « Dîner sur un rooftop ») ;",
    "- ne cite un lieu précis que s'il est très connu et existe réellement à cette destination ; dans le doute, reste général (« Visiter un musée ») ;",
    "- jamais deux idées qui disent la même chose ;",
    "- si la destination est inconnue ou trop vague, propose des idées générales de voyage.",
    "Pour chaque idée, donne sa famille, EXACTEMENT parmi : culture, detente, nature, gastronomie, sorties, travail ;",
    "et l'activité vestimentaire la plus proche, EXACTEMENT parmi :",
    "plage (plage, piscine, baignade), ville (visites, musées, marchés, shopping, restaurants du midi), nature (balade, excursion, bateau, désert, jardins),",
    "randonnee (randonnée, trek), detente (spa, hammam, massage, journée calme), soiree (dîner, bar, spectacle, sortie du soir),",
    "travail (réunion, conférence), sport (activité sportive), evenement (mariage, cérémonie).",
    'Réponds en JSON : {"idees": [{"libelle": "...", "categorie": "...", "activite": "..."}]}. N\'invente rien d\'autre : pas de tenue, pas de commentaire.',
  ].join("\n");
}

/** La réponse du modèle, réduite aux idées valides, sans doublon, bornée. */
export function ideesLues(reponse: unknown): IdeeLue[] {
  const brutes = (reponse as { idees?: unknown } | null)?.idees;
  if (!Array.isArray(brutes)) return [];
  const vues = new Set<string>();
  const out: IdeeLue[] = [];
  for (const b of brutes) {
    const r = b as { libelle?: unknown; categorie?: unknown; activite?: unknown } | null;
    const libelle = String(r?.libelle ?? "").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
    const categorie = r?.categorie;
    const activite = r?.activite;
    if (!libelle || libelle.length > LIBELLE_MAX) continue;
    if (typeof categorie !== "string" || !(CATEGORIES as readonly string[]).includes(categorie)) continue;
    if (typeof activite !== "string" || !(ACTIVITES as readonly string[]).includes(activite)) continue;
    const cle = libelle.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    out.push({ libelle, categorie: categorie as IdeeLue["categorie"], activite: activite as IdeeLue["activite"] });
    if (out.length >= IDEES_MAX) break;
  }
  return out;
}
