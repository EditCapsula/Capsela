import { ACTIVITES, type ActiviteSejour } from "./programmeValise";
import type { OccasionKey } from "./types";

/*
 * LES ACTIVITÉS DU SÉJOUR, EN UNE SEULE SÉLECTION (30/10/2026, brief « Refonte UX de l'étape Activités »). Module pur.
 *
 * L'étape 3 distinguait des activités (plage, ville…) et des événements datés (dîner, mariage…, avec jour, moment et nom). Elle n'a plus
 * qu'une liste : des IDÉES proposées selon la destination, et ce que la personne écrit elle-même. Chaque choix garde son LIBELLÉ tel
 * qu'il a été proposé ou saisi, et porte une correspondance vers l'une des activités que le moteur connaît déjà (ActiviteSejour). C'est
 * cette correspondance, et elle seule, qui part vers le programme (programmeDesActivites) : le moteur, les parts du séjour et le planning
 * ne changent pas. Un libellé qu'aucune activité ne décrit garde `activite: null` : il est affiché et gardé, sans rien changer aux tenues
 * (le séjour retombe alors sur le quotidien, comme sans activité).
 */

/** Les familles d'idées, pour les filtres de l'écran : elles organisent les suggestions, elles ne disent rien au moteur. */
export type CategorieIdee = "culture" | "detente" | "nature" | "gastronomie" | "sorties" | "travail";

export const CATEGORIES_IDEES: { id: CategorieIdee; libelle: string }[] = [
  { id: "culture", libelle: "Culture" },
  { id: "detente", libelle: "Détente" },
  { id: "nature", libelle: "Nature" },
  { id: "gastronomie", libelle: "Gastronomie" },
  { id: "sorties", libelle: "Sorties" },
  { id: "travail", libelle: "Travail" },
];

/** Une idée proposée : son libellé, sa famille, l'activité du moteur qu'elle évoque. */
export interface IdeeSejour {
  libelle: string;
  categorie: CategorieIdee;
  activite: ActiviteSejour;
}

/** Un choix de la personne : une idée retenue ou un libellé saisi. Le libellé n'est jamais réécrit. */
export interface ActiviteChoisie {
  libelle: string;
  /** L'activité du moteur à laquelle il correspond ; null quand aucune ne le décrit (il ne change alors rien aux tenues). */
  activite: ActiviteSejour | null;
  source: "idee" | "perso";
}

export const LIBELLE_MAX = 60;

/**
 * LES IDÉES DE REPLI : quand la destination ne donne pas d'idées (mode démo, hors ligne, lecture impossible ou destination trop vague),
 * les activités que l'étape proposait déjà, sous une forme d'idée. Rien n'y est propre à un lieu : aucune n'affirme ce qu'on trouve sur
 * place. ARBITRAGE ÉDITORIAL du 30/10/2026 pour les libellés.
 */
export const IDEES_GENERIQUES: IdeeSejour[] = [
  { libelle: "Visiter la ville", categorie: "culture", activite: "ville" },
  { libelle: "Profiter de la plage", categorie: "detente", activite: "plage" },
  { libelle: "Se balader dans la nature", categorie: "nature", activite: "nature" },
  { libelle: "Faire une randonnée", categorie: "nature", activite: "randonnee" },
  { libelle: "Un moment de détente", categorie: "detente", activite: "detente" },
  { libelle: "Dîner au restaurant", categorie: "gastronomie", activite: "soiree" },
  { libelle: "Sortir le soir", categorie: "sorties", activite: "soiree" },
  { libelle: "Faire du sport", categorie: "detente", activite: "sport" },
  { libelle: "Travailler", categorie: "travail", activite: "travail" },
  { libelle: "Un mariage ou une cérémonie", categorie: "sorties", activite: "evenement" },
];

/** L'idée de repli qui dit chaque activité d'avant le 30/10/2026, pour reprendre une ancienne valise (choixDeLaValise). */
const LIBELLE_DE_REPRISE: Partial<Record<ActiviteSejour, string>> = {
  ville: "Visiter la ville",
  plage: "Profiter de la plage",
  nature: "Se balader dans la nature",
  randonnee: "Faire une randonnée",
  detente: "Un moment de détente",
  soiree: "Sortir le soir",
  sport: "Faire du sport",
  travail: "Travailler",
  evenement: "Un mariage ou une cérémonie",
};

