import { estPhotoDetouree } from "./dressing";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Item } from "./types";
import { VESTIAIRE_ID_OFFSET, isVestiaireId } from "./vestiaire";

export interface ResolvedItemImage {
  kind: "photo" | "detouree" | "affiliate" | "generated" | "placeholder";
  url?: string;
}

/**
 * Priorité d'affichage impérative (recette 18/08/2026) : photo réelle (ou détourée) du
 * dressing utilisateur > image produit affiliée > image catalogue Capsela
 * générée > placeholder. Une image générique Capsela ne remplace jamais la
 * photo réelle d'une pièce ajoutée par l'utilisatrice, et on ne génère
 * jamais un visuel artificiel pour représenter un produit affilié précis
 * qui a déjà sa vraie photo.
 *
 * Correctif 18/08/2026 : une image générée n'est utilisée que si son statut
 * est explicitement "ready" — jamais affichée juste parce qu'imageUrl
 * existe (une image invalidée après coup ne doit jamais réapparaître).
 */
export function resolveItemImage(item: Item): ResolvedItemImage {
  // Une photo DÉTOURÉE (fond transparent, 04/10/2026) se montre comme un visuel produit — posée en « contain » sur la
  // tuile, jamais recadrée comme une photo réelle. C'est le nom du fichier qui le dit (estPhotoDetouree).
  if (item.photoUrl) return { kind: estPhotoDetouree(item.photoUrl) ? "detouree" : "photo", url: item.photoUrl };
  if (item.affiliateImageUrl) return { kind: "affiliate", url: item.affiliateImageUrl };
  if (item.imageUrl && item.imageStatus === "ready") return { kind: "generated", url: item.imageUrl };
  return { kind: "placeholder" };
}

/**
 * L'image d'une pièce pour le FLAT LAY du hero (08/10/2026) : le visuel hero (pièce posée à plat) quand le catalogue en a un
 * et que la pièce n'a ni photo de la personne ni photo affiliée ; sinon exactement resolveItemImage. Le visuel standard reste
 * donc le repli de toute pièce sans visuel hero, avant comme après la migration 0049.
 */
export function resolveHeroImage(item: Item): ResolvedItemImage {
  const standard = resolveItemImage(item);
  // Le visuel hero se suffit : une pièce dont le visuel standard est faux, absent ou pas prêt (collants, robe sans statut)
  // s'affiche quand même avec lui. Une photo de la personne ou un produit affilié passent toujours devant.
  if ((standard.kind === "generated" || standard.kind === "placeholder") && item.imageHeroUrl) return { kind: "generated", url: item.imageHeroUrl };
  return standard;
}

/**
 * Le fond d'une case qui montre la photo d'une pièce (04/10/2026) : une photo réelle remplit la case (« cover »), une
 * photo DÉTOURÉE se montre entière sur la tuile (« contain », fond de tuile) — recadrée, la pièce serait tronquée.
 */
export function fondPhotoPiece(url: string, detouree: boolean): import("react").CSSProperties {
  return detouree
    ? { background: "var(--color-photo-bg)", backgroundImage: `url(${url})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
    : { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" };
}

/** Ids déjà en cours de génération cette session — jamais un second appel Edge Function tant que le premier n'a pas répondu. */
const inFlight = new Set<number>();

/**
 * Déclenche la génération du visuel d'une pièce du catalogue via l'Edge
 * Function generate-catalog-image (recette 18/08/2026, gestion automatique
 * des images produit). Ne fait jamais d'appel :
 * - pour le catalogue statique de secours (ids < VESTIAIRE_ID_OFFSET) : pas
 *   de ligne vestiaire_universel correspondante à mettre à jour ;
 * - en mode démo (pas de vraie fonction Supabase à appeler) ;
 * - en double pendant qu'une génération pour cet id est déjà en cours.
 * L'Edge Function revérifie de toute façon image_url à son tour (garde
 * ceinture-bretelles côté serveur).
 */
export async function ensureCatalogImage(itemId: number): Promise<string | undefined> {
  if (!isSupabaseConfigured || !isVestiaireId(itemId) || inFlight.has(itemId)) return undefined;
  inFlight.add(itemId);
  try {
    const rawId = itemId - VESTIAIRE_ID_OFFSET;
    const { data, error } = await getSupabase().functions.invoke("generate-catalog-image", {
      body: { item_id: rawId },
    });
    if (error || !data?.image_url) return undefined;
    return data.image_url as string;
  } catch {
    return undefined;
  } finally {
    inFlight.delete(itemId);
  }
}
