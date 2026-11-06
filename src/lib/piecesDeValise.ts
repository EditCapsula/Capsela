import type { CatalogItem } from "./catalog";
import { STYLE_ID_TO_CATALOG_LABEL, type Profile, type StyleId } from "./profile";
import type { CategoryKey, Item } from "./types";

/*
 * LES PIÈCES RÉSERVÉES À LA VALISE (06/11/2026, demandé : « pour la valise seulement, on crée des pièces pour couvrir toutes les
 * occasions, mais ces pièces ne sont visibles que dans la valise et propres à chaque style » ; périmètre et tableau validés le même
 * jour, docs/pieces-de-valise.md).
 *
 * Plage, piscine et spa : un maillot de bain (femme) ou un short de bain (homme), et une surchemise ou une chemise de plage, un modèle
 * par style. Ces pièces sont au catalogue (vestiaire_universel), reconnues par leur type (`sous_type`) — aucune colonne, aucune
 * migration. Elles restent dans le catalogue chargé (une valise enregistrée les retrouve), mais n'entrent JAMAIS dans une capsule
 * (computeDefaultCapsule les écarte) : ni Capsule, ni Explorer, ni tenue du jour, ni idées. La valise seule les ajoute, pour ses
 * situations de baignade.
 */

export const SOUS_TYPES_RESERVES_VALISE = [
  "Maillot de bain",
  "Short de bain",
  "Surchemise de plage",
  "Chemise de plage",
  "Kimono de plage",
  // 06/11/2026, demandé : « Pour des randos dans les tenues vacances il faut intégrer une paire de chaussures de randonnée pour femme
  // et homme. » Une paire par genre, sans style ; seulement pour les journées de randonnée.
  "Chaussures de randonnée",
] as const;

/** Une pièce réservée à la valise : jamais proposée ailleurs. */
export const estPieceDeValise = (it: Pick<Item, "subtype">): boolean =>
  Boolean(it.subtype) && (SOUS_TYPES_RESERVES_VALISE as readonly string[]).includes(it.subtype as string);

const estTenueDeBain = (it: Pick<Item, "subtype">) => it.subtype === "Maillot de bain" || it.subtype === "Short de bain";
const estCouverture = (it: Pick<Item, "subtype">) =>
  it.subtype === "Surchemise de plage" || it.subtype === "Chemise de plage" || it.subtype === "Kimono de plage";

/** Les activités de la valise qui demandent une tenue de bain (programmeValise.ts : Plage, Piscine → Quotidien ; Spa → Cocooning). */
export const SOUS_OCCASIONS_BAIGNADE = ["plage", "piscine", "spa"] as const;
const PLEIN_AIR = ["plage", "piscine"];

/**
 * Les activités dont le look peut porter des pièces réservées ET devenir la tenue du jour, le jour où le programme les prévoit
 * (06/11/2026, arbitré : « Look de plage ou de rando ou de spa… »). La randonnée y est déjà, pour ses pièces à venir.
 */
export const ACTIVITES_DE_VACANCES = ["plage", "piscine", "spa", "randonnee"] as const;
export const estActiviteDeVacances = (sousId: string | null | undefined): boolean =>
  Boolean(sousId) && (ACTIVITES_DE_VACANCES as readonly string[]).includes(sousId as string);

/** Une journée de randonnée au programme. */
export const estRandonnee = (s: { sousIds?: string[] }): boolean => (s.sousIds ?? []).includes("randonnee");
const estChaussureDeRando = (it: Pick<Item, "subtype">) => it.subtype === "Chaussures de randonnée";

/** La paire de randonnée de CE profil : celle de son genre d'abord, puis une paire unisexe ; jamais celle de l'autre genre. */
export function chaussuresDeRandonnee(catalogue: readonly CatalogItem[], profile: Pick<Profile, "gender">): CatalogItem[] {
  const autreGenre = profile.gender === "homme" ? "femme" : "homme";
  const paires = catalogue.filter((it) => estChaussureDeRando(it) && it.genre !== autreGenre);
  const sienne = paires.find((it) => it.genre === profile.gender) ?? paires[0];
  return sienne ? [sienne] : [];
}

