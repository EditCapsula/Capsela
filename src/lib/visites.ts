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
  titre: string;
  texte: string;
}

export interface Visite {
  id: IdVisite;
  /** L'écran où la visite se joue : elle se lance à sa première ouverture. */
  ecran: Screen;
  /** Le nom de la visite dans la feuille « Aide » (Gérer mon compte → Support). */
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
        texte: aTraduire("Composée chaque matin avec tes pièces, selon la météo et ton programme. Fais glisser pour voir d'autres idées."),
      },
      {
        cible: "accueil-autre-tenue",
        titre: aTraduire("Envie d'autre chose ?"),
        texte: aTraduire("Demande une autre tenue : elle respecte toujours la météo et ton occasion."),
      },
      {
        cible: "jour-meteo",
        titre: aTraduire("Prépare les jours suivants"),
        texte: aTraduire("Les flèches te montrent la tenue des prochains jours, avec leur météo."),
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
        texte: aTraduire("Touche la saison pour découvrir la capsule d'une autre saison."),
      },
      {
        cible: "capsule-onglets",
        titre: aTraduire("Quatre façons de la parcourir"),
        texte: aTraduire("Compose une tenue, explore les pièces, découvre les pièces clés et les détails de ta capsule."),
      },
      {
        cible: "capsule-planche",
        titre: aTraduire("Compose ta tenue"),
        texte: aTraduire("Choisis une catégorie, puis fais défiler ses pièces avec les flèches ou d'un glissement."),
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
