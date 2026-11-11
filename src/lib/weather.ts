import { estNatif } from "./authNatif";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { CreneauPrevision, Prevision } from "./prevision";
import type { City } from "./types";
import { PAYS, type Pays } from "./paysData";

/** Une position : ce que la météo et la ville en lisent, rien de plus. */
export interface PositionLue {
  coords: { latitude: number; longitude: number };
}

/**
 * La position de l'appareil — résout à null (jamais de rejet) si elle est absente, refusée ou expire, pour ne jamais bloquer l'app.
 *
 * DANS L'APP iOS ET ANDROID, LE PLUGIN NATIF (11/11/2026, signalé dans la vidéo pour Apple : « localhost aimerait utiliser votre position
 * actuelle »). L'app sert son site embarqué depuis `capacitor://localhost` : l'API web de position y ouvrait la fenêtre de la vue web, au
 * nom du « site » localhost. Le plugin natif ouvre celle du système, au nom de Capsela, avec le texte d'Info.plist
 * (NSLocationWhenInUseUsageDescription). Le site web garde l'API du navigateur.
 */
export async function getBrowserPosition(): Promise<PositionLue | null> {
  if (estNatif()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const statut = await Geolocation.checkPermissions();
      const accordee = statut.location === "granted" || statut.coarseLocation === "granted";
      if (!accordee) {
        const demande = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
        if (demande.location !== "granted" && demande.coarseLocation !== "granted") return null;
      }
      const pos = await Geolocation.getCurrentPosition({ timeout: 8000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false });
      return { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } };
    } catch {
      // Refus, service de localisation coupé, délai : la ville du profil prend le relais, comme sur le web.
      return null;
    }
  }
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
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
 * Météo ACTUELLE d'une ville, par son nom (correctif du 25/09/2026). Même
 * fonction Edge et même appel que par coordonnées — `{ city }` au lieu de
 * `{ lat, lon }`, un chemin que la fonction sert depuis toujours : aucun
 * redéploiement. Null en mode démo, en cas d'échec ou de réponse mal formée.
 */
export async function fetchWeatherByCity(city: string): Promise<City | null> {
  if (!isSupabaseConfigured) return null;
  const nom = city.trim();
  if (!nom) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("weather", { body: { city: nom } });
    if (error || !data || data.error || typeof data.temp !== "number" || typeof data.label !== "string") return null;
    return {
      // LA VILLE DEMANDÉE, PAS CELLE QUE L'API RENVOIE (recette du 26/09/2026) :
      // OpenWeather nomme sa station ou sa localité la plus proche — un
      // quartier que l'utilisatrice n'a jamais choisi. Elle a donné une ville,
      // on affiche cette ville ; la précision de l'API reste interne.
      city: nom,
      country: typeof data.country === "string" ? data.country : "",
      temp: data.temp,
      label: data.label,
    };
  } catch {
    return null;
  }
}

/** D'où vient la météo affichée — dit à l'écran, jamais tu. */
export type SourceMeteo = "position" | "ville" | "derniere_position" | "defaut";

/**
 * LA RÈGLE UNIQUE DU CHOIX DE LA MÉTÉO (correctif du 25/09/2026).
 *
 * Avant : position en direct, sinon DERNIÈRE POSITION CONNUE, sinon une
 * entrée de CITIES — dont la température est écrite en dur (Paris 24°,
 * Ensoleillé). Trois défauts : la ville du profil n'était jamais interrogée ;
 * la dernière position gardait la température du jour où elle avait été
 * enregistrée, présentée comme celle d'aujourd'hui ; et elle passait devant
 * la ville même quand « Utiliser la météo de ma position » était désactivé.
 *
 * Désormais, dans l'ordre :
 *   1. la position en direct, si la géolocalisation l'a donnée ;
 *   2. la VRAIE météo actuelle de la ville du profil ;
 *   3. la dernière position connue — seulement si la météo de position est
 *      activée : c'est un repli de la géolocalisation, pas de la ville ;
 *   4. des valeurs par défaut, annoncées comme telles à l'écran. La ville
 *      affichée reste celle du profil : on ne montre pas « Paris » à qui
 *      habite ailleurs, et l'écran dit que la météo est indisponible.
 */
