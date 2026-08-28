import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { City } from "./types";

/** Position navigateur — résout à null (jamais de rejet) si l'API est absente, refusée ou expire, pour ne jamais bloquer l'app. */
export function getBrowserPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

/**
 * Météo réelle (OpenWeatherMap) pour une position donnée — null si
 * indisponible, l'appelant retombe alors sur la liste de villes simulée.
 *
 * Passe par la fonction Edge `weather` et non plus par la route Next
 * /api/weather (recette 26/08/2026) : l'export statique nécessaire à
 * l'empaquetage Capacitor n'embarque pas les Route Handlers. La clé
 * OpenWeather reste côté serveur, comme avant — elle vit désormais dans les
 * secrets Supabase.
 *
 * Mode démo (Supabase non configuré) : aucun appel, l'app utilise sa liste
 * de villes simulée. Le comportement est identique à celui d'un échec
 * réseau, jamais une erreur visible.
 */
export async function fetchWeatherByCoords(lat: number, lon: number): Promise<City | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("weather", { body: { lat, lon } });
    if (error || !data || data.error) return null;
    return data as City;
  } catch {
    return null;
  }
}
