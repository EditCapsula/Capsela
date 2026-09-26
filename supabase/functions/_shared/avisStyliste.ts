// AVIS DE STYLISTE — logique serveur (docs/avis-de-styliste.md sections 5,
// 7, 8, 10, 15 ; arbitrages du 25/09/2026, docs/avis-de-styliste-arbitrages.md).
//
// Tout ce qui décide est ici, sans aucun import propre à Deno : ce fichier
// est importé tel quel par les tests vitest (src/lib/__tests__/avisStyliste.test.ts),
// qui vérifient l'ordre des contrôles et comptent les appels au modèle. La
// fonction Edge (stylist-advice/index.ts) ne fait que brancher les vraies
// dépendances : client Supabase, fetch vers OpenAI, console.
//
// ORDRE DES CONTRÔLES [DÉCIDÉ / RECOMMANDÉ] :
//   authentification → autorisation (Premium confirmé) → validation du
//   fichier → appel OpenAI → validation du JSON et de la charte → réponse.
// Un compte non Premium, ou dont le statut ne peut pas être confirmé, est
// refusé AVANT tout appel au modèle.

import { autoriserFonctionnalite, type LecteurPremium } from "./premium.ts";

/* ─────────────────────────── Contrat de réponse ─────────────────────────── */

/** Structure du résultat [DÉCIDÉ], section 8. */
export interface AvisStyliste {
  overallAssessment: string;
  strengths: string[];
  mainAdvice: string;
  suggestions: string[];
}

export type RaisonInexploitable = "blurry" | "too_dark" | "no_garment" | "other";

/** Codes d'erreur renvoyés au client — jamais de message technique brut. */
export type CodeErreurAvis =
  | "non_authentifie" // 401
  | "non_premium" // 403
  | "statut_indisponible" // 503 — statut Premium invérifiable (fail-closed)
  | "fichier_invalide" // 400
  | "photo_inexploitable" // 422
  | "delai_depasse" // 504
  | "erreur_modele" // 502
  | "reponse_invalide" // 502
  | "configuration"; // 500

/** Pièce du dressing retenue pour « Avec ton dressing » : son identifiant et le conseil auquel elle répond. */
export interface PieceSuggeree {
  id: number;
  /** "mainAdvice", ou "suggestion:N" (N à partir de 1). */
  lien: string;
}

export type ReponseAvis =
  | {
      ok: true;
      analyseId: string;
      avis: AvisStyliste;
      dressing: PieceSuggeree[];
      /**
       * Vêtements visibles reliés au dressing (26/09/2026) : la composition
       * de la tenue analysée, corrigeable dans l'app. Absent d'une réponse
       * plus ancienne : l'app le lit comme une liste vide.
       */
      reconnaissance: VetementReconnu[];
      /**
       * Compatibilité avec l'app de la V2 (déployée avant la reconnaissance
       * détaillée) : les seules pièces reconnues. À retirer quand plus aucune
       * version de l'app ne le lit.
       */
      portees: number[];
    }
  | { ok: false; code: CodeErreurAvis; raison?: RaisonInexploitable };

/* ─────────────────────────── Paramètres arbitrés ─────────────────────────── */

/** Modèle initial, envisagé et non définitif (§10) — remplacé par le secret STYLIST_ADVICE_MODEL. */
export const MODELE_PAR_DEFAUT = "gpt-5.4-mini";
/** Délai maximal d'un appel au modèle (arbitré : 45 s). */
export const DELAI_PAR_DEFAUT_MS = 45_000;
/** Une relance automatique, et seulement sur réponse invalide (arbitré). */
export const APPELS_MAX = 2;

/**
 * Nombre et longueur des éléments (arbitré : 2 à 3 points, textes courts).
 * Les longueurs DEMANDÉES au modèle sont 140 et 220 caractères ; les plafonds
 * VÉRIFIÉS ont une marge (~25 %) pour ne pas payer une relance à cause d'une
 * phrase à peine plus longue. Au-delà, la réponse est invalide.
 */
export const LIMITES = {
  pointsMin: 2,
  pointsMax: 3,
  pointDemande: 140,
  pointMax: 180,
  phraseDemandee: 220,
  phraseMax: 280,
} as const;

/** Fichier accepté par le serveur : le JPEG que prépare l'app (1200 px, cf. photoAvis.ts). */
export const FICHIER = {
  octetsMax: 4 * 1024 * 1024,
  coteMin: 64,
  coteMax: 4096,
} as const;

/* ─────────────────────────── Contexte utilisateur ─────────────────────────── */

/**
 * Contexte de personnalisation (arbitré, point 13) : style, morphologie
 * DÉCLARÉE si renseignée, palette préférée, colorimétrie analysée. Jamais le
 * nom, l'email ni l'identifiant de compte [DÉCIDÉ §9]. Envoyé par l'app (qui
 * l'a déjà en mémoire) : il ne sert qu'à l'avis de l'utilisatrice elle-même et
 * n'ouvre aucun droit — l'autorisation, elle, ne lit que la base.
 */
