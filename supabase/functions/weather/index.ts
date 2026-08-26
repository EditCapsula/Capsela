// Edge Function weather (recette 26/08/2026) — proxy vers OpenWeatherMap.
//
// Reprend à l'identique la route Next /api/weather, qu'elle remplace. Le
// déplacement n'est pas cosmétique : l'export statique de Next
// (output: "export", nécessaire pour l'empaquetage Capacitor) n'embarque
// pas les Route Handlers qui lisent la requête. Cette route était le seul
// morceau de l'app à exiger un serveur Node ; une fois ici, le bundle Next
// devient purement statique et n'a plus besoin d'être hébergé sur un
// serveur d'application.
//
// Fichier volontairement autonome (aucun import), même convention que
// delete-account et analyze-dressing-photo : déployable en copiant-collant
// ce seul fichier dans l'éditeur en ligne du dashboard Supabase.
//
// Sécurité : OPENWEATHER_API_KEY est lue côté serveur uniquement, comme
// elle l'était dans la route Next. Elle n'a jamais transité par le
// navigateur et ne doit jamais porter le préfixe NEXT_PUBLIC_.
//
// Pas de vérification de JWT ici, contrairement à delete-account : la météo
// d'une position n'est pas une donnée personnelle et ne touche aucun
// compte. Le garde-fou est ailleurs — les coordonnées ne sont envoyées que
// si l'utilisatrice a consenti à la géolocalisation (profile.prefs.geoConsent).
//
// Déploiement SANS la CLI Supabase (dashboard) :
//   1. Dashboard Supabase → Edge Functions → "Deploy a new function".
//   2. Nom de la fonction : weather (exactement ce nom).
//   3. Coller l'intégralité de ce fichier, puis Deploy.
//   4. Ajouter le secret OPENWEATHER_API_KEY (Settings → Edge Functions →
//      Secrets), la même valeur que celle utilisée par la route Next.
//
// Déploiement avec la CLI (équivalent) :
//   supabase secrets set OPENWEATHER_API_KEY=...
//   supabase functions deploy weather

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Libellés français des conditions OpenWeather — repris tels quels de la route Next remplacée. */
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) {
    // 501 et non 500 : la fonction est déployée mais pas configurée. Le
    // client traite tout échec de la même façon — repli sur la ville
    // renseignée — donc ce statut ne sert qu'au diagnostic.
    return json({ error: "OPENWEATHER_API_KEY non configurée" }, 501);
  }

  // Coordonnées acceptées dans le corps (invoke envoie du JSON) comme dans
  // la query string, pour rester appelable à la main pendant un test.
  let lat: string | null = null;
  let lon: string | null = null;
  let city: string | null = null;

  const url = new URL(req.url);
  lat = url.searchParams.get("lat");
  lon = url.searchParams.get("lon");
  city = url.searchParams.get("city");

  if (!lat && !city && req.method === "POST") {
    try {
      const body = await req.json();
      lat = body?.lat != null ? String(body.lat) : null;
      lon = body?.lon != null ? String(body.lon) : null;
      city = body?.city != null ? String(body.city) : null;
    } catch {
      // Corps absent ou illisible : traité comme des paramètres manquants.
    }
  }

  let query: string;
  if (lat && lon) query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  else if (city) query = `q=${encodeURIComponent(city)}`;
  else return json({ error: "lat/lon ou city requis" }, 400);

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&lang=fr&appid=${apiKey}`
    );
    if (!res.ok) return json({ error: `OpenWeather a répondu ${res.status}` }, 502);

    const data = await res.json();
    const main: string | undefined = data.weather?.[0]?.main;
    const label = (main && WEATHER_LABELS[main]) || capitalize(data.weather?.[0]?.description) || "—";

    return json({
      city: data.name || city || "",
      country: data.sys?.country || "",
      temp: Math.round(data.main?.temp ?? 0),
      label,
    });
  } catch {
    return json({ error: "Impossible de contacter OpenWeather" }, 502);
  }
});
