import type { CadragePhoto } from "./types";

/*
 * UNE PHOTO QUI N'EST PAS CELLE D'UNE PIÈCE SEULE (05/10/2026, demandé : « si une photo est ajoutée mais pas d'une pièce
 * seule, il faut l'indiquer, pour éviter les confusions »). L'analyse de la photo (Edge Function analyze-dressing-photo, champ
 * photo_type) dit si elle montre l'article seul, porté, ou plusieurs articles. Le message n'est dit qu'À L'AJOUT, au moment de
 * choisir la photo : rien n'est stocké (aucune colonne, aucune migration), donc rien n'est affiché plus tard dans le Dressing.
 *
 * Aucun jugement sur la personne ou son corps : on parle de la PHOTO et de ce qu'elle montre. Quand le modèle n'est pas sûr
 * (photoType absent), rien n'est dit — jamais une supposition.
 */
export function messageCadrage(cadrage: CadragePhoto | null): { titre: string; texte: string } | null {
  if (cadrage === "portee") {
    return {
      titre: "Cette photo montre la pièce portée",
      texte: "Capsela a lu la pièce, mais elle se mêlera mieux à tes tenues avec une photo de la pièce seule, à plat ou sur cintre.",
    };
  }
  if (cadrage === "plusieurs") {
    return {
      titre: "Cette photo montre plusieurs pièces",
      texte: "Capsela en a lu une seule. Une photo par pièce, posée seule, évite les confusions dans ton dressing.",
    };
  }
  return null;
}
