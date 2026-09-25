/**
 * LES COULEURS DE LA PALETTE PERSONNELLE — module FEUILLE, sans aucun import.
 *
 * Sorties de `profile.ts` le 25/09/2026 pour rompre un cycle : `profile.ts`
 * a besoin du type `Colorimetrie` et de `COLORIMETRIE_VIDE`, et
 * `colorimetrie.ts` a besoin de cette liste pour valider ce qu'un service
 * externe lui rend. Chacun important l'autre, l'une des deux constantes était
 * lue avant son initialisation — invisible en test, fatale au chargement dans
 * le navigateur.
 *
 * VINGT ET UNE COULEURS, PAS VINGT. La maquette du 25/09 n'en montre que 20 :
 * elle omet « Blanc » et renomme « Rose poudré » en « Rose ». Arbitré de
 * garder les 21 du code — retirer « Blanc » (#F7F4EE) orphelinerait les
 * profils qui l'ont déjà choisi, et « Rose poudré » est le libellé du
 * vestiaire universel, où il désigne une teinte précise du catalogue.
 */
export const PAL_COULEURS: [string, string][] = [
  ["Noir", "#2A2724"],
  ["Marine", "#3A4152"],
  ["Gris", "#8E8B85"],
  ["Blanc / écru", "#EDE4D6"],
  ["Blanc", "#F7F4EE"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#DCCFBC"],
  ["Beige", "#CDBBA2"],
  ["Taupe", "#A8967C"],
  ["Chocolat", "#5A4436"],
  ["Camel", "#C08A5E"],
  ["Kaki", "#6E7358"],
  ["Vert bouteille", "#3C5347"],
  ["Bordeaux", "#6E3B3A"],
  ["Prune", "#5B3A4A"],
  ["Rouge", "#933B33"],
  ["Terracotta", "#A66950"],
  ["Rose poudré", "#D6A9A0"],
  ["Corail", "#CF7358"],
  ["Moutarde", "#C29A3D"],
  ["Bleu", "#4A6280"],
];
