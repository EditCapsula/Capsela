/**
 * Convention de nommage du catalogue (arrêtée le 28/08/2026) :
 *
 *   TYPE → LONGUEUR → COUPE → DÉTAIL → MATIÈRE (uniquement si nécessaire)
 *
 * Deux principes gouvernent tout le reste :
 *   · ne jamais déduire un attribut absent des données structurées ;
 *   · ne jamais dupliquer une caractéristique déjà portée par sous_type.
 *
 * Fonctions pures, sans accès base : la matière n'est ajoutée qu'au vu des
 * collisions, ce qui suppose de connaître tout le catalogue — cette étape-là
 * appartient à l'appelant (scripts/convention-noms.audit.ts).
 *
 * Il n'existe aucune colonne de longueur en base : la longueur ne peut donc
 * venir que de sous_type, par lexique fermé. Tout terme non reconnu est un
 * détail, jamais une longueur devinée.
 */

/** Mapping de coupe imposé par la convention, écrit dans les formes de la base. */
const COUPE_SOURCE: Record<string, string> = {
  Ample: "large",
  Ajusté: "ajusté",
  Serré: "ajusté",
  Droit: "droit",
  Oversize: "oversize",
  Fluide: "fluide",
};

/**
 * Lexique fermé des longueurs, écrit en français courant. Les deux côtés de la
 * comparaison passent par `stem`, ce qui absorbe le pluriel et le féminin
 * régulier ("courte"/"court"/"courts"). Le masculin et le féminin sont tout de
 * même listés tous les deux quand ils ne se réduisent pas à la même racine —
 * "longue" donne "longu", "long" donne "long".
 */
const LONGUEUR_SOURCE = [
  "mini", "courte", "court", "midi", "mi-longue", "mi-long", "longue", "long",
  "maxi", "genou", "cheville", "cropped", "crop", "7/8",
];

/** Forme comparable : minuscules, sans accent, sans marque finale de genre/nombre. */
export function stem(mot: string): string {
  const base = mot.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/(es|e|s)$/, "") || base;
}

const LONGUEURS = new Set(LONGUEUR_SOURCE.map(stem));
const COUPE_LIBELLE = new Map(Object.entries(COUPE_SOURCE).map(([cle, valeur]) => [stem(cle), valeur]));

/** Termes après lesquels une longueur qualifie les manches, jamais le vêtement. */
const PORTEURS_DE_MANCHE = new Set(["manche"].map(stem));

export function estLongueur(mot: string): boolean {
  return LONGUEURS.has(stem(mot));
}

/** Libellé de coupe depuis la colonne structurée uniquement. `inconnue` signale une valeur hors mapping, conservée telle quelle. */
export function libelleCoupe(coupe: string | null | undefined): { mot: string | null; inconnue: boolean } {
  const c = (coupe || "").trim();
  if (!c) return { mot: null, inconnue: false };
  const connue = COUPE_LIBELLE.get(stem(c));
  return connue ? { mot: connue, inconnue: false } : { mot: c.toLowerCase(), inconnue: true };
}

/** Matière principale d'une valeur composée ("Lin / coton" → "lin"). */
export function matierePrincipale(matiere: string | null | undefined): string | null {
  const m = (matiere || "").trim().toLowerCase();
  if (!m) return null;
  return m.split(/\s*[/,+]\s*| et /)[0].trim() || null;
}

export interface Decoupage {
  type: string;
  longueur: string | null;
  detail: string;
  /** La longueur ne suivait pas déjà le nom de tête : l'ordre des mots change. */
  longueurDeplacee: boolean;
  /** Plusieurs termes de longueur dans sous_type — ambigu, à arbitrer. */
  longueursMultiples: string[];
}

/**
 * Décompose sous_type en TYPE (nom de tête) + LONGUEUR + DÉTAIL.
 * "Pantalon à pinces" → Pantalon / — / à pinces
 * "Jupe midi plissée" → Jupe / midi / plissée
 * L'ordre des mots de détail est préservé, jamais réinterprété.
 */
export function decouper(sousType: string): Decoupage {
  const mots = sousType.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const type = mots[0] ? mots[0][0].toUpperCase() + mots[0].slice(1) : "";
  const reste = mots.slice(1);
  // Une longueur ne qualifie le vêtement que si elle ne qualifie pas les
  // manches. "Chemise manches courtes" décrit des manches courtes, pas une
  // chemise courte : sans ce garde-fou, la convention produisait "Chemise
  // courtes manches" et "Body longues ajusté drapé manches" (audit du
  // 28/08/2026). On ne retient donc jamais un terme précédé de "manche(s)".
  const indices = reste
    .map((mot, i) => (estLongueur(mot) && !PORTEURS_DE_MANCHE.has(stem(reste[i - 1] ?? "")) ? i : -1))
    .filter((i) => i >= 0);
  const trouvees = indices.map((i) => reste[i]);
  const longueur = trouvees[0] ?? null;
  const indexLongueur = indices[0] ?? -1;
  return {
    type,
    longueur,
    detail: reste.filter((_, i) => i !== indexLongueur).join(" "),
    longueurDeplacee: indexLongueur > 0,
    longueursMultiples: trouvees.length > 1 ? trouvees : [],
  };
}

export interface NomCompose {
  nom: string;
  decoupage: Decoupage;
  coupe: string | null;
  coupeInconnue: boolean;
  /** La coupe figurait déjà dans sous_type : non dupliquée. */
  coupeDejaPresente: boolean;
}

/** Nom TYPE + LONGUEUR + COUPE + DÉTAIL, sans matière (ajoutée en aval, sur collision seulement). */
export function composerNom(sousType: string, coupe: string | null | undefined): NomCompose {
  const decoupage = decouper(sousType);
  const { mot, inconnue } = libelleCoupe(coupe);
  const coupeDejaPresente =
    Boolean(mot) && sousType.trim().split(/\s+/).some((w) => stem(w) === stem(mot!));
  const retenue = coupeDejaPresente ? null : mot;
  return {
    nom: [decoupage.type, decoupage.longueur, retenue, decoupage.detail].filter(Boolean).join(" "),
    decoupage,
    coupe: retenue,
    coupeInconnue: inconnue,
    coupeDejaPresente,
  };
}