/** Toutes les pièces réservées de ce profil : baignade et randonnée. */
export function piecesReserveesDuProfil(catalogue: readonly CatalogItem[], profile: Pick<Profile, "gender" | "styles">, couleurs: readonly string[]): CatalogItem[] {
  return [...piecesDeBaignade(catalogue, profile, couleurs), ...chaussuresDeRandonnee(catalogue, profile)];
}

/** Les pièces réservées qui servent à CETTE situation : la tenue de bain à la baignade, la paire de randonnée à la randonnée. */
export function piecesPourLaSituation<T extends Pick<Item, "subtype">>(pieces: readonly T[], s: { sousIds?: string[] }): T[] {
  return pieces.filter((p) => (estBaignade(s) && !estChaussureDeRando(p)) || (estRandonnee(s) && estChaussureDeRando(p)));
}

/** Une journée de randonnée se marche en chaussures de randonnée : quand le pool en a une paire, les autres chaussures sortent. */
export function poolDeRandonnee(pool: Item[], s: { sousIds?: string[] }): Item[] {
  if (!estRandonnee(s) || !pool.some(estChaussureDeRando)) return pool;
  return pool.filter((it) => it.cat !== "chaussures" || estChaussureDeRando(it));
}

export const estBaignade = (s: { sousIds?: string[] }): boolean =>
  (s.sousIds ?? []).some((id) => (SOUS_OCCASIONS_BAIGNADE as readonly string[]).includes(id));

/**
 * Les pièces de baignade de CE profil : une tenue de bain et une couverture, les mieux rangées pour lui. Rang : une pièce propre à un
 * style du profil, la plus spécifique (le moins d'étiquettes de style), puis une couleur préférée. Jamais une pièce de l'autre genre.
 */
export function piecesDeBaignade(catalogue: readonly CatalogItem[], profile: Pick<Profile, "gender" | "styles">, couleurs: readonly string[]): CatalogItem[] {
  const autreGenre = profile.gender === "homme" ? "femme" : "homme";
  const styles = (profile.styles ?? []).map((id) => STYLE_ID_TO_CATALOG_LABEL[id as StyleId]).filter(Boolean);
  const rang = (it: CatalogItem): number[] => [
    styles.length && it.styleTags?.some((t) => styles.includes(t)) ? 0 : 1,
    it.styleTags?.length || 99,
    couleurs.includes(it.hex) ? 0 : 1,
  ];
  const avant = (a: CatalogItem, b: CatalogItem) => {
    const ra = rang(a), rb = rang(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  };
  const candidates = catalogue.filter((it) => estPieceDeValise(it) && it.genre !== autreGenre);
  return [candidates.filter(estTenueDeBain), candidates.filter(estCouverture)].flatMap((l) => [...l].sort(avant).slice(0, 1));
}

const VETEMENTS: readonly CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];

/**
 * Le pool d'une situation de baignade : la tenue de bain et sa couverture tiennent lieu de vêtements (les autres vêtements sortent) ;
 * chaussures, sac, bijoux et accessoires restent, et le moteur compose comme il le fait toujours. Sans tenue de bain dans le pool,
 * rien ne change. Hors baignade, rien ne change.
 */
export function poolDeBaignade(pool: Item[], s: { sousIds?: string[] }): Item[] {
  if (!estBaignade(s) || !pool.some(estTenueDeBain)) return pool;
  return pool.filter((it) => estTenueDeBain(it) || estCouverture(it) || !VETEMENTS.includes(it.cat));
}

/**
 * À la plage ou à la piscine, un maillot de bain se porte avec sa surchemise : le moteur ne superpose pas un haut à une pièce
 * entière, la couverture est donc ajoutée au look quand le pool en a une. Jamais au spa (chez soi, R-B13 : chaussures d'intérieur).
 */
export function ajouterCouverture(ids: number[], pool: Item[], s: { sousIds?: string[] }): number[] {
  if (!(s.sousIds ?? []).some((id) => PLEIN_AIR.includes(id))) return ids;
  const portees = pool.filter((it) => ids.includes(it.id));
  if (!portees.some((it) => it.subtype === "Maillot de bain") || portees.some(estCouverture)) return ids;
  const couverture = pool.find(estCouverture);
  return couverture ? [...ids, couverture.id] : ids;
}
