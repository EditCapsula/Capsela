import { PAL_COULEURS } from "./palCouleurs";

/**
 * COLORIMÉTRIE ET PALETTE CAPSELA.
 *
 * Vivent ici : le type persisté, les quatre saisons, le questionnaire et le
 * calcul de la palette affichée. Ce que le moteur de tenues en fait est dans
 * colorimetrieMoteur.ts (30/09/2026).
 *
 * NOMMAGE EN FRANÇAIS, comme les quarante autres fichiers du dépôt. Le brief
 * proposait `colorPreferences` / `intensityPreference` / `colorimetry` ;
 * arbitré le 25/09/2026 de garder la langue du projet, qui n'a aucun
 * identifiant anglais ailleurs.
 *
 * LES PRÉFÉRENCES RESTENT EN HEX. `paletteHexes()` les passe telles quelles
 * au moteur (capsule.ts, styleCoverage.ts) ; les convertir en noms imposerait
 * une migration des profils et une conversion à chaque appel, pour perdre au
 * passage la distinction entre « Blanc » et « Blanc / écru » que le hex porte
 * sans ambiguïté.
 */

/** Ce que l'analyse rend, ou l'absence d'analyse. Persisté en jsonb. */
export interface Colorimetrie {
  statut: "aucune" | "encours" | "faite" | "erreur";
  /** Clé stable, jamais affichée — ex. "automne_chaud". */
  saison?: string;
  /** Libellé affiché — ex. « Automne chaud ». */
  libelle?: string;
  /** Hex de PAL_COULEURS. */
  signature?: string[];
  neutres?: string[];
  /**
   * « Plutôt loin du visage ». JAMAIS « interdit », jamais « à éviter » :
   * l'écran de résultat le dit avec ces mots-là, et le moteur n'en retire
   * aucune couleur.
   */
  moderation?: string[];
  /** 0..1, absent si le service ne le rend pas — le badge dépend de sa présence. */
  confiance?: number;
  analyseeLe?: string;
  /**
   * D'où vient le résultat. Seul le questionnaire l'écrit depuis le
   * 30/09/2026 (analyse photo abandonnée « pour le moment ») ; "camera" et
   * "galerie" restent lisibles pour les profils écrits par la démo d'avant.
   */
  source?: "camera" | "galerie" | "questionnaire";
  /**
   * Les réponses au questionnaire, par identifiant de question (30/09/2026) :
   * « Pourquoi cette palette ? » les relit, même en revenant plus tard sur
   * l'étape. Jsonb libre — aucune migration (la contrainte de 0034 ne porte
   * que sur `statut`). Absentes d'un profil plus ancien : la section ne
   * s'affiche pas plutôt que d'inventer une explication.
   */
  reponses?: Record<string, number>;
}

export const COLORIMETRIE_VIDE: Colorimetrie = { statut: "aucune" };

/** Une analyse exploitable : faite, avec au moins une couleur signature. */
export function colorimetrieUtilisable(c: Colorimetrie | null | undefined): boolean {
  return !!c && c.statut === "faite" && !!c.signature?.length;
}

/** Nombre maximal de couleurs dans la palette Capsela, et de neutres dedans. */
export const PALETTE_CAPSELA_MAX = 8;
export const PALETTE_CAPSELA_NEUTRES = 2;

/**
 * LA PALETTE CAPSELA — calculée à la volée, JAMAIS stockée.
 *
 * L'ordre est celui du brief, et chaque rang dit quelque chose :
 *
 *   1. les signatures QUI SONT AUSSI des préférences — ce qu'elle aime et qui
 *      la met en valeur, l'intersection est ce qu'on veut montrer d'abord ;
 *   2. les autres préférences, hors « avec modération » ;
 *   3. les autres signatures ;
 *   4. jusqu'à deux neutres, pour que la palette soit portable.
 *
 * Ce calcul ne sert qu'à l'affichage. Le moteur, lui, lit la colorimétrie
 * par colorimetrieMoteur.ts (30/09/2026, demandé : « on doit tenir compte de
 * la colorimétrie dans les recommandations de tenues ») : il éloigne du
 * visage les couleurs « avec modération » sans jamais les retirer des
 * tenues — elles restent possibles en bas, en chaussures, en sac.
 *
 * Sans colorimétrie, la palette EST la liste des préférences. C'est le cas
 * « passer l'analyse », et il doit rendre quelque chose de juste, pas un vide.
 */
