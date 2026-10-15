/**
 * Ce que l'app garde sur l'appareil au nom d'un compte, et qui doit partir avec
 * lui (01/10/2026, docs/legal/README.md, écart 6). La suppression du compte
 * efface tout côté serveur ; restaient sur l'appareil les valises en cache
 * (`capsela.valises.<compte>`, et l'ancienne clé `capsela.valise.<compte>`) et
 * la dernière position connue (`capsela.lastKnownCity`).
 *
 * Ne part PAS : le choix de mesure d'audience (`capsela.analyticsConsent`),
 * qui s'attache à l'appareil et non au compte (cf. consent.ts).
 */

/** Les clés locales liées à un compte. `null` : le mode démo, dont les valises sont rangées sous « demo » (valises.ts). */
export function clesLocalesDuCompte(userId: string | null): string[] {
  const compte = userId ?? "demo";
  return [
    "capsela.lastKnownCity",
    "capsela.authIntent",
    `capsela.valises.${compte}`,
    `capsela.valise.${compte}`,
    // Les tenues recommandées ces derniers jours (recommandationsRecentes.ts).
    `capsela.recommandees.${compte}`,
    // Les retours sur les accords de saison (retoursAccords.ts).
    `capsela.accords.${compte}`,
    // Les villes cherchées récemment (lieux.ts) — ajoutées le 15/10/2026 (repasse légale) : une destination dit où l'on va. La
    // clé n'est pas rangée par compte : elle part avec n'importe quel compte supprimé sur l'appareil.
    "capsela.villesRecentes",
  ];
}

/** Efface ces clés. Défensif : le stockage peut manquer ou jeter (navigation privée), et rien ne doit alors échouer. */
export function effacerDonneesLocales(userId: string | null): void {
  if (typeof window === "undefined") return;
  // Les check-lists d'avant le 11/10/2026 (`capsela.valise.check.<id>`, ValiseScreen) sont rangées par valise : on les retrouve par
  // les valises en cache du compte, lues AVANT de les effacer (15/10/2026, repasse légale).
  const cles = [...clesDesChecklists(userId), ...clesLocalesDuCompte(userId)];
  for (const cle of cles) {
    try {
      window.localStorage.removeItem(cle);
    } catch {
      // Stockage indisponible : il n'y a alors rien à effacer.
    }
  }
}

/** Les clés des check-lists héritées des valises en cache du compte. Défensif : un cache illisible n'en donne aucune. */
export function clesDesChecklists(userId: string | null): string[] {
  const compte = userId ?? "demo";
  const ids = new Set<string>();
  for (const cle of [`capsela.valises.${compte}`, `capsela.valise.${compte}`]) {
    try {
      const brut = window.localStorage.getItem(cle);
      const lu: unknown = brut ? JSON.parse(brut) : null;
      for (const v of Array.isArray(lu) ? lu : lu ? [lu] : []) {
        const id = (v as { id?: unknown } | null)?.id;
        if (typeof id === "string" || typeof id === "number") ids.add(String(id));
      }
    } catch {
      // Stockage indisponible ou cache illisible : rien à retrouver.
    }
  }
  return [...ids].map((id) => `capsela.valise.check.${id}`);
}
