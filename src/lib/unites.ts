/*
 * LES UNITÉS (05/11/2026, demandé : « le brancher sur la météo »). Le réglage Métrique / Impérial (profile.prefs.unitSystem)
 * existait sans rien changer à l'écran. Il règle désormais l'AFFICHAGE des températures, et seulement lui : la météo reçue,
 * le moteur de tenues, les seuils et ce qui est enregistré restent en degrés Celsius. Aucune mesure du corps n'est affichée
 * en centimètres dans l'app (les tailles sont des tailles : M, 38, 40) : il n'y a rien d'autre à convertir.
 *
 * Le système est posé par App.tsx à chaque rendu, depuis le profil, comme la langue l'est par langue.ts : les fonctions
 * d'affichage, appelées partout, n'ont pas à recevoir le profil.
 */

export type SystemeUnites = "metric" | "imperial";

let systeme: SystemeUnites = "metric";

export function definirSystemeUnites(s: SystemeUnites | undefined | null): void {
  systeme = s === "imperial" ? "imperial" : "metric";
}

export const systemeUnites = (): SystemeUnites => systeme;

/** Une température reçue en °C, dans l'unité choisie, arrondie au degré. */
export function temperatureAffichee(celsius: number, s: SystemeUnites = systeme): number {
  return Math.round(s === "imperial" ? (celsius * 9) / 5 + 32 : celsius);
}

/** « 17° » (ou « 63° » en impérial) : l'écriture courte des écrans. */
export const degres = (celsius: number, s: SystemeUnites = systeme): string => `${temperatureAffichee(celsius, s)}°`;

/** « 17 °C » (ou « 63 °F ») : l'écriture longue des phrases. Espace insécable optionnelle. */
export const degresUnite = (celsius: number, s: SystemeUnites = systeme, espace = " "): string =>
  `${temperatureAffichee(celsius, s)}${espace}°${s === "imperial" ? "F" : "C"}`;