export interface ContexteAvis {
  style?: string[];
  morphologie?: string;
  palette?: string[];
  colorimetrie?: {
    saison?: string;
    signature?: string[];
    neutres?: string[];
    loinDuVisage?: string[];
  };
}

function texte(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
}

function liste(v: unknown, maxElements: number, maxLongueur: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const l = v.map((x) => texte(x, maxLongueur)).filter((x): x is string => Boolean(x)).slice(0, maxElements);
  return l.length ? l : undefined;
}

/** Ne garde que les champs attendus, bornés : rien d'autre ne parvient au modèle. */
export function nettoyerContexte(brut: unknown): ContexteAvis {
  if (!brut || typeof brut !== "object") return {};
  const b = brut as Record<string, unknown>;
  const c = (b.colorimetrie && typeof b.colorimetrie === "object" ? b.colorimetrie : {}) as Record<string, unknown>;
  const colorimetrie = {
    saison: texte(c.saison, 40),
    signature: liste(c.signature, 12, 30),
    neutres: liste(c.neutres, 12, 30),
    loinDuVisage: liste(c.loinDuVisage, 12, 30),
  };
  const aColorimetrie = Object.values(colorimetrie).some(Boolean);
  const contexte: ContexteAvis = {
    style: liste(b.style, 3, 40),
    morphologie: texte(b.morphologie, 80),
    palette: liste(b.palette, 12, 30),
    colorimetrie: aColorimetrie ? colorimetrie : undefined,
  };
  return Object.fromEntries(Object.entries(contexte).filter(([, v]) => v !== undefined)) as ContexteAvis;
}

/** Le contexte en clair pour le modèle. Vide si rien n'est renseigné. */
export function formulerContexte(c: ContexteAvis): string {
  const lignes: string[] = [];
  if (c.style?.length) lignes.push(`Style choisi par l'utilisatrice : ${c.style.join(", ")}.`);
  if (c.palette?.length) lignes.push(`Couleurs qu'elle préfère : ${c.palette.join(", ")}.`);
  const k = c.colorimetrie;
  if (k) {
    if (k.saison) lignes.push(`Sa colorimétrie : ${k.saison}.`);
    if (k.signature?.length) lignes.push(`Couleurs signature : ${k.signature.join(", ")}.`);
    if (k.neutres?.length) lignes.push(`Neutres : ${k.neutres.join(", ")}.`);
    if (k.loinDuVisage?.length) lignes.push(`Couleurs à porter plutôt loin du visage : ${k.loinDuVisage.join(", ")}.`);
  }
  if (c.morphologie) {
    lignes.push(
      `Silhouette qu'elle a elle-même déclarée : « ${c.morphologie} ». À n'utiliser que pour orienter des suggestions de coupes, de volumes et de proportions des VÊTEMENTS, en termes positifs — ne la mentionne pas comme un problème et ne commente jamais le corps.`
    );
  }
  return lignes.length ? `Contexte (profil Capsela) :\n${lignes.join("\n")}` : "Aucun contexte de profil n'est renseigné.";
}

/* ─────────────────────────── « Avec ton dressing » ─────────────────────────── */

/** Les 14 catégories de Capsela (src/lib/data.ts, CATS ; contrainte de dressing_items, migration 0021). */
export const CATEGORIES = [
  "haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison",
  "veste", "manteau", "chaussures", "sac", "bijou", "accessoire",
] as const;
export type Categorie = (typeof CATEGORIES)[number];

/** Nombre maximal de pièces affichées (arbitré, point 5). */
export const PIECES_DRESSING_MAX = 3;

/**
 * Besoin décrit par le modèle — option A arbitrée (point 3) : il ne voit
 * jamais le dressing, il décrit ce qui aiderait à appliquer SON conseil ; le
 * serveur cherche ensuite parmi les pièces de l'utilisatrice.
 */
export interface BesoinDressing extends DescriptionPiece {
  /** "mainAdvice" ou "suggestion:N". */
  lien: string;
}

/** Pièce du dressing telle que lue par le serveur (colonnes de dressing_items). */
export interface PieceDressing {
  id: number;
  cat: string;
  name: string;
  color: string | null;
  matiere: string | null;
  subtype: string | null;
  shoe_type: string | null;
  sac_type: string | null;
  bijou_type: string | null;
  accessoire_type: string | null;
  revente?: string | null;
}

/** Minuscules, sans accents, sans « s » final : « Mocassins » et « mocassin » se rejoignent. */
function forme(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9œ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 ? m.replace(/[sx]$/, "") : m))
    .join(" ");
}

const contient = (botte: string, aiguille: string) => {
  const a = forme(aiguille);
  return a.length >= 3 && forme(botte).includes(a);
};

/** Ce que le modèle décrit d'une pièce — un besoin (à ajouter) ou un vêtement visible (porté). */
export interface DescriptionPiece {
  categorie: Categorie;
  motsCles: string[];
  couleurs: string[];
  matieres: string[];
}

