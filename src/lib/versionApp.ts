/**
 * LA VERSION AFFICHÉE DE L'APP (15/10/2026, arbitré : « date et commit, sans numéro »).
 *
 * Avant : un numéro écrit à la main (`APP_VERSION = "1.4.0"`, data.ts), figé depuis le 25/09/2026 et contredit par
 * package.json (0.1.0) — il ne disait pas quel build l'utilisatrice avait devant elle. Désormais la date et le commit sont
 * posés AU BUILD par next.config.ts (`env`, remplacés dans le bundle) : rien à maintenir, et le même libellé part avec les
 * rapports d'erreur (Sentry, `release`).
 */

/** Le commit du build (7 caractères), ou chaîne vide hors build (tests, outil sans git). */
export const COMMIT_BUILD = process.env.CAPSELA_BUILD_COMMIT ?? "";
/** L'instant du build, ISO 8601, ou chaîne vide. */
export const DATE_BUILD = process.env.CAPSELA_BUILD_DATE ?? "";

/** « 15/10/2026 · f5524dc », après « Capsela · version » — date à l'heure de Paris ; ce qui manque n'est pas inventé. Pure. */
export function libelleVersion(commit: string, dateIso: string): string {
  const d = dateIso ? new Date(dateIso) : null;
  const date =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
      : "";
  const morceaux = [date, commit.slice(0, 7)].filter(Boolean);
  return morceaux.length ? morceaux.join(" · ") : "de développement";
}

export const VERSION_APP = libelleVersion(COMMIT_BUILD, DATE_BUILD);
