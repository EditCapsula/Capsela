import type { Humeur } from "./humeur";
import type { DateContext, OccasionKey, WorkMode } from "./types";

/*
 * L'OCCASION SAISIE LIBREMENT DANS PLANIFIER (22/11/2026, demandé : « qu'un utilisateur puisse saisir librement son occasion dans une
 * barre de recherche et qu'en fonction de l'occasion on lui pousse une tenue » ; arbitré : la barre EN PLUS, au-dessus des tuiles).
 *
 * Le moteur ne lit pas de texte : il compose pour une OCCASION de la liste. La saisie est donc traduite en une occasion (et, quand le
 * texte le dit, son sous-choix : Entretien, Télétravail, le type de date), puis tout continue comme avec une tuile — c'est le même
 * moteur, avec les pièces du dressing et de la capsule, qui compose la tenue au bout du parcours.
 *
 * D'abord cette lecture LOCALE, par mots-clés (immédiate, hors ligne, en démo, sans coût) ; seulement si elle ne reconnaît rien, la
 * lecture IA déjà en place pour les événements de valise (lireNomEvenement, fonction `lire-evenement`). Ni l'une ni l'autre : aucune
 * occasion n'est inventée, l'écran invite à choisir la plus proche.
 *
 * L'ORDRE DE LA TABLE DÉCIDE : la règle la plus spécifique d'abord (« dîner d'affaires » est du travail avant d'être un dîner,
 * « anniversaire de mariage » un rendez-vous avant d'être un mariage). ARBITRAGE ÉDITORIAL, à ajuster sur les saisies réelles. Les
 * obsèques n'y sont pas, volontairement : aucune des occasions ne leur convient sans nuance, la lecture IA ou le choix d'une tuile
 * décident.
 */

export interface OccasionComprise {
  occasion: OccasionKey;
  /** Le sous-choix quand le texte le dit (Entretien, Télétravail ; le type de date) ; sinon celui par défaut de l'écran. */
  sousChoix?: WorkMode | DateContext;
  /** La nuance que le texte donne (« habillé », « décontracté »…) : l'envie de Planifier (sous les tuiles), préremplie. */
  humeur?: Humeur;
  /** Le type de lieu quand le texte le dit (« rooftop ») et que l'occasion le propose. */
  typeLieu?: string;
}

/*
 * LES NUANCES (22/11/2026, demandé : « la barre de recherche doit être plus intelligente », arbitré : « mieux comprendre » — lire
 * habillé, décontracté… pour régler le niveau d'habillement). Elles préremplissent l'envie de Planifier (humeur.ts), que le moteur
 * lit déjà ; la personne la voit et la change. Seuls des mots du texte — l'allure dite, ou le cadre (campagne, plage) depuis le
 * 23/11/2026 : aucune nuance n'est déduite de l'occasion seule.
 */
const NUANCES: readonly { mots: RegExp; humeur: Humeur }[] = [
  { mots: /\b(habille|habillee|chic|elegant|elegante|classe|soignee?|tenue correcte|dress code|black tie|smart)\b/, humeur: "elegant" },
  { mots: /\b(glamour|sexy|feminine?)\b/, humeur: "feminin" },
  { mots: /\b(decontracte|decontractee|casual|cool|relax|detendu|simple)\b/, humeur: "decontracte" },
  { mots: /\b(confortable|confort|a l aise|marcher beaucoup|debout toute la journee)\b/, humeur: "confortable" },
  { mots: /\b(leger|legere|chaleur|canicule|il fera chaud|en plein soleil)\b/, humeur: "leger" },
  // LE CADRE (23/11/2026, demandé : « mariage à la campagne » doit donner Cérémonie et Décontracté). Après les mots explicites : « un
  // mariage chic à la campagne » reste Plus habillé. Le cadre dit l'allure d'un événement, pas l'occasion seule. ARBITRAGE ÉDITORIAL.
  { mots: /\b(campagne|champetre|jardin|plein air|en exterieur|guinguette|boheme|grange|ferme|domaine|garden party)\b/, humeur: "decontracte" },
  { mots: /\b(plage|bord de mer|pieds dans le sable|piscine)\b/, humeur: "leger" },
];