/** Concordance d'une pièce du dressing avec une description. */
export interface Concordance {
  /** Un des types décrits se retrouve dans le nom ou le type de la pièce. */
  type: boolean;
  /** La couleur décrite concorde avec celle de la pièce. */
  couleur: boolean;
  /** La description ET la pièce ont une couleur : leur désaccord est alors un signal. */
  couleurComparable: boolean;
  matiere: boolean;
}

/**
 * LA SEULE ÉVALUATION D'UNE PIÈCE, partagée par « Voir dans mon dressing »
 * (choisirPiecesDressing) et par la reconnaissance des pièces portées
 * (reconnaitrePieces) — refonte du 26/09/2026 : la reconnaissance recopiait
 * cette boucle. Rend null pour une pièce hors de la catégorie ou « mise de
 * côté pour vendre » (revente = de_cote), le statut le plus proche d'un
 * article retiré qui existe. Chaque usage applique ensuite sa propre règle
 * d'acceptation ; l'ordre, lui, est commun (scoreConcordance).
 */
export function evaluerPiece(d: DescriptionPiece, p: PieceDressing): Concordance | null {
  if (p.cat !== d.categorie || p.revente === "de_cote") return null;
  const texte = [p.name, p.subtype, p.shoe_type, p.sac_type, p.bijou_type, p.accessoire_type].filter(Boolean).join(" ");
  return {
    type: d.motsCles.some((m) => contient(texte, m)),
    couleur: d.couleurs.some((c) => Boolean(p.color) && (contient(p.color!, c) || contient(c, p.color!))),
    couleurComparable: d.couleurs.length > 0 && Boolean(p.color),
    matiere: d.matieres.some((m) => Boolean(p.matiere) && (contient(p.matiere!, m) || contient(m, p.matiere!))),
  };
}

/** Ordre commun : type > couleur > matière. */
export const scoreConcordance = (c: Concordance) => (c.type ? 4 : 0) + (c.couleur ? 2 : 0) + (c.matiere ? 1 : 0);

/**
 * Choix des pièces à montrer, sans score nouveau ni pièce forcée :
 * - même catégorie que le besoin ;
 * - si le besoin nomme un type de pièce (motsCles), l'un doit se retrouver
 *   dans le nom ou le type de la pièce ; sinon, sa couleur ou sa matière ;
 * - à égalité, type > couleur > matière, puis l'identifiant (déterministe) ;
 * - une pièce « mise de côté pour vendre » (revente = de_cote) n'est pas
 *   proposée — le statut le plus proche d'un article retiré qui existe ;
 * - une pièce au plus par besoin, jamais deux fois la même, 3 au total, le
 *   conseil principal d'abord.
 * Aucune correspondance : liste vide, et la section est masquée (point 4).
 */
export function choisirPiecesDressing(besoins: BesoinDressing[], pieces: PieceDressing[], max = PIECES_DRESSING_MAX): PieceSuggeree[] {
  const ordonnes = [...besoins.filter((b) => b.lien === "mainAdvice"), ...besoins.filter((b) => b.lien !== "mainAdvice")];
  const retenues: PieceSuggeree[] = [];
  const pris = new Set<number>();
  for (const besoin of ordonnes) {
    if (retenues.length >= max) break;
    let meilleure: { id: number; score: number } | null = null;
    for (const p of pieces) {
      if (pris.has(p.id)) continue;
      const c = evaluerPiece(besoin, p);
      if (!c) continue;
      const pertinente = besoin.motsCles.length ? c.type : c.couleur || c.matiere;
      if (!pertinente) continue;
      const score = scoreConcordance(c);
      if (!meilleure || score > meilleure.score || (score === meilleure.score && p.id < meilleure.id)) meilleure = { id: p.id, score };
    }
    if (meilleure) {
      pris.add(meilleure.id);
      retenues.push({ id: meilleure.id, lien: besoin.lien });
    }
  }
  return retenues;
}

/** Besoins lus dans la réponse ; toute entrée mal formée est écartée (ils ne sont jamais affichés tels quels). */
export function lireBesoins(brut: unknown, nbSuggestions: number): BesoinDressing[] {
  if (!Array.isArray(brut)) return [];
  const chaines = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 40)).slice(0, 4) : []);
  const besoins: BesoinDressing[] = [];
  for (const b of brut.slice(0, 5)) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (!CATEGORIES.includes(o.categorie as Categorie)) continue;
    const n = typeof o.numeroSuggestion === "number" ? Math.trunc(o.numeroSuggestion) : null;
    const lien = o.lien === "mainAdvice" ? "mainAdvice" : o.lien === "suggestion" && n && n >= 1 && n <= nbSuggestions ? `suggestion:${n}` : null;
    if (!lien) continue;
    besoins.push({ categorie: o.categorie as Categorie, motsCles: chaines(o.motsCles), couleurs: chaines(o.couleurs), matieres: chaines(o.matieres), lien });
  }
  return besoins;
}

