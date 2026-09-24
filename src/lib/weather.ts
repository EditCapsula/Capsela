import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { CreneauPrevision, Prevision } from "./prevision";
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

/**
 * Prévision pour un lieu nommé — null si indisponible, l'appelant affiche
 * alors « pas encore de prévision » plutôt qu'une valeur inventée.
 *
 * DEUX RAISONS DE RENDRE NULL, VOLONTAIREMENT INDISTINCTES POUR L'APPELANT :
 * la fonction Edge peut échouer (réseau, quota, ville introuvable), ou bien
 * la version déployée peut être ANTÉRIEURE à `mode=forecast`. Dans ce second
 * cas l'ancienne fonction ignore `mode` et renvoie la météo actuelle, c'est-
 * à-dire une réponse sans `slots` — d'où le test de forme ci-dessous plutôt
 * qu'une confiance dans le code de retour. L'app tourne donc correctement
 * avant comme après le redéploiement, sans fenêtre de casse.
 *
 * Mode démo (Supabase non configuré) : aucun appel, comme pour la météo
 * actuelle.
 */
export async function fetchPrevisionByCity(city: string): Promise<Prevision | null> {
  if (!isSupabaseConfigured) return null;
  const nom = city.trim();
  if (!nom) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("weather", {
      body: { city: nom, mode: "forecast" },
    });
    if (error || !data || data.error) return null;
    // Test de FORME, pas de statut : c'est lui qui distingue la nouvelle
    // fonction de l'ancienne.
    if (!Array.isArray(data.slots) || !data.slots.length) return null;
    return {
      city: typeof data.city === "string" ? data.city : nom,
      country: typeof data.country === "string" ? data.country : "",
      timezone: typeof data.timezone === "number" ? data.timezone : 0,
      slots: data.slots.filter(
        (s: unknown): s is CreneauPrevision =>
          !!s &&
          typeof (s as CreneauPrevision).ts === "number" &&
          typeof (s as CreneauPrevision).temp === "number" &&
          typeof (s as CreneauPrevision).label === "string"
      ),
    };
  } catch {
    return null;
  }
}
