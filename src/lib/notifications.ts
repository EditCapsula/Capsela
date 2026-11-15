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
 * INEXACTE, VOLONTAIREMENT. Une alarme exacte demanderait l'autorisation « Alarmes et rappels », que Google Play réserve aux
 * réveils et aux agendas : le plugin la déclare, le manifeste de l'app la retire (AndroidManifest.xml). Android peut donc la
 * décaler pour économiser la batterie — de quelques minutes pour une app ouverte chaque jour, davantage pour une app peu ouverte.
 *
 * UNE NOTIFICATION PAR JOUR, PAS UNE RÉPÉTITION (05/11/2026, signalé : « réglée à 8 h, reçue quelques heures après »). La
 * répétition quotidienne du plugin (`schedule.on`) ne programme proprement que la PREMIÈRE : après chaque envoi, il repose la
 * suivante avec une alarme qui ne réveille pas le téléphone (`AlarmManager.set(RTC)`, TimedNotificationPublisher.kt) — elle ne part
 * qu'au prochain déverrouillage, des heures plus tard. Les jours suivants sont donc programmés un à un (`schedule.at`, qui réveille
 * le téléphone et passe pendant sa veille), sur JOURS_PROGRAMMES jours, reconduits à chaque lancement et à chaque retour dans l'app.
 * Sans ouverture pendant deux semaines, les rappels s'arrêtent : l'app ne relance pas indéfiniment qui ne l'ouvre plus.
 *
 * SUR LE WEB : pas de notification (il faudrait un serveur d'envoi et l'accord du navigateur). Les Préférences le disent.
 */

import { Capacitor } from "@capacitor/core";
import { momentRappelReprise, periodesAVenir } from "./conges";
import type { ProfilePrefs } from "./profile";

/** Les identifiants des notifications de la tenue du jour : 1 à JOURS_PROGRAMMES, un par jour, remplacés à chaque reprogrammation. */
export const ID_TENUE_DU_JOUR = 1;
export const JOURS_PROGRAMMES = 14;

/**
 * Les moments des prochaines notifications : aujourd'hui à l'heure choisie si elle n'est pas encore passée (une minute de marge),
 * sinon demain, puis chaque jour suivant — en heure locale, changement d'heure compris.
 */
export function prochainsMoments(heure: { hour: number; minute: number }, maintenant: Date, nb = JOURS_PROGRAMMES): Date[] {
  const premier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), heure.hour, heure.minute);
  const decalage = premier.getTime() > maintenant.getTime() + 60_000 ? 0 : 1;
  return Array.from(
    { length: nb },
    (_, i) => new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + decalage + i, heure.hour, heure.minute)
  );
}

export const TITRE_TENUE_DU_JOUR = "Ta tenue du jour t'attend";
export const TEXTE_TENUE_DU_JOUR = "Ouvre Capsela pour la découvrir, composée avec la météo et ton programme.";

/*
 * LE RAPPEL DE REPRISE (04/11/2026, retour du test fermé : « il est temps de préparer son dressing retour de vacances »). Un par
 * période de congés datée à venir (conges.ts), le dernier jour à 18 h. Il ne dépend pas de « Recevoir ma tenue du jour » : c'est
 * un autre rappel, que la personne a demandé en datant ses congés. Identifiants 100 à 131 : au plus 32 périodes à venir.
 */
const ID_REPRISE_PREMIER = 100;
const NB_REPRISES_MAX = 32;
export const TITRE_REPRISE = "Fin de tes congés demain";
export const TEXTE_REPRISE = "Il est temps de préparer ton dressing pour la reprise : ta tenue de demain t'attend dans Capsela.";

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
export async function synchroniserNotifications(
  prefs: Pick<ProfilePrefs, "notifEnabled" | "notifTime"> & Partial<Pick<ProfilePrefs, "conges">>,
  demander: boolean,
): Promise<EtatNotifications> {
  if (!notificationsDisponiblesIci()) return "indisponible";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({
      notifications: [...Array.from({ length: JOURS_PROGRAMMES }, (_, i) => ({ id: ID_TENUE_DU_JOUR + i })), ...Array.from({ length: NB_REPRISES_MAX }, (_, i) => ({ id: ID_REPRISE_PREMIER + i }))],
    });
    const heure = prefs.notifEnabled ? heureDeNotification(prefs.notifTime) : null;
    const reprises = periodesAVenir(prefs.conges)
      .map((p) => momentRappelReprise(p))
      .filter((d): d is Date => d !== null)
      .slice(0, NB_REPRISES_MAX);
    if (!heure && reprises.length === 0) return "desactivee";

    let permission = (await LocalNotifications.checkPermissions())?.display;
    if (permission !== "granted" && demander) permission = (await LocalNotifications.requestPermissions())?.display;
    if (permission !== "granted") return "refusee";

    const commun = { isExactNotification: false, smallIcon: "ic_stat_capsela" };
    await LocalNotifications.schedule({
      notifications: [
        ...(heure
          ? prochainsMoments(heure, new Date()).map((at, i) => ({
              id: ID_TENUE_DU_JOUR + i,
              title: TITRE_TENUE_DU_JOUR,
              body: TEXTE_TENUE_DU_JOUR,
              schedule: { at, allowWhileIdle: true },
              ...commun,
            }))
          : []),
        ...reprises.map((at, i) => ({
          id: ID_REPRISE_PREMIER + i,
          title: TITRE_REPRISE,
          body: TEXTE_REPRISE,
          schedule: { at, allowWhileIdle: true },
          ...commun,
        })),
      ],
    });
    return heure ? "programmee" : "desactivee";
  } catch (e) {
    console.warn("[notifications] programmation impossible", e);
    return "indisponible";
  }
}

