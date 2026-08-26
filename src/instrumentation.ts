import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { SENTRY_COMMON_OPTIONS, SENTRY_DSN } from "@/lib/sentryOptions";

/**
 * Surveillance des erreurs côté serveur — appelée une fois au démarrage de
 * l'instance Next (cf. docs/01-app/02-guides/instrumentation.md).
 */
export function register() {
  if (!SENTRY_DSN) return;
  Sentry.init({ dsn: SENTRY_DSN, ...SENTRY_COMMON_OPTIONS });
}

/** Remonte les erreurs levées pendant le rendu serveur et dans les routes d'API. */
export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
