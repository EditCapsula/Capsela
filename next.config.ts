import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * `output: "export"` produit un site entièrement statique dans `out/` : un
 * fichier HTML par route, aucun serveur Node à l'exécution. C'est la
 * condition pour empaqueter l'app avec Capacitor (iOS / Android), dont la
 * WebView ne sait servir que des fichiers locaux.
 *
 * Ce que cela implique côté code, et qui est déjà respecté ici :
 * - aucune Route Handler lisant la requête (la météo est passée en fonction
 *   Edge Supabase le 26/08/2026, cf. supabase/functions/weather) ;
 * - aucune Server Action, aucun `cookies()` ni `headers()` ;
 * - aucun `next/image` avec le loader par défaut (l'app n'utilise que des
 *   balises `<img>`, les visuels venant du stockage Supabase) ;
 * - aucune redirection, réécriture ni en-tête définis ici : sur un
 *   hébergement statique ils ne seraient de toute façon pas appliqués.
 *
 * Conséquence côté web : le déploiement n'est plus un serveur Node mais un
 * hébergement de fichiers statiques servant `out/`.
 */
const nextConfig: NextConfig = {
  output: "export",
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
