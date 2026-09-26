/*
 * RÉINITIALISATION DU MOT DE PASSE (recette du 26/09/2026).
 *
 * Jusqu'ici, « Mot de passe oublié » n'appelait aucun service : l'écran
 * affichait « Lien envoyé » sans rien envoyer. Le parcours repose désormais
 * sur le mécanisme officiel de Supabase Auth — `resetPasswordForEmail`, puis
 * `updateUser({ password })` dans la session de récupération que le lien de
 * l'e-mail ouvre. Aucun second système d'authentification.
 *
 * Ce module ne contient que la logique pure (lecture de l'URL de retour,
 * validation, traduction des erreurs), testée ; les appels vivent dans
 * auth.tsx.
 */

/** Paramètre posé sur l'URL de retour du lien, pour reconnaître une récupération même si l'événement Supabase est manqué. */
export const PARAM_RECUPERATION = "reinitialisation";

/** Longueur minimale exigée côté app — le serveur peut exiger davantage, son refus est alors traduit. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export type RetourLien = "recuperation" | "lien_invalide" | null;

/**
 * Ce que dit l'URL au chargement : retour d'un lien de récupération, lien
 * expiré ou invalide (Supabase ajoute `error_code`, dans la requête ou dans
 * le fragment selon le flux), ou rien.
 */
export function lireRetourLien(url: string): RetourLien {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
  const lire = (k: string) => u.searchParams.get(k) ?? hash.get(k);
  const marque = lire(PARAM_RECUPERATION) === "1" || lire("type") === "recovery";
  if (!marque) return null;
  if (lire("error") || lire("error_code")) return "lien_invalide";
  return "recuperation";
}

/** Adresse de forme plausible — le serveur reste juge ; on évite seulement d'envoyer une saisie manifestement incomplète. */
export function emailPlausible(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export type ErreurNouveauMotDePasse = "trop_court" | "differents" | null;

/** Validation des deux champs avant tout appel. */
export function validerNouveauMotDePasse(motDePasse: string, confirmation: string): ErreurNouveauMotDePasse {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) return "trop_court";
  if (motDePasse !== confirmation) return "differents";
  return null;
}

/**
 * Message à afficher pour un refus de `updateUser`. Jamais le message brut du
 * serveur : il est en anglais et peut changer.
 */
export function messageErreurNouveauMotDePasse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("session") || m.includes("expired") || (m.includes("invalid") && m.includes("token"))) {
    return "Ce lien a expiré ou a déjà servi. Demande un nouveau lien depuis l'écran de connexion.";
  }
  if (m.includes("different from the old")) return "Choisis un mot de passe différent de l'ancien.";
  if (m.includes("password should") || m.includes("weak") || m.includes("at least")) {
    return "Ce mot de passe est trop faible. Allonge-le ou mélange lettres, chiffres et signes.";
  }
  if (m.includes("rate limit")) return "Trop de tentatives — réessaie dans quelques minutes.";
  if (m.includes("fetch") || m.includes("network")) return "Connexion impossible. Vérifie ton réseau et réessaie.";
  return "Le mot de passe n'a pas pu être enregistré. Réessaie dans un instant.";
}
