import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON_OPTIONS, SENTRY_DSN } from "@/lib/sentryOptions";

// Surveillance des erreurs côté navigateur. Sans DSN, rien n'est initialisé :
// aucune requête réseau en développement, aucun bruit dans la console.
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, ...SENTRY_COMMON_OPTIONS });
}

// Requis par @sentry/nextjs pour rattacher les erreurs de navigation au bon
// contexte de route (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
