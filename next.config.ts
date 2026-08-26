import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Le plugin Sentry n'est branché que si le dépôt sait où téléverser les
 * cartes de source : sans SENTRY_AUTH_TOKEN, org ni projet, `npm run build`
 * doit continuer de passer tel quel — c'est le cas en développement local et
 * dans la CI, qui ne dispose d'aucun secret Sentry.
 */
const sentryConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default sentryConfigured
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Cartes de source téléversées puis retirées du bundle public : les
      // traces restent lisibles côté Sentry sans exposer le code source.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      silent: true,
    })
  : nextConfig;
