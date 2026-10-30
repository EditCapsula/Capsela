import { CATEGORIES_IDEES, type IdeeSejour } from "./activitesSejour";
import { ACTIVITES } from "./programmeValise";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { ideesLues } from "../../supabase/functions/_shared/ideesSejour.ts";

/*
 * LES IDÉES D'ACTIVITÉS D'UNE DESTINATION (30/10/2026, brief « Refonte UX de l'étape Activités »), servies par la fonction Edge
 * `lire-evenement` (supabase/functions/_shared/ideesSejour.ts). Jamais bloquantes : en mode démo, hors ligne, au-delà du quota ou sur une
 * réponse inutilisable, null — l'écran propose alors ses idées de repli (IDEES_GENERIQUES). Une réponse est gardée sur l'appareil par
 * destination : revenir à l'étape, ou rouvrir la valise, ne redemande rien.
 */

const CLE_CACHE = "capsela.ideesSejour";
const CACHE_MAX = 20;

const cleDestination = (destination: string) => destination.trim().toLowerCase();

function lireCache(): Record<string, IdeeSejour[]> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_CACHE) ?? "{}");
    return brut && typeof brut === "object" ? brut : {};
  } catch {
    return {};
  }
}

function ecrireCache(destination: string, idees: IdeeSejour[]) {
  try {
    const cache = lireCache();
    cache[cleDestination(destination)] = idees;
    const cles = Object.keys(cache);
    for (const c of cles.slice(0, Math.max(0, cles.length - CACHE_MAX))) delete cache[c];
    localStorage.setItem(CLE_CACHE, JSON.stringify(cache));
  } catch {
    // Stockage indisponible : la réponse n'est simplement pas gardée.
  }
}

/** Les idées déjà reçues pour cette destination, sans appel. */
export function ideesGardees(destination: string): IdeeSejour[] | null {
  const idees = lireCache()[cleDestination(destination)];
  return Array.isArray(idees) && idees.length ? (ideesLues({ idees }) as IdeeSejour[]) : null;
}

export async function ideesPourDestination(destination: string): Promise<IdeeSejour[] | null> {
  const propre = destination.trim();
  if (propre.length < 2) return null;
  const gardees = ideesGardees(propre);
  if (gardees) return gardees;
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("lire-evenement", { body: { destination: propre } });
    if (error) return null;
    const idees = ideesLues(data) as IdeeSejour[];
    if (!idees.length) return null;
    ecrireCache(propre, idees);
    return idees;
  } catch {
    return null;
  }
}

/** Les familles et les activités du serveur sont celles de l'app (verrouillé par un test). */
export const CATEGORIES_APP = CATEGORIES_IDEES.map((c) => c.id);
export const ACTIVITES_APP = ACTIVITES.map((a) => a.id);