export function paletteCapsela(preferences: string[], colorimetrie?: Colorimetrie | null): string[] {
  const prefs = preferences.filter(Boolean);
  if (!colorimetrieUtilisable(colorimetrie)) return prefs.slice(0, PALETTE_CAPSELA_MAX);

  const signature = colorimetrie!.signature ?? [];
  const neutres = colorimetrie!.neutres ?? [];
  const moderation = new Set(colorimetrie!.moderation ?? []);
  const ensemblePrefs = new Set(prefs);

  const out: string[] = [];
  const ajouter = (hex: string) => {
    if (out.length >= PALETTE_CAPSELA_MAX) return;
    if (!out.includes(hex)) out.push(hex);
  };

  for (const h of signature) if (ensemblePrefs.has(h)) ajouter(h);
  for (const h of prefs) if (!signature.includes(h) && !moderation.has(h)) ajouter(h);
  for (const h of signature) ajouter(h);

  let poses = 0;
  for (const h of neutres) {
    if (poses >= PALETTE_CAPSELA_NEUTRES) break;
    if (out.includes(h)) continue;
    const avant = out.length;
    ajouter(h);
    if (out.length > avant) poses++;
  }
  return out;
}

/**
 * Hex de PAL_COULEURS, pour valider ce que rend un service externe.
 *
 * Lue au chargement sans risque : `palCouleurs.ts` est un module feuille,
 * sans aucun import. Le cycle qui existait avec `profile.ts` est rompu.
 */
const HEX_CONNUS = new Set(PAL_COULEURS.map(([, x]) => x));

/**
 * Lecture d'une réponse d'analyse — PURE, donc testée.
 *
 * On ne fait jamais confiance à la sortie : toute couleur hors de
 * PAL_COULEURS est écartée plutôt que transmise, même motif que `sanitize()`
 * dans la fonction Edge `analyze-dressing-photo`. Une teinte inventée par un
 * modèle ne doit pas apparaître dans une palette présentée comme la sienne.
 */
export function lireColorimetrie(data: unknown, source: Colorimetrie["source"]): Colorimetrie {
  const o = (data ?? {}) as Record<string, unknown>;
  const hexes = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && HEX_CONNUS.has(x)) : [];
  const signature = hexes(o.signature);
  if (!signature.length) return { statut: "erreur" };
  const c: Colorimetrie = {
    statut: "faite",
    signature,
    neutres: hexes(o.neutres),
    analyseeLe: new Date().toISOString(),
    source,
  };
  if (typeof o.saison === "string") c.saison = o.saison;
  if (typeof o.libelle === "string") c.libelle = o.libelle;
  const mod = hexes(o.moderation);
  // Absent plutôt que vide : l'écran n'affiche le groupe « Plutôt loin du
  // visage » QUE si le service l'a rendu. Un tableau vide afficherait un
  // titre sans contenu.
  if (mod.length) c.moderation = mod;
  if (typeof o.confiance === "number" && o.confiance >= 0 && o.confiance <= 1) c.confiance = o.confiance;
  return c;
}

/*
 * LES QUATRE SAISONS (30/09/2026, confirmé par la propriétaire : quatre
 * plutôt que douze — plus fiable par questionnaire, et plus lisible).
 *
 * Le questionnaire ne rend qu'une SAISON ; les couleurs viennent toujours
 * d'ici, et le moteur de tenues lit les mêmes.
 *
 * Toutes les teintes sont des hex de PAL_COULEURS (vérifié par les tests) :
 * les mêmes que l'étape « Tes couleurs », pour que la palette Capsela les
 * croise sans conversion. ARBITRAGE ÉDITORIAL : le choix des couleurs de
 * chaque saison, sur les vingt et une de la palette de l'app.
 */
export type SaisonCle = "printemps" | "ete" | "automne" | "hiver";
export const SAISONS_CLES: SaisonCle[] = ["printemps", "ete", "automne", "hiver"];