/*
 * LE DIAGNOSTIC DE LA NOTIFICATION (13/11/2026, signalé : « je n'ai reçu aucune notification de l'application à l'heure demandée »,
 * dans l'app Android). Jusqu'ici, Réglages ne disait que le téléphone bloquait les notifications qu'après un changement de
 * l'interrupteur ou de l'heure : à l'ouverture de la page, rien n'était vérifié, et un refus restait invisible. Ce diagnostic lit,
 * sans rien demander, ce que le téléphone sait vraiment — l'autorisation et la prochaine notification programmée — et permet d'en
 * recevoir une tout de suite, pour séparer un blocage (rien n'arrive) d'un retard d'Android (l'essai arrive, l'heure dérive).
 */
export const ID_ESSAI = 99;

export interface DiagnosticNotifications {
  /** L'autorisation d'afficher des notifications, telle que le téléphone la donne. */
  autorisee: boolean;
  /** La prochaine notification de la tenue du jour programmée sur le téléphone, ou null s'il n'y en a aucune. */
  prochaine: Date | null;
}

/** La plus proche des notifications de la tenue du jour (identifiants 1 à JOURS_PROGRAMMES) encore à venir. */
export function prochaineTenueProgrammee(attente: readonly { id: number; schedule?: { at?: Date | string } }[], maintenant: Date): Date | null {
  const dates = attente
    .filter((n) => n.id >= ID_TENUE_DU_JOUR && n.id < ID_TENUE_DU_JOUR + JOURS_PROGRAMMES && n.schedule?.at)
    .map((n) => new Date(n.schedule!.at as Date | string))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > maintenant.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

/**
 * LA DERNIÈRE ERREUR DU TÉLÉPHONE (13/11/2026, signalé sur Android : « Le téléphone n'a pas pu programmer la notification d'essai »,
 * et « Prochaine notification » restée sur « … ») : son code (OS-PLUG-LNOT-…) ou son message, affiché par Réglages pour que la
 * prochaine panne se diagnostique sans débogueur. null tant que tout va bien.
 */
let derniereErreur: string | null = null;
export const erreurNotifications = () => derniereErreur;
function noterErreur(e: unknown): void {
  const err = e as { code?: unknown; message?: unknown } | null;
  derniereErreur = (typeof err?.code === "string" && err.code) || (typeof err?.message === "string" && err.message) || String(e);
}

/** Ce que le téléphone sait ; null sur le web ou si le téléphone ne répond pas. Ne demande jamais l'autorisation. */
export async function diagnostiquerNotifications(): Promise<DiagnosticNotifications | null> {
  if (!notificationsDisponiblesIci()) return null;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const autorisee = (await LocalNotifications.checkPermissions())?.display === "granted";
    const { notifications } = await LocalNotifications.getPending();
    derniereErreur = null;
    return { autorisee, prochaine: prochaineTenueProgrammee(notifications, new Date()) };
  } catch (e) {
    console.warn("[notifications] diagnostic impossible", e);
    noterErreur(e);
    return null;
  }
}

/** Une notification d'essai, affichée tout de suite (demande l'autorisation si elle n'a jamais été donnée). */
export async function envoyerNotificationEssai(): Promise<"envoyee" | "refusee" | "indisponible"> {
  if (!notificationsDisponiblesIci()) return "indisponible";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let permission = (await LocalNotifications.checkPermissions())?.display;
    if (permission !== "granted") permission = (await LocalNotifications.requestPermissions())?.display;
    // Une réponse sans autorisation lisible n'est pas un refus (14/11/2026, vu : R8 retirait les annotations des plugins,
    // proguard-rules.pro) : l'écran le dit tel quel, au lieu d'un « Cannot read properties of undefined ».
    if (permission === undefined) throw new Error("autorisation illisible");
    if (permission !== "granted") return "refusee";
    // INEXACTE, COMME LES AUTRES (13/11/2026) : sans `isExactNotification: false`, le module la croit exacte (sa valeur par défaut) et,
    // sur Android 12 et plus, ouvre la demande « Alarmes et rappels » — autorisation que le manifeste retire (cf. l'en-tête) : l'essai
    // échouait alors (« Le téléphone n'a pas pu programmer la notification d'essai »). Elle part tout de suite : rien à exactifier.
    await LocalNotifications.schedule({
      notifications: [{ id: ID_ESSAI, title: "Notification d'essai", body: "Les notifications de Capsela arrivent bien sur ce téléphone.", smallIcon: "ic_stat_capsela", isExactNotification: false }],
    });
    derniereErreur = null;
    return "envoyee";
  } catch (e) {
    console.warn("[notifications] essai impossible", e);
    noterErreur(e);
    return "indisponible";
  }
}
