import type { VilleSuggeree } from "./weather";

/*
 * L'ÉTAPE « OÙ » DE PLANIFIER (08/10/2026) : des fonctions pures pour présenter les villes, et les villes récentes gardées sur
 * l'appareil. Aucune image de destination : un lieu se dit par son nom, son pays et sa météo.
 */

function nomDuPays(code: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

/** Une ville de la liste : le nom domine, le contexte géographique est secondaire. */
export interface ResultatVille {
  ville: VilleSuggeree;
  principal: string;
  secondaire: string;
  /** Le libellé retenu quand on choisit cette ville : « Rome, Italie », ou « Rome, Georgia, États-Unis » quand le nom seul ne suffit pas. */
  libelle: string;
}

/**
 * Présente les résultats de l'autocomplétion SANS les afficher bruts : « Rome / Italie », pas « Rome, Lazio, Italie ». La région n'est
 * montrée que si elle sert à distinguer deux villes de même nom dans le même pays (« Rome / Georgia, États-Unis » et « Rome / New York,
 * États-Unis ») : jamais deux lignes qui diraient seulement « Rome ».
 */
export function presenterResultats(villes: VilleSuggeree[]): ResultatVille[] {
  const memeNomEtPays = new Map<string, number>();
  for (const v of villes) {
    const cle = `${v.name}|${v.country}`.toLowerCase();
    memeNomEtPays.set(cle, (memeNomEtPays.get(cle) ?? 0) + 1);
  }
  return villes.map((v) => {
    const pays = nomDuPays(v.country);
    const ambigu = (memeNomEtPays.get(`${v.name}|${v.country}`.toLowerCase()) ?? 0) > 1;
    const region = ambigu && v.state && v.state !== v.name ? v.state : "";
    const secondaire = [region, pays].filter(Boolean).join(", ");
    return { ville: v, principal: v.name, secondaire, libelle: [v.name, secondaire].filter(Boolean).join(", ") };
  });
}

/** Ce qui se range avec la tenue planifiée et s'affiche sur la carte de la destination. */
export function libelleDestination(v: VilleSuggeree, villesDeLaListe: VilleSuggeree[] = [v]): string {
  const liste = villesDeLaListe.some((x) => x.lat === v.lat && x.lon === v.lon) ? villesDeLaListe : [v, ...villesDeLaListe];
  return presenterResultats(liste).find((r) => r.ville.lat === v.lat && r.ville.lon === v.lon)?.libelle ?? v.name;
}

// ── VILLES RÉCENTES ──────────────────────────────────────────────────

export const NB_VILLES_RECENTES = 6;
export const CLE_VILLES_RECENTES = "capsela.villesRecentes";

export interface VilleRecente extends VilleSuggeree {
  /** Le libellé au moment du choix (« Rome, Italie »). */
  libelle: string;
}

const memePoint = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

/** La ville choisie en tête, sans doublon (même point), six au plus. */
export function ajouterRecente(liste: VilleRecente[], ville: VilleRecente): VilleRecente[] {
  return [ville, ...liste.filter((v) => !memePoint(v, ville))].slice(0, NB_VILLES_RECENTES);
}

/** Lecture tolérante du stockage : tout ce qui n'a pas la forme attendue est ignoré, jamais une erreur. */
export function lireRecentes(brut: string | null): VilleRecente[] {
  if (!brut) return [];
  try {
    const data: unknown = JSON.parse(brut);
    if (!Array.isArray(data)) return [];
    const sortie: VilleRecente[] = [];
    for (const r of data) {
      const v = r as Partial<VilleRecente> | null;
      if (!v || typeof v.name !== "string" || !v.name || typeof v.lat !== "number" || typeof v.lon !== "number") continue;
      sortie.push({
        name: v.name,
        country: typeof v.country === "string" ? v.country : "",
        state: typeof v.state === "string" ? v.state : "",
        lat: v.lat,
        lon: v.lon,
        libelle: typeof v.libelle === "string" && v.libelle ? v.libelle : v.name,
      });
    }
    return sortie.slice(0, NB_VILLES_RECENTES);
  } catch {
    return [];
  }
}

export function chargerRecentes(): VilleRecente[] {
  try {
    return lireRecentes(localStorage.getItem(CLE_VILLES_RECENTES));
  } catch {
    return [];
  }
}

export function garderRecentes(liste: VilleRecente[]): void {
  try {
    localStorage.setItem(CLE_VILLES_RECENTES, JSON.stringify(liste.slice(0, NB_VILLES_RECENTES)));
  } catch {
    // stockage indisponible : les villes récentes ne durent que le temps de la session
  }
}
