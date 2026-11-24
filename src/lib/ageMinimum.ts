import { t } from "./langue";

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
  if (raison === "manquante") return t("Indique ta date de naissance pour créer ton compte.");
  if (raison === "invalide") return t("Cette date de naissance n'est pas valide.");
  return t("Il faut avoir au moins {n} ans pour créer un compte.", { n: AGE_MINIMUM });
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

/*
 * LA TRANCHE D'ÂGE À LA PLACE DE LA DATE DE NAISSANCE (24/11/2026, arbitré par la propriétaire). La date ne servait qu'au seuil de
 * 15 ans : une tranche suffit (minimisation, RGPD), et des tranches de dix ans permettent d'analyser l'âge des utilisateurs, de façon
 * agrégée seulement — finalité écrite dans la politique de confidentialité. Découpage des études d'audience (Médiamétrie, Meta,
 * Google), les deux premières coupures aux seuils légaux (15 ans, 18 ans).
 *
 * EXCEPTION À LA RÈGLE « AUCUNE LOGIQUE FONDÉE SUR L'ÂGE » (CLAUDE.md), arbitrée le même jour et LIMITÉE À LA PUBLICITÉ : les 15-17 ans
 * ne reçoivent que des publicités non personnalisées (règlement sur les services numériques, art. 28 ; publicite.ts). Aucune tenue,
 * capsule ni suggestion ne dépend de la tranche.
 *
 * Contrôle déclaratif, comme la date l'était : la question est posée de façon neutre, aucune tranche présélectionnée.
 */
export const TRANCHES_AGE = ["moins_15", "15_17", "18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"] as const;
export type TrancheAge = (typeof TRANCHES_AGE)[number];

const LIBELLES_TRANCHE: Record<TrancheAge, string> = {
  moins_15: "Moins de 15 ans",
  "15_17": "15 à 17 ans",
  "18_24": "18 à 24 ans",
  "25_34": "25 à 34 ans",
  "35_44": "35 à 44 ans",
  "45_54": "45 à 54 ans",
  "55_64": "55 à 64 ans",
  "65_plus": "65 ans et plus",
};
export const libelleTranche = (tr: TrancheAge): string => t(LIBELLES_TRANCHE[tr]);

export const estTrancheAge = (v: unknown): v is TrancheAge => typeof v === "string" && (TRANCHES_AGE as readonly string[]).includes(v);

/** La tranche d'une date de naissance (comptes d'avant le 24/11/2026), ou null si la date est illisible. */
export function trancheDepuisNaissance(naissance: string | null | undefined, maintenant: Date = new Date()): TrancheAge | null {
  if (!naissance) return null;
  const age = ageEn(naissance, maintenant);
  if (age === null) return null;
  if (age < AGE_MINIMUM) return "moins_15";
  if (age < 18) return "15_17";
  if (age < 25) return "18_24";
  if (age < 35) return "25_34";
  if (age < 45) return "35_44";
  if (age < 55) return "45_54";
  if (age < 65) return "55_64";
  return "65_plus";
}

/** La tranche déclarée, sinon celle de la date de naissance encore gardée (avant la migration 0067). */
export const trancheDuProfil = (p: { trancheAge?: TrancheAge | null; birthdate?: string | null }, maintenant?: Date): TrancheAge | null =>
  p.trancheAge ?? trancheDepuisNaissance(p.birthdate ?? null, maintenant);

export function verifierTranche(tr: TrancheAge | null | undefined): { ok: true } | { ok: false; raison: "manquante" | "trop_jeune" } {
  if (!tr) return { ok: false, raison: "manquante" };
  return tr === "moins_15" ? { ok: false, raison: "trop_jeune" } : { ok: true };
}

export function messageTranche(raison: "manquante" | "trop_jeune"): string {
  return raison === "manquante" ? t("Indique ta tranche d'âge pour créer ton compte.") : t("Il faut avoir au moins {n} ans pour créer un compte.", { n: AGE_MINIMUM });
}

/** Mineur au sens de la publicité (15-17 ans) : publicités non personnalisées seulement. Tranche inconnue : rien n'est supposé. */
export const estMineur = (tr: TrancheAge | null | undefined): boolean => tr === "15_17";

/** Faut-il demander la tranche ? Même règle que doitDemanderNaissance : un compte sans tranche ni date, au profil non terminé. */
export function doitDemanderTranche(e: { signedIn: boolean; profileLoaded: boolean; trancheAge: TrancheAge | null; birthdate: string | null; completed: boolean }): boolean {
  return e.signedIn && e.profileLoaded && !e.trancheAge && !e.birthdate && !e.completed;
}
