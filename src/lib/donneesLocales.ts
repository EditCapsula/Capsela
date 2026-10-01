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
  return ["capsela.lastKnownCity", "capsela.authIntent", `capsela.valises.${compte}`, `capsela.valise.${compte}`];
}

/** Efface ces clés. Défensif : le stockage peut manquer ou jeter (navigation privée), et rien ne doit alors échouer. */
export function effacerDonneesLocales(userId: string | null): void {
  if (typeof window === "undefined") return;
  for (const cle of clesLocalesDuCompte(userId)) {
    try {
      window.localStorage.removeItem(cle);
    } catch {
      // Stockage indisponible : il n'y a alors rien à effacer.
    }
  }
}
