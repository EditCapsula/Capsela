import { estDeSaison, type ContexteSaisonnier } from "./capsule";
import { clePieces } from "./outfitFeedback";
import { inactivityInfo } from "./selectors";
import type { CategoryKey, Item } from "./types";

/*
 * LES SECTIONS DE L'ÉCRAN DRESSING, V6 (08/10/2026) — des fonctions pures, testées ; l'écran ne fait que les afficher.
 * Aucune donnée inventée : une section sans donnée ne s'affiche pas (les fonctions rendent alors une liste vide).
 */

// ── INTRO ────────────────────────────────────────────────────────────

/** « 12 pièces · 5 catégories » — jamais de places restantes (retirées le 08/10/2026). */
export function ligneDressing(nbPieces: number, nbCategories: number): string {
  return `${nbPieces} ${nbPieces <= 1 ? "pièce" : "pièces"} · ${nbCategories} ${nbCategories <= 1 ? "catégorie" : "catégories"}`;
}

// ── AJOUTÉES RÉCEMMENT ───────────────────────────────────────────────

/**
 * LES DERNIÈRES PIÈCES = LES 30 DERNIERS JOURS (08/10/2026, décidé) : découverte et inspiration. Le Dressing, lui, est tout le
 * vestiaire — gestion et exploration. Une pièce plus ancienne n'est jamais « récente », même si c'est la dernière ajoutée.
 */
export const JOURS_DERNIERES_PIECES = 30;

/** Les pièces ajoutées ces 30 derniers jours, par date d'ajout décroissante, et rien d'autre : ni saison, ni usage. Une pièce sans date d'ajout n'y figure pas. */
export function piecesRecentes(items: Item[], max = 8, maintenant: number = Date.now()): Item[] {
  const limite = debutDeJour(maintenant) - JOURS_DERNIERES_PIECES * 86_400_000;
  return items
    .filter((i): i is Item & { createdAt: number } => typeof i.createdAt === "number" && i.createdAt >= limite)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
}

const debutDeJour = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** « Ajoutée aujourd'hui », « Ajoutée hier », « Ajoutée il y a N jours » (au-delà de 30 jours : en mois). Jours calendaires, pas multiples de 24 h. */
export function dateRelativeAjout(createdAt: number, maintenant: number = Date.now()): string {
  const jours = Math.max(0, Math.round((debutDeJour(maintenant) - debutDeJour(createdAt)) / 86_400_000));
  if (jours === 0) return "Ajoutée aujourd'hui";
  if (jours === 1) return "Ajoutée hier";
  if (jours <= 30) return `Ajoutée il y a ${jours} jours`;
  return `Ajoutée il y a ${Math.round(jours / 30)} mois`;
}

// ── À REDÉCOUVRIR ────────────────────────────────────────────────────

/** Au-delà de ce nombre de ports, une pièce n'est plus « à redécouvrir ». ARBITRAGE ÉDITORIAL du 08/10/2026 : « peu porté » = deux fois au plus. */
export const PORTS_MAX_A_REDECOUVRIR = 2;

export type EtiquettePortee = "Jamais porté" | "Peu porté" | "Porté 1 fois" | "À réinventer";

/**
 * Le nombre de ports d'une pièce : celui de l'historique, et au moins 1 quand `worn` dit qu'elle a déjà été portée (un historique
 * tronqué ne la fait jamais passer pour « jamais portée »).
 */
export function portsDe(item: Item, parPiece: Map<number, number>): number {
  return Math.max(parPiece.get(item.id) ?? 0, item.worn != null ? 1 : 0);
}

export function etiquettePortee(item: Item, ports: number): EtiquettePortee {
  if (ports === 0) return inactivityInfo(item).inactive ? "À réinventer" : "Jamais porté";
  return ports === 1 ? "Porté 1 fois" : "Peu porté";
}