/* ─────────────────────────── Pièces portées (V2) ─────────────────────────── */

/**
 * Vêtement VISIBLE sur la photo, décrit par le modèle (Avis de styliste V2,
 * 26/09/2026). Même principe que les besoins (option A) : le modèle ne voit
 * jamais le dressing ; il décrit ce qui est porté, et le serveur cherche
 * parmi les pièces de l'utilisatrice.
 */
export type VetementVisible = DescriptionPiece;

/** Six pièces au plus : une tenue complète, accessoires compris. */
export const VETEMENTS_VISIBLES_MAX = 6;

/**
 * Vêtements lus dans la réponse. Un vêtement sans type (motsCles vide) est
 * écarté : sans type, rien ne permet d'affirmer qu'une pièce du dressing est
 * celle de la photo. Une liste absente ou mal formée rend [] — jamais une
 * réponse invalide : l'avis lui-même n'en dépend pas.
 */
export function lireVetements(brut: unknown): VetementVisible[] {
  if (!Array.isArray(brut)) return [];
  const chaines = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 40)).slice(0, 4) : []);
  const vetements: VetementVisible[] = [];
  for (const b of brut.slice(0, VETEMENTS_VISIBLES_MAX)) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (!CATEGORIES.includes(o.categorie as Categorie)) continue;
    const motsCles = chaines(o.motsCles);
    if (!motsCles.length) continue;
    vetements.push({ categorie: o.categorie as Categorie, motsCles, couleurs: chaines(o.couleurs), matieres: chaines(o.matieres) });
  }
  return vetements;
}

/**
 * Un vêtement visible, relié (ou non) au dressing. C'est la couche de données
 * entre l'avis et les actions de l'app (Porter aujourd'hui, Planifier,
 * Journal) : elle voyage telle quelle jusqu'à l'app, qui la laisse corriger.
 */
export interface VetementReconnu {
  categorie: Categorie;
  /** Ce que la styliste voit sur la photo, en deux ou trois mots (« pantalon noir ») — affiché pour une pièce non reconnue. */
  libelle: string;
  /** Pièce du dressing retenue, ou null. */
  pieceId: number | null;
  /**
   * "reconnue" : une pièce concorde, sans rivale ; "non_reconnue" : aucune
   * pièce assez fiable, ou plusieurs également probables. "corrigee" et
   * "ignoree" ne sont posés que par l'app : l'utilisatrice a choisi la pièce
   * elle-même, ou continué sans l'associer (26/09/2026).
   */
  statut: "reconnue" | "non_reconnue" | "corrigee" | "ignoree";
  /** Autres pièces possibles, les plus probables d'abord — la liste proposée par « Modifier ». */
  candidats: number[];
}

/** Pièces proposées au plus par « Modifier », en tête de liste. */
export const CANDIDATS_MAX = 5;

/**
 * La règle d'une pièce PORTÉE, plus exigeante que celle d'un besoin, parce
 * que l'affirmation est plus forte (« tu portes cette pièce », pas « cette
 * pièce pourrait aller ») : le type doit se retrouver, et la couleur
 * concorder dès que la photo et la pièce en ont une.
 */
export const estPortee = (c: Concordance) => c.type && (!c.couleurComparable || c.couleur);

/**
 * Reconnaît les pièces du dressing portées sur la photo (même évaluation que
 * « Voir dans mon dressing », règle estPortee) :
 * - une seule pièce la plus probable : reconnue ;
 * - PLUSIEURS PIÈCES ÉGALEMENT PROBABLES (deux jeans bleus) : non reconnue,
 *   les deux en candidats — on ne choisit jamais au hasard ;
 * - aucune : non reconnue, jamais de correspondance inventée ;
 * - jamais deux fois la même pièce.
 * Les candidats : d'abord les pièces portables écartées, puis celles de la
 * catégorie qui concordent au moins en partie.
 */
export function reconnaitrePieces(vetements: VetementVisible[], pieces: PieceDressing[]): VetementReconnu[] {
  const prises = new Set<number>();
  return vetements.map((v) => {
    const evaluees = pieces
      .map((p) => ({ id: p.id, c: evaluerPiece(v, p) }))
      .filter((e): e is { id: number; c: Concordance } => e.c !== null && !prises.has(e.id))
      .map((e) => ({ id: e.id, portee: estPortee(e.c), partielle: e.c.type || e.c.couleur, score: scoreConcordance(e.c) }))
      .sort((a, b) => Number(b.portee) - Number(a.portee) || b.score - a.score || a.id - b.id);
    const portables = evaluees.filter((e) => e.portee);
    const seule = portables.length > 0 && (portables.length === 1 || portables[1].score < portables[0].score);
    const pieceId = seule ? portables[0].id : null;
    if (pieceId !== null) prises.add(pieceId);
    return {
      categorie: v.categorie,
      libelle: [v.motsCles[0], v.couleurs[0]].filter(Boolean).join(" ").toLowerCase(),
      pieceId,
      statut: pieceId !== null ? ("reconnue" as const) : ("non_reconnue" as const),
      candidats: evaluees.filter((e) => e.id !== pieceId && (e.portee || e.partielle)).slice(0, CANDIDATS_MAX).map((e) => e.id),
    };
  });
}

