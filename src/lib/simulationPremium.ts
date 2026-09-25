import { estActif, type EtatPremium } from "./premium";

/*
 * SIMULATION DU STATUT PREMIUM — DÉVELOPPEMENT UNIQUEMENT (25/09/2026).
 *
 * But : parcourir tous les cas d'accès à l'Avis de styliste sans toucher aux
 * données Supabase. Usage, sous `npm run dev` seulement :
 *   http://localhost:3000/?simulerPremium=FREE
 * (PREMIUM_ACTIVE, FREE, EXPIRED, UNKNOWN, DEMO ; ?simulerPremium=AUCUNE pour
 * arrêter). La valeur est gardée pour l'onglet (sessionStorage), l'app ne
 * changeant pas d'URL en naviguant.
 *
 * JAMAIS EN PRODUCTION. La lecture est conditionnée à NODE_ENV, que Next
 * remplace par une constante au build : `next build` (production, et donc
 * aussi les aperçus Vercel) la fixe à "production", et tout le code de
 * lecture devient inatteignable. Aucun bouton, aucun endpoint : rien
 * d'exposé.
 *
 * CÔTÉ CLIENT SEULEMENT. La simulation ne change que ce que l'app AFFICHE.
 * Le contrôle serveur (`assertPremium`) n'a aucun contournement : ses cas sont
 * vérifiés par les tests (premiumServeur.test.ts), avec un faux client.
 */

export const PROFILS_SIMULES = ["PREMIUM_ACTIVE", "FREE", "EXPIRED", "UNKNOWN", "DEMO"] as const;
export type ProfilSimule = (typeof PROFILS_SIMULES)[number];

const CLE_STOCKAGE = "capsela.simulerPremium";
const PARAMETRE_URL = "simulerPremium";

function estProfil(v: string | null | undefined): v is ProfilSimule {
  return Boolean(v) && (PROFILS_SIMULES as readonly string[]).includes(v as string);
}

/** La simulation n'existe qu'en développement (et sous vitest). */
export function simulationAutorisee(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

/**
 * Profil simulé à appliquer, ou null. Pure : l'environnement, le paramètre
 * d'URL et la valeur mémorisée sont passés en arguments. L'URL prime sur la
 * mémoire ; toute valeur inconnue est ignorée.
 */
export function resoudreProfilSimule(
  nodeEnv: string | undefined,
  valeurUrl: string | null,
  valeurStockee: string | null
): ProfilSimule | null {
  if (!simulationAutorisee(nodeEnv)) return null;
  if (estProfil(valeurUrl)) return valeurUrl;
  if (valeurUrl) return null; // AUCUNE, ou une valeur erronée : pas de simulation
  return estProfil(valeurStockee) ? valeurStockee : null;
}

/**
 * Statut Premium produit par un profil simulé. EXPIRED passe par la VRAIE
 * règle (`estActif` sur une ligne échue) plutôt que d'être décrété
 * "gratuit" : la simulation teste ainsi le calcul, pas seulement l'écran.
 * DEMO et UNKNOWN rendent "inconnu", comme l'app sans Supabase ou en panne.
 */
export function etatSimule(profil: ProfilSimule, maintenant = new Date()): EtatPremium {
  switch (profil) {
    case "PREMIUM_ACTIVE":
      return estActif({ actif: true, expire_le: null }, maintenant) ? "premium" : "gratuit";
    case "FREE":
      return estActif(null, maintenant) ? "premium" : "gratuit";
    case "EXPIRED":
      return estActif({ actif: true, expire_le: new Date(maintenant.getTime() - 86_400_000).toISOString() }, maintenant)
        ? "premium"
        : "gratuit";
    case "UNKNOWN":
    case "DEMO":
      return "inconnu";
  }
}

/** Lecture dans le navigateur. En production, rend null sans rien lire. */
export function lireProfilSimule(): ProfilSimule | null {
  if (!simulationAutorisee(process.env.NODE_ENV)) return null;
  if (typeof window === "undefined") return null;
  try {
    const valeurUrl = new URLSearchParams(window.location.search).get(PARAMETRE_URL);
    const profil = resoudreProfilSimule(process.env.NODE_ENV, valeurUrl, window.sessionStorage.getItem(CLE_STOCKAGE));
    if (valeurUrl) {
      if (profil) window.sessionStorage.setItem(CLE_STOCKAGE, profil);
      else window.sessionStorage.removeItem(CLE_STOCKAGE);
    }
    return profil;
  } catch {
    return null;
  }
}
