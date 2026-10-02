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
/**
 * ENRICHIE LE 02/10/2026 (demandé : « enrichir la palette de couleurs à choisir »),
 * de 21 à 46 teintes, rangées par FAMILLES pour qu'on les lise d'un coup d'œil.
 * Les 21 d'origine gardent leur code couleur (les profils qui les ont choisies ne
 * changent pas). Les ajouts viennent de deux sources :
 *   · les couleurs du catalogue réel que ni cette palette ni celle du dressing ne
 *     reconnaissaient (mesuré par scripts/palette-couverture.audit.ts : Vieux rose,
 *     Vert forêt, Bleu nuit, Ivoire, Nude, Champagne, Rouge cerise, Marron, Vert olive,
 *     Bleu cobalt — leur code est celui du catalogue) ;
 *   · des teintes de mode qui manquaient (Fuchsia, Émeraude, Lavande, Orange…), et
 *     quatre du dressing absentes d'ici (Gris anthracite, Gris clair, Vert sauge, Bleu ciel).
 * La palette du dressing (data.ts) reçoit les MÊMES ajouts au MÊME code, plus Rouge, Bleu
 * et Beige qu'elle n'avait pas : une couleur choisie ici se retrouve, à l'identique, sur
 * une pièce. Les teintes ajoutées ne sont encore placées dans aucune saison de la
 * colorimétrie (ARBITRAGE ÉDITORIAL à venir) : elle ne dit rien d'elles pour l'instant.
 */
export const PAL_COULEURS: [string, string][] = [
  // Neutres
  ["Noir", "#2A2724"],
  ["Gris anthracite", "#4B4A47"],
  ["Gris", "#8E8B85"],
  ["Gris clair", "#C7C2B9"],
  ["Gris perle", "#D3D0CB"],
  ["Blanc", "#F7F4EE"],
  ["Blanc / écru", "#EDE4D6"],
  ["Ivoire", "#F0EAE0"],
  ["Crème", "#E7DCC8"],
  ["Champagne", "#E8D9B5"],
  ["Sable", "#DCCFBC"],
  ["Nude", "#D9BBA0"],
  ["Beige", "#CDBBA2"],
  ["Taupe", "#A8967C"],
  // Marrons
  ["Chocolat", "#5A4436"],
  ["Marron", "#964B00"],
  ["Cognac", "#9A5B34"],
  ["Camel", "#C08A5E"],
  // Rouges et roses
  ["Bordeaux", "#6E3B3A"],
  ["Rouge", "#933B33"],
  ["Rouge cerise", "#A32B33"],
  ["Prune", "#5B3A4A"],
  ["Terracotta", "#A66950"],
  ["Corail", "#CF7358"],
  ["Vieux rose", "#C08A85"],
  ["Rose poudré", "#D6A9A0"],
  ["Rose pâle", "#EBCFCB"],
  ["Fuchsia", "#B83B78"],
  // Jaunes et oranges
  ["Moutarde", "#C29A3D"],
  ["Jaune", "#E0BE3C"],
  ["Orange", "#D9772B"],
  ["Abricot", "#E8A97E"],
  // Verts
  ["Kaki", "#6E7358"],
  ["Vert olive", "#6B6E4A"],
  ["Vert forêt", "#2F4A38"],
  ["Vert bouteille", "#3C5347"],
  ["Émeraude", "#1F6B58"],
  ["Vert sauge", "#9AA389"],
  ["Menthe", "#B7D3C1"],
  // Bleus
  ["Marine", "#3A4152"],
  ["Bleu nuit", "#2B3350"],
  ["Bleu cobalt", "#1E4FA3"],
  ["Bleu", "#4A6280"],
  ["Turquoise", "#3A9A9E"],
  ["Bleu ciel", "#A9BFCB"],
  // Violets
  ["Lavande", "#A99BC4"],
];

/**
 * Les teintes que la palette du dressing (data.ts) reçoit EN PLUS de ses 27 d'origine, au
 * code identique à celui de PAL_COULEURS. Source unique : data.ts les ajoute à PALETTE.
 */
export const NOMS_AJOUTES_AU_DRESSING: readonly string[] = [
  "Rouge", "Bleu", "Beige", "Marron", "Cognac", "Rouge cerise", "Vieux rose", "Rose pâle", "Fuchsia", "Jaune",
  "Orange", "Abricot", "Vert olive", "Vert forêt", "Émeraude", "Menthe", "Bleu nuit", "Bleu cobalt", "Turquoise",
  "Lavande", "Ivoire", "Champagne", "Nude", "Gris perle",
];