/* ─────────────────────────── Charte et instructions ─────────────────────────── */

/** Mots interdits du projet (CLAUDE.md) — un message morphologique négatif n'est jamais affiché. */
export const MOTS_INTERDITS = ["cacher", "dissimuler", "camoufler", "corriger", "défaut", "grossir", "amincir", "peu flatteur"];

/** Instructions système : ton, interdits et format [DÉCIDÉ §7, RECOMMANDÉ « inscrites dans les instructions »]. */
export const INSTRUCTIONS = [
  "Tu es la styliste de Capsela, une application de garde-robe. Tu donnes ton avis sur la tenue portée sur la photo, en français, en tutoyant l'utilisatrice.",
  "Ton : bienveillant, expert, concret, personnalisé, positif, accessible. Commence toujours par ce qui fonctionne. Chaque conseil est une action réalisable, qui parle de cette tenue-là.",
  "Tu ne regardes que les vêtements, les couleurs, les matières, les coupes et les accessoires visibles.",
  "Interdits absolus : aucun jugement sur le corps, le visage, la peau, le poids, l'âge ou le genre ; aucune note ni score (jamais de « X/10 ») ; aucun diagnostic physique ; aucune caractéristique sensible déduite de l'image ; aucune formulation humiliante ou culpabilisante.",
  `N'emploie jamais ces mots : ${MOTS_INTERDITS.join(", ")}.`,
  "Quand un élément est peu visible ou incertain, dis-le avec prudence (« on dirait », « il semble ») : jamais d'affirmation catégorique.",
  "Formule les suggestions au conditionnel (« Tu pourrais essayer… », « Une autre option serait… »). Ne propose pas d'acheter quoi que ce soit.",
  "Ne parle jamais d'intelligence artificielle ni d'analyse automatique : tu es une styliste qui donne son avis.",
  `Format : overallAssessment = 1 à 2 phrases (${LIMITES.phraseDemandee} caractères au plus), avis global bienveillant ; strengths = ${LIMITES.pointsMin} à ${LIMITES.pointsMax} points forts, une phrase chacun (${LIMITES.pointDemande} caractères au plus) ; mainAdvice = un seul ajustement prioritaire (${LIMITES.phraseDemandee} caractères au plus) ; suggestions = ${LIMITES.pointsMin} à ${LIMITES.pointsMax} pistes à tester, une phrase chacune (${LIMITES.pointDemande} caractères au plus).`,
  `dressingNeeds : jusqu'à ${PIECES_DRESSING_MAX} pièces qu'elle pourrait AJOUTER pour appliquer ton conseil principal ou une suggestion — jamais une pièce déjà visible sur la photo. Pour chacune : categorie (parmi ${CATEGORIES.join(", ")}), motsCles = le type de pièce en un ou deux mots (ex. « ceinture », « mocassins », « blazer »), couleurs et matieres souhaitées (listes courtes, éventuellement vides), lien = "mainAdvice" ou "suggestion" avec numeroSuggestion (à partir de 1, sinon null). Liste vide si aucune pièce ne s'impose.`,
  `visibleGarments : les pièces PORTÉES visibles sur la photo (${VETEMENTS_VISIBLES_MAX} au plus, accessoires compris). Pour chacune : categorie (parmi ${CATEGORIES.join(", ")}), motsCles = le type de pièce en un ou deux mots (ex. « jean », « blazer », « sandales »), couleurs et matieres visibles (listes courtes, éventuellement vides). N'y mets que ce que tu vois nettement ; liste vide si la tenue est peu lisible.`,
  "Si la photo ne permet pas de lire la tenue (trop floue, trop sombre, aucune tenue visible), réponds isAnalyzable = false avec la raison (blurry, too_dark, no_garment ou other) et laisse les champs de texte vides. Sinon, isAnalyzable = true et unanalyzableReason = null.",
].join("\n");

