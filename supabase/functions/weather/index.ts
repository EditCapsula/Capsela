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
// 24/09/2026 — `mode=geo`, autocomplétion de ville pour « Planifier une
// tenue ». Même remarque de compatibilité que `mode=forecast` ci-dessous :
// sans le paramètre, la réponse ne change pas d'un octet, et AVANT le
// redéploiement l'ancienne fonction ignore `mode` et rend la météo actuelle —
// une réponse sans `places`, que le client détecte par la FORME et traite
// comme « pas de suggestion », en retombant sur la saisie libre. Aucune
// fenêtre de casse dans un sens comme dans l'autre.
//
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


// ------------------------------------------------------------------
// 09/2026 — PRÉVISIONS JUSQU'À 16 JOURS ET CLIMATOLOGIE, via Open-Meteo (gratuit, sans clé).
//
// Pourquoi : le palier gratuit d'OpenWeather ne donne que 5 jours de prévision (4 retenus par l'app). Open-Meteo en donne 16, par
// heure, avec les mêmes coordonnées — et un historique (1940 →) dont on tire la CLIMATOLOGIE d'un lieu à une date : au-delà de 16 jours,
// aucune prévision fiable n'existe, l'app dit « températures habituelles ».
//
// COMPATIBILITÉ : `mode=forecast` garde exactement sa forme de réponse ({ city, country, timezone, slots }) ; les créneaux sont toujours
// des points de ts/temp/label, le client ne change pas de lecture. Si Open-Meteo échoue, la branche OpenWeather d'origine répond (5 jours).
// `mode=climate` est nouveau : une fonction non redéployée l'ignore, le client le détecte par la FORME de la réponse (`climat`).
//
// LICENCE : Open-Meteo est gratuit pour un usage NON commercial ; un usage commercial demande son plan payant (open-meteo.com/en/pricing).

/** Codes météo WMO → les libellés que l'app reconnaît déjà (isRainy, labelPrecipitation, isSunny). */
function libelleWmo(code: number): string {
  if (code === 0) return "Ensoleillé";
  if (code === 1 || code === 2) return "Éclaircies";
  if (code === 3) return "Nuageux";
  if (code === 45 || code === 48) return "Brumeux";
  if (code >= 51 && code <= 57) return "Pluie légère";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Pluvieux";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Neigeux";
  if (code >= 95) return "Orageux";
  return "Nuageux";
}