/** La nuance et le lieu que le texte dit explicitement, sans l'occasion. */
export function lireNuances(texte: string): Pick<OccasionComprise, "humeur" | "typeLieu"> {
  const t = normaliser(texte);
  const humeur = NUANCES.find((n) => n.mots.test(t))?.humeur;
  const typeLieu = /\b(rooftop|roof top|bar)\b/.test(t) ? "Bar / Rooftop" : undefined;
  return { ...(humeur ? { humeur } : {}), ...(typeLieu ? { typeLieu } : {}) };
}

/** Minuscules, sans accents ni ponctuation : « Dîner d'affaires ! » → « diner d affaires ». */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Regle = { mots: RegExp; occasion: OccasionKey; sousChoix?: (t: string) => WorkMode | DateContext | undefined };

const contexteDate = (t: string): DateContext | undefined =>
  /\b(verre|bar|apero)\b/.test(t) ? "Verre" : /\b(cinema|balade|promenade|expo|musee)\b/.test(t) ? "Cinéma / balade" : /\b(restaurant|resto|diner|dejeuner)\b/.test(t) ? "Restaurant / date romantique" : undefined;

const REGLES: readonly Regle[] = [
  { mots: /\banniversaire de mariage\b|\bsaint valentin\b|\b(rendez vous|rdv|diner|soiree) (amoureux|romantique|galant)\b|\bpremier rendez vous\b|\btete a tete\b|\ben amoureux\b|\bdate\b/, occasion: "date", sousChoix: contexteDate },
  { mots: /\b(mariage|bapteme|ceremonie|gala|communion|fiancailles|remise (de|des) diplomes?|bar mitzvah|bat mitzvah)\b/, occasion: "evenement_perso" },
  { mots: /\bentretien\b/, occasion: "travail_formel", sousChoix: () => "Entretien" },
  { mots: /\bteletravail\b|\btravail (a|de) la maison\b/, occasion: "travail_formel", sousChoix: () => "Télétravail" },
  { mots: /\b(reunion|bureau|travail|boulot|conference|seminaire|salon professionnel|rendez vous client|rdv client|client|presentation|affaires|business|pro)\b/, occasion: "travail_formel", sousChoix: () => "Présentiel" },
  { mots: /\b(sport|salle de sport|gym|yoga|pilates|running|footing|jogging|course a pied|randonnee|rando|trek|velo|ski|fitness|crossfit|tennis|padel|natation|escalade|danse)\b/, occasion: "sport" },
  { mots: /\b(voyage|avion|train|aeroport|gare|trajet|road trip|vol|deplacement)\b/, occasion: "voyage" },
  { mots: /\b(cocooning|maison|canape|pyjama|spa|journee tranquille|chez moi)\b/, occasion: "cocooning" },
  { mots: /\b(soiree|anniversaire|fete|pot|reveillon|cremaillere|rooftop|afterwork|after work|bar|club|boite|concert|diner|restaurant|resto|apero|aperitif|cocktail|vernissage|theatre|opera|spectacle|festival)\b/, occasion: "soiree" },
  { mots: /\b(courses|marche|brunch|pique nique|picnic|ecole|balade|promenade|parc|shopping|musee|expo|exposition|dejeuner|famille|week end|journee libre|cafe)\b/, occasion: "quotidien" },
];

/** L'occasion lue localement dans la saisie, ou null (rien de reconnu : la lecture IA prend le relais). */
export function lireOccasionLocale(texte: string): OccasionComprise | null {
  const t = normaliser(texte);
  if (!t) return null;
  for (const r of REGLES) {
    if (!r.mots.test(t)) continue;
    const sousChoix = r.sousChoix?.(t);
    const nuances = lireNuances(texte);
    // Le type de lieu ne vaut que pour la Soirée (le seul qui en propose, PlanifierScreen) : un « bar » ailleurs n'en dit rien.
    if (nuances.typeLieu && r.occasion !== "soiree") delete nuances.typeLieu;
    return { occasion: r.occasion, ...(sousChoix ? { sousChoix } : {}), ...nuances };
  }
  return null;
}

