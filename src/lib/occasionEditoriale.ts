import type { OccasionKey } from "./types";

/*
 * « TON STYLE CE MOIS-CI » — LA SOURCE UNIQUE de ce que la carte dit et
 * montre pour une occasion (26/09/2026). Les chiffres viennent tous de
 * styleDuMois (selectors.ts) ; ce module ne porte que les mots et l'image.
 *
 * LES VISUELS sont les huit visuels éditoriaux unisexes fournis le 26/09/2026
 * (900 × 1200, sans personne ni texte), copiés tels quels dans
 * public/editorial/occasions. Une seule image pour les profils femme et homme :
 * elle montre l'univers de l'occasion, jamais une silhouette. L'occasion
 * elle-même est dite par l'interface.
 *
 * Rendez-vous important et Sortie festive n'ont pas reçu de visuel : leur
 * carte s'affiche sans image, en pleine largeur. JAMAIS le visuel d'une autre
 * occasion en repli — une image fausse contredirait la statistique.
 *
 * ARBITRAGE ÉDITORIAL : les titres et les insights (formulations du brief du
 * 26/09/2026 pour les huit occasions illustrées).
 */

export interface OccasionEditoriale {
  /** Le nom de l'occasion tel que la carte l'affiche : « Travail », « Déplacement ». */
  libelle: string;
  /** Sujet du titre : « Le travail », « Les soirées ». */
  sujet: string;
  pluriel: boolean;
  /** Verbe et complément quand l'occasion dépasse la moitié des tenues : « domine ton dressing ». */
  verbe: { singulier: string; pluriel: string };
  /** Pour quoi les tenues étaient pensées : « tenues pensées pour tes journées de travail ». */
  pour: string;
  /** L'insight, quand l'occasion dépasse la moitié des tenues. */
  insight: string;
  /** Libellé du bouton qui ouvre le journal filtré (sans la flèche). */
  cta: string;
  /** Visuel éditorial et son texte alternatif — absent tant qu'aucun asset n'existe. */
  visuel?: { src: string; alt: string };
}

const V = (nom: string, univers: string) => ({
  src: `/editorial/occasions/capsela_editorial_${nom}_unisex_900x1200.jpg`,
  alt: `Scène éditoriale représentant l'univers ${univers}`,
});

export const OCCASIONS_EDITORIALES: Record<Exclude<OccasionKey, "all">, OccasionEditoriale> = {
  quotidien: {
    libelle: "Quotidien",
    sujet: "Le quotidien",
    pluriel: false,
    verbe: { singulier: "domine ton dressing", pluriel: "dominent ton dressing" },
    pour: "ton quotidien",
    insight: "Ton dressing accompagne surtout tes journées de tous les jours.",
    cta: "Voir mes tenues du quotidien",
    visuel: V("quotidien", "du quotidien"),
  },
  travail_formel: {
    libelle: "Travail",
    sujet: "Le travail",
    pluriel: false,
    verbe: { singulier: "domine ton dressing", pluriel: "dominent ton dressing" },
    pour: "tes journées de travail",
    insight: "Ton dressing accompagne surtout ton quotidien professionnel.",
    cta: "Voir mes tenues travail",
    visuel: V("travail", "du travail"),
  },
  entretien: {
    libelle: "Rendez-vous important",
    sujet: "Les rendez-vous importants",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes rendez-vous importants",
    insight: "Ton dressing t'accompagne surtout dans tes moments importants.",
    cta: "Voir mes tenues rendez-vous",
  },
  date: {
    libelle: "Date",
    sujet: "Les rendez-vous",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes rendez-vous à deux",
    insight: "Ton dressing fait une belle place à tes rendez-vous à deux.",
    cta: "Voir mes tenues date",
    visuel: V("date", "d'un rendez-vous à deux"),
  },
  soiree: {
    libelle: "Soirée",
    sujet: "Les soirées",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes soirées",
    insight: "Ton dressing révèle une vraie place pour les silhouettes de soirée.",
    cta: "Voir mes tenues soirée",
    visuel: V("soiree", "d'une soirée"),
  },
  festive: {
    libelle: "Sortie festive",
    sujet: "Les soirées festives",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes soirées festives",
    insight: "Ton dressing révèle une vraie place pour tes soirées festives.",
    cta: "Voir mes tenues festives",
  },
  sport: {
    libelle: "Sport",
    sujet: "Le sport",
    pluriel: false,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes séances de sport",
    insight: "Ton dressing s'adapte particulièrement à tes moments actifs.",
    cta: "Voir mes tenues sport",
    visuel: V("sport", "du sport"),
  },
  cocooning: {
    libelle: "Cocooning",
    sujet: "Le cocooning",
    pluriel: false,
    verbe: { singulier: "s'invite dans ton dressing", pluriel: "s'invitent dans ton dressing" },
    pour: "tes moments cocooning",
    insight: "Ton dressing privilégie le confort de tes moments à la maison.",
    cta: "Voir mes tenues cocooning",
    visuel: V("cocooning", "du cocooning"),
  },
  voyage: {
    libelle: "Déplacement",
    sujet: "Les déplacements",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes déplacements",
    insight: "Ton dressing t'accompagne surtout dans tes déplacements.",
    cta: "Voir mes tenues déplacement",
    visuel: V("deplacement", "des déplacements"),
  },
  evenement_perso: {
    libelle: "Événement",
    sujet: "Les événements",
    pluriel: true,
    verbe: { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" },
    pour: "tes événements",
    insight: "Ton dressing se met au diapason de tes grandes occasions.",
    cta: "Voir mes tenues événement",
    visuel: V("evenement", "d'un événement"),
  },
};

/**
 * Le titre de la carte. « Domine », « rythme », « s'invite » seulement quand
 * l'occasion dépasse la moitié des tenues du mois (styleDuMois.majorite) ;
 * sinon elle « arrive en tête » — jamais une domination qu'elle n'a pas.
 */
export function titreStyle(o: OccasionEditoriale, majorite: boolean): string {
  const verbe = majorite ? (o.pluriel ? o.verbe.pluriel : o.verbe.singulier) : o.pluriel ? "arrivent en tête de ton dressing" : "arrive en tête de ton dressing";
  return `${o.sujet} ${verbe} ce mois-ci`;
}
