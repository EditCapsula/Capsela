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
  { mots: /\banniversaire de mariage\b|\bsaint valentin\b|\b(rendez vous|rdv|diner|soiree) (amoureux|romantique|galant)\b|\bpremier rendez vous\b|\btete a tete\b|\bdate\b/, occasion: "date", sousChoix: contexteDate },
  { mots: /\b(mariage|bapteme|ceremonie|gala|communion|fiancailles|remise (de|des) diplomes?|bar mitzvah|bat mitzvah)\b/, occasion: "evenement_perso" },
  { mots: /\bentretien\b/, occasion: "travail_formel", sousChoix: () => "Entretien" },
  { mots: /\bteletravail\b|\btravail (a|de) la maison\b/, occasion: "travail_formel", sousChoix: () => "Télétravail" },
  { mots: /\b(reunion|bureau|travail|boulot|conference|seminaire|salon professionnel|rendez vous client|rdv client|client|presentation|affaires|business|pro)\b/, occasion: "travail_formel", sousChoix: () => "Présentiel" },
  { mots: /\b(sport|salle de sport|gym|yoga|pilates|running|footing|jogging|course a pied|randonnee|rando|trek|velo|ski|fitness|crossfit|tennis|padel|natation|escalade|danse)\b/, occasion: "sport" },
  { mots: /\b(voyage|avion|train|aeroport|gare|trajet|road trip|vol|deplacement)\b/, occasion: "voyage" },
  { mots: /\b(cocooning|maison|canape|pyjama|spa|journee tranquille|chez moi)\b/, occasion: "cocooning" },
  { mots: /\b(soiree|anniversaire|fete|pot|afterwork|after work|bar|club|boite|concert|diner|restaurant|resto|apero|aperitif|cocktail|vernissage|theatre|opera|spectacle|festival)\b/, occasion: "soiree" },
  { mots: /\b(courses|marche|brunch|pique nique|picnic|ecole|balade|promenade|parc|shopping|musee|expo|exposition|dejeuner|famille|week end|journee libre|cafe)\b/, occasion: "quotidien" },
];

/** L'occasion lue localement dans la saisie, ou null (rien de reconnu : la lecture IA prend le relais). */
export function lireOccasionLocale(texte: string): OccasionComprise | null {
  const t = normaliser(texte);
  if (!t) return null;
  for (const r of REGLES) {
    if (!r.mots.test(t)) continue;
    const sousChoix = r.sousChoix?.(t);
    return sousChoix ? { occasion: r.occasion, sousChoix } : { occasion: r.occasion };
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
  { mots: /\b(famille|parents|beaux parents|belle famille|repas|invitation|invites|cremaillere|reveillon|noel|nouvel an)\b/, pistes: ["soiree", "quotidien"] },
];

/** Les occasions que le texte suggère sans les dire (au plus trois, sans doublon), ou une liste vide. */
export function pistesLocales(texte: string): OccasionKey[] {
  const t = normaliser(texte);
  const out: OccasionKey[] = [];
  for (const i of INDICES) if (i.mots.test(t)) for (const o of i.pistes) if (!out.includes(o)) out.push(o);
  return out.slice(0, 3);
}
