import { PAL_COULEURS } from "./palCouleurs";

/**
 * COLORIMÉTRIE ET PALETTE CAPSELA.
 *
 * Trois choses vivent ici, et une seule touche la base : le type persisté,
 * le calcul de la palette affichée, et l'interface d'analyse.
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
  /** D'où vient le résultat : une photo (appareil ou galerie) ou le questionnaire (30/09/2026). */
  source?: "camera" | "galerie" | "questionnaire";
  /** Pourquoi une analyse photo n'a pas abouti, pour le dire à l'écran (jamais persisté comme résultat). */
  motif?: MotifPhoto;
}

/** Ce qui rend une photo inexploitable, tel que le service le rend (liste fermée). */
export type MotifPhoto = "lumiere" | "filtre" | "visage_non_visible" | "plusieurs_personnes" | "indetermine";

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
 * CE QUI EST EN « AVEC MODÉRATION » N'EST PAS RETIRÉ DU MOTEUR. Ce calcul ne
 * sert qu'à l'affichage : `paletteHexes(profile)` continue de rendre TOUTES
 * les préférences, y compris celles-là. Une couleur qu'elle a choisie ne
 * disparaît pas de ses tenues parce qu'une analyse la place loin du visage —
 * la nuance appartient à l'écran, pas à la sélection.
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
 * LES QUATRE SAISONS (30/09/2026, arbitré : quatre plutôt que douze — plus
 * fiable, surtout par questionnaire, et plus lisible).
 *
 * UNE SEULE TABLE POUR LES DEUX CHEMINS. Le questionnaire et l'analyse photo
 * ne rendent qu'une SAISON ; les couleurs viennent toujours d'ici. Un service
 * externe ne peut donc jamais inventer une couleur : il choisit parmi quatre
 * mots, et la palette présentée est celle que Capsela a composée.
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

export const SAISONS: Record<SaisonCle, { libelle: string; description: string; signature: string[]; neutres: string[]; moderation: string[] }> = {
  printemps: {
    libelle: "Printemps lumineux",
    description: "Des couleurs chaudes et claires, qui illuminent.",
    signature: ["Corail", "Camel", "Moutarde", "Rose poudré"].map(hexDe),
    neutres: ["Crème", "Sable", "Beige", "Blanc / écru"].map(hexDe),
    moderation: ["Noir", "Prune", "Gris"].map(hexDe),
  },
  ete: {
    libelle: "Été doux",
    description: "Des couleurs fraîches et adoucies, tout en nuances.",
    signature: ["Rose poudré", "Bleu", "Prune", "Marine"].map(hexDe),
    neutres: ["Blanc", "Gris", "Taupe"].map(hexDe),
    moderation: ["Moutarde", "Corail", "Noir"].map(hexDe),
  },
  automne: {
    libelle: "Automne chaleureux",
    description: "Des couleurs chaudes et profondes, riches et naturelles.",
    signature: ["Terracotta", "Camel", "Moutarde", "Kaki", "Bordeaux"].map(hexDe),
    neutres: ["Chocolat", "Crème", "Taupe", "Beige"].map(hexDe),
    moderation: ["Noir", "Gris", "Rose poudré"].map(hexDe),
  },
  hiver: {
    libelle: "Hiver contrasté",
    description: "Des couleurs froides et franches, en contraste.",
    signature: ["Rouge", "Bordeaux", "Prune", "Vert bouteille", "Marine"].map(hexDe),
    neutres: ["Noir", "Blanc", "Gris"].map(hexDe),
    moderation: ["Camel", "Moutarde", "Beige"].map(hexDe),
  },
};

export const estSaison = (v: unknown): v is SaisonCle => typeof v === "string" && (SAISONS_CLES as string[]).includes(v);

/** Le résultat d'une saison, quelle que soit la façon dont elle a été trouvée. */
export function colorimetrieDeSaison(saison: SaisonCle, source: NonNullable<Colorimetrie["source"]>): Colorimetrie {
  const s = SAISONS[saison];
  return lireColorimetrie({ saison, libelle: s.libelle, signature: s.signature, neutres: s.neutres, moderation: s.moderation }, source);
}

