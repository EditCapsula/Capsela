import { getSupabase, isSupabaseConfigured } from "./supabase";
import { ticketLu, type ArticleLu, type TicketLu } from "../../supabase/functions/_shared/lectureTicket.ts";

/*
 * AJOUTER DES PIÈCES DEPUIS UN TICKET DE CAISSE (30/10/2026, demandé ; le nom du magasin dans « Marque », arbitré le même jour).
 *
 * La photo du ticket est réduite sur l'appareil, envoyée à la fonction Edge `lire-ticket` (supabase/functions/_shared/lectureTicket.ts),
 * qui ne la garde pas, puis oubliée. Ce qui revient — le magasin et les articles vestimentaires — devient une carte par article dans la
 * liste de l'import (importTenue.ts, brouillonsDepuisTicket), que la personne vérifie et ajoute : rien n'entre au dressing sans elle.
 */

export type { ArticleLu, TicketLu };

/** La photo réduite en JPEG : le côté le plus long à 1 600 px, assez pour lire un ticket, quelques centaines de Ko. */
async function reduire(fichier: File): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * echelle);
  canvas.height = Math.round(bitmap.height * echelle);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * La lecture d'un ticket. `null` : la lecture n'a pas pu se faire (mode démo, hors ligne, quota) — l'écran le dit et propose la saisie à
 * la main. Un ticket lu sans article est rendu tel quel : l'écran dit alors qu'aucun vêtement n'y a été trouvé.
 */
export async function lireTicket(fichier: File): Promise<TicketLu | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const image = await reduire(fichier);
    const { data, error } = await getSupabase().functions.invoke("lire-ticket", { body: { image } });
    if (error) return null;
    return ticketLu(data);
  } catch {
    return null;
  }
}
