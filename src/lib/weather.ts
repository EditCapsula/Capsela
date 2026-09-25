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
      city: typeof data.city === "string" && data.city ? data.city : nom,
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
  return [v.name, v.state, pays].filter(Boolean).join(", ");
}

/**
 * Villes correspondant à un début de saisie — `null` quand l'autocomplétion
 * n'est pas disponible (mode démo, réseau, fonction Edge pas encore
 * redéployée), `[]` quand elle a répondu et ne connaît rien de tel. La
 * distinction compte : le premier cas ne doit rien afficher, le second peut
 * le dire.
 */
export async function fetchVilles(q: string): Promise<VilleSuggeree[] | null> {
  if (!isSupabaseConfigured) return null;
  const nom = q.trim();
  if (nom.length < 2) return [];
  try {
    const { data, error } = await getSupabase().functions.invoke("weather", {
      body: { city: nom, mode: "geo" },
    });
    if (error || !data || (data as { error?: unknown }).error) return null;
    return lireVillesSuggerees(data);
  } catch {
    return null;
  }
}
