/**
 * Réglages Sentry communs au client et au serveur — recette 26/08/2026.
 *
 * Objectif explicite : rester dans la « mesure strictement nécessaire au
 * fonctionnement du service », qui n'appelle pas de consentement, plutôt que
 * d'ajouter un second bandeau après celui des statistiques d'usage.
 *
 * Ce qui rend ça vrai, et qu'il ne faut pas défaire sans y repenser :
 *
 * - sendDefaultPii reste à false : ni adresse IP, ni cookies, ni en-têtes,
 *   ni corps de requête ne sont transmis.
 * - Aucune intégration Replay. Le rejeu de session filme l'écran de
 *   l'utilisatrice — c'est précisément ce qui ferait basculer Sentry dans
 *   les traceurs soumis à consentement. Ne pas l'activer.
 * - Aucun identifiant d'utilisateur n'est associé aux erreurs.
 * - Les fils d'Ariane de type console sont supprimés : l'app y écrit des
 *   messages de diagnostic qui peuvent contenir le contenu du dressing.
 * - tracesSampleRate à 0 : les traces de performance ne sont pas des données
 *   personnelles, mais elles consomment le quota gratuit sans rien apporter
 *   au lancement. À relever si le besoin apparaît.
 *
 * Le SDK navigateur de Sentry ne dépose ni cookie ni entrée localStorage et
 * ne conserve aucun identifiant d'appareil : c'est l'autre moitié de
 * l'argument d'exemption.
 *
 * ⚠️ Un réglage ne peut pas être fait ici : dans le tableau de bord Sentry,
 * activer « Prevent Storing of IP Addresses » au niveau du projet. Le code
 * n'envoie pas l'IP, mais elle reste visible de l'infrastructure qui reçoit
 * la requête — seul ce réglage garantit qu'elle n'est pas conservée.
 */
export const SENTRY_COMMON_OPTIONS = {
  sendDefaultPii: false,
  tracesSampleRate: 0,
  /** Retire les fils d'Ariane susceptibles de transporter des données saisies par l'utilisatrice. */
  beforeBreadcrumb(breadcrumb: { category?: string }) {
    if (breadcrumb.category === "console") return null;
    return breadcrumb;
  },
} as const;

/** DSN public — absent en développement et en préproduction : le SDK n'est alors pas initialisé du tout. */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