async function geocoderParNom(nom: string): Promise<{ lat: number; lon: number; name: string; country: string } | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nom)}&count=1&language=fr&format=json`);
    if (!res.ok) return null;
    const d = await res.json();
    const r = Array.isArray(d.results) ? d.results[0] : null;
    if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") return null;
    return { lat: r.latitude, lon: r.longitude, name: r.name || nom, country: r.country_code || "" };
  } catch {
    return null;
  }
}

/** Prévision horaire sur 16 jours, ramenée à un point toutes les 3 h (la forme d'OpenWeather) : ts en secondes UTC, au fuseau du LIEU. */
async function previsionOpenMeteo(lat: string, lon: string): Promise<{ timezone: number; slots: { ts: number; temp: number; label: string }[] } | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
        `&hourly=temperature_2m,weather_code&forecast_days=16&timezone=auto&timeformat=unixtime`
    );
    if (!res.ok) return null;
    const d = await res.json();
    const t: unknown[] = d?.hourly?.time ?? [];
    const temps: unknown[] = d?.hourly?.temperature_2m ?? [];
    const codes: unknown[] = d?.hourly?.weather_code ?? [];
    const slots: { ts: number; temp: number; label: string }[] = [];
    for (let i = 0; i < t.length; i++) {
      const ts = t[i], temp = temps[i], code = codes[i];
      if (typeof ts !== "number" || typeof temp !== "number" || typeof code !== "number") continue;
      // Un point sur trois (0 h, 3 h, 6 h…, heure locale) : le client agrège par fenêtres et n'a pas besoin du pas horaire.
      if (((ts + (d.utc_offset_seconds ?? 0)) / 3600) % 3 !== 0) continue;
      slots.push({ ts, temp: Math.round(temp), label: libelleWmo(code) });
    }
    return slots.length ? { timezone: typeof d.utc_offset_seconds === "number" ? d.utc_offset_seconds : 0, slots } : null;
  } catch {
    return null;
  }
}

/**
 * CLIMATOLOGIE d'un lieu à une date : les cinq années précédentes, fenêtre de ± 3 jours autour de la même date, moyenne des
 * minimales et maximales et part des jours de pluie (≥ 1 mm). Rien n'est inventé : ce sont des mesures passées, dites comme telles.
 */
async function climatologie(lat: string, lon: string, mois: number, jour: number): Promise<{ tempMin: number; tempMax: number; pluie: number; annees: number } | null> {
  const an = new Date().getUTCFullYear();
  const requetes = [1, 2, 3, 4, 5].map(async (k) => {
    const centre = Date.UTC(an - k, mois - 1, jour);
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    try {
      const res = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
          `&start_date=${iso(centre - 3 * 86400000)}&end_date=${iso(centre + 3 * 86400000)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      );
      if (!res.ok) return null;
      const d = await res.json();
      return d?.daily ?? null;
    } catch {
      return null;
    }
  });
  const reponses = (await Promise.all(requetes)).filter((r) => r);
  const maxs: number[] = [], mins: number[] = [], pluies: number[] = [];
  for (const r of reponses) {
    for (const v of r.temperature_2m_max ?? []) if (typeof v === "number") maxs.push(v);
    for (const v of r.temperature_2m_min ?? []) if (typeof v === "number") mins.push(v);
    for (const v of r.precipitation_sum ?? []) if (typeof v === "number") pluies.push(v >= 1 ? 1 : 0);
  }
  if (!maxs.length || !mins.length) return null;
  const moy = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return { tempMin: Math.round(moy(mins)), tempMax: Math.round(moy(maxs)), pluie: pluies.length ? Math.round((moy(pluies) + Number.EPSILON) * 100) / 100 : 0, annees: reponses.length };
}

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
  let corpsMois: unknown = null;
  let corpsJour: unknown = null;

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
      corpsMois = body?.mois;
      corpsJour = body?.jour;
    } catch {
      // Corps absent ou illisible : traité comme des paramètres manquants.
    }
  }

  // mode=forecast : prévision, et non plus météo actuelle (23/09/2026,
  // « Planifier une tenue »). Tout le reste de l'app continue d'appeler la
  // fonction SANS ce paramètre et reçoit exactement la même réponse qu'avant.
  let mode = url.searchParams.get("mode");
  if (!mode && bodyMode) mode = bodyMode;

  // mode=geo : autocomplétion de ville (recette 24/09/2026). MÊME CLÉ, MÊME
  // FOURNISSEUR — /geo/1.0/direct fait partie du palier gratuit OpenWeather
  // déjà utilisé ici. Aucun nouveau service, aucun nouveau secret.
  //
  // Placé avant la construction de `query` : celle-ci exige lat/lon ou city,
  // alors que la recherche part d'un fragment de nom (« Par… ») qui n'est ni
  // l'un ni l'autre.
  //
  // Renvoie les COORDONNÉES en plus du nom. C'est tout l'intérêt : la
  // prévision se demande ensuite sur lat/lon, donc sur le lieu choisi, et non
  // sur une chaîne que /data/2.5/forecast réinterprète à sa façon — c'est ce
  // qui règle « Parme » rendu pour « Parm » et les homonymes.
  if (mode === "geo") {
    const q = (city || "").trim();
    if (q.length < 2) return json({ places: [] });
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`
      );
      if (!res.ok) return json({ error: `OpenWeather a répondu ${res.status}` }, 502);
      const data = await res.json();
      const brut: unknown[] = Array.isArray(data) ? data : [];
      // Proxy mince, comme les deux autres branches : le nom affiché, le
      // dédoublonnage et la mise en forme sont du vocabulaire applicatif et
      // vivent côté client, avec leurs tests.
      const places = brut
        .map((raw) => {
          const e = raw as Record<string, unknown>;
          // local_names.fr quand il existe : « Londres » plutôt que « London ».
          const locales = e.local_names as Record<string, string> | undefined;
          const name = (locales?.fr as string | undefined) || (e.name as string | undefined) || "";
          if (!name || typeof e.lat !== "number" || typeof e.lon !== "number") return null;
          return {
            name,
            country: typeof e.country === "string" ? e.country : "",
            state: typeof e.state === "string" ? e.state : "",
            lat: e.lat,
            lon: e.lon,
          };
        })
        .filter((v) => v !== null);
      return json({ places });
    } catch {
      return json({ error: "Impossible de contacter OpenWeather" }, 502);
    }
  }

  // mode=reverse : la ville d'une position (08/10/2026, « Utiliser ma position actuelle » de Planifier). Même clé, même palier
  // gratuit : /geo/1.0/reverse. Même forme de réponse que mode=geo (`places`), donc la même lecture côté client.
  if (mode === "reverse") {
    if (!lat || !lon) return json({ error: "lat/lon requis" }, 400);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=1&appid=${apiKey}`
      );
      if (!res.ok) return json({ error: `OpenWeather a répondu ${res.status}` }, 502);
      const data = await res.json();
      const brut: unknown[] = Array.isArray(data) ? data : [];
      const places = brut
        .map((raw) => {
          const e = raw as Record<string, unknown>;
          const locales = e.local_names as Record<string, string> | undefined;
          const name = (locales?.fr as string | undefined) || (e.name as string | undefined) || "";
          if (!name || typeof e.lat !== "number" || typeof e.lon !== "number") return null;
          return {
            name,
            country: typeof e.country === "string" ? e.country : "",
            state: typeof e.state === "string" ? e.state : "",
            lat: e.lat,
            lon: e.lon,
          };
        })
        .filter((v) => v !== null);
      return json({ places });
    } catch {
      return json({ error: "Impossible de contacter OpenWeather" }, 502);
    }
  }

  // mode=climate : les températures habituelles d'un lieu à une date (09/2026) — body { lat, lon, mois, jour }.
  if (mode === "climate") {
    const mois = Number(corpsMois), jr = Number(corpsJour);
    if (!lat || !lon || !(mois >= 1 && mois <= 12) || !(jr >= 1 && jr <= 31)) return json({ error: "lat, lon, mois et jour requis" }, 400);
    const climat = await climatologie(lat, lon, mois, jr);
    return climat ? json({ climat }) : json({ error: "Climatologie indisponible" }, 502);
  }

  // mode=forecast : d'abord Open-Meteo (16 jours) ; sans coordonnées, le nom est géocodé. Échec : la branche OpenWeather ci-dessous (5 jours).
  if (mode === "forecast") {
    let la = lat, lo = lon, nom = city || "", pays = "";
    if ((!la || !lo) && city) {
      const g = await geocoderParNom(city);
      if (g) {
        la = String(g.lat);
        lo = String(g.lon);
        nom = g.name;
        pays = g.country;
      }
    }
    if (la && lo) {
      const p = await previsionOpenMeteo(la, lo);
      if (p) return json({ city: nom, country: pays, timezone: p.timezone, slots: p.slots });
    }
  }

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