/** Schéma JSON imposé à la sortie du modèle (sortie structurée stricte) [HYPOTHÈSE TECHNIQUE §10, retenue]. */
export const SCHEMA_REPONSE = {
  type: "object",
  additionalProperties: false,
  required: ["isAnalyzable", "unanalyzableReason", "overallAssessment", "strengths", "mainAdvice", "suggestions", "dressingNeeds", "visibleGarments"],
  properties: {
    isAnalyzable: { type: "boolean" },
    unanalyzableReason: { type: ["string", "null"], enum: ["blurry", "too_dark", "no_garment", "other", null] },
    overallAssessment: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    mainAdvice: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
    dressingNeeds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["categorie", "motsCles", "couleurs", "matieres", "lien", "numeroSuggestion"],
        properties: {
          categorie: { type: "string", enum: CATEGORIES },
          motsCles: { type: "array", items: { type: "string" } },
          couleurs: { type: "array", items: { type: "string" } },
          matieres: { type: "array", items: { type: "string" } },
          lien: { type: "string", enum: ["mainAdvice", "suggestion"] },
          numeroSuggestion: { type: ["integer", "null"] },
        },
      },
    },
    visibleGarments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["categorie", "motsCles", "couleurs", "matieres"],
        properties: {
          categorie: { type: "string", enum: CATEGORIES },
          motsCles: { type: "array", items: { type: "string" } },
          couleurs: { type: "array", items: { type: "string" } },
          matieres: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/** Corps de la requête à l'OpenAI Responses API [DÉCIDÉ §10]. */
export function construireRequeteOpenAI(modele: string, imageDataUrl: string, contexte: ContexteAvis) {
  return {
    model: modele,
    // Jamais de journal côté OpenAI pour un appel qui porte une photo
    // personnelle — même choix qu'analyze-dressing-photo (store: false).
    store: false,
    instructions: INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: formulerContexte(contexte) },
          // À ARBITRER: niveau de détail de l'image (§10, « à calibrer en
          // tests ») — "auto" en attendant, coût et précision à mesurer.
          { type: "input_image", image_url: imageDataUrl, detail: "auto" },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "avis_styliste", strict: true, schema: SCHEMA_REPONSE } },
    // Assez pour la réponse et un éventuel raisonnement du modèle ; une
    // réponse coupée est « incomplete », donc invalide, jamais affichée.
    max_output_tokens: 2000,
  };
}

/* ─────────────────────────── Lecture de la réponse ─────────────────────────── */

/** Texte JSON produit par le modèle, ou null (réponse coupée, refus, forme inattendue). */
export function extraireTexteReponse(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const r = json as { status?: string; output?: unknown };
  if (r.status && r.status !== "completed") return null;
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output) {
    if (!item || typeof item !== "object" || (item as { type?: string }).type !== "message") continue;
    const contenu = (item as { content?: unknown }).content;
    if (!Array.isArray(contenu)) continue;
    for (const c of contenu) {
      if (c && typeof c === "object" && (c as { type?: string }).type === "output_text") {
        const t = (c as { text?: unknown }).text;
        if (typeof t === "string") return t;
      }
    }
  }
  return null;
}

