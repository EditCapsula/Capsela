import { composerFlatLay, type PlacementFlatLay } from "./flatLay";
import type { CategoryKey } from "./types";

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

/** L'échelle du dessin du haut (cf. composerSilhouette). */
const ECHELLE_HAUT = 0.78;

/** Le format d'un cadre de photo portée (4:5), quand le haut est photographié. */
const RATIO_PHOTO = 0.8;

export interface FormeSilhouette {
  cat: CategoryKey;
  /** Le haut photographié : un cadre de photo au format 4:5 au lieu du dessin. */
  photo: boolean;
}

export interface PlacementSilhouette extends PlacementFlatLay {
  photo: boolean;
  src: string;
}

/** Les emplacements des dessins pour ces catégories : ceux du flat lay de l'accueil. Bijoux et accessoires n'ont pas de dessin. */
export function composerSilhouette(formes: { cat: CategoryKey; photoUrl?: string | null }[]): PlacementSilhouette[] {
  const utiles: FormeSilhouette[] = formes.filter((f) => f.cat !== "bijou" && f.cat !== "accessoire" && DESSINS_SILHOUETTE[f.cat]).map((f) => ({ cat: f.cat, photo: Boolean(f.photoUrl) }));
  if (!utiles.length) return [];
  const { pieces } = composerFlatLay(
    // Le dessin du haut est un carré plein (format 1:1), celui du pantalon un trait étroit (0,36) : à échelle égale, le haut prenait
    // plus de place que le bas. Le haut est ramené à 78 % — sa surface reste sous celle du pantalon, comme dans le look final.
    utiles.map((f, id) => ({ id, cat: f.cat, ratio: f.photo ? RATIO_PHOTO : DESSINS_SILHOUETTE[f.cat]!.ratio, visualScale: f.cat === "haut" || f.cat === "pull" ? ECHELLE_HAUT : 1 })),
    // Une graine fixe par ensemble de catégories : la silhouette ne bouge pas d'un rendu à l'autre.
    `silhouette:${utiles.map((f) => f.cat).join(",")}`,
    { contexte: "hero-home", sansMiroir: true }
  );
  return pieces.map((p) => ({ ...p, photo: utiles[p.id].photo, src: DESSINS_SILHOUETTE[utiles[p.id].cat]!.src }));
}