/*
 * LES PISTES LOCALES (22/11/2026, demandé : « que le moteur fasse des recommandations d'occasions selon ce qui est saisi », capture
 * « Signature notaire » non reconnue). Des mots qui ne suffisent pas à TRANCHER mais orientent : ils proposent deux occasions, la plus
 * probable d'abord, que la personne choisit. Complètent les pistes de la lecture IA, ou les remplacent sans elle (démo, hors ligne).
 * Les obsèques n'y sont pas non plus (cf. plus haut). ARBITRAGE ÉDITORIAL.
 */
const INDICES: readonly { mots: RegExp; pistes: OccasionKey[] }[] = [
  { mots: /\b(notaire|banque|banquier|avocat|signature|mairie|administratif|prefecture|comptable|assurance|etat des lieux|agence immobiliere|visite d appartement)\b/, pistes: ["travail_formel", "quotidien"] },
  { mots: /\b(medecin|docteur|dentiste|kine|rendez vous|rdv|coiffeur)\b/, pistes: ["quotidien", "travail_formel"] },
  { mots: /\b(famille|parents|beaux parents|belle famille|repas|invitation|invites|noel|nouvel an)\b/, pistes: ["soiree", "quotidien"] },
];

/** Les occasions que le texte suggère sans les dire (au plus trois, sans doublon), ou une liste vide. */
export function pistesLocales(texte: string): OccasionKey[] {
  const t = normaliser(texte);
  const out: OccasionKey[] = [];
  for (const i of INDICES) if (i.mots.test(t)) for (const o of i.pistes) if (!out.includes(o)) out.push(o);
  return out.slice(0, 3);
}

/*
 * LES EXEMPLES (22/11/2026, arbitré : « suggestions en tapant » et « exemples cliquables »). Une liste d'intitulés courants, chacun avec
 * l'occasion qu'il désigne (et son sous-choix, sa nuance) : sous la barre vide, quelques-uns à toucher ; en tapant, ceux dont un mot
 * commence comme la saisie. Toucher un exemple vaut une lecture sûre — c'est la liste qui le dit, pas une déduction.
 */
