import type {
  AccessoireType,
  BijouType,
  CapsuleSeason,
  CategoryKey,
  City,
  DateContext,
  OccasionKey,
  SacType,
  Season,
  ShoeType,
  WorkMode,
} from "./types";
import { NOMS_AJOUTES_AU_DRESSING, PAL_COULEURS } from "./palCouleurs";

/** Source unique du numéro de version — partagée entre l'écran Profil et l'écran Informations légales, pour éviter toute divergence d'affichage. */
export const APP_VERSION = "1.4.0";

export const CATS: [CategoryKey, string, string][] = [
  ["haut", "Haut", "Hauts"],
  ["pull", "Pull / Gilet", "Pulls & gilets"],
  ["pantalon", "Pantalon", "Pantalons"],
  ["jean", "Jean", "Jeans"],
  ["jupe", "Jupe", "Jupes"],
  ["short", "Short", "Shorts"],
  ["robe", "Robe", "Robes"],
  ["combinaison", "Combinaison", "Combinaisons"],
  ["veste", "Veste / Blazer", "Vestes & blazers"],
  ["manteau", "Manteau", "Manteaux & extérieurs"],
  ["chaussures", "Chaussures", "Chaussures"],
  ["sac", "Sac", "Sacs"],
  ["bijou", "Bijou", "Bijoux"],
  ["accessoire", "Accessoire", "Accessoires"],
];

/** Sous-types génériques par catégorie — pré-suggérés à la saisie du nom, toujours facultatifs (seul le type de chaussure bloque, cf. SHOE_TYPES/R-B6). */
export const SUBTYPES: Partial<Record<CategoryKey, string[]>> = {
  haut: ["T-shirt", "Top", "Débardeur", "Chemise", "Chemisier", "Blouse", "Polo", "Sweat"],
  pull: ["Pull", "Gilet", "Cardigan", "Col roulé"],
  pantalon: ["Pantalon", "Tailleur", "Cargo", "Legging", "Jogging"],
  jean: ["Droit", "Slim", "Skinny", "Mom", "Boyfriend", "Wide leg", "Flare"],
  jupe: ["Mini", "Midi", "Longue", "Crayon", "Plissée"],
  short: ["Short", "Bermuda"],
  robe: ["Courte", "Midi", "Longue", "Chemise", "Portefeuille", "Pull"],
  combinaison: ["Combinaison", "Combishort", "Salopette"],
  veste: ["Blazer", "Veste légère", "Perfecto", "Veste en jean", "Surchemise"],
  manteau: ["Manteau", "Trench", "Caban", "Doudoune", "Parka", "Imperméable"],
};

/** Catégories du sous-type générique pour lesquelles il est obligatoire — aucune : seul le type de chaussure bloque (mécanisme séparé, cf. addShoeType/R-B6). */
export const SUBTYPE_REQUIRED: CategoryKey[] = [];

/** Catégories regroupées sous "bas" pour la taille, l'anti-répétition et le picker de tenue. */
export const BAS_CATS: CategoryKey[] = ["pantalon", "jean", "short"];

export const CATLABEL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
export const CATPLURAL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
CATS.forEach(([key, label, plural]) => {
  CATLABEL[key] = label;
  CATPLURAL[key] = plural;
});

/**
 * Repli hex quand un article catalogue n'a pas de couleur renseignée
 * (vestiaire.ts) — jamais une vraie couleur de palette, correctif 20/08/2026 :
 * la préférence de palette personnelle (R-S10, logic.ts) exempte
 * explicitement les articles à cette valeur, pour ne jamais les exclure "à
 * vie" d'une tenue simplement parce que leur couleur n'a pas été saisie.
 */
export const FALLBACK_HEX = "#DCCFBC";

/**
 * Palette de couleurs pour les pièces du dressing : 27 teintes d'origine, plus 24 ajoutées le
 * 02/10/2026 au code identique à celui de la palette personnelle du profil (palCouleurs.ts,
 * NOMS_AJOUTES_AU_DRESSING). Les 27 d'origine gardent leur code : les pièces déjà enregistrées
 * ne changent pas. La copie de la fonction Edge analyze-dressing-photo doit rester identique
 * (test miroir).
 */
