/**
 * NOTIFICATIONS (04/11/2026, demandé : « ne masque rien, faisons les développements nécessaires »).
 *
 * Avant ce fichier, « Recevoir ma tenue du jour » et son heure s'enregistraient dans les préférences mais rien ne les lisait :
 * aucune notification n'était envoyée. Désormais, dans l'application (Android, et iOS le jour où elle sortira), une notification
 * LOCALE est programmée chaque jour à l'heure choisie. Locale : elle est posée sur le téléphone par l'app elle-même, rien ne
 * passe par un serveur et aucune donnée ne sort de l'appareil.
 *
 * Ce qu'elle dit est vrai quoi qu'il arrive : la tenue du jour est composée à l'ouverture de l'app (`regen`, store), pas à l'heure
 * de la notification, qui ne peut donc ni la montrer ni la décrire. Elle invite à l'ouvrir.
 *
 * INEXACTE, VOLONTAIREMENT. Android peut la décaler de quelques minutes pour économiser la batterie. Une alarme exacte demanderait
 * l'autorisation « Alarmes et rappels », que Google Play réserve aux réveils et aux agendas : le plugin la déclare, le manifeste
 * de l'app la retire (AndroidManifest.xml).
 *
 * SUR LE WEB : pas de notification (il faudrait un serveur d'envoi et l'accord du navigateur). Les Préférences le disent.
 */

import { Capacitor } from "@capacitor/core";
import type { ProfilePrefs } from "./profile";

/** L'identifiant de la notification quotidienne : un seul, que chaque reprogrammation remplace. */
export const ID_TENUE_DU_JOUR = 1;

export const TITRE_TENUE_DU_JOUR = "Ta tenue du jour t'attend";
export const TEXTE_TENUE_DU_JOUR = "Ouvre Capsela pour la découvrir, composée avec la météo et ton programme.";

/** « 08:00 » → { hour: 8, minute: 0 } ; null pour toute autre forme (champ vidé, valeur abîmée). */
export function heureDeNotification(valeur: string | undefined | null): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((valeur ?? "").trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function notificationsDisponiblesIci(): boolean {
  return Capacitor.isNativePlatform();
}

export type EtatNotifications = "programmee" | "desactivee" | "refusee" | "indisponible";

/**
 * Met la notification quotidienne en accord avec les préférences : programmée à l'heure choisie, ou retirée.
 *
 * `demander` : peut-on afficher la demande d'autorisation du téléphone ? Oui quand la personne vient d'activer ou de régler la
 * notification, et au premier lancement après l'inscription (le réglage est activé par défaut). Android ne la montre plus après
 * deux refus : l'état « refusee » le dit alors aux Préférences. Ne jette jamais.
 */
export async function synchroniserNotifications(prefs: Pick<ProfilePrefs, "notifEnabled" | "notifTime">, demander: boolean): Promise<EtatNotifications> {
  if (!notificationsDisponiblesIci()) return "indisponible";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: ID_TENUE_DU_JOUR }] });
    const heure = heureDeNotification(prefs.notifTime);
    if (!prefs.notifEnabled || !heure) return "desactivee";

    let permission = (await LocalNotifications.checkPermissions()).display;
    if (permission !== "granted" && demander) permission = (await LocalNotifications.requestPermissions()).display;
    if (permission !== "granted") return "refusee";

    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_TENUE_DU_JOUR,
          title: TITRE_TENUE_DU_JOUR,
          body: TEXTE_TENUE_DU_JOUR,
          schedule: { on: heure, allowWhileIdle: true },
          isExactNotification: false,
          smallIcon: "ic_stat_capsela",
        },
      ],
    });
    return "programmee";
  } catch (e) {
    console.warn("[notifications] programmation impossible", e);
    return "indisponible";
  }
}
