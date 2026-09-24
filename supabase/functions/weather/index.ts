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
//
// ------------------------------------------------------------------
// 23/09/2026 — `mode=forecast`, ajouté pour « Planifier une tenue ».
//
// Sans ce paramètre, la réponse est IDENTIQUE à celle d'avant : la tenue du
// jour et l'accueil ne voient aucune différence. Cette fonction peut donc
// être redéployée sans coordination avec le client.
//
// Et l'inverse est vrai aussi, ce qui est le point important : tant que la
// version ci-dessous n'est PAS déployée, l'ancienne ignore `mode` et renvoie
// la météo actuelle — une réponse sans champ `slots`. Le client teste
// exactement ça (lib/weather.ts) et retombe alors sur « prévision
// indisponible », sans erreur visible. Aucune fenêtre de casse entre les
// deux déploiements, dans un sens comme dans l'autre.
//
// L'horizon n'est écrit nulle part : il vaut ce que l'abonnement OpenWeather
// renvoie. /data/2.5/forecast donne 5 jours par pas de 3 h sur le palier
// gratuit ; un palier supérieur en donnerait davantage, et le client s'y
// adapterait sans changer une ligne, puisqu'il déduit l'horizon de la
// longueur de `slots`.

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
  let bodyMode: string | null = null;

  const url = new URL(req.url);
  lat = url.searchParams.get("lat");
  lon = url.searchParams.get("lon");
  city = url.searchParams.get("city");

  if (!lat && !city && req.method === "POST") {
    // (lat/lon ou city viennent toujours avec `mode` : une seule lecture.)
    try {
      const body = await req.json();
      lat = body?.lat != null ? String(body.lat) : null;
      lon = body?.lon != null ? String(body.lon) : null;
      city = body?.city != null ? String(body.city) : null;
      bodyMode = body?.mode != null ? String(body.mode) : null;
    } catch {
      // Corps absent ou illisible : traité comme des paramètres manquants.
    }
  }

  // mode=forecast : prévision, et non plus météo actuelle (23/09/2026,
  // « Planifier une tenue »). Tout le reste de l'app continue d'appeler la
  // fonction SANS ce paramètre et reçoit exactement la même réponse qu'avant.
  let mode = url.searchParams.get("mode");
  if (!mode && bodyMode) mode = bodyMode;

  let query: string;
  if (lat && lon) query = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  else if (city) query = `q=${encodeURIComponent(city)}`;
  else return json({ error: "lat/lon ou city requis" }, 400);

  if (mode === "forecast") {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?${query}&units=metric&lang=fr&appid=${apiKey}`
      );
      if (!res.ok) return json({ error: `OpenWeather a répondu ${res.status}` }, 502);

      const data = await res.json();
      const list: unknown[] = Array.isArray(data.list) ? data.list : [];

      // Proxy mince, comme la branche « météo actuelle » juste en dessous :
      // aucune agrégation ici. Le découpage en jours et en moments de la
      // journée est du vocabulaire applicatif — il vit dans le client
      // (lib/prevision.ts), avec ses tests, et pas dans une fonction qu'il
      // faut redéployer à la main pour corriger une règle de regroupement.
      //
      // `timezone` est renvoyé parce qu'il est indispensable et qu'il n'est
      // pas devinable : les `dt` sont en UTC, or « mardi matin » se lit dans
      // le fuseau du LIEU, pas dans celui du téléphone. Planifier une tenue
      // pour une autre ville sans lui donnerait le bon jour au mauvais
      // endroit.
      const slots = list
        .map((raw) => {
          const e = raw as Record<string, unknown>;
          const w = (e.weather as Record<string, unknown>[] | undefined)?.[0];
          const main = w?.main as string | undefined;
          const label = (main && WEATHER_LABELS[main]) || capitalize((w?.description as string) || "") || "—";
          const temp = (e.main as Record<string, unknown> | undefined)?.temp;
          if (typeof e.dt !== "number" || typeof temp !== "number") return null;
          return { ts: e.dt, temp: Math.round(temp), label };
        })
        .filter((s) => s !== null);

      return json({
        city: data.city?.name || city || "",
        country: data.city?.country || "",
        // Décalage du lieu en secondes (OpenWeather le donne tel quel).
        timezone: typeof data.city?.timezone === "number" ? data.city.timezone : 0,
        slots,
      });
    } catch {
      return json({ error: "Impossible de contacter OpenWeather" }, 502);
    }
  }

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
