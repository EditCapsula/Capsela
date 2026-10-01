/**
 * Âge minimum d'inscription (01/10/2026, docs/legal/README.md, écart 4).
 *
 * 15 ans : la majorité numérique pour le consentement en France (art. 45 de la
 * loi Informatique et Libertés), valeur retenue dans les brouillons des CGU et
 * de la politique de confidentialité. [À CONFIRMER PAR LE JURISTE] : si le
 * seuil change, il change ici ET dans ces textes.
 *
 * Contrôle côté app seulement : la date est déclarative. Elle empêche une
 * inscription par e-mail sous le seuil ; elle ne prouve pas l'âge.
 */
export const AGE_MINIMUM = 15;

export type RaisonAge = "manquante" | "invalide" | "trop_jeune";

/** Années pleines entre la date de naissance (AAAA-MM-JJ) et `maintenant`, ou null si la date est illisible ou dans le futur. */
export function ageEn(naissance: string, maintenant: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(naissance);
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null;
  let age = maintenant.getUTCFullYear() - annee;
  const anniversairePasse =
    maintenant.getUTCMonth() > mois - 1 || (maintenant.getUTCMonth() === mois - 1 && maintenant.getUTCDate() >= jour);
  if (!anniversairePasse) age -= 1;
  return age < 0 ? null : age;
}

export function verifierAge(naissance: string, maintenant: Date = new Date()): { ok: true } | { ok: false; raison: RaisonAge } {
  if (!naissance) return { ok: false, raison: "manquante" };
  const age = ageEn(naissance, maintenant);
  if (age === null) return { ok: false, raison: "invalide" };
  return age >= AGE_MINIMUM ? { ok: true } : { ok: false, raison: "trop_jeune" };
}

export function messageAge(raison: RaisonAge): string {
  if (raison === "manquante") return "Indique ta date de naissance pour créer ton compte.";
  if (raison === "invalide") return "Cette date de naissance n'est pas valide.";
  return `Il faut avoir au moins ${AGE_MINIMUM} ans pour créer un compte.`;
}

/**
 * Faut-il demander la date de naissance ? (01/10/2026) Le compte créé avec
 * Google n'en reçoit aucune : elle est demandée juste après la connexion, avant
 * le questionnaire. La règle ne vise que les comptes SANS date ET dont le
 * profil n'est pas terminé — un compte déjà installé n'est jamais renvoyé vers
 * un écran bloquant (règle du 17/08/2026) — et seulement une fois le profil
 * chargé : avant, il vaut EMPTY_PROFILE et tout compte semblerait sans date.
 */
export function doitDemanderNaissance(e: { signedIn: boolean; profileLoaded: boolean; birthdate: string | null; completed: boolean }): boolean {
  return e.signedIn && e.profileLoaded && !e.birthdate && !e.completed;
}