export const PALETTE: [string, string][] = [
  ["Blanc", "#F7F4EE"],
  ["Blanc cassé", "#EDE4D6"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#D9C9B2"],
  ["Camel", "#C08A5E"],
  ["Caramel", "#B4835A"],
  ["Terracotta", "#B4735A"],
  ["Rouille", "#A9613F"],
  ["Brique", "#9E5A3C"],
  ["Chocolat", "#7C5436"],
  ["Moutarde", "#C39A50"],
  ["Kaki", "#8A8560"],
  ["Vert sauge", "#9AA389"],
  ["Vert bouteille", "#3F5342"],
  ["Taupe", "#A8967C"],
  ["Beige rosé", "#D8C3B4"],
  ["Rose poudré", "#D3AE9F"],
  ["Corail", "#C9846A"],
  ["Gris clair", "#C7C2B9"],
  ["Gris", "#9B968F"],
  ["Gris anthracite", "#4B4A47"],
  ["Bleu ciel", "#A9BFCB"],
  ["Denim", "#5E6E7C"],
  ["Marine", "#3A4152"],
  ["Prune", "#5B3A4A"],
  ["Bordeaux", "#6E3B3A"],
  ["Noir", "#2A2724"],
  ...NOMS_AJOUTES_AU_DRESSING.map((nom): [string, string] => [nom, PAL_COULEURS.find(([n]) => n === nom)![1]]),
];

export const SEASONS: Season[] = ["Printemps / Été", "Automne / Hiver", "Toutes saisons"];

/**
 * Pré-suggestion de saison à l'ajout d'une pièce, par catégorie et par nom.
 * Longtemps « jamais appliquée d'office, l'utilisateur doit toujours
 * confirmer » : cette contrainte produit est levée le 27/09/2026, cf.
 * saisonParDefaut juste en dessous.
 */
export function seasonSuggestion(cat: CategoryKey, name: string): Season | null {
  if (cat === "veste" || cat === "manteau" || cat === "pull") return "Automne / Hiver";
  if (/lin|short|débardeur|sandal|combinaison/.test((name || "").toLowerCase())) return "Printemps / Été";
  return null;
}

/**
 * La saison retenue quand l'utilisatrice n'en a choisi aucune
 * (27/09/2026, refonte « Ajouter une pièce » : « la saison ne doit plus
 * empêcher l'ajout »). Jusque-là, la pièce ne s'enregistrait pas tant que la
 * saison n'était pas confirmée à la main — la seule information secondaire
 * qui bloquait l'action principale.
 *
 * La suggestion d'abord ; à défaut, « Toutes saisons », qui est déjà le repli
 * du catalogue pour une saison inconnue (vestiaire.ts) : la pièce reste
 * proposée par le moteur toute l'année plutôt que d'être écartée sur une
 * saison que personne n'a donnée. L'écran l'affiche présélectionnée et
 * modifiable : rien n'est enregistré sans avoir été montré.
 */
export function saisonParDefaut(cat: CategoryKey, name: string): Season {
  return seasonSuggestion(cat, name) ?? "Toutes saisons";
}

/**
 * Occasion, libellé, sous-libellé, niveau de formalité minimum requis
 * (0 = sport, 1 = décontracté, 3 = business casual, 4 = habillé) — alimente
 * R-B3 (incohérence occasion) et R-B6 (baskets non éligibles). Les 10
 * occasions sont présentées au même niveau côté UI, sans hiérarchie
 * principale/secondaire (corrigé le 12/08/2026 — la version précédente de
 * cette table n'avait pas été mise à jour lors du passage à cette taxonomie
 * et reprenait par erreur des valeurs de formalité obsolètes).
 * "Date" a une formalité variable selon son sous-contexte (cf. DATE_CONTEXTS)
 * — la valeur ci-dessous n'est qu'un repli par défaut.
 */
export const OCCASIONS: [OccasionKey, string, string, number][] = [
  ["quotidien", "Quotidien / Décontracté", "Courses, école, journée libre", 1],
  ["travail_formel", "Travail / Bureau", "Journée de travail", 3],
  // Formalité alignée sur travail_formel (correctif 21/08/2026, décidé) :
  // un entretien se traite comme une journée de travail en présentiel,
  // business_casual — pas le niveau habillé, jamais couvert par les bas du
  // catalogue (aucun pantalon/jupe n'atteint ce niveau dans les capsules).
  ["entretien", "Rendez-vous important", "Entretien, réunion clé", 3],
  ["date", "Rendez-vous amoureux", "Tête-à-tête", 3],
  // Formalité relevée (recette 24/08/2026, signalé : tenues trop basiques
  // pour ces deux occasions) — repli automatique déjà en place
  // (FORMALITY_FALLBACK_CHAIN, logic.ts) si le dressing/la capsule ne suit
  // pas : 3 -> [3,1], 4 -> [4,3,1], jamais de tenue bloquée pour autant.
  // « Sortie festive » a été fusionnée ici le 08/10/2026 (occasions.ts) : la formalité de base reste 3 ; elle passe à 4 quand le
  // contexte de la soirée l'appelle (effectiveFormality, `habillee`).
  ["soiree", "Soirée", "Bar, dîner, club, entre amis", 3],
  ["sport", "Sport", "Actif, technique", 0],
  ["cocooning", "Cocooning / Maison", "Chez soi, détente", 1],
  ["voyage", "Voyage / Déplacement", "Confortable, polyvalent", 1],
  ["evenement_perso", "Événement / Cérémonie", "Mariage, baptême", 4],
];

/** Sous-contexte de l'occasion "Date" — seul déterminant de sa formalité (recette 12/08/2026). */
export const DATE_CONTEXTS: [DateContext, number][] = [
  ["Restaurant / date romantique", 4],
  ["Verre", 1],
  ["Cinéma / balade", 1],
  ["Activité", 1],
  ["Soirée festive", 3],
];
export const DATE_CONTEXT_FORMALITY: Record<DateContext, number> = {} as Record<DateContext, number>;
DATE_CONTEXTS.forEach(([key, formality]) => {
  DATE_CONTEXT_FORMALITY[key] = formality;
});

/** Libellés courts pour les chips d'occasion à l'ajout d'une pièce (espace restreint). */
/** Icône météo par libellé de condition (partagée Tenue du jour / Accueil). */
export const WEATHER_ICONS: Record<string, string> = {
  "Ensoleillé": "☀️",
  "Grand soleil": "☀️",
  "Éclaircies": "⛅",
  "Nuageux": "☁️",
  "Pluie": "🌧️",
  "Orageux": "⛈️",
  "Neige": "❄️",
};

/**
 * Libellés courts pour les chips d'occasion (espace restreint).
 *
 * Record COMPLET depuis le 23/09/2026, plus Partial. Trois occasions —
 * sport, cocooning, voyage — n'y figuraient pas, et l'écran d'ajout affichait
 * alors la clé brute de l'énumération : « voyage » en minuscules, à côté de
 * chips correctement capitalisés. Le type empêche désormais d'ajouter une
 * occasion sans son libellé court ; c'est une erreur de compilation, plus une
 * chaîne technique qui remonte jusqu'à l'écran.
 *
 * "all" en est exclue : ce n'est pas une occasion mais la sentinelle
 * « aucune », et OCC_LABELS lui donne déjà « Toutes ».
 */
export const OCC_SHORT: Record<Exclude<OccasionKey, "all">, string> = {
  quotidien: "Quotidien",
  travail_formel: "Travail",
  entretien: "Rendez-vous",
  date: "Date",
  soiree: "Soirée",
  sport: "Sport",
  cocooning: "Cocooning",
  voyage: "Voyage",
  evenement_perso: "Cérémonie",
};

export const OCC_LABELS: Record<OccasionKey, string> = { all: "Toutes" } as Record<OccasionKey, string>;
export const OCC_FORMALITY: Record<OccasionKey, number> = { all: 0 } as Record<OccasionKey, number>;
OCCASIONS.forEach(([key, label, , formality]) => {
  OCC_LABELS[key] = label;
  OCC_FORMALITY[key] = formality;
});

/**
 * Libellé court d'une occasion, quelle que soit la clé — point unique de
 * lecture. Les trois appelants faisaient chacun leur repli : l'un tombait sur
 * le libellé complet, l'autre sur sa première moitié, le troisième sur la
 * CLÉ BRUTE. Trois replis pour une même question, dont un faux.
 */
export function occasionShortLabel(key: OccasionKey): string {
  if (key === "all") return OCC_LABELS.all;
  return OCC_SHORT[key];
}

/**
 * Formalité minimum effective d'une occasion — "travail_formel" varie selon
 * le sous-choix Présentiel (business casual) / Télétravail (décontracté),
 * "date" varie selon son sous-contexte (cf. DATE_CONTEXTS), "soiree" monte à 4
 * quand le contexte la rend habillée (`habillee`, cf. soireeHabillee), les autres
 * occasions gardent leur valeur fixe de OCC_FORMALITY.
 */
export function effectiveFormality(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext = "Verre", habillee = false): number {
  if (occasion === "soiree" && habillee) return 4;
  if (occasion === "travail_formel") return workMode === "Télétravail" ? 1 : 3;
  if (occasion === "date") return DATE_CONTEXT_FORMALITY[dateContext] ?? 1;
  return OCC_FORMALITY[occasion] ?? 0;
}

/** Type de chaussure — obligatoire si catégorie = chaussures, nécessaire à R-B6. */
export const SHOE_TYPES: ShoeType[] = [
  "Baskets", "Bottines", "Bottes", "Escarpins", "Sandales", "Sandales à talons", "Espadrilles", "Mocassins",
  "Ballerines", "Chaussures d'intérieur",
];

/**
 * Préférences de style par occasion (R-S16, recette 20/08/2026) — mécanisme
 * général et extensible : chaque occasion peut définir des attributs
 * favorisés (aujourd'hui le type de chaussure, d'autres pourront s'ajouter
 * ici plus tard, ex. matière/statement) SANS jamais devenir un critère
 * d'exclusion. Appliqué comme une inclination molle dans logic.ts (même
 * esprit que R-S10/R-B15/R-B16) : ne retient le sous-ensemble préféré que
 * s'il laisse au moins une option, jamais de tenue bloquée faute de la
 * bonne pièce dans le dressing. Occasions absentes de cette table : aucune
 * préférence de style, comportement inchangé.
 */
export interface OccasionStylePrefs {
  /** Types de chaussures favorisés (ex. talons pour une soirée habillée). */
  shoeTypes?: ShoeType[];
}
/**
 * Préférence de chaussures d'une soirée HABILLÉE (occasions.ts) — celle de l'ancienne occasion « Sortie festive », qui n'existe plus
 * comme occasion (08/10/2026) : élargie le 21/08/2026 à toute chaussure à talon. Molle, jamais exclusive.
 */
export const PREFS_SOIREE_HABILLEE: OccasionStylePrefs = { shoeTypes: ["Escarpins", "Sandales à talons", "Mules", "Slingbacks"] };
export const OCCASION_STYLE_PREFS: Partial<Record<OccasionKey, OccasionStylePrefs>> = {
  // Ajouté (recette 25/08/2026, signalé) — un mariage/baptême appelle une
  // chaussure à talon au même titre qu'une soirée habillée, jamais une
  // simple sandale plate ; même liste (PREFS_SOIREE_HABILLEE), préférence molle jamais exclusive comme
  // partout ailleurs dans cette table.
  evenement_perso: { shoeTypes: ["Escarpins", "Sandales à talons", "Mules", "Slingbacks"] },
  // Ajouté (correctif 21/08/2026, signalé) — inverse : le voyage privilégie
  // le confort, jamais un talon.
  voyage: { shoeTypes: ["Baskets", "Ballerines", "Sandales", "Mocassins", "Espadrilles"] },
  // Ajouté (correctif 21/08/2026, décidé — option B) : le seuil de formalité
  // d'un entretien reste business_casual (cf. OCCASIONS ci-dessus), mais la
  // tenue doit lire plus sérieuse qu'une simple journée de bureau — favorise
  // les chaussures les plus structurées/habillées de ce niveau.
  entretien: { shoeTypes: ["Mocassins", "Escarpins", "Derbies", "Bottines"] },
};
/** Sous-types — pré-suggérés à la saisie du nom, jamais bloquants. */
export const SAC_TYPES: SacType[] = ["Sac à main", "Cabas", "Bandoulière", "Pochette", "Sac à dos", "Sac de sport"];
export const BIJOU_TYPES: BijouType[] = ["Collier", "Boucles d'oreilles", "Bracelet", "Bague", "Montre"];
export const ACCESSOIRE_TYPES: AccessoireType[] = [
  "Ceinture", "Foulard", "Écharpe", "Chapeau", "Casquette", "Lunettes", "Collants", "Chaussettes hautes", "Gourde",
];

/**
 * LES COULEURS DU DRESSING PAR FAMILLE (02/10/2026, signalé : la grille mélangeait les teintes, un beige à côté
 * d'un bleu). Un ordre de LECTURE pour le sélecteur de la fiche pièce : du plus clair au plus foncé dans chaque
 * famille. PALETTE garde son ordre (la copie de la fonction Edge `analyze-dressing-photo` doit lui rester
 * identique) ; chaque teinte de PALETTE figure dans une seule famille (test).
 */
export const FAMILLES_COULEURS: { libelle: string; noms: string[] }[] = [
  { libelle: "Blancs & écrus", noms: ["Blanc", "Ivoire", "Blanc cassé", "Crème"] },
  { libelle: "Beiges & camel", noms: ["Champagne", "Sable", "Beige", "Nude", "Beige rosé", "Camel", "Caramel"] },
  { libelle: "Jaunes & oranges", noms: ["Jaune", "Moutarde", "Abricot", "Orange"] },
  { libelle: "Bruns & terres", noms: ["Cognac", "Marron", "Chocolat", "Corail", "Terracotta", "Rouille", "Brique"] },
  { libelle: "Rouges", noms: ["Rouge", "Rouge cerise", "Bordeaux", "Prune"] },
  { libelle: "Roses", noms: ["Rose pâle", "Rose poudré", "Vieux rose", "Fuchsia"] },
  { libelle: "Verts", noms: ["Menthe", "Vert sauge", "Kaki", "Vert olive", "Vert forêt", "Vert bouteille", "Émeraude"] },
  { libelle: "Bleus & violets", noms: ["Bleu ciel", "Turquoise", "Denim", "Bleu", "Bleu cobalt", "Marine", "Bleu nuit", "Lavande"] },
  { libelle: "Gris & noirs", noms: ["Gris perle", "Gris clair", "Gris", "Taupe", "Gris anthracite", "Noir"] },
];

/** Palette dédiée au bijou (tons métalliques) — remplace la palette générale pour cette catégorie. */
export const PALETTE_BIJOU: [string, string][] = [
  ["Doré", "#C9A24B"],
  ["Argenté", "#B9BEC4"],
  ["Cuivré", "#B8734A"],
  ["Or rose", "#D4A995"],
  ["Bronze", "#8C6A3F"],
  ["Perle", "#EDE6DA"],
  ["Noir mat", "#2A2724"],
];

export const CITIES: City[] = [
  { city: "Paris", country: "France", temp: 24, label: "Ensoleillé" },
  { city: "Lyon", country: "France", temp: 27, label: "Ensoleillé" },
  { city: "Marseille", country: "France", temp: 29, label: "Grand soleil" },
  { city: "Nantes", country: "France", temp: 21, label: "Éclaircies" },
  { city: "Lille", country: "France", temp: 18, label: "Nuageux" },
  { city: "Bordeaux", country: "France", temp: 26, label: "Ensoleillé" },
  { city: "Toulouse", country: "France", temp: 28, label: "Grand soleil" },
  { city: "Strasbourg", country: "France", temp: 20, label: "Éclaircies" },
  { city: "Rennes", country: "France", temp: 19, label: "Nuageux" },
  { city: "Nice", country: "France", temp: 30, label: "Grand soleil" },
  { city: "Bruxelles", country: "Belgique", temp: 19, label: "Nuageux" },
  { city: "Genève", country: "Suisse", temp: 22, label: "Éclaircies" },
  { city: "Montréal", country: "Canada", temp: 25, label: "Ensoleillé" },
  { city: "Casablanca", country: "Maroc", temp: 27, label: "Ensoleillé" },
  { city: "Londres", country: "Royaume-Uni", temp: 20, label: "Nuageux" },
  { city: "Barcelone", country: "Espagne", temp: 28, label: "Grand soleil" },
  { city: "Berlin", country: "Allemagne", temp: 21, label: "Éclaircies" },
  { city: "Dakar", country: "Sénégal", temp: 31, label: "Grand soleil" },
];

export const CONTACTS = ["Léa", "Chloé", "Sacha", "Mon copain"];

export const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export interface Weather {
  season: Season;
  temp: number;
  label: string;
  seasons: Season[];
  /**
   * Les saisons du jour sur quatre valeurs (27/09/2026), pour les pièces qui
   * portent leurs quatre saisons (Item.saisons). Posées par weatherForDay et
   * representativeWeatherFor, cf. saisonsDuJour et estDeSaison (capsule.ts).
   * Absentes : toutes les pièces sont jugées sur `seasons`, comme avant.
   */
  saisons?: CapsuleSeason[];
}

/**
 * Indice UV estimé — aucune vraie donnée UV n'est disponible côté API météo
 * actuelle (correctif 21/08/2026 : approximation à partir de la température
 * et du libellé météo, faute de brancher un endpoint UV dédié). Sert de
 * signal pour R-B15 (lunettes de soleil et pièces similaires nécessitant du
 * soleil) : seuil demandé "dès que l'indice UV est de 3 minimum".
 */
function estimateUvIndex(weather: Weather): number {
  let base: number;
  if (weather.temp >= 25) base = 7;
  else if (weather.temp >= 20) base = 5;
  else if (weather.temp >= 15) base = 4;
  else if (weather.temp >= 10) base = 2;
  else base = 1;
  if (/soleil/i.test(weather.label)) return base;
  if (/pluie|orage/i.test(weather.label)) return Math.max(0, base - 3);
  return Math.max(0, base - 2);
}

/** Météo jugée assez ensoleillée pour les pièces necessite_soleil (R-B15) — seuil indice UV estimé ≥ 3 (correctif 21/08/2026, remplace l'ancien test uniquement textuel sur "ensoleillé"). */
export function isSunny(weather: Weather): boolean {
  return estimateUvIndex(weather) >= 3;
}

/**
 * Temps de précipitations, pour les règles de composition (R-B16 veste qui
 * résiste à la pluie, R-B21 chaussures ouvertes écartées).
 *
 * CORRIGÉ LE 30/09/2026 (signalé : « il pleut et l'application me propose des
 * chaussures ouvertes » ; arbitré le même jour). La fonction Edge `weather`
 * appelle la pluie ordinaire « Pluvieux » (condition OpenWeather `Rain`, de
 * loin la plus fréquente) ; l'ancien test `/pluie|orage/i` ne la reconnaissait
 * pas, et le moteur composait comme par temps sec. Couvre désormais tout le
 * vocabulaire réellement produit — celui de la fonction Edge (Pluvieux, Pluie
 * légère, Orageux, Neigeux) et celui de la liste `CITIES` simulée —, NEIGE
 * COMPRISE (arbitré : sous la neige non plus, pas de chaussures ouvertes).
 */
export function isRainy(weather: { label: string }): boolean {
  return /pluie|pluvieux|averse|bruine|orage|neige/i.test(weather.label);
}

/**
 * Libellé décrivant des précipitations — question de VOCABULAIRE, distincte
 * de la règle de composition `isRainy` juste au-dessus. Les deux reconnaissent
 * les mêmes libellés depuis le 30/09/2026 (le défaut du 23/09 — « Pluvieux »
 * ignoré par `isRainy` — est corrigé là-haut) ; elles restent séparées parce
 * qu'elles ne répondent pas à la même question.
 *
 * Cette fonction-ci ne sert qu'à choisir quel libellé afficher et transmettre
 * quand plusieurs créneaux sont agrégés (cf. prevision.ts) : elle ne décide
 * d'aucune pièce. Elle couvre le vocabulaire réellement produit — celui de la
 * fonction Edge comme celui de la liste `CITIES` simulée.
 */
export function labelPrecipitation(label: string): boolean {
  return /pluie|pluvieux|averse|bruine|orage|neige|neigeux/i.test(label);
}

export function isBag(it: { cat?: CategoryKey; name: string }): boolean {
  return it.cat === "sac" || /\bsac\b/i.test(it.name);
}

export function wornAgo(d: number | null | undefined): string {
  if (d == null) return "Jamais porté";
  if (d < 1) return "Porté aujourd’hui";
  if (d === 1) return "Porté hier";
  if (d < 7) return "Porté il y a " + d + " j";
  if (d < 30) return "Porté il y a " + Math.round(d / 7) + " sem";
  if (d < 365) return "Porté il y a " + Math.round(d / 30) + " mois";
  return "Porté il y a +1 an";
}

/**
 * "Ajoutée il y a X" à partir de Item.createdAt (recette 25/08/2026, écran
 * "Jamais portées") — null si createdAt est absent, jamais une durée
 * devinée. Même granularité que wornAgo, jamais un second calcul de dates
 * qui pourrait diverger.
 */
export function addedAgo(createdAt: number | null | undefined): string | null {
  if (createdAt == null) return null;
  const d = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
  if (d < 1) return "Ajoutée aujourd’hui";
  if (d === 1) return "Ajoutée hier";
  if (d < 7) return "Ajoutée il y a " + d + " j";
  if (d < 30) return "Ajoutée il y a " + Math.round(d / 7) + " sem";
  if (d < 365) return "Ajoutée il y a " + Math.round(d / 30) + " mois";
  return "Ajoutée il y a +1 an";
}

/**
 * LES CINQ ÉCRANS DE L'ONBOARDING (refonte du 05/10/2026, brief « Onboarding premium ») : l'histoire d'une phrase —
 * Capsela comprend ton style, ton dressing, t'aide à t'habiller, t'accompagne quand tu pars — puis un cinquième écran qui
 * ne présente plus rien et demande seulement le compte. Un sur-titre, un titre (la dernière ligne en italique terracotta,
 * comme les titres d'écran de l'app), une phrase ; le visuel vit dans OnboardingScreen.tsx.
 */
export interface OnboardingSlide {
  kicker: string;
  /** Les lignes du titre ; la dernière passe en italique terracotta. */
  title: string[];
  body: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    kicker: "Ton style",
    title: ["Un dressing", "qui te ressemble."],
    body: "Indique ce que tu aimes. Capsela s’en sert pour imaginer des pièces, des associations et des tenues qui correspondent vraiment à ton style.",
  },
  {
    kicker: "Ton dressing",
    title: ["Tout ce que tu as.", "Tout ce que tu peux porter."],
    body: "Ajoute les pièces que tu possèdes et laisse Capsela repérer celles qui vont ensemble. Ton dressing devient une source d’idées, pas une pile de vêtements.",
  },
  {
    kicker: "Tes tenues",
    title: ["Chaque matin,", "tu sais quoi porter."],
    body: "Capsela compose des tenues adaptées à ton style, à la météo et à tes occasions, avec tes pièces et celles qui peuvent compléter ton dressing.",
  },
  {
    kicker: "Tes valises",
    title: ["Partir devient", "plus simple."],
    body: "Indique ta destination, tes dates et ton programme. Capsela sélectionne les pièces à emporter et compose tes tenues pour tout le séjour.",
  },
  {
    kicker: "Capsela",
    title: ["Ton dressing.", "Ton style.", "Ton quotidien."],
    body: "Crée ton compte pour retrouver ton dressing, tes capsules, tes tenues et tes valises au même endroit.",
  },
];