/**
 * Les pièces du dressing à remettre en jeu : DE SAISON (la saison courante de la météo, la règle du moteur — `estDeSaison`), et
 * portées deux fois au plus. Jamais une pièce hors saison. Les moins portées d'abord, puis celles qui n'ont pas servi pendant leur
 * dernière saison, puis les plus anciennes. L'appelant retire celles qui n'ont aucun look possible (le moteur décide, pas ici).
 */
export function candidatsARedecouvrir(
  items: Item[],
  contexte: ContexteSaisonnier,
  parPiece: Map<number, number>,
  max = 12
): { piece: Item; etiquette: EtiquettePortee; ports: number }[] {
  return items
    .filter((i) => estDeSaison(i, contexte))
    .map((piece) => ({ piece, ports: portsDe(piece, parPiece) }))
    .filter(({ ports }) => ports <= PORTS_MAX_A_REDECOUVRIR)
    .map(({ piece, ports }) => ({ piece, ports, etiquette: etiquettePortee(piece, ports) }))
    .sort(
      (a, b) =>
        a.ports - b.ports ||
        Number(b.etiquette === "À réinventer") - Number(a.etiquette === "À réinventer") ||
        (a.piece.createdAt ?? 0) - (b.piece.createdAt ?? 0)
    )
    .slice(0, max);
}

const ARTICLE_PAR_CAT: Partial<Record<CategoryKey, "ton" | "ta" | "tes">> = {
  haut: "ton",
  pull: "ton",
  pantalon: "ton",
  jean: "ton",
  jupe: "ta",
  short: "ton",
  robe: "ta",
  combinaison: "ta",
  veste: "ta",
  manteau: "ton",
  chaussures: "tes",
  sac: "ton",
};

const PARTENAIRES: Partial<Record<CategoryKey, CategoryKey[]>> = {
  haut: ["pantalon", "jean", "jupe", "short"],
  pull: ["pantalon", "jean", "jupe", "short"],
  pantalon: ["haut", "pull"],
  jean: ["haut", "pull"],
  jupe: ["haut", "pull"],
  short: ["haut", "pull"],
  robe: ["veste", "chaussures"],
  combinaison: ["veste", "chaussures"],
  veste: ["haut", "pull", "robe"],
  manteau: ["pull", "haut", "pantalon"],
  chaussures: ["pantalon", "jean", "jupe", "robe"],
  sac: ["pantalon", "jean", "jupe", "robe"],
};

/**
 * « Avec ton pantalon tailleur » : une pièce DU DRESSING que le moteur a réellement associée à celle-ci (`tenues` = les ids de ses
 * tenues). Rien quand aucune tenue ne la porte avec une autre pièce du dressing — la phrase ne dit jamais plus que le moteur.
 */
export function pisteAssociation(pivot: Item, tenues: number[][], items: Item[]): string | null {
  const parId = new Map(items.map((i) => [i.id, i]));
  const voulues = PARTENAIRES[pivot.cat] ?? [];
  let repli: Item | null = null;
  for (const ids of tenues) {
    const autres = ids.filter((id) => id !== pivot.id).map((id) => parId.get(id)).filter((p): p is Item => !!p);
    for (const cat of voulues) {
      const trouve = autres.find((p) => p.cat === cat);
      if (trouve) return phrasePiste(trouve);
    }
    repli ??= autres[0] ?? null;
  }
  return repli ? phrasePiste(repli) : null;
}

/**
 * L'ARTICLE S'ACCORDE AVEC LE NOM DE LA PIÈCE, PAS AVEC SA CATÉGORIE (09/10/2026, signalé : « Ton chemise en lin ») : une chemise, une
 * blouse sont rangées dans « haut », des baskets dans « chaussures » mais une basket au singulier aussi. Le nom principal est le premier
 * mot connu du libellé (les adjectifs d'ouverture comme « petite » sont sautés) ; inconnu, on retombe sur l'article de la catégorie.
 * Les clés sont sans accents ni majuscules (`cleMot`).
 */