const hexDe = (nom: string): string => {
  const hex = PAL_COULEURS.find(([n]) => n === nom)?.[1];
  if (!hex) throw new Error(`Teinte absente de PAL_COULEURS : ${nom}`);
  return hex;
};

export interface Saison {
  libelle: string;
  /** La phrase sous le titre du résultat (brief du 30/09/2026). */
  description: string;
  /** « Résultat : une palette … » — dit ce que les deux axes ont donné, rien de plus. */
  nature: string;
  signature: string[];
  neutres: string[];
  moderation: string[];
  /**
   * Visuel éditorial du résultat — UN PAR SAISON, jamais partagé : une
   * palette de printemps (corail, moutarde) affichée pour un Hiver contrasté
   * montrerait des couleurs que le résultat place justement loin du visage.
   * Les quatre ont été fournis le 30/09/2026 et relus couleur par couleur :
   * aucun ne montre les teintes « avec modération » de sa saison. Facultatif
   * dans le type : une saison sans visuel s'afficherait sans, plutôt qu'avec
   * celui d'une autre.
   */
  visuel?: string;
}

export const SAISONS: Record<SaisonCle, Saison> = {
  printemps: {
    libelle: "Printemps lumineux",
    description: "Des couleurs chaudes et claires qui illuminent naturellement ton teint.",
    nature: "chaude et lumineuse",
    signature: ["Corail", "Camel", "Moutarde", "Rose poudré"].map(hexDe),
    neutres: ["Crème", "Sable", "Beige", "Blanc / écru"].map(hexDe),
    moderation: ["Noir", "Prune", "Gris"].map(hexDe),
    visuel: "/onboarding/colorimetrie/palette-printemps.webp",
  },
  ete: {
    libelle: "Été doux",
    description: "Des couleurs fraîches et adoucies qui subliment ton teint tout en nuances.",
    nature: "fraîche et douce",
    signature: ["Rose poudré", "Bleu", "Prune", "Marine"].map(hexDe),
    neutres: ["Blanc", "Gris", "Taupe"].map(hexDe),
    moderation: ["Moutarde", "Corail", "Noir"].map(hexDe),
    visuel: "/onboarding/colorimetrie/palette-ete.webp",
  },
  automne: {
    libelle: "Automne chaleureux",
    description: "Des couleurs chaudes et profondes qui réchauffent naturellement ton teint.",
    nature: "chaude et profonde",
    signature: ["Terracotta", "Camel", "Moutarde", "Kaki", "Bordeaux"].map(hexDe),
    neutres: ["Chocolat", "Crème", "Taupe", "Beige"].map(hexDe),
    moderation: ["Noir", "Gris", "Rose poudré"].map(hexDe),
    visuel: "/onboarding/colorimetrie/palette-automne.webp",
  },
  hiver: {
    libelle: "Hiver contrasté",
    description: "Des couleurs froides et franches qui révèlent l'éclat de ton teint.",
    nature: "froide et contrastée",
    signature: ["Rouge", "Bordeaux", "Prune", "Vert bouteille", "Marine"].map(hexDe),
    neutres: ["Noir", "Blanc", "Gris"].map(hexDe),
    moderation: ["Camel", "Moutarde", "Beige"].map(hexDe),
    visuel: "/onboarding/colorimetrie/palette-hiver.webp",
  },
};

export const estSaison = (v: unknown): v is SaisonCle => typeof v === "string" && (SAISONS_CLES as string[]).includes(v);

/** Le résultat d'une saison, avec les réponses qui l'ont donnée quand elles existent. */
export function colorimetrieDeSaison(
  saison: SaisonCle,
  source: NonNullable<Colorimetrie["source"]>,
  reponses?: Record<string, number>
): Colorimetrie {
  const s = SAISONS[saison];
  const c = lireColorimetrie({ saison, libelle: s.libelle, signature: s.signature, neutres: s.neutres, moderation: s.moderation }, source);
  if (reponses && Object.keys(reponses).length) c.reponses = { ...reponses };
  return c;
}

