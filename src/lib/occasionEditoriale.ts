import { occasionShortLabel } from "./data";
import type { OccasionKey } from "./types";

/*
 * LA CARTE DU JOURNAL — LA SOURCE UNIQUE de ce qu'elle dit et montre pour une
 * occasion (26/09/2026). Les chiffres et le choix du commentaire viennent du
 * moteur commentaireJournal.ts (16/10/2026) ; ce module ne porte que les mots
 * et l'image.
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
 * Rendez-vous important reprend le visuel Travail (décidé le 26/09/2026) : deux
 * univers voisins, choisis explicitement — jamais un repli automatique.
 * « Sortie festive » a été fusionnée dans « Soirée » le 08/10/2026 (occasions.ts).
 *
 * ARBITRAGE ÉDITORIAL : les titres et les descriptions.
 *
 * « rendez\u2011vous » porte un trait d'union insécable dans les textes de la
 * colonne étroite (titre, « tenues pensées pour ») : la ligne ne se coupe
 * jamais en « rendez- / vous ».
 */

/** Un titre et sa description, tels que la carte du Journal les affiche. */
export interface TexteCarte {
  titre: string;
  description: string;
}

export interface OccasionEditoriale {
  /** Pour quoi les tenues étaient pensées : « tenues pensées pour tes journées de travail ». */
  pour: string;
  /** Occasion nettement en tête (règle « dominante » de commentaireJournal) : la description ne répète pas les chiffres affichés en grand. */
  dominante: TexteCarte;
  /**
   * Occasion en tête sans domination nette. `{tenues}` devient « 14 tenues » (« 1 tenue » au singulier), `{total}` le total de la
   * période : la phrase situe la tendance sans l'exagérer.
   */
  enTete: TexteCarte;
  /** Libellé du bouton qui ouvre la liste filtrée (sans la flèche), rédigé par occasion — jamais construit par concaténation. */
  cta: string;
  /** Visuel éditorial et son texte alternatif (qui décrit l'image) — absent tant qu'aucun asset n'est choisi. */
  visuel?: { src: string; alt: string };
}

const V = (nom: string, univers: string) => ({
  src: `/editorial/occasions/capsela_editorial_${nom}_unisex_900x1200.jpg`,
  alt: `Scène éditoriale représentant l'univers ${univers}`,
});
const enTete = (titre: string, sujet: string): TexteCarte => ({
  titre,
  description: `Avec {tenues} sur {total}, ${sujet} l'occasion la plus représentée dans ton Journal.`,
});

/*
 * LA BIBLIOTHÈQUE DU MOTEUR DE COMMENTAIRES (16/10/2026, spécification « Moteur de commentaires éditoriaux du Journal », textes
 * validés par la propriétaire). ARBITRAGE ÉDITORIAL. Contraintes vérifiées par les tests : titres de 45 caractères au plus,
 * descriptions de 160 au plus (chiffres compris), formulations neutres en genre, « préféré » dans un titre seulement. Aucun
 * texte ne suppose une préférence, une motivation, une vie sentimentale ou un niveau sportif : ils décrivent les tenues portées.
 */