const GENRE_DU_NOM: Record<string, "m" | "f" | "p"> = {
  // Hauts et mailles
  "t-shirt": "m", "tee-shirt": "m", top: "m", debardeur: "m", chemisier: "m", polo: "m", body: "m", haut: "m", pull: "m", "pull-over": "m",
  gilet: "m", sweat: "m", "sweat-shirt": "m", cardigan: "m", col: "m", crop: "m", caraco: "m",
  chemise: "f", blouse: "f", tunique: "f", mariniere: "f", brassiere: "f", maille: "f", chemisette: "f",
  // Bas, robes, combinaisons
  pantalon: "m", jean: "m", chino: "m", jogging: "m", legging: "m", short: "m", bermuda: "m", cargo: "m", palazzo: "m", tailleur: "m",
  jupe: "f", "mini-jupe": "f", robe: "f", salopette: "f", combinaison: "f", combi: "f", combishort: "m",
  jeans: "p", leggings: "p",
  // Vestes et manteaux
  blazer: "m", manteau: "m", trench: "m", "trench-coat": "m", caban: "m", perfecto: "m", blouson: "m", impermeable: "m", "coupe-vent": "m",
  anorak: "m", kimono: "m", kway: "m", "k-way": "m", poncho: "m", "duffle-coat": "m",
  veste: "f", parka: "f", doudoune: "f", cape: "f", saharienne: "f", surchemise: "f",
  // Chaussures
  escarpin: "m", mocassin: "m", derby: "m", sabot: "m", chausson: "m", richelieu: "m", sneaker: "f",
  basket: "f", bottine: "f", botte: "f", sandale: "f", ballerine: "f", mule: "f", espadrille: "f", chaussure: "f", tennis: "p",
  baskets: "p", sneakers: "p", bottines: "p", bottes: "p", sandales: "p", ballerines: "p", escarpins: "p", mocassins: "p", derbies: "p",
  derbys: "p", mules: "p", espadrilles: "p", chaussures: "p", chaussons: "p", sabots: "p", richelieus: "p", boots: "p",
  // Sacs, bijoux, accessoires
  sac: "m", cabas: "m", tote: "m", "tote-bag": "m", collier: "m", bracelet: "m", pendentif: "m", foulard: "m", chapeau: "m", bonnet: "m",
  beret: "m", carre: "m", bandeau: "m", "serre-tete": "m", chouchou: "m", jonc: "m",
  pochette: "f", besace: "f", banane: "f", ceinture: "f", echarpe: "f", etole: "f", casquette: "f", montre: "f", bague: "f", gourde: "f",
  boucles: "p", lunettes: "p", chaussettes: "p", collants: "p", gants: "p", creoles: "p", mitaines: "p",
};

/** Adjectifs qui peuvent ouvrir un libellé (« Petite robe noire ») : sautés pour trouver le nom. */
const ADJECTIFS_D_OUVERTURE = new Set([
  "petit", "petite", "petits", "petites", "grand", "grande", "grands", "grandes", "long", "longue", "longs", "longues", "joli", "jolie",
  "beau", "bel", "belle", "nouveau", "nouvel", "nouvelle", "vieux", "vieil", "vieille", "gros", "grosse", "mini", "maxi", "vrai", "vraie",
]);

function cleMot(mot: string): string {
  return mot.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z-]/g, "");
}

/** « ton », « ta » ou « tes » selon le nom de la pièce ; repli sur la catégorie ; `undefined` quand rien ne permet de choisir. */
export function articlePossessif(p: Item): "ton" | "ta" | "tes" | undefined {
  const mots = p.name.trim().split(/\s+/).map(cleMot).filter(Boolean);
  for (const mot of mots.slice(0, 3)) {
    const genre = GENRE_DU_NOM[mot];
    if (genre === "p") return "tes";
    // « ton écharpe », « ton espadrille » : devant une voyelle ou un h muet, le possessif féminin prend la forme masculine.
    if (genre === "f") return /^[aeiouyh]/.test(mot) ? "ton" : "ta";
    if (genre === "m") return "ton";
    if (!ADJECTIFS_D_OUVERTURE.has(mot)) break;
  }
  return ARTICLE_PAR_CAT[p.cat];
}