/*
 * LE QUESTIONNAIRE (30/09/2026, seule voie retenue : « on va partir sur le
 * questionnaire plutôt, pas d'analyse photo pour le moment »). Quatre
 * questions sur des traits DÉCLARÉS — métal, blanc préféré, couleur de
 * cheveux d'origine, couleur des yeux. Aucune ne porte sur la couleur de
 * peau : la règle du projet reste entière.
 *
 * QUATRE ET NON PLUS CINQ (brief « Refonte UX/UI du parcours colorimétrie »,
 * 30/09/2026) : « Quelles couleurs te valent le plus de compliments ? » est
 * retirée, jugée trop subjective. Mesuré dans la même exécution sur toutes
 * les combinaisons de réponses : la répartition bouge à peine — « pas de
 * saison nette » 17,2 % → 18,8 %, chaque saison à moins de 1,5 point.
 *
 * Deux axes, comme dans la méthode des saisons : la CHALEUR (tons chauds
 * positifs, froids négatifs) et la PROFONDEUR (profond positif, clair
 * négatif). Chaud et clair : printemps ; froid et clair : été ; chaud et
 * profond : automne ; froid et profond : hiver. Une profondeur nulle compte
 * comme claire. Une chaleur nulle — trop de « Je ne sais pas » ou de « Les
 * deux » — ne tranche pas : aucune saison n'est inventée, l'écran le dit.
 *
 * `explication` : la phrase de « Pourquoi cette palette ? ». Elle dit ce que
 * la réponse apporte SUR LES DEUX AXES, et rien d'autre — une réponse qui ne
 * pèse pas le dit (« ce critère reste neutre »). Les tests vérifient que
 * chaque phrase « chaude » vient d'une réponse de chaleur positive, etc.
 *
 * `visuel` : la vignette de la réponse (public/onboarding/colorimetrie,
 * découpée dans les visuels du 30/09/2026) ; null pour « Je ne sais pas »,
 * qui n'a pas d'image honnête et reçoit une vignette neutre.
 *
 * ARBITRAGE ÉDITORIAL : les points de chaque réponse, instruits réponse par
 * réponse, à revoir sur des profils réels.
 */
export interface ReponseQuestion {
  libelle: string;
  chaleur: number;
  profondeur: number;
  explication: string;
  visuel: string | null;
}
export interface QuestionColorimetrie {
  id: string;
  question: string;
  /** Titre de la ligne dans « Pourquoi cette palette ? ». */
  titreExplication: string;
  /** Ce que l'écran d'analyse dit relire. */
  analyse: string;
  reponses: ReponseQuestion[];
}

const V = (nom: string) => `/onboarding/colorimetrie/${nom}.webp`;
const NEUTRE = "Sans préférence marquée, ce critère reste neutre.";
const NSP: ReponseQuestion = { libelle: "Je ne sais pas", chaleur: 0, profondeur: 0, explication: NEUTRE, visuel: null };