export function choisirMeteo(e: {
  live: City | null;
  ville: City | null;
  derniere: City | null;
  geoActive: boolean;
  villeProfil: string;
  defauts: City[];
}): { city: City; source: SourceMeteo } {
  if (e.live) return { city: e.live, source: "position" };
  if (e.ville) return { city: e.ville, source: "ville" };
  if (e.geoActive && e.derniere) return { city: e.derniere, source: "derniere_position" };
  const nom = e.villeProfil.trim();
  const base = e.defauts.find((c) => c.city === nom) ?? e.defauts[0];
  return { city: { ...base, city: nom || base.city }, source: "defaut" };
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
export async function fetchPrevisionByCity(city: string, coords?: { lat: number; lon: number } | null): Promise<Prevision | null> {
  if (!isSupabaseConfigured) return null;
  const nom = city.trim();
  if (!nom) return null;
  try {
    // LES COORDONNÉES PRIMENT SUR LE NOM quand une suggestion a été choisie :
    // « Parme » et « Paros » ne sont plus départagés par une chaîne que
    // l'API réinterprète, mais par le point exact que l'utilisatrice a
    // désigné. Le nom reste envoyé pour l'affichage de repli.
    const { data, error } = await getSupabase().functions.invoke("weather", {
      body: coords ? { lat: coords.lat, lon: coords.lon, mode: "forecast" } : { city: nom, mode: "forecast" },
    });
    if (error || !data || data.error) return null;
    // Test de FORME, pas de statut : c'est lui qui distingue la nouvelle
    // fonction de l'ancienne.
    if (!Array.isArray(data.slots) || !data.slots.length) return null;
    return {
      // Le nom demandé (saisi, ou celui de la suggestion choisie), jamais le
      // `city.name` de /forecast : interrogé par coordonnées, il rend la
      // localité de la station (« Quartier du Palais-Royal » pour Paris).
      // Même règle que fetchWeatherByCity (recette du 26/09/2026).
      city: nom,
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

/**
 * Une ville proposée par l'autocomplétion. `lat`/`lon` sont la raison d'être
 * de la suggestion : ce sont eux, et non le nom, qui partent ensuite chercher
 * la prévision.
 */
export interface VilleSuggeree {
  name: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
  /** Renseigné quand la saisie était un PAYS : le nom du pays, dont cette ville est la capitale retenue pour la météo (14/10/2026). */
  capitaleDe?: string;
}

/**
 * Suggestions lues d'une réponse `mode=geo` — fonction PURE, donc testée.
 *
 * Trois choses s'y jouent, et aucune n'est du ressort de la fonction Edge :
 *
 * 1. LE TEST DE FORME. Une fonction `weather` antérieure au 24/09/2026 ignore
 *    `mode` et renvoie la météo actuelle : un objet sans `places`. On rend
 *    alors `null` — pas un tableau vide — pour que l'appelant distingue
 *    « aucune ville ne correspond » de « l'autocomplétion n'existe pas ici »
 *    et retombe sur la saisie libre sans rien afficher.
 * 2. LE DÉDOUBLONNAGE. /geo/1.0/direct rend volontiers plusieurs entrées pour
 *    une même ville (arrondissements, doublons de base). La clé retenue est
 *    nom + région + pays : deux « Paris » du Texas et de France restent deux
 *    lignes, deux « Paris, FR » n'en font qu'une.
 * 3. RIEN D'AUTRE. Pas de tri par popularité : OpenWeather rend déjà ses
 *    résultats par pertinence, et les réordonner sur un critère inventé
 *    ferait remonter la mauvaise ville avec l'air d'être sûr de soi.
 */
export function lireVillesSuggerees(data: unknown): VilleSuggeree[] | null {
  const o = data as { places?: unknown } | null;
  if (!o || !Array.isArray(o.places)) return null;
  const vues = new Set<string>();
  const out: VilleSuggeree[] = [];
  for (const raw of o.places) {
    const v = raw as Partial<VilleSuggeree> | null;
    if (!v || typeof v.name !== "string" || !v.name) continue;
    if (typeof v.lat !== "number" || typeof v.lon !== "number") continue;
    const country = typeof v.country === "string" ? v.country : "";
    const state = typeof v.state === "string" ? v.state : "";
    const cle = `${v.name}|${state}|${country}`.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    out.push({ name: v.name, country, state, lat: v.lat, lon: v.lon });
  }
  return out;
}

/**
 * Libellé affiché d'une suggestion — « Paris, France », « Paris, Texas,
 * États-Unis ».
 *
 * Le code pays d'OpenWeather est un ISO 3166-1 alpha-2 (« FR »). `Intl.
 * DisplayNames` le traduit sans embarquer une table de 250 entrées qu'il
 * faudrait maintenir ; là où il n'existe pas, le code brut reste affiché,
 * ce qui est laid mais jamais faux.
 */
export function libelleVille(v: VilleSuggeree): string {
  let pays = v.country;
  try {
    pays = new Intl.DisplayNames(["fr"], { type: "region" }).of(v.country) || v.country;
  } catch {
    // Environnement sans données de localisation : on garde le code.
  }
  const base = [v.name, v.state, pays].filter(Boolean).join(", ");
  // Un pays saisi (« Thaïlande ») : la météo est celle de sa capitale, dite comme telle.
  return v.capitaleDe ? `${base} (capitale)` : base;
}

const sansAccent = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * UN PAYS SAISI À LA PLACE D'UNE VILLE (14/10/2026, signalé : « Thaïlande » ne donnait rien dans la valise ; repris le 11/11/2026,
 * signalé : « lorsque je saisis un pays le moteur ne trouve pas »). Les pays viennent de la liste de l'app (paysData.ts) — REST Countries
 * v3.1 a fermé — et sont cherchés à CHAQUE saisie, plus seulement quand le géocodage ne rend aucune ville : il rendait presque toujours
 * des villages homonymes (« Japon » en Colombie, « Espagne » en France). Fonction PURE, donc testée.
 *
 * Un nom exact d'abord (français ou anglais, courant ou officiel, sans accent ni casse), puis, dès trois lettres, les noms qui commencent
 * par la saisie (« Ind » : Inde, Indonésie). Au plus `max` pays.
 */
export function paysDeLaSaisie(saisie: string, max = 3): Pays[] {
  const voulu = sansAccent(saisie);
  if (voulu.length < 2) return [];
  const rang = (p: Pays): number => {
    const noms = p.noms.map(sansAccent);
    if (noms.includes(voulu)) return 0;
    if (voulu.length >= 3 && noms.some((n) => n.startsWith(voulu))) return 1;
    return 2;
  };
  return PAYS.map((p) => ({ p, r: rang(p) }))
    .filter((x) => x.r < 2)
    .sort((a, b) => a.r - b.r || a.p.nom.localeCompare(b.p.nom, "fr"))
    .slice(0, max)
    .map((x) => x.p);
}

/**
 * La capitale d'un pays, en ville suggérée : ses coordonnées par le géocodage de l'app (« Bangkok,TH »), jamais inventées. Gardée par
 * pays le temps de la session : la saisie se tape lettre à lettre. null : introuvable.
 */
const capitalesGardees = new Map<string, Promise<VilleSuggeree | null>>();
function capitaleDuPays(p: Pays): Promise<VilleSuggeree | null> {
  const deja = capitalesGardees.get(p.code);
  if (deja) return deja;
  const promesse = getSupabase()
    .functions.invoke("weather", { body: { city: `${p.capitale},${p.code}`, mode: "geo" } })
    .then(({ data, error }) => {
      if (error || !data || (data as { error?: unknown }).error) return null;
      const v = lireVillesSuggerees(data)?.[0];
      return v ? { ...v, capitaleDe: p.nom } : null;
    })
    .catch(() => null);
  capitalesGardees.set(p.code, promesse);
  // Un échec ne se garde pas : la saisie suivante retente.
  promesse.then((v) => v ?? capitalesGardees.delete(p.code));
  return promesse;
}

/**
 * Villes correspondant à un début de saisie — `null` quand l'autocomplétion
 * n'est pas disponible (mode démo, réseau, fonction Edge pas encore
 * redéployée), `[]` quand elle a répondu et ne connaît rien de tel. La
 * distinction compte : le premier cas ne doit rien afficher, le second peut
 * le dire.
 */
export async function fetchVilles(q: string, pays?: string): Promise<VilleSuggeree[] | null> {
  if (!isSupabaseConfigured) return null;
  const nom = q.trim();
  if (nom.length < 2) return [];
  try {
    // `pays` (code ISO, 30/10/2026) : la recherche « ville,pays » du géocodage, restreinte à ce pays — jamais de repli sur une capitale.
    const { data, error } = await getSupabase().functions.invoke("weather", {
      body: { city: pays ? `${nom},${pays}` : nom, mode: "geo" },
    });
    if (error || !data || (data as { error?: unknown }).error) return null;
    const villes = lireVillesSuggerees(data);
    if (pays) return villes;
    // Un pays saisi passe en tête, par sa capitale (paysDeLaSaisie), avant les villes homonymes.
    const capitales = (await Promise.all(paysDeLaSaisie(nom).map(capitaleDuPays))).filter((v): v is VilleSuggeree => !!v);
    if (!capitales.length) return villes;
    const memeLieu = (a: VilleSuggeree, b: VilleSuggeree) => a.country === b.country && Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
    return [...capitales, ...(villes ?? []).filter((v) => !capitales.some((c) => memeLieu(c, v)))];
  } catch {
    return null;
  }
}

/**
 * La ville où se trouve une position (« Utiliser ma position actuelle », 08/10/2026) : /geo/1.0/reverse via la fonction Edge
 * `weather` en `mode=reverse`, avec le même test de forme que l'autocomplétion. Une fonction Edge pas encore redéployée ignore
 * le mode et renvoie la météo actuelle : on s'en sert alors pour le nom (`fetchWeatherByCoords`), sans région. `null` : introuvable.
 */
export async function fetchVilleParPosition(lat: number, lon: number): Promise<VilleSuggeree | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("weather", { body: { lat, lon, mode: "reverse" } });
    if (!error && data && !(data as { error?: unknown }).error) {
      const lues = lireVillesSuggerees(data);
      if (lues && lues.length) return { ...lues[0], lat, lon };
    }
  } catch {
    // on retente avec la météo actuelle ci-dessous
  }
  const c = await fetchWeatherByCoords(lat, lon).catch(() => null);
  return c ? { name: c.city, country: c.country ?? "", state: "", lat, lon } : null;
}

/**
 * La prévision d'un lieu, GARDÉE dix minutes par POINT (latitude, longitude arrondies à 0,01) ou, sans coordonnées, par nom. La
 * prévision couvre plusieurs jours : une même ville ne rappelle donc pas la fonction à chaque changement de date, ni quand l'étape
 * « Où » puis « Quand » la demandent toutes deux. Une réponse vide n'est pas gardée : l'affichage suivant retente.
 */
const DUREE_PREVISION_MS = 10 * 60 * 1000;
const previsionsGardees = new Map<string, { a: number; p: Promise<Prevision | null> }>();

export function clePrevision(nom: string, coords?: { lat: number; lon: number } | null): string {
  return coords ? `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}` : nom.trim().toLowerCase();
}

export function previsionGardee(nom: string, coords?: { lat: number; lon: number } | null): Promise<Prevision | null> {
  const cle = clePrevision(nom, coords);
  const gardee = previsionsGardees.get(cle);
  if (gardee && Date.now() - gardee.a < DUREE_PREVISION_MS) return gardee.p;
  const p = fetchPrevisionByCity(nom, coords).catch(() => null);
  previsionsGardees.set(cle, { a: Date.now(), p });
  void p.then((r) => {
    if (!r) previsionsGardees.delete(cle);
  });
  return p;
}

/** Les températures habituelles d'un lieu à une date (moyenne des cinq années précédentes, ± 3 jours) — jamais une prévision. */
export interface Climat {
  tempMin: number;
  tempMax: number;
  /** Part des jours de pluie (≥ 1 mm), de 0 à 1. */
  pluie: number;
  annees: number;
}

const climatsGardes = new Map<string, Promise<Climat | null>>();

/**
 * Climatologie d'un POINT à une date (`mode=climate` de la fonction Edge). Gardée pour la session : elle ne change pas d'un appel à
 * l'autre. `null` : mode démo, réseau, ou fonction Edge pas encore redéployée (elle ignore `mode` — réponse sans `climat`, détectée par
 * la forme) ; l'appelant retombe alors sur la température habituelle de la saison.
 */
export function fetchClimat(coords: { lat: number; lon: number }, date: Date): Promise<Climat | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  const mois = date.getMonth() + 1;
  const jour = date.getDate();
  const cle = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}|${mois}-${jour}`;
  const gardee = climatsGardes.get(cle);
  if (gardee) return gardee;
  const p = (async () => {
    try {
      const { data, error } = await getSupabase().functions.invoke("weather", { body: { lat: coords.lat, lon: coords.lon, mois, jour, mode: "climate" } });
      const c = (data as { climat?: Partial<Climat> } | null)?.climat;
      if (error || !c || typeof c.tempMin !== "number" || typeof c.tempMax !== "number") return null;
      return { tempMin: c.tempMin, tempMax: c.tempMax, pluie: typeof c.pluie === "number" ? c.pluie : 0, annees: typeof c.annees === "number" ? c.annees : 0 };
    } catch {
      return null;
    }
  })();
  climatsGardes.set(cle, p);
  void p.then((r) => {
    if (!r) climatsGardes.delete(cle);
  });
  return p;
}
