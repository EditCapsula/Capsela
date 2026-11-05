import { aTraduire } from "./langue";

/*
 * LES ASTUCES DE L'ÉCRAN DE CHARGEMENT (05/11/2026, demandé : « lors de l'écran de chargement de l'application une phrase sur
 * les features de l'application », sur le modèle d'une autre app ; exemples donnés : les congés dans les réglages, « plus tu
 * intègres de pièces dans le dressing, plus personnalisées seront tes tenues »).
 *
 * Une astuce par ouverture, jamais la même deux fois de suite (la dernière montrée est gardée sur l'appareil). Chaque phrase
 * décrit une fonction qui existe, à l'endroit où elle se trouve : en déplaçant ou en retirant une fonction, relire l'astuce qui
 * en parle. Six astuces validées par la propriétaire le 05/11/2026 (deux retirées : la navigation par date, la saison de la
 * capsule).
 */

export const ASTUCES: readonly string[] = [
  // Réglages → Mon quotidien (conges.ts) : pendant les dates de congés, plus de tenues de travail.
  aTraduire("Tu peux indiquer tes congés dans les Réglages : pendant ces dates, Capsela met les tenues de travail en pause."),
  // composeWardrobePool : catégorie par catégorie, les pièces réelles remplacent les suggestions de la capsule.
  aTraduire("Plus tu ajoutes de pièces à ton dressing, plus tes tenues te ressemblent."),
  // analyze-dressing-photo, detourer-photo.
  aTraduire("Une photo suffit pour ajouter une pièce : Capsela reconnaît sa catégorie et sa couleur, puis la détoure."),
  // Valise (valise.ts) : pièces du dressing, complétées par la capsule, puis les looks du séjour.
  aTraduire("Tu pars bientôt ? Capsela prépare ta valise : les pièces à emporter et les looks de ton séjour."),
  // Planifier : tenue pour une date, un moment et un lieu.
  aTraduire("Un dîner, un rendez-vous ? Planifie ta tenue à l'avance : elle suit la météo du jour prévu."),
  // Réglages → Aide & Support → Tutoriel.
  aTraduire("Envie de revoir une visite guidée ? Retrouve-les dans les Réglages, rubrique Tutoriel."),
];

/** La clé, sur l'appareil, de la dernière astuce montrée. Une préférence d'affichage : jamais liée à un compte. */
export const CLE_DERNIERE_ASTUCE = "capsela.derniereAstuce";

/**
 * L'astuce à montrer : tirée au hasard (`hasard` dans [0, 1[), jamais `precedente`. Fonction pure, testée.
 */
export function choisirAstuce(precedente: number | null, hasard: number, total: number = ASTUCES.length): number {
  if (total <= 1) return 0;
  const exclue = precedente != null && precedente >= 0 && precedente < total;
  const n = Math.min(Math.floor(hasard * (exclue ? total - 1 : total)), (exclue ? total - 1 : total) - 1);
  return exclue && n >= precedente ? n + 1 : n;
}