/** La forme d'un libellé pour reconnaître un doublon : sans casse, sans accent, sans ponctuation ni article de tête. */
export function cleLibelle(libelle: string): string {
  return libelle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(un|une|le|la|les|l|des|du|faire|aller)\s+/, "");
}

/** Le libellé tel qu'il est gardé : une ligne, sans espaces superflus, borné, sans point final. */
export function libellePropre(brut: string): string {
  return brut.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").slice(0, LIBELLE_MAX);
}

/**
 * LA CORRESPONDANCE D'UN LIBELLÉ SAISI (30/10/2026) : des mots qui disent sans ambiguïté l'une des activités du moteur. L'ordre compte —
 * un « dîner de mariage » est d'abord un mariage. Rien ne correspond : null, et la lecture IA du nom (lectureEvenement.ts) peut prendre le
 * relais. ARBITRAGE ÉDITORIAL : la sortie en bateau, en quad ou dans le désert sont des sorties en plein air (Nature) ; la gastronomie et
 * les marchés, des découvertes de la ville (Ville, qui porte les restaurants du midi).
 */
const MOTS: [RegExp, ActiviteSejour][] = [
  [/\b(mariage|ceremonie|bapteme|communion|gala|fiancailles|remise de diplome)/, "evenement"],
  [/\b(reunion|travail|seminaire|conference|salon|client|rendez vous pro|bureau|formation|congres)/, "travail"],
  [/\b(randonnee|rando|trek|trekking|ascension|via ferrata)/, "randonnee"],
  [/\b(plage|piscine|baignade|snorkeling|plongee|bronzer|transat|mer\b)/, "plage"],
  [/\b(spa|hammam|massage|thermes|sauna|detente|repos|farniente|yoga)/, "detente"],
  [/\b(sport|ski|surf|velo|course|footing|running|golf|tennis|escalade|kayak|paddle|fitness|salle de sport)/, "sport"],
  [/\b(diner|soiree|bar|club|concert|spectacle|anniversaire|cocktail|rooftop|fete|cabaret|opera|theatre|restaurant)/, "soiree"],
  [/\b(bateau|quad|desert|excursion|nature|foret|lac|montagne|parc|jardin|balade|promenade|safari|cascade|campagne|chameau)/, "nature"],
  [/\b(visite|visiter|musee|monument|medina|souk|marche|shopping|ville|quartier|galerie|exposition|eglise|cathedrale|chateau|village|gastronomie|degustation|brunch)/, "ville"],
];

export function activiteDuLibelle(libelle: string): ActiviteSejour | null {
  const cle = ` ${cleLibelle(libelle)} `;
  return MOTS.find(([re]) => re.test(cle))?.[1] ?? null;
}

/** L'occasion lue par l'IA dans un libellé (lectureEvenement.ts), traduite en activité du moteur. Quotidien ne dit rien : null. */
export function activiteDeLOccasion(occasion: OccasionKey | null): ActiviteSejour | null {
  switch (occasion) {
    case "evenement_perso":
      return "evenement";
    case "travail_formel":
      return "travail";
    case "soiree":
    case "date":
      return "soiree";
    case "sport":
      return "sport";
    case "cocooning":
      return "detente";
    default:
      return null;
  }
}

/** Les activités du moteur que les choix donnent, sans doublon, dans l'ordre des choix : ce que reçoit programmeDesActivites. */
export function activitesDesChoix(choix: readonly ActiviteChoisie[]): ActiviteSejour[] {
  const out: ActiviteSejour[] = [];
  for (const c of choix) if (c.activite && !out.includes(c.activite)) out.push(c.activite);
  return out;
}

/** Vrai si le libellé est déjà choisi (même idée, autrement écrite). */
export const dejaChoisi = (choix: readonly ActiviteChoisie[], libelle: string): boolean => {
  const cle = cleLibelle(libelle);
  return cle.length > 0 && choix.some((c) => cleLibelle(c.libelle) === cle);
};

/** Ajouter un libellé saisi : rien s'il est vide ou déjà choisi. Sa correspondance vient des mots (activiteDuLibelle). */
export function ajouterLibelle(choix: readonly ActiviteChoisie[], brut: string): ActiviteChoisie[] {
  const libelle = libellePropre(brut);
  if (!cleLibelle(libelle) || dejaChoisi(choix, libelle)) return [...choix];
  return [...choix, { libelle, activite: activiteDuLibelle(libelle), source: "perso" }];
}