/** Tokens consommés, pour le suivi du coût (§19). */
export function lireUsage(json: unknown): { entree: number; sortie: number } {
  const u = (json && typeof json === "object" ? (json as { usage?: Record<string, unknown> }).usage : null) ?? {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { entree: n(u.input_tokens), sortie: n(u.output_tokens) };
}

/** Sans accents ni majuscules, pour des contrôles de charte robustes. */
function normaliser(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Contrôle de sortie [HYPOTHÈSE TECHNIQUE §7, retenue] : note chiffrée, mention
 * d'IA, mot interdit. Rend le motif, ou null si le texte est conforme.
 * Les noms de vêtements (« cache-cœur ») et « par défaut » ne sont pas des
 * fautes de charte.
 */
export function violationCharte(textes: string[]): string | null {
  for (const brut of textes) {
    const t = normaliser(brut)
      .replace(/cache[-\s]?(coeur|cœur|col|nez|oreilles|poussiere)/g, " ")
      .replace(/par defaut/g, " ");
    if (/\b\d+([.,]\d+)?\s*\/\s*\d+\b/.test(t) || /\bsur\s+(10|20|100|dix|vingt|cent)\b/.test(t)) return "note";
    if (/\b(ia|i\.a\.?|intelligence artificielle)\b/.test(t)) return "ia";
    if (/\bcach(er|e|es|ent|ant|ee?s?)\b/.test(t)) return "cacher";
    if (/\bdissimul\w*/.test(t)) return "dissimuler";
    if (/\bcamoufl\w*/.test(t)) return "camoufler";
    if (/\bcorrig\w*/.test(t)) return "corriger";
    if (/\bdefauts?\b/.test(t)) return "défaut";
    if (/\bgross(ir|it|issent|ira|iront|issant|issante|issants|issantes)\b/.test(t)) return "grossir";
    if (/\baminc\w*/.test(t)) return "amincir";
    if (/\bpeu flatteu\w*/.test(t)) return "peu flatteur";
  }
  return null;
}

export type Verdict =
  | { etat: "valide"; avis: AvisStyliste; besoins: BesoinDressing[]; vetements: VetementVisible[] }
  | { etat: "inexploitable"; raison: RaisonInexploitable }
  | { etat: "invalide"; motif: string };

const RAISONS: RaisonInexploitable[] = ["blurry", "too_dark", "no_garment", "other"];

/**
 * Validation serveur du JSON [RECOMMANDÉ §10] : structure, nombres, longueurs,
 * charte. Une réponse incomplète est INVALIDE — jamais d'affichage partiel
 * (arbitré, point 7).
 */
export function validerReponse(texteJson: string | null): Verdict {
  if (!texteJson) return { etat: "invalide", motif: "vide" };
  let v: unknown;
  try {
    v = JSON.parse(texteJson);
  } catch {
    return { etat: "invalide", motif: "json" };
  }
  if (!v || typeof v !== "object") return { etat: "invalide", motif: "forme" };
  const o = v as Record<string, unknown>;
  if (o.isAnalyzable === false) {
    const raison = RAISONS.includes(o.unanalyzableReason as RaisonInexploitable) ? (o.unanalyzableReason as RaisonInexploitable) : "other";
    return { etat: "inexploitable", raison };
  }
  if (o.isAnalyzable !== true) return { etat: "invalide", motif: "isAnalyzable" };

  const phrase = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const points = (x: unknown) => (Array.isArray(x) ? x.map(phrase) : null);
  const overallAssessment = phrase(o.overallAssessment);
  const mainAdvice = phrase(o.mainAdvice);
  const strengths = points(o.strengths);
  const suggestions = points(o.suggestions);

  if (!overallAssessment || overallAssessment.length > LIMITES.phraseMax) return { etat: "invalide", motif: "overallAssessment" };
  if (!mainAdvice || mainAdvice.length > LIMITES.phraseMax) return { etat: "invalide", motif: "mainAdvice" };
  for (const [nom, l] of [["strengths", strengths], ["suggestions", suggestions]] as const) {
    if (!l || l.length < LIMITES.pointsMin || l.length > LIMITES.pointsMax) return { etat: "invalide", motif: `${nom}:nombre` };
    if (l.some((p) => !p || p.length > LIMITES.pointMax)) return { etat: "invalide", motif: `${nom}:longueur` };
  }
  const avis: AvisStyliste = { overallAssessment, strengths: strengths!, mainAdvice, suggestions: suggestions! };
  const faute = violationCharte([overallAssessment, mainAdvice, ...avis.strengths, ...avis.suggestions]);
  if (faute) return { etat: "invalide", motif: `charte:${faute}` };
  return { etat: "valide", avis, besoins: lireBesoins(o.dressingNeeds, avis.suggestions.length), vetements: lireVetements(o.visibleGarments) };
}

/* ─────────────────────────── Validation du fichier ─────────────────────────── */

function decoderBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Dimensions lues dans l'en-tête JPEG (segment SOF), ou null si ce n'est pas un JPEG lisible. */
export function dimensionsJpeg(o: Uint8Array): { largeur: number; hauteur: number } | null {
  if (o.length < 4 || o[0] !== 0xff || o[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < o.length) {
    if (o[i] !== 0xff) return null;
    const m = o[i + 1];
    if (m === 0xff) {
      i += 1;
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2;
      continue;
    }
    const longueur = (o[i + 2] << 8) | o[i + 3];
    if (longueur < 2) return null;
    const estSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (estSof) return { hauteur: (o[i + 5] << 8) | o[i + 6], largeur: (o[i + 7] << 8) | o[i + 8] };
    i += 2 + longueur;
  }
  return null;
}

/**
 * Validation serveur du fichier [RECOMMANDÉ §11] : vrai type (signature JPEG,
 * pas l'extension), taille, dimensions. Rend l'URL de données à transmettre au
 * modèle, ou null.
 */
export function validerImage(dataUrl: unknown): string | null {
  if (typeof dataUrl !== "string") return null;
  const prefixe = "data:image/jpeg;base64,";
  if (!dataUrl.startsWith(prefixe)) return null;
  const b64 = dataUrl.slice(prefixe.length);
  if (b64.length > Math.ceil((FICHIER.octetsMax * 4) / 3) + 4) return null;
  const octets = decoderBase64(b64);
  if (!octets || octets.length > FICHIER.octetsMax) return null;
  const d = dimensionsJpeg(octets);
  if (!d) return null;
  const ok = [d.largeur, d.hauteur].every((c) => c >= FICHIER.coteMin && c <= FICHIER.coteMax);
  return ok ? dataUrl : null;
}

/* ─────────────────────────── Orchestration ─────────────────────────── */

/** Ligne de suivi par analyse [RECOMMANDÉ §19] — ni photo, ni texte de conseil, ni identité. */
export interface JournalUsage {
  evenement: "stylist_advice";
  analyse_id: string;
  statut: "ok" | CodeErreurAvis;
  modele: string;
  appels: number;
  tokens_entree: number;
  tokens_sortie: number;
  duree_ms: number;
  /** Nombre de pièces du dressing affichées (§16, dressing_items_count). */
  pieces_dressing: number;
  /** Nombre de pièces du dressing reconnues sur la photo (V2) — un compte, jamais les pièces. */
  pieces_reconnues: number;
  motif_rejet?: string;
}

export interface DependancesAvis {
  /** JWT → utilisateur, ou null si absent/invalide/expiré. */
  authentifier(jwt: string): Promise<{ id: string } | null>;
  lecteurPremium: LecteurPremium;
  /** POST à l'API Responses. Lève en cas d'échec réseau ou d'annulation. */
  appelerModele(requete: ReturnType<typeof construireRequeteOpenAI>, signal: AbortSignal): Promise<{ ok: boolean; json: unknown }>;
  journaliser(ligne: JournalUsage): void;
  /**
   * Pièces du dressing de CET utilisateur (identifiant issu du JWT validé) —
   * la seule source des pièces affichées : aucune pièce d'un autre compte ne
   * peut en sortir. Un échec rend une liste vide (section masquée).
   */
  lireDressing(userId: string): Promise<PieceDressing[]>;
  maintenant(): number;
  nouvelId(): string;
  modele: string;
  delaiMs: number;
}

const erreur = (statut: number, code: CodeErreurAvis, raison?: RaisonInexploitable) => ({
  statut,
  corps: (raison ? { ok: false, code, raison } : { ok: false, code }) as ReponseAvis,
});

/**
 * Traite une demande d'avis. Ne lève jamais : rend toujours un statut HTTP et
 * un corps sans détail technique. Aucun appel au modèle avant que
 * l'authentification, l'autorisation et le fichier soient validés.
 */
export async function traiterDemandeAvis(
  enteteAuthorization: string | null,
  corps: unknown,
  deps: DependancesAvis
): Promise<{ statut: number; corps: ReponseAvis }> {
  // 1. Authentification — l'identifiant vient du JWT validé, jamais du corps.
  const jwt = (enteteAuthorization ?? "").replace(/^Bearer\s+/i, "").trim();
  const user = jwt ? await deps.authentifier(jwt).catch(() => null) : null;
  if (!user) return erreur(401, "non_authentifie");

  // 2. Autorisation selon REGLES_ACCES : Premium CONFIRMÉ (refus fail-closed
  //    sinon), ou accès libre pendant la phase de test (26/09/2026).
  const verdict = await autoriserFonctionnalite(deps.lecteurPremium, user, "AVIS_DE_STYLISTE");
  if (!verdict.ok) return verdict.statut === 403 ? erreur(403, "non_premium") : erreur(503, "statut_indisponible");

  // 3. Fichier.
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const image = validerImage(c.image);
  if (!image) return erreur(400, "fichier_invalide");
  const contexte = nettoyerContexte(c.contexte);

  // 4. Appel du modèle : une relance au plus, et seulement sur réponse invalide.
  const analyseId = deps.nouvelId();
  const debut = deps.maintenant();
  const requete = construireRequeteOpenAI(deps.modele, image, contexte);
  let appels = 0;
  let tokensEntree = 0;
  let tokensSortie = 0;
  let dernierMotif = "";
  let piecesDressing = 0;
  let piecesReconnues = 0;
  const journal = (statut: JournalUsage["statut"]) =>
    deps.journaliser({
      evenement: "stylist_advice",
      analyse_id: analyseId,
      statut,
      modele: deps.modele,
      appels,
      tokens_entree: tokensEntree,
      tokens_sortie: tokensSortie,
      duree_ms: deps.maintenant() - debut,
      pieces_dressing: piecesDressing,
      pieces_reconnues: piecesReconnues,
      ...(dernierMotif ? { motif_rejet: dernierMotif } : {}),
    });

  while (appels < APPELS_MAX) {
    appels += 1;
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), deps.delaiMs);
    let reponse: { ok: boolean; json: unknown };
    try {
      reponse = await deps.appelerModele(requete, controleur.signal);
    } catch {
      clearTimeout(minuterie);
      const code = controleur.signal.aborted ? "delai_depasse" : "erreur_modele";
      journal(code);
      return erreur(code === "delai_depasse" ? 504 : 502, code);
    }
    clearTimeout(minuterie);
    const usage = lireUsage(reponse.json);
    tokensEntree += usage.entree;
    tokensSortie += usage.sortie;
    if (!reponse.ok) {
      journal("erreur_modele");
      return erreur(502, "erreur_modele");
    }
    const v = validerReponse(extraireTexteReponse(reponse.json));
    if (v.etat === "valide") {
      // Le dressing n'est lu que s'il sert : un besoin à satisfaire, ou des
      // vêtements visibles à reconnaître.
      const pieces = v.besoins.length || v.vetements.length ? await deps.lireDressing(user.id).catch(() => [] as PieceDressing[]) : [];
      const dressing = choisirPiecesDressing(v.besoins, pieces);
      const reconnaissance = reconnaitrePieces(v.vetements, pieces);
      const portees = reconnaissance.flatMap((r) => (r.pieceId !== null ? [r.pieceId] : []));
      piecesDressing = dressing.length;
      piecesReconnues = portees.length;
      journal("ok");
      return { statut: 200, corps: { ok: true, analyseId, avis: v.avis, dressing, reconnaissance, portees } };
    }
    if (v.etat === "inexploitable") {
      journal("photo_inexploitable");
      return erreur(422, "photo_inexploitable", v.raison);
    }
    dernierMotif = v.motif;
  }
  journal("reponse_invalide");
  return erreur(502, "reponse_invalide");
}