/** « ta veste en daim », « ton pantalon tailleur », « tes chaussures » — la pièce désignée avec son article ; sans article connu, son nom seul. */
export function designationPiece(p: Item): string {
  const nom = p.name.trim();
  const article = articlePossessif(p);
  const bas = `${nom.charAt(0).toLowerCase()}${nom.slice(1)}`;
  return article ? `${article} ${bas}` : bas;
}

export function phrasePiste(p: Item): string {
  const nom = p.name.trim();
  const article = articlePossessif(p);
  return article ? `Avec ${article} ${nom.charAt(0).toLowerCase()}${nom.slice(1)}` : `Avec ${nom}`;
}

// ── SAISON ───────────────────────────────────────────────────────────

export function saisonDeLaDate(ts: number): "Printemps" | "Été" | "Automne" | "Hiver" {
  const m = new Date(ts).getMonth() + 1;
  if (m >= 3 && m <= 5) return "Printemps";
  if (m >= 6 && m <= 8) return "Été";
  if (m >= 9 && m <= 11) return "Automne";
  return "Hiver";
}

// ── TES DERNIÈRES PIÈCES (écran « Voir tout », 08/10/2026) ──────────

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** Jusqu'à ce nombre de jours (aujourd'hui compris), une pièce est de « cette semaine ». */
export const JOURS_CETTE_SEMAINE = 6;

const joursDepuis = (ts: number, maintenant: number) => Math.max(0, Math.round((debutDeJour(maintenant) - debutDeJour(ts)) / 86_400_000));

/** « Aujourd'hui », « Hier », « Il y a 3 jours » pour la semaine ; « 22 sept. » au-delà. */
export function libelleDateRecente(ts: number, maintenant: number = Date.now()): string {
  const j = joursDepuis(ts, maintenant);
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return "Hier";
  if (j <= JOURS_CETTE_SEMAINE) return `Il y a ${j} jours`;
  const d = new Date(ts);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

/** Les pièces (déjà triées) séparées en « cette semaine » et « un peu plus tôt ». Une section vide n'existe pas côté écran. */
export function separerParSemaine<T extends { createdAt?: number }>(pieces: T[], maintenant: number = Date.now()): { semaine: T[]; avant: T[] } {
  const semaine: T[] = [];
  const avant: T[] = [];
  for (const p of pieces) (typeof p.createdAt === "number" && joursDepuis(p.createdAt, maintenant) <= JOURS_CETTE_SEMAINE ? semaine : avant).push(p);
  return { semaine, avant };
}

/** « 1 look possible », « 4 looks possibles » — rien quand il n'y en a pas : la ligne ne dit jamais un nombre que le moteur n'a pas trouvé. */
export function libelleLooksPossibles(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? "look possible" : "looks possibles"}` : null;
}

/** Le nombre de looks DISTINCTS (même jeu de pièces = un seul) parmi des idées de plusieurs pièces. */
export function looksDistincts(parPiece: number[][][]): number {
  return new Set(parPiece.flatMap((tenues) => tenues.map((ids) => clePieces(ids).join(",")))).size;
}

/**
 * LE LOOK QUE MONTRE « TES LOOKS » POUR UNE PIÈCE (09/10/2026, « la carte active doit présenter un look suffisamment complet ») :
 * parmi les trois premières idées du moteur pour cette pièce, celle qui compte le plus de pièces — la tenue la plus complète —,
 * à égalité la première. Jamais une tenue hors des idées du moteur : seul le choix entre elles change.
 */
export function ideeLaPlusComplete<T extends { ids: number[] }>(idees: readonly T[] | undefined): T | undefined {
  if (!idees?.length) return undefined;
  return idees.slice(0, 3).reduce((meilleure, i) => (i.ids.length > meilleure.ids.length ? i : meilleure));
}