export const QUESTIONS_COLORIMETRIE: QuestionColorimetrie[] = [
  {
    id: "bijoux",
    question: "Quel métal te met le plus en valeur ?",
    titreExplication: "Tes bijoux",
    analyse: "Ton métal préféré",
    reponses: [
      { libelle: "Doré", chaleur: 2, profondeur: 0, explication: "Ton choix du doré suggère une harmonie plutôt chaude.", visuel: V("metal-dore") },
      { libelle: "Argenté", chaleur: -2, profondeur: 0, explication: "Ton choix de l'argenté suggère une harmonie plutôt froide.", visuel: V("metal-argente") },
      { libelle: "Les deux", chaleur: 0, profondeur: 0, explication: "Les deux te vont : ce critère reste neutre.", visuel: V("metal-les-deux") },
      NSP,
    ],
  },
  {
    id: "blanc",
    question: "Près du visage, quel blanc préfères-tu ?",
    titreExplication: "Ton blanc préféré",
    analyse: "Ton blanc près du visage",
    reponses: [
      { libelle: "Un blanc pur", chaleur: -1, profondeur: 0, explication: "Le blanc pur semble plus net près de ton visage : une nuance plutôt froide.", visuel: V("blanc-pur") },
      { libelle: "Un écru ou un crème", chaleur: 1, profondeur: 0, explication: "L'écru et le crème semblent plus doux près de ton visage : une nuance plutôt chaude.", visuel: V("blanc-ecru") },
      { libelle: "Les deux", chaleur: 0, profondeur: 0, explication: "Les deux te vont : ce critère reste neutre.", visuel: V("blanc-les-deux") },
      NSP,
    ],
  },
  {
    id: "cheveux",
    question: "Quelle est ta couleur de cheveux d'origine ?",
    titreExplication: "Tes cheveux",
    analyse: "Ta couleur naturelle de cheveux",
    reponses: [
      { libelle: "Blond clair ou cendré", chaleur: -1, profondeur: -1, explication: "Ta couleur naturelle apporte de la clarté et une nuance plutôt fraîche.", visuel: V("cheveux-blond-clair") },
      { libelle: "Blond doré, roux ou cuivré", chaleur: 2, profondeur: 0, explication: "Ta couleur naturelle apporte une chaleur marquée.", visuel: V("cheveux-blond-dore") },
      { libelle: "Châtain", chaleur: 0, profondeur: 1, explication: "Ta couleur naturelle apporte une profondeur intermédiaire.", visuel: V("cheveux-chatain") },
      { libelle: "Brun foncé ou noir", chaleur: 0, profondeur: 2, explication: "Ta couleur naturelle apporte une profondeur marquée.", visuel: V("cheveux-brun") },
    ],
  },
  {
    id: "yeux",
    question: "De quelle couleur sont tes yeux ?",
    titreExplication: "Tes yeux",
    analyse: "La couleur de tes yeux",
    reponses: [
      { libelle: "Bleus ou gris", chaleur: -1, profondeur: -1, explication: "Leur tonalité claire apporte une note fraîche.", visuel: V("yeux-bleus") },
      { libelle: "Verts ou noisette", chaleur: 1, profondeur: 0, explication: "Leur tonalité apporte une note chaude.", visuel: V("yeux-verts") },
      { libelle: "Marron", chaleur: 0, profondeur: 1, explication: "Leur tonalité ajoute de la profondeur.", visuel: V("yeux-marron") },
      { libelle: "Marron très foncé ou noirs", chaleur: 0, profondeur: 2, explication: "Leur tonalité renforce le contraste.", visuel: V("yeux-tres-fonces") },
    ],
  },
];

/** Les réponses (un indice par question, dans l'ordre) rangées par identifiant de question — ce que le profil garde. */
export function reponsesParQuestion(reponses: (number | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  QUESTIONS_COLORIMETRIE.forEach((q, i) => {
    const r = reponses[i];
    if (typeof r === "number" && q.reponses[r]) out[q.id] = r;
  });
  return out;
}

/** Le chemin inverse, pour reprendre un questionnaire déjà rempli. */
export function reponsesEnListe(reponses: Record<string, number> | undefined): (number | null)[] {
  return QUESTIONS_COLORIMETRIE.map((q) => {
    const r = reponses?.[q.id];
    return typeof r === "number" && q.reponses[r] ? r : null;
  });
}

/** « Pourquoi cette palette ? » : une ligne par réponse enregistrée, dans l'ordre des questions. Vide sans réponses. */
export function explicationsDesReponses(reponses: Record<string, number> | undefined): { titre: string; texte: string }[] {
  if (!reponses) return [];
  return QUESTIONS_COLORIMETRIE.flatMap((q) => {
    const r = q.reponses[reponses[q.id] ?? -1];
    return r ? [{ titre: q.titreExplication, texte: r.explication }] : [];
  });
}

/**
 * La saison des réponses (un indice de réponse par question, dans l'ordre de
 * QUESTIONS_COLORIMETRIE), ou null quand elles ne permettent pas de trancher
 * le chaud et le froid. Une réponse absente ou hors liste ne compte pas.
 */
export function saisonDuQuestionnaire(reponses: (number | null | undefined)[]): SaisonCle | null {
  let chaleur = 0;
  let profondeur = 0;
  QUESTIONS_COLORIMETRIE.forEach((q, i) => {
    const r = reponses[i];
    const choisie = typeof r === "number" ? q.reponses[r] : undefined;
    if (!choisie) return;
    chaleur += choisie.chaleur;
    profondeur += choisie.profondeur;
  });
  if (chaleur === 0) return null;
  if (chaleur > 0) return profondeur > 0 ? "automne" : "printemps";
  return profondeur > 0 ? "hiver" : "ete";
}
