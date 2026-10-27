import type { CapacitorConfig } from "@capacitor/cli";

/*
 * LES APPLICATIONS iOS ET ANDROID (17/10/2026, plan « Publication sur l'App Store et Google Play », Notion).
 *
 * Capacitor emballe le site statique déjà construit (`out/`, `output: "export"` dans next.config.ts) : même code, même Supabase,
 * mêmes comptes. Le site web (Vercel) n'est pas touché — `npm run build` reste le même ; seul `npm run mobile:sync` copie `out/`
 * dans les projets natifs. Doc : docs/applications-mobiles.md.
 *
 * `appId` est DÉFINITIF une fois l'app publiée : `app.capsela`, dérivé du domaine capsela.app — domaine acheté par la propriétaire,
 * identifiant validé le 27/10/2026 avant le premier envoi aux stores.
 */
const config: CapacitorConfig = {
  appId: "app.capsela",
  appName: "Capsela",
  webDir: "out",
  // Le fond crème de l'app (--color-cream) derrière la vue web : pas d'éclair blanc au démarrage ni au rebond du défilement.
  backgroundColor: "#F3EEE5",
};

export default config;
