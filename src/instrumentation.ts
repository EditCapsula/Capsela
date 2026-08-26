import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { SENTRY_COMMON_OPTIONS, SENTRY_DSN } from "@/lib/sentryOptions";

/**
 * Surveillance des erreurs côté serveur — appelée une fois au démarrage de
 * l'instance Next (cf. docs/01-app/02-guides/instrumentation.md).
 *
 * Depuis le passage à `output: "export"` (26/08/2026), l'app n'a plus de
 * serveur à l'exécution : ce fichier ne couvre donc plus que le rendu
 * effectué pendant `next build`. Les erreurs vues par les utilisateurs
 * remontent toutes par instrumentation-client.ts. On le conserve tel quel :
 * il redeviendrait utile si un rendu serveur était réintroduit un jour.
 */
export function register() {
  if (!SENTRY_DSN) return;
  Sentry.init({ dsn: SENTRY_DSN, ...SENTRY_COMMON_OPTIONS });
}

/** Remonte les erreurs levées pendant le rendu serveur et dans les routes d'API. */
export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
