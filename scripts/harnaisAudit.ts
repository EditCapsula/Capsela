/**
 * HARNAIS D'AUDIT — construction des profils de test.
 *
 * Créé le 29/08/2026 après la découverte que quatorze scripts d'audit
 * passaient des LIBELLÉS français dans `profile.styles` là où la production
 * y met des `StyleId`. `STYLE_ID_TO_CATALOG_LABEL["Casual chic"]` renvoie
 * `undefined`, `filter(Boolean)` vidait le tableau, et `computeDefaultCapsule`
 * sautait purement et simplement son filtre de style : chaque audit mesurait
 * UNE capsule répétée N fois par saison sur un pool universel, au lieu de N
 * capsules distinctes sur des pools de style réels. L'un des libellés les plus
 * utilisés, « Classique », n'existe même pas au catalogue (« Classique chic »).
 *
 * Règle : aucun script d'audit ne construit plus un Profile à la main.
 * Il passe par `profilAudit`, qui échoue bruyamment plutôt que de laisser un
 * audit continuer en silence sur un pool universel.
 */
import {
  EMPTY_PROFILE,
  STYLE_ID_TO_CATALOG_LABEL,
  STYLE_IDS,
  exposedStyleIds,
  type Profile,
  type StyleId,
} from "../src/lib/profile";
import type { CatalogItem } from "../src/lib/catalog";

/** Les huit styles féminins exposés, par identifiant. Source unique des audits femme. */
export const STYLES_FEMME: StyleId[] = exposedStyleIds("femme");
/** Les six styles masculins exposés (ni romantique ni glamour côté homme). */
export const STYLES_HOMME: StyleId[] = exposedStyleIds("homme");

export function stylesAudit(gender: "femme" | "homme"): StyleId[] {
  return gender === "homme" ? STYLES_HOMME : STYLES_FEMME;
}

/**
 * Vérifie qu'une valeur destinée à `profile.styles` est bien un StyleId
 * connu ET traduisible en libellé catalogue. Lève sinon : un audit qui
 * mesure le mauvais pool est pire qu'un audit qui ne tourne pas.
 */
export function assertStyleId(value: string): asserts value is StyleId {
  if (!(STYLE_IDS as readonly string[]).includes(value)) {
    const suggestion = (Object.entries(STYLE_ID_TO_CATALOG_LABEL) as [StyleId, string][])
      .find(([, label]) => label.toLowerCase() === value.toLowerCase());
    throw new Error(
      `HARNAIS D'AUDIT — « ${value} » n'est pas un StyleId.` +
        (suggestion ? ` C'est le LIBELLÉ catalogue de « ${suggestion[0]} » : passe l'identifiant.` : "") +
        ` Ids valides : ${STYLE_IDS.join(", ")}.`,
    );
  }
  if (!STYLE_ID_TO_CATALOG_LABEL[value as StyleId]) {
    throw new Error(`HARNAIS D'AUDIT — le StyleId « ${value} » n'a aucun libellé catalogue.`);
  }
}

/**
 * Construit un Profile d'audit. `styles` vide est refusé : un audit qui
 * attend un style et n'en passe aucun retomberait sur le pool universel,
 * exactement le défaut que ce harnais existe pour empêcher. Les audits qui
 * veulent délibérément l'absence de style passent `styles: null`.
 */
export function profilAudit(opts: {
  gender: "femme" | "homme";
  styles: readonly string[] | null;
  morphology?: string | null;
  patch?: Partial<Profile>;
}): Profile {
  const { gender, styles, morphology = null, patch } = opts;
  if (styles !== null) {
    if (!styles.length) {
      throw new Error("HARNAIS D'AUDIT — `styles` vide. Passe `styles: null` pour tester explicitement l'absence de style.");
    }
    for (const s of styles) assertStyleId(s);
  }
  return { ...EMPTY_PROFILE, gender, styles: styles ? [...styles] : [], morphology, ...patch };
}

/**
 * Garde-fou catalogue, à appeler une fois le pool chargé : chaque libellé
 * attendu doit exister dans la colonne `styles`. Un style orphelin produirait
 * un pool vide, donc le repli `curated = base` de computeDefaultCapsule,
 * donc à nouveau une mesure silencieusement fausse.
 */
export function assertCatalogueStyles(pool: CatalogItem[], styles: readonly StyleId[] = STYLES_FEMME): void {
  const presents = new Set<string>();
  for (const it of pool) for (const t of it.styleTags ?? []) presents.add(t);
  const orphelins = styles.filter((id) => !presents.has(STYLE_ID_TO_CATALOG_LABEL[id]));
  if (orphelins.length) {
    throw new Error(
      `HARNAIS D'AUDIT — aucun article du catalogue ne porte le libellé de : ${orphelins.join(", ")}. ` +
        `Libellés présents : ${[...presents].sort().join(", ") || "(aucun)"}.`,
    );
  }
}
