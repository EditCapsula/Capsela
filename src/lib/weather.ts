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

/** Météo réelle (OpenWeatherMap, via /api/weather) pour une position donnée — null si indisponible, l'appelant retombe alors sur la liste de villes simulée. */
export async function fetchWeatherByCoords(lat: number, lon: number): Promise<City | null> {
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data as City;
  } catch {
    return null;
  }
}
