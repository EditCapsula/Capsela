import { composerFlatLay, type PlacementFlatLay } from "./flatLay";
import type { CategoryKey, SacType } from "./types";

/*
 * LA SILHOUETTE DE CHARGEMENT, SUR LE MOTEUR DU FLAT LAY (08/10/2026, signalé : « il faut revoir les dimensions des pièces au
 * chargement, haut trop grand vs bas »). Elle posait ses dessins avec l'ancienne planche (composerPlanche) : un haut presque aussi
 * grand que la zone à côté d'un pantalon étroit, et des emplacements qui n'étaient plus ceux du look final — le fondu glissait d'une
 * composition à l'autre. Elle passe maintenant par composerFlatLay, contexte « hero-home », avec le FORMAT RÉEL de chaque dessin : le
 * haut, le pantalon, le sac et les chaussures ont les tailles relatives du look final, aux mêmes places.
 */

/** Les dessins de chargement (public/loader) et le format (largeur / hauteur) de leur partie visible — mesuré sur les fichiers. */
export const DESSINS_SILHOUETTE: Partial<Record<CategoryKey, { src: string; ratio: number }>> = {
  haut: { src: "/loader/haut.webp", ratio: 1.01 },
  pull: { src: "/loader/haut.webp", ratio: 1.01 },
  pantalon: { src: "/loader/pantalon.webp", ratio: 0.36 },
  jean: { src: "/loader/pantalon.webp", ratio: 0.36 },
  jupe: { src: "/loader/jupe.webp", ratio: 0.75 },
  short: { src: "/loader/short.webp", ratio: 1.17 },
  robe: { src: "/loader/robe.webp", ratio: 0.51 },
  combinaison: { src: "/loader/combinaison.webp", ratio: 0.35 },
  veste: { src: "/loader/veste.webp", ratio: 0.77 },
  manteau: { src: "/loader/manteau.webp", ratio: 0.48 },
  chaussures: { src: "/loader/chaussures.webp", ratio: 2.47 },
  sac: { src: "/loader/sac.webp", ratio: 0.88 },
};

/**
 * LES DESSINS HOMME (15/10/2026, signalé : « les silhouettes des pièces pour homme sont-elles adaptées ? »). Le sac à main, le trench
 * ceinturé, le blazer cintré et le short taille haute sont de coupe féminine ; un profil homme reçoit une besace, un pardessus droit,
 * un blazer droit et un short chino (dessins Claude Design, liseré crème ajouté au traitement pour coller au reste de la planche).
 * Les autres catégories (haut, pantalon, chaussures) gardent le dessin commun. Formats mesurés sur les fichiers.
 */
const DESSINS_HOMME: Partial<Record<CategoryKey, { src: string; ratio: number }>> = {
  sac: { src: "/loader/sac-homme.webp", ratio: 1.1 },
  veste: { src: "/loader/veste-homme.webp", ratio: 0.9 },
  manteau: { src: "/loader/manteau-homme.webp", ratio: 0.66 },
  short: { src: "/loader/short-homme.webp", ratio: 1.22 },
};

/** Un sac à dos est dessiné comme tel, quel que soit le profil : ni sac à main ni besace. */
const DESSIN_SAC_A_DOS = { src: "/loader/sac-a-dos.webp", ratio: 0.81 };

export interface OptionsDessin {
  /** Profil homme : les dessins de DESSINS_HOMME remplacent les dessins communs. */
  homme?: boolean;
  /** Le type du sac posé, quand la pièce est connue. */
  sacType?: SacType;
}

/** Le dessin d'une catégorie pour ce profil (et ce sac), ou undefined si la catégorie n'en a pas. */
export function dessinSilhouette(cat: CategoryKey, options: OptionsDessin = {}): { src: string; ratio: number } | undefined {
  if (cat === "sac" && options.sacType === "Sac à dos") return DESSIN_SAC_A_DOS;
  return (options.homme ? DESSINS_HOMME[cat] : undefined) ?? DESSINS_SILHOUETTE[cat];
}

/** L'échelle du dessin du haut (cf. composerSilhouette). */
const ECHELLE_HAUT = 0.78;

/** Le format d'un cadre de photo portée (4:5), quand le haut est photographié. */
const RATIO_PHOTO = 0.8;

export interface FormeSilhouette {
  cat: CategoryKey;
  dessin: { src: string; ratio: number };
  /** Le haut photographié : un cadre de photo au format 4:5 au lieu du dessin. */
  photo: boolean;
}

export interface PlacementSilhouette extends PlacementFlatLay {
  photo: boolean;
  src: string;
}

/** Les emplacements des dessins pour ces catégories : ceux du flat lay de l'accueil. Bijoux et accessoires n'ont pas de dessin. */
export function composerSilhouette(
  formes: { cat: CategoryKey; photoUrl?: string | null; sacType?: SacType }[],
  options: { homme?: boolean } = {}
): PlacementSilhouette[] {
  const utiles: FormeSilhouette[] = formes.flatMap((f) => {
    if (f.cat === "bijou" || f.cat === "accessoire") return [];
    const dessin = dessinSilhouette(f.cat, { homme: options.homme, sacType: f.sacType });
    return dessin ? [{ cat: f.cat, dessin, photo: Boolean(f.photoUrl) }] : [];
  });
  if (!utiles.length) return [];
  const { pieces } = composerFlatLay(
    // Le dessin du haut est un carré plein (format 1:1), celui du pantalon un trait étroit (0,36) : à échelle égale, le haut prenait
    // plus de place que le bas. Le haut est ramené à 78 % — sa surface reste sous celle du pantalon, comme dans le look final.
    utiles.map((f, id) => ({ id, cat: f.cat, ratio: f.photo ? RATIO_PHOTO : f.dessin.ratio, visualScale: f.cat === "haut" || f.cat === "pull" ? ECHELLE_HAUT : 1 })),
    // Une graine fixe par ensemble de catégories : la silhouette ne bouge pas d'un rendu à l'autre.
    `silhouette:${utiles.map((f) => f.cat).join(",")}`,
    { contexte: "hero-home", sansMiroir: true }
  );
  return pieces.map((p) => ({ ...p, photo: utiles[p.id].photo, src: utiles[p.id].dessin.src }));
}
