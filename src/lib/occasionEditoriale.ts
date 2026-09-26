import { occasionShortLabel } from "./data";
import type { OccasionKey } from "./types";

/*
 * « TON STYLE CE MOIS-CI » — LA SOURCE UNIQUE de ce que la carte dit et
 * montre pour une occasion (26/09/2026). Les chiffres viennent tous de
 * styleDuMois (selectors.ts) ; ce module ne porte que les mots et l'image.
 *
 * LES NOMS SONT CEUX DE L'APPLICATION (harmonisés le 26/09/2026, demandé) :
 * le nom affiché est occasionShortLabel — le même que les pastilles du filtre
 * du Journal, que le bouton de la carte ouvre —, et titres, phrases et
 * boutons emploient les mêmes mots (« Voyage » et non « Déplacement »,
 * « Sortie », « Cérémonie »).
 *
 * LES VISUELS sont les huit visuels éditoriaux unisexes fournis le 26/09/2026
 * (900 × 1200, sans personne ni texte), copiés tels quels dans
 * public/editorial/occasions. Une seule image pour les profils femme et homme :
 * elle montre l'univers de l'occasion, jamais une silhouette.
 * Rendez-vous important reprend le visuel Travail et Sortie festive celui de
 * Sortie / Soirée (décidé le 26/09/2026) : deux univers voisins, choisis
 * explicitement — jamais un repli automatique.
 *
 * ARBITRAGE ÉDITORIAL : les titres et les insights.
 *
 * « rendez\u2011vous » porte un trait d'union insécable dans les textes de la
 * colonne étroite (titre, « tenues pensées pour ») : la ligne ne se coupe
 * jamais en « rendez- / vous ».
 */

export interface OccasionEditoriale {
  /** Sujet du titre : « Le travail », « Les sorties ». */
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
  /** Visuel éditorial et son texte alternatif (qui décrit l'image) — absent tant qu'aucun asset n'est choisi. */
  visuel?: { src: string; alt: string };
}

const V = (nom: string, univers: string) => ({
  src: `/editorial/occasions/capsela_editorial_${nom}_unisex_900x1200.jpg`,
  alt: `Scène éditoriale représentant l'univers ${univers}`,
});
const DOMINE = { singulier: "domine ton dressing", pluriel: "dominent ton dressing" };
const RYTHME = { singulier: "rythme ton dressing", pluriel: "rythment ton dressing" };

export const OCCASIONS_EDITORIALES: Record<Exclude<OccasionKey, "all">, OccasionEditoriale> = {
  quotidien: {
    sujet: "Le quotidien",
    pluriel: false,
    verbe: DOMINE,
    pour: "ton quotidien",
    insight: "Ton dressing accompagne surtout tes journées de tous les jours.",
    cta: "Voir mes tenues du quotidien",
    visuel: V("quotidien", "du quotidien"),
  },
  travail_formel: {
    sujet: "Le travail",
    pluriel: false,
    verbe: DOMINE,
    pour: "tes journées de travail",
    insight: "Ton dressing accompagne surtout ton quotidien professionnel.",
    cta: "Voir mes tenues travail",
    visuel: V("travail", "du travail"),
  },
  entretien: {
    sujet: "Les rendez\u2011vous importants",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes rendez\u2011vous importants",
    insight: "Ton dressing t'accompagne surtout dans tes moments importants.",
    cta: "Voir mes tenues rendez-vous",
    visuel: V("travail", "du travail"),
  },
  date: {
    sujet: "Les rendez\u2011vous à deux",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes rendez\u2011vous à deux",
    insight: "Ton dressing fait une belle place à tes rendez-vous à deux.",
    cta: "Voir mes tenues date",
    visuel: V("date", "d'un rendez-vous à deux"),
  },
  soiree: {
    sujet: "Les sorties",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes sorties",
    insight: "Ton dressing révèle une vraie place pour les silhouettes de soirée.",
    cta: "Voir mes tenues sortie",
    visuel: V("soiree", "d'une soirée"),
  },
  festive: {
    sujet: "Les sorties festives",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes sorties festives",
    insight: "Ton dressing révèle une vraie place pour tes soirées festives.",
    cta: "Voir mes tenues sortie festive",
    visuel: V("soiree", "d'une soirée"),
  },
  sport: {
    sujet: "Le sport",
    pluriel: false,
    verbe: RYTHME,
    pour: "tes séances de sport",
    insight: "Ton dressing s'adapte particulièrement à tes moments actifs.",
    cta: "Voir mes tenues sport",
    visuel: V("sport", "du sport"),
  },
  cocooning: {
    sujet: "Le cocooning",
    pluriel: false,
    verbe: { singulier: "s'invite dans ton dressing", pluriel: "s'invitent dans ton dressing" },
    pour: "tes moments cocooning",
    insight: "Ton dressing privilégie le confort de tes moments à la maison.",
    cta: "Voir mes tenues cocooning",
    visuel: V("cocooning", "du cocooning"),
  },
  voyage: {
    sujet: "Les voyages",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes voyages",
    insight: "Ton dressing t'accompagne surtout dans tes voyages.",
    cta: "Voir mes tenues voyage",
    visuel: V("deplacement", "du voyage"),
  },
  evenement_perso: {
    sujet: "Les cérémonies",
    pluriel: true,
    verbe: RYTHME,
    pour: "tes cérémonies",
    insight: "Ton dressing se met au diapason de tes grandes occasions.",
    cta: "Voir mes tenues cérémonie",
    visuel: V("evenement", "d'une cérémonie"),
  },
};

/** Le nom de l'occasion tel que la carte l'affiche : celui de l'application (pastilles du filtre du Journal). */
export const libelleOccasion = (occasion: Exclude<OccasionKey, "all">) => occasionShortLabel(occasion);

/**
 * Le titre de la carte. « Domine », « rythme », « s'invite » seulement quand
 * l'occasion dépasse la moitié des tenues du mois (styleDuMois.majorite) ;
 * sinon elle « arrive en tête » — jamais une domination qu'elle n'a pas.
 */
export function titreStyle(o: OccasionEditoriale, majorite: boolean): string {
  const verbe = majorite ? (o.pluriel ? o.verbe.pluriel : o.verbe.singulier) : o.pluriel ? "arrivent en tête" : "arrive en tête";
  return `${o.sujet} ${verbe} ce mois-ci`;
}
