import { Capacitor } from "@capacitor/core";
import { PARAM_RECUPERATION } from "./motDePasse";

/*
 * LA CONNEXION DANS LES APPLICATIONS iOS ET ANDROID (17/10/2026, plan « Publication sur les stores »).
 *
 * Dans l'app, la page est servie depuis `capacitor://localhost` (iOS) ou `https://localhost` (Android) : un retour de connexion vers
 * `window.location.origin` ne mène nulle part, et Google refuse sa page de connexion dans une vue web intégrée (« disallowed_useragent »).
 * La connexion Google s'ouvre donc dans le navigateur du système (@capacitor/browser), et revient dans l'app par un lien profond
 * `app.capsela://auth/callback` (déclaré dans Info.plist et AndroidManifest.xml, et à ajouter aux « Redirect URLs » de Supabase).
 * Le lien « nouveau mot de passe » de l'e-mail revient par le même chemin. Sur le web, rien ne change.
 */

/** Le schéma des liens profonds : l'identifiant de l'app (capsela.app inversé). */
export const SCHEMA_APP = "app.capsela";
export const REDIRECTION_NATIVE = `${SCHEMA_APP}://auth/callback`;

export const estNatif = (): boolean => Capacitor.isNativePlatform();

export interface RetourNatif {
  /** Le code PKCE à échanger contre une session. */
  code: string | null;
  /** Les jetons d'un retour implicite (dans le fragment). */
  accessToken: string | null;
  refreshToken: string | null;
  /** Le retour du lien « nouveau mot de passe ». */
  recuperation: boolean;
  /** Supabase a refusé (lien expiré, connexion annulée) : rien à échanger. */
  erreur: boolean;
}

/** Lit un lien profond de retour de connexion ; null pour tout autre lien. Fonction pure, testée. */
export function lireRetourNatif(url: string): RetourNatif | null {
  if (!url.startsWith(REDIRECTION_NATIVE)) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const fragment = new URLSearchParams(u.hash.replace(/^#/, ""));
  const lire = (k: string) => u.searchParams.get(k) ?? fragment.get(k);
  return {
    code: lire("code"),
    accessToken: lire("access_token"),
    refreshToken: lire("refresh_token"),
    recuperation: lire(PARAM_RECUPERATION) === "1" || lire("type") === "recovery",
    erreur: Boolean(lire("error") || lire("error_code")),
  };
}