export const OCCASIONS_EDITORIALES: Record<Exclude<OccasionKey, "all">, OccasionEditoriale> = {
  quotidien: {
    pour: "ton quotidien",
    dominante: {
      titre: "Ton quotidien, ton terrain de style préféré",
      description: "Tes tenues du quotidien occupent une place de choix dans ton dressing. C'est l'occasion qui revient le plus souvent dans ton Journal.",
    },
    enTete: enTete("Le quotidien revient le plus souvent", "le quotidien est"),
    cta: "Voir mes tenues du quotidien",
    visuel: V("quotidien", "du quotidien"),
  },
  travail_formel: {
    pour: "tes journées de travail",
    dominante: {
      titre: "L'élégance t'accompagne au travail",
      description: "Tes tenues professionnelles occupent une place importante dans ton Journal. Le bureau est l'occasion la plus représentée.",
    },
    enTete: enTete("Le travail arrive en tête", "le travail est"),
    cta: "Voir mes tenues de travail",
    visuel: V("travail", "du travail"),
  },
  date: {
    pour: "tes rendez\u2011vous à deux",
    dominante: {
      titre: "Des tenues pour les moments à deux",
      description: "Les rendez-vous amoureux sont l'occasion la plus représentée dans ton Journal.",
    },
    enTete: enTete("Les rendez\u2011vous reviennent le plus souvent", "les rendez-vous amoureux sont"),
    cta: "Voir mes tenues de rendez-vous",
    visuel: V("date", "d'un rendez-vous à deux"),
  },
  soiree: {
    pour: "tes soirées",
    dominante: {
      titre: "Ton style prend une autre dimension le soir",
      description: "Les soirées sont l'occasion la plus représentée dans tes tenues portées.",
    },
    enTete: enTete("Les soirées arrivent en tête", "les soirées sont"),
    cta: "Voir mes tenues de soirée",
    visuel: V("soiree", "d'une soirée"),
  },
  sport: {
    pour: "tes séances de sport",
    dominante: {
      titre: "Le confort en mouvement",
      description: "Tes tenues de sport occupent une place importante dans ton Journal. Le confort et la liberté de mouvement sont au cœur de cette occasion.",
    },
    enTete: enTete("Le sport revient le plus souvent", "le sport est"),
    cta: "Voir mes tenues de sport",
    visuel: V("sport", "du sport"),
  },
  cocooning: {
    pour: "tes moments cocooning",
    dominante: {
      titre: "À la maison aussi, le style a sa place",
      description: "Les tenues de cocooning sont celles qui reviennent le plus souvent dans ton Journal.",
    },
    enTete: enTete("Le cocooning arrive en tête", "le cocooning est"),
    cta: "Voir mes tenues cocooning",
    visuel: V("cocooning", "du cocooning"),
  },
  voyage: {
    pour: "tes voyages",
    dominante: {
      // « Prête à bouger avec style » (spécification) remplacé par une formule neutre en genre (arbitrage du 16/10/2026).
      titre: "Le style en mouvement",
      description: "Les tenues de voyage et de déplacement sont les plus représentées dans ton Journal.",
    },
    enTete: enTete("Le voyage revient le plus souvent", "le voyage est"),
    cta: "Voir mes tenues de voyage",
    visuel: V("deplacement", "du voyage"),
  },
  evenement_perso: {
    pour: "tes cérémonies",
    dominante: {
      titre: "Les grandes occasions inspirent ton dressing",
      description: "Les événements et les cérémonies sont l'occasion la plus représentée dans tes tenues portées.",
    },
    enTete: enTete("Les cérémonies arrivent en tête", "les cérémonies sont"),
    cta: "Voir mes tenues de cérémonie",
    visuel: V("evenement", "d'une cérémonie"),
  },
};

/** Les états du Journal qui ne désignent aucune occasion (même spécification, mêmes contraintes de longueur et de ton). */
export const TEXTES_JOURNAL = {
  vide: {
    titre: "Ton Journal commence ici",
    description: "Porte une première tenue pour commencer à découvrir les occasions qui rythment ton dressing.",
  },
  insuffisant: {
    titre: "Ton Journal prend forme",
    description: "Chaque tenue portée enrichit ton Journal et révèle peu à peu tes habitudes de style.",
  },
  emergent: {
    titre: "Ton style se dessine peu à peu",
    description: "Tes tenues portées commencent à dessiner les grandes lignes de ton quotidien vestimentaire.",
  },
  equilibre: {
    titre: "Plusieurs occasions rythment ton style",
    description: "Ton Journal montre un équilibre entre plusieurs occasions. Ton dressing accompagne différents moments de ton quotidien.",
  },
  diversifie: {
    titre: "Ton dressing suit plusieurs rythmes",
    description: "Du quotidien aux moments plus particuliers, tes tenues accompagnent différentes facettes de tes journées.",
  },
  secours: {
    titre: "Ton Journal prend forme",
    description: "Tes tenues portées enrichissent ton Journal. Les occasions apparaîtront ici au fil des tenues renseignées.",
  },
} satisfies Record<string, TexteCarte>;

/** Le nom de l'occasion tel que la carte l'affiche : celui de l'application (pastilles du filtre du Journal). */
export const libelleOccasion = (occasion: Exclude<OccasionKey, "all">) => occasionShortLabel(occasion);
