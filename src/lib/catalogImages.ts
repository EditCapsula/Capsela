import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Item } from "./types";
import { VESTIAIRE_ID_OFFSET, isVestiaireId } from "./vestiaire";

export interface ResolvedItemImage {
  kind: "photo" | "affiliate" | "generated" | "placeholder";
  url?: string;
}

/**
 * Priorité d'affichage impérative (recette 18/08/2026) : photo réelle du
 * dressing utilisateur > image produit affiliée > image catalogue Capsela
 * générée > placeholder. Une image générique Capsela ne remplace jamais la
 * photo réelle d'une pièce ajoutée par l'utilisatrice, et on ne génère
 * jamais un visuel artificiel pour représenter un produit affilié précis
 * qui a déjà sa vraie photo.
 */
export function resolveItemImage(item: Item): ResolvedItemImage {
  if (item.photoUrl) return { kind: "photo", url: item.photoUrl };
  if (item.affiliateImageUrl) return { kind: "affiliate", url: item.affiliateImageUrl };
  if (item.imageUrl) return { kind: "generated", url: item.imageUrl };
  return { kind: "placeholder" };
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