/** Ajouter ou retirer une idée proposée. */
export function basculerIdee(choix: readonly ActiviteChoisie[], idee: IdeeSejour): ActiviteChoisie[] {
  const cle = cleLibelle(idee.libelle);
  if (choix.some((c) => cleLibelle(c.libelle) === cle)) return choix.filter((c) => cleLibelle(c.libelle) !== cle);
  return [...choix, { libelle: libellePropre(idee.libelle), activite: idee.activite, source: "idee" }];
}

/**
 * LA REPRISE D'UNE VALISE GARDÉE : ses choix s'ils ont été gardés ; sinon (valise d'avant le 30/10/2026) les activités cochées alors, sous
 * leur libellé d'activité. Les événements datés d'une ancienne valise restent ce qu'ils sont (gardés à part, avec leur jour).
 */
export function choixDeLaValise(choix: readonly ActiviteChoisie[] | undefined, activites: readonly ActiviteSejour[]): ActiviteChoisie[] {
  if (choix?.length) return choix.map((c) => ({ ...c }));
  // Sous le libellé de l'idée de repli qui la dit (« Visiter la ville » pour Ville) : l'idée apparaît alors cochée, jamais en double.
  return ACTIVITES.filter((a) => activites.includes(a.id)).map((a) => ({
    libelle: LIBELLE_DE_REPRISE[a.id] ?? a.libelle,
    activite: a.id,
    source: "idee" as const,
  }));
}

/** Les idées affichées : sans doublon de libellé. */
export function ideesUniques(idees: readonly IdeeSejour[]): IdeeSejour[] {
  const vues = new Set<string>();
  return idees.filter((i) => {
    const cle = cleLibelle(i.libelle);
    if (!cle || vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

// ── Le titre : « Qu'as-tu prévu à Marrakech ? », « au Sénégal ? », « en Italie ? » ─────────────────────────────

/**
 * La préposition des pays et régions les plus courants. Un nom absent de la table est lu comme une ville (« à »), le cas le plus
 * fréquent. Un pays absent dont le genre n'est pas connu donnerait un « à » fautif : la table s'étend au besoin, jamais par déduction.
 */
const PREPOSITIONS: Record<string, "au" | "en" | "aux"> = {
  maroc: "au", senegal: "au", portugal: "au", japon: "au", mexique: "au", canada: "au", bresil: "au", "royaume uni": "au", danemark: "au",
  perou: "au", chili: "au", vietnam: "au", cambodge: "au", kenya: "au", "cap vert": "au", luxembourg: "au", liban: "au", qatar: "au",
  france: "en", italie: "en", espagne: "en", grece: "en", tunisie: "en", egypte: "en", turquie: "en", croatie: "en", thailande: "en",
  indonesie: "en", inde: "en", chine: "en", australie: "en", islande: "en", irlande: "en", ecosse: "en", angleterre: "en", allemagne: "en",
  belgique: "en", suisse: "en", autriche: "en", norvege: "en", suede: "en", finlande: "en", pologne: "en", hongrie: "en", "afrique du sud": "en",
  argentine: "en", colombie: "en", jordanie: "en", corse: "en", sicile: "en", sardaigne: "en", crete: "en", bretagne: "en", normandie: "en",
  provence: "en", guadeloupe: "en", martinique: "en", "polynesie francaise": "en", "nouvelle caledonie": "en", californie: "en", floride: "en",
  "etats unis": "aux", maldives: "aux", antilles: "aux", baleares: "aux", canaries: "aux", "pays bas": "aux", seychelles: "aux", philippines: "aux",
  "emirats arabes unis": "aux", acores: "aux", cyclades: "aux",
};

/** « à Marrakech », « au Maroc », « en Italie », « aux Maldives » ; null sans destination lisible. */
export function destinationAvecPreposition(nom: string): string | null {
  const propre = nom.replace(/\s+/g, " ").trim();
  if (propre.length < 2) return null;
  const prep = PREPOSITIONS[cleLibelle(propre).replace(/^(le|la|les|l)\s+/, "")];
  if (!prep) return `à ${propre}`;
  const sansArticle = propre.replace(/^(les\s+|la\s+|le\s+|l['’]\s*)/i, "");
  return `${prep} ${sansArticle.charAt(0).toUpperCase()}${sansArticle.slice(1)}`;
}
