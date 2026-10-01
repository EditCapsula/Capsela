/**
 * Les textes légaux publiés par l'app (01/10/2026) : un fichier de docs/legal,
 * une page publique /legal/<slug>. Les pages sont rendues À LA COMPILATION
 * (site statique, output: "export") : elles ne dépendent ni d'un serveur ni de
 * l'app, et leur URL est publique — ce qu'exigent les stores et la LCEN.
 */

export interface DocumentLegal {
  slug: string;
  /** Titre court, celui de la liste « Informations légales ». */
  titre: string;
  sousTitre: string;
}

export const DOCUMENTS_LEGAUX: readonly DocumentLegal[] = [
  { slug: "mentions-legales", titre: "Mentions légales", sousTitre: "Éditeur, hébergeur, contact" },
  { slug: "confidentialite", titre: "Politique de confidentialité", sousTitre: "Données collectées et usages" },
  { slug: "cgu", titre: "Conditions générales d'utilisation", sousTitre: "Règles du service" },
  { slug: "droits-rgpd", titre: "Tes droits (RGPD)", sousTitre: "Accès, rectification, suppression" },
  { slug: "cookies", titre: "Cookies et traceurs", sousTitre: "Préférences de mesure" },
  { slug: "cgv", titre: "Conditions générales de vente", sousTitre: "Abonnement Premium" },
];

export const SLUGS_LEGAUX: string[] = DOCUMENTS_LEGAUX.map((d) => d.slug);

export const urlLegale = (slug: string): string => `/legal/${slug}`;

/** Le texte contient encore des champs que l'éditrice n'a pas remplis ou qu'un juriste doit vérifier. */
export const estProvisoire = (source: string): boolean => /\[À (COMPLÉTER|VÉRIFIER)/.test(source);
