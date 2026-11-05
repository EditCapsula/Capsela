/*
 * LE CENTRE D'AIDE (05/11/2026, Réglages Capsela → Aide & Support). Aucune FAQ n'existait : ce contenu est un BROUILLON rédigé
 * d'après le fonctionnement vérifié dans le code, à valider par la propriétaire avant d'être affiché (arbitré le 05/11/2026 :
 * « Tu rédiges, je valide »). Tant que `CENTRE_AIDE_VALIDE` vaut false, l'entrée « Centre d'aide » n'apparaît pas dans Réglages.
 *
 * Chaque réponse doit rester vraie dans le code : en modifiant une règle (quota, horizon de prévision, valise…), relire la
 * réponse qui en parle.
 */

import { GENERATIONS_GRATUITES_PAR_JOUR } from "./premium";

/** true : contenu validé par la propriétaire le 05/11/2026 (« C'est ok pour le centre d'aide ») ; l'entrée apparaît dans Réglages. */
export const CENTRE_AIDE_VALIDE = true;

const enLettres = (n: number) => ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"][n] ?? String(n);

export interface QuestionAide {
  question: string;
  reponse: string;
}

export interface ThemeAide {
  id: string;
  titre: string;
  questions: QuestionAide[];
}

export const CENTRE_AIDE: readonly ThemeAide[] = [
  {
    id: "dressing",
    titre: "Mon dressing",
    questions: [
      {
        question: "Comment ajouter une pièce ?",
        // analyze-dressing-photo (catégorie, couleur) et detourer-photo (docs/detourage.md).
        reponse:
          "Dans Dressing, touche « + » puis prends ou choisis une photo. Capsela reconnaît la catégorie et la couleur de la pièce, puis la détoure. Tu peux corriger chaque information avant d'enregistrer.",
      },
      {
        question: "Faut-il ajouter toute ma garde-robe ?",
        // composeWardrobePool : catégorie par catégorie, les pièces réelles remplacent les suggestions de la capsule.
        reponse:
          "Non. Commence par 5 à 10 pièces que tu portes souvent. Tant qu'une catégorie est vide, Capsela la complète avec des pièces de ta capsule pour te proposer des tenues.",
      },
    ],
  },
  {
    id: "tenues",
    titre: "Mes tenues",
    questions: [
      {
        question: "Comment est choisie ma tenue du jour ?",
        // generateOutfitWithFallback + diversite.ts + occasionParDefaut (Mon rythme).
        reponse:
          "Elle est composée avec tes pièces selon la météo du jour, ton occasion (travail ou week-end, d'après tes jours travaillés) et ton profil. Capsela évite de te reproposer les mêmes pièces plusieurs jours de suite.",
      },
      {
        question: "Combien de fois puis-je demander une autre tenue ?",
        // Le chiffre est lu dans premium.ts (GENERATIONS_GRATUITES_PAR_JOUR) : la réponse suit la limite. Vidéo : Android, une par jour.
        reponse:
          `Sans abonnement, « Autre tenue » est disponible ${enLettres(GENERATIONS_GRATUITES_PAR_JOUR)} fois par jour. Sur Android, tu peux en obtenir une de plus en regardant une courte vidéo. Avec Premium, il n'y a pas de limite.`,
      },
    ],
  },
  {
    id: "capsule",
    titre: "Ma capsule",
    questions: [
      {
        question: "Qu'est-ce que ma capsule ?",
        // computeDefaultCapsule (capsule.ts) : catalogue, style, palette, saison.
        reponse:
          "Une sélection de pièces pensée pour ton style, ta palette de couleurs et la saison. Elle sert de base à tes tenues et complète ton dressing là où il manque des pièces.",
      },
      {
        question: "Comment voir la capsule d'une autre saison ?",
        reponse: "Dans Capsule, touche le nom de la saison en haut de l'écran, puis choisis-en une autre.",
      },
    ],
  },
  {
    id: "colorimetrie",
    titre: "Ma colorimétrie",
    questions: [
      {
        question: "Comment ma palette est-elle établie ?",
        // docs/colorimetrie.md : questionnaire sur des traits déclarés, jamais de photo (arbitré le 30/09/2026).
        reponse:
          "Par un court questionnaire sur tes cheveux, tes yeux et les teintes qui te vont. Aucune photo n'est analysée. Tu peux refaire le questionnaire à tout moment depuis ton profil, ligne « Palette de couleurs ».",
      },
    ],
  },
  {
    id: "planifier",
    titre: "Planifier",
    questions: [
      {
        question: "Puis-je préparer une tenue pour un autre jour ?",
        // Planifier ; HORIZON_PREVISION_JOURS = 15 (prevision.ts), au-delà les températures habituelles (climat).
        reponse:
          "Oui, depuis Planifier : choisis la date, le moment et le lieu. Jusqu'à 15 jours à l'avance, la tenue suit la prévision météo ; au-delà, les températures habituelles du lieu à cette date.",
      },
    ],
  },
  {
    id: "valise",
    titre: "Ma valise",
    questions: [
      {
        question: "Comment fonctionne « Préparer une valise » ?",
        // docs/valise.md ; completerAvecCapsule (05/11/2026) quand le dressing ne suffit pas.
        reponse:
          "Indique ta destination, tes dates, la taille de ta valise et ce qui est prévu. Capsela choisit les pièces à emporter dans ton dressing, les complète avec ta capsule si besoin, puis compose les looks de ton séjour.",
      },
    ],
  },
];