export interface ExempleOccasion extends OccasionComprise {
  libelle: string;
  /** Avec son article, pour le titre du résultat : « Ta tenue pour ton entretien d'embauche est prête » (23/11/2026, demandé). */
  titre: string;
}
export const EXEMPLES_OCCASION: readonly ExempleOccasion[] = [
  { libelle: "Mariage", titre: "le mariage", occasion: "evenement_perso" },
  { libelle: "Baptême", titre: "le baptême", occasion: "evenement_perso" },
  { libelle: "Communion", titre: "la communion", occasion: "evenement_perso" },
  { libelle: "Fiançailles", titre: "les fiançailles", occasion: "evenement_perso" },
  { libelle: "Gala", titre: "le gala", occasion: "evenement_perso", humeur: "elegant" },
  { libelle: "Remise de diplôme", titre: "la remise de diplôme", occasion: "evenement_perso" },
  { libelle: "Entretien d'embauche", titre: "ton entretien d'embauche", occasion: "travail_formel", sousChoix: "Entretien" },
  { libelle: "Réunion", titre: "ta réunion", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Rendez-vous client", titre: "ton rendez-vous client", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Présentation", titre: "ta présentation", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Séminaire", titre: "le séminaire", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Dîner d'affaires", titre: "ton dîner d'affaires", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Signature chez le notaire", titre: "la signature chez le notaire", occasion: "travail_formel", sousChoix: "Présentiel" },
  { libelle: "Télétravail", titre: "ta journée de télétravail", occasion: "travail_formel", sousChoix: "Télétravail" },
  { libelle: "Dîner romantique", titre: "ton dîner romantique", occasion: "date", sousChoix: "Restaurant / date romantique" },
  { libelle: "Verre en amoureux", titre: "ton verre en amoureux", occasion: "date", sousChoix: "Verre" },
  { libelle: "Cinéma en amoureux", titre: "ta sortie cinéma en amoureux", occasion: "date", sousChoix: "Cinéma / balade" },
  { libelle: "Afterwork", titre: "l'afterwork", occasion: "soiree" },
  { libelle: "Anniversaire", titre: "l'anniversaire", occasion: "soiree" },
  { libelle: "Soirée entre amis", titre: "ta soirée entre amis", occasion: "soiree" },
  { libelle: "Verre en rooftop", titre: "ton verre en rooftop", occasion: "soiree", typeLieu: "Bar / Rooftop" },
  { libelle: "Concert", titre: "le concert", occasion: "soiree" },
  { libelle: "Dîner entre amis", titre: "ton dîner entre amis", occasion: "soiree" },
  { libelle: "Pot de départ", titre: "le pot de départ", occasion: "soiree" },
  { libelle: "Réveillon", titre: "le réveillon", occasion: "soiree", humeur: "elegant" },
  { libelle: "Crémaillère", titre: "la crémaillère", occasion: "soiree", humeur: "decontracte" },
  { libelle: "Brunch", titre: "ton brunch", occasion: "quotidien" },
  { libelle: "Déjeuner en famille", titre: "ton déjeuner en famille", occasion: "quotidien" },
  { libelle: "Shopping", titre: "ta journée shopping", occasion: "quotidien" },
  { libelle: "Balade", titre: "ta balade", occasion: "quotidien", humeur: "confortable" },
  { libelle: "Musée", titre: "ta visite au musée", occasion: "quotidien" },
  { libelle: "Pique-nique", titre: "ton pique-nique", occasion: "quotidien", humeur: "decontracte" },
  { libelle: "Salle de sport", titre: "ta séance de sport", occasion: "sport" },
  { libelle: "Yoga", titre: "ton cours de yoga", occasion: "sport" },
  { libelle: "Randonnée", titre: "ta randonnée", occasion: "sport" },
  { libelle: "Footing", titre: "ton footing", occasion: "sport" },
  { libelle: "Voyage en train", titre: "ton voyage en train", occasion: "voyage" },
  { libelle: "Voyage en avion", titre: "ton voyage en avion", occasion: "voyage" },
  { libelle: "Journée cocooning", titre: "ta journée cocooning", occasion: "cocooning" },
];

/** Sous la barre vide : des intitulés variés, une occasion chacun. */
export const EXEMPLES_VEDETTES: readonly string[] = ["Mariage", "Entretien d'embauche", "Afterwork", "Dîner romantique", "Brunch"];

/** Les exemples dont un mot commence comme chaque mot de la saisie (« diner aff » → Dîner d'affaires), au plus `max`. */
export function exemplesPour(saisie: string, max = 4): ExempleOccasion[] {
  const mots = normaliser(saisie).split(" ").filter(Boolean);
  if (!mots.length || normaliser(saisie).length < 2) return [];
  return EXEMPLES_OCCASION.filter((e) => {
    const motsExemple = normaliser(e.libelle).split(" ");
    return mots.every((m) => motsExemple.some((x) => x.startsWith(m)));
  }).slice(0, max);
}

/**
 * LE TEXTE DANS LE TITRE DU RÉSULTAT (23/11/2026, demandé : « mets les articles devant comme suggéré ») : un exemple de la liste, touché
 * ou écrit tel quel, prend son article (« ton entretien d'embauche », « l'afterwork ») ; un texte libre reste celui de la personne,
 * première lettre en minuscule et sans ponctuation finale — on ne réécrit pas ce qu'elle a écrit.
 */
export function titrePourSaisie(texte: string): string {
  const exemple = EXEMPLES_OCCASION.find((e) => normaliser(e.libelle) === normaliser(texte));
  if (exemple) return exemple.titre;
  const t = texte.trim().replace(/[.!\s]+$/, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}
