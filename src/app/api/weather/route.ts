import type { NextRequest } from "next/server";

/**
 * Proxy serveur vers OpenWeatherMap (Current Weather Data API) — la clé
 * (OPENWEATHER_API_KEY, sans préfixe NEXT_PUBLIC_) reste côté serveur,
 * jamais exposée au bundle client. Alimente la météo de géolocalisation
 * (recette "Localisation & météo", profile.prefs.geoConsent/weatherFromGeo)
 * quand l'utilisatrice y a consenti — sinon l'app retombe sur la liste de
 * villes simulée (CITIES, data.ts), jamais d'erreur bloquante.
 */

const WEATHER_LABELS: Record<string, string> = {
  Clear: "Ensoleillé",
  Clouds: "Nuageux",
  Rain: "Pluvieux",
  Drizzle: "Pluie légère",
  Thunderstorm: "Orageux",
  Snow: "Neigeux",
  Mist: "Brumeux",
  Fog: "Brumeux",
  Haze: "Brumeux",
  Smoke: "Brumeux",
  Dust: "Poussière",
  Sand: "Sable",
  Ash: "Cendres",
  Squall: "Rafales",
  Tornado: "Tornade",
};

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENWEATHER_API_KEY non configurée" }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const city = searchParams.get("city");

  let query: string;
  if (lat && lon) query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  else if (city) query = `q=${encodeURIComponent(city)}`;
  else return Response.json({ error: "lat/lon ou city requis" }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&lang=fr&appid=${apiKey}`
    );
    if (!res.ok) {
      return Response.json({ error: `OpenWeather a répondu ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const main: string | undefined = data.weather?.[0]?.main;
    const label = (main && WEATHER_LABELS[main]) || capitalize(data.weather?.[0]?.description) || "—";

    return Response.json({
      city: data.name || city || "",
      country: data.sys?.country || "",
      temp: Math.round(data.main?.temp ?? 0),
      label,
    });
  } catch {
    return Response.json({ error: "Impossible de contacter OpenWeather" }, { status: 502 });
  }
}
