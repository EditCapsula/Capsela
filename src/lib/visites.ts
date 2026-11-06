import { aTraduire } from "./langue";
import type { Screen } from "./types";

/*
 * LES VISITES GUIDÉES (05/11/2026, demandé : « des infobulles interactives pour accompagner les premières utilisations »).
 * Contenus validés le 05/11/2026 par la propriétaire. Toute la configuration est ici : quelle visite, sur quel écran, quelles étapes,
 * dans quel ordre. Les écrans ne portent que des attributs `data-tour` ; Driver.js n'est manipulé que par
 * src/components/VisiteGuidee.tsx. Docs : docs/visites-guidees.md.
 */

export type IdVisite = "accueil" | "dressing" | "capsule";

export interface EtapeVisite {
  /** La valeur de l'attribut `data-tour` de l'élément mis en évidence. */
  cible: string;
  /**
   * Le côté de l'élément où poser l'infobulle (option native `popover.side` de Driver.js) ; sans, Driver.js choisit. À fixer quand
   * l'infobulle masquerait ce qu'elle désigne ou ce qu'il faut toucher ensuite.
   */
  cote?: "top" | "bottom" | "left" | "right";
  /**
   * L'élément mis en évidence ne réagit pas au toucher pendant l'étape (option native `disableActiveInteraction`) : pour un bouton
   * dont l'action ne doit pas partir pendant la visite (« Autre tenue » générerait une tenue et consommerait le quota).
   */
  inactif?: boolean;
  titre: string;
  texte: string;
}

export interface Visite {
  id: IdVisite;
  /** L'écran où la visite se joue : elle se lance à sa première ouverture. */
  ecran: Screen;
  /** Le nom de la visite dans la feuille « Tutoriel » (Réglages → Aide & Support). */
  nom: string;
  etapes: EtapeVisite[];
}

export const VISITES: readonly Visite[] = [
  {
    id: "accueil",
    ecran: "home",
    nom: aTraduire("Découvrir Aujourd'hui"),
    etapes: [
      {
        cible: "accueil-tenue",
        titre: aTraduire("Ta tenue du jour"),
        // Deux paragraphes (06/11/2026) : le retour à la ligne est rendu par la feuille de style des infobulles (white-space: pre-line).
        texte: aTraduire(
          "Chaque matin, découvre une tenue composée à partir de tes pièces, de la météo et de ton programme.\nFais glisser pour découvrir d'autres propositions."
        ),
      },
      {
        cible: "accueil-autre-tenue",
        inactif: true,
        titre: aTraduire("Envie d'autre chose ?"),
        texte: aTraduire("Découvre une nouvelle proposition, toujours adaptée à ton profil, à la météo et à ton occasion."),
      },
      {
        // La ligne entière (flèches, jour, ville, météo) : le texte lie les flèches aux prévisions.
        cible: "jour-meteo",
        titre: aTraduire("Anticipe tes prochaines tenues"),
        texte: aTraduire("Utilise les flèches pour découvrir les tenues proposées pour les prochains jours et consulter la météo associée."),
      },
    ],
  },
  {
    id: "dressing",
    ecran: "wardrobe",
    nom: aTraduire("Découvrir ton Dressing"),
    etapes: [
      {
        cible: "dressing-ajouter",
        titre: aTraduire("Ajoute tes pièces"),
        texte: aTraduire("Une photo suffit : Capsela reconnaît la catégorie, la couleur de la pièce puis la détoure."),
      },
      {
        cible: "dressing-filtres",
        titre: aTraduire("Retrouve tout, vite"),
        texte: aTraduire("Cherche, filtre par catégorie ou trie ton dressing."),
      },
    ],
  },
  {
    id: "capsule",
    ecran: "capsule",
    nom: aTraduire("Découvrir ta Capsule"),
    etapes: [
      {
        cible: "capsule-saison",
        titre: aTraduire("Ta capsule de saison"),
        texte: aTraduire("Change de saison pour découvrir les pièces sélectionnées pour une autre période de l'année."),
      },
      {
        cible: "capsule-onglets",
        titre: aTraduire("Quatre façons de découvrir ta capsule"),
        texte: aTraduire("Compose une tenue, explore ta sélection, retrouve tes pièces clés et découvre les détails de ta capsule."),
      },
      {
        // Les catégories sous la planche (06/11/2026) : l'étape désignait la planche alors que le texte parle des catégories.
        // L'infobulle se pose au-dessus de la rangée, sur la planche, pour laisser les catégories visibles et touchables.
        cible: "capsule-categories",
        cote: "top",
        titre: aTraduire("Compose ta tenue"),
        texte: aTraduire("Choisis une catégorie pour découvrir les pièces de ta capsule, puis sélectionne celles qui composeront ton look."),
      },
    ],
  },
];

/** Le sélecteur d'une cible. */
export const selecteurCible = (cible: string): string => `[data-tour="${cible}"]`;

/**
 * La visite à lancer sur cet écran : celle qui a été demandée depuis l'Aide (même déjà vue), sinon celle de l'écran si elle n'a
 * jamais été vue. Rien tant que le compte n'est pas prêt (inscription et questionnaire terminés).
 */
export function visiteAMontrer(ecran: Screen, vues: readonly string[], pret: boolean, demandee: IdVisite | null = null): Visite | null {
  if (!pret) return null;
  const ici = VISITES.find((v) => v.ecran === ecran);
  if (!ici) return null;
  if (demandee === ici.id) return ici;
  return vues.includes(ici.id) ? null : ici;
}