/*
 * LE QUESTIONNAIRE (30/09/2026, demandé : la photo ET une alternative sans
 * photo). Cinq questions sur des traits DÉCLARÉS — bijoux, blanc préféré,
 * couleur de cheveux d'origine, couleur des yeux, couleurs complimentées.
 * Aucune question ne porte sur la couleur de peau : la règle du projet
 * reste entière pour ce chemin.
 *
 * Deux axes, comme dans la méthode des saisons : la CHALEUR (tons chauds
 * positifs, froids négatifs) et la PROFONDEUR (profond positif, clair
 * négatif). Chaud et clair : printemps ; froid et clair : été ; chaud et
 * profond : automne ; froid et profond : hiver. Une profondeur nulle compte
 * comme claire. Une chaleur nulle — trop de « Je ne sais pas » ou de « Les
 * deux » — ne tranche pas : aucune saison n'est inventée, l'écran le dit.
 *
 * ARBITRAGE ÉDITORIAL : les points de chaque réponse, instruits réponse par
 * réponse, à revoir sur des profils réels.
 */
export interface ReponseQuestion {
  libelle: string;
  chaleur: number;
  profondeur: number;
}
export interface QuestionColorimetrie {
  id: string;
  question: string;
  reponses: ReponseQuestion[];
}

const NSP: ReponseQuestion = { libelle: "Je ne sais pas", chaleur: 0, profondeur: 0 };

export const QUESTIONS_COLORIMETRIE: QuestionColorimetrie[] = [
  {
    id: "bijoux",
    question: "Quels bijoux te mettent le plus en valeur ?",
    reponses: [
      { libelle: "Dorés", chaleur: 2, profondeur: 0 },
      { libelle: "Argentés", chaleur: -2, profondeur: 0 },
      { libelle: "Les deux", chaleur: 0, profondeur: 0 },
      NSP,
    ],
  },
  {
    id: "blanc",
    question: "Près du visage, quel blanc préfères-tu ?",
    reponses: [
      { libelle: "Un blanc pur", chaleur: -1, profondeur: 0 },
      { libelle: "Un écru ou un crème", chaleur: 1, profondeur: 0 },
      { libelle: "Les deux", chaleur: 0, profondeur: 0 },
      NSP,
    ],
  },
  {
    id: "cheveux",
    question: "Quelle est ta couleur de cheveux d'origine ?",
    reponses: [
      { libelle: "Blond clair ou cendré", chaleur: -1, profondeur: -1 },
      { libelle: "Blond doré, roux ou cuivré", chaleur: 2, profondeur: 0 },
      { libelle: "Châtain", chaleur: 0, profondeur: 1 },
      { libelle: "Brun foncé ou noir", chaleur: 0, profondeur: 2 },
    ],
  },
  {
    id: "yeux",
    question: "De quelle couleur sont tes yeux ?",
    reponses: [
      { libelle: "Bleus ou gris", chaleur: -1, profondeur: -1 },
      { libelle: "Verts ou noisette", chaleur: 1, profondeur: 0 },
      { libelle: "Marron", chaleur: 0, profondeur: 1 },
      { libelle: "Marron très foncé ou noirs", chaleur: 0, profondeur: 2 },
    ],
  },
  {
    id: "compliments",
    question: "Quelles couleurs te valent le plus de compliments ?",
    reponses: [
      { libelle: "Des pastels frais", chaleur: -1, profondeur: -1 },
      { libelle: "Des tons chauds et lumineux, corail ou pêche", chaleur: 1, profondeur: -1 },
      { libelle: "Des tons terreux, moutarde, kaki ou rouille", chaleur: 1, profondeur: 1 },
      { libelle: "Des couleurs franches, le noir et le blanc", chaleur: -1, profondeur: 1 },
      NSP,
    ],
  },
];

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

/*
 * L'ANALYSE PHOTO (30/09/2026). Le service existe désormais (fonction Edge
 * `analyser-colorimetrie`, cf. colorimetrieClient.ts), mais il ne s'ouvre
 * qu'une fois la revue juridique faite : une photo de visage, envoyée à un
 * prestataire hors UE, dont la carnation peut révéler une donnée sensible
 * (RGPD, article 9). D'où un interrupteur explicite, NEXT_PUBLIC_COLORIMETRIE_PHOTO=1,
 * à poser dans Vercel le jour où c'est validé. Sans lui, l'étape ne propose
 * que le questionnaire — jamais un bouton photo qui n'analyserait rien.
 *
 * Le mock reste possible derrière NEXT_PUBLIC_COLORIMETRIE_MOCK=1, et l'écran
 * affiche alors « Résultat de démonstration ». Jamais de faux résultat silencieux.
 */
export function colorimetrieMockActive(): boolean {
  return process.env.NEXT_PUBLIC_COLORIMETRIE_MOCK === "1";
}

/** L'analyse photo est-elle proposée ? */
export function colorimetrieDisponible(): boolean {
  return colorimetrieMockActive() || process.env.NEXT_PUBLIC_COLORIMETRIE_PHOTO === "1";
}
