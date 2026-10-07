/**
 * LES MARGES TRANSPARENTES DES VISUELS DU CATALOGUE (07/10/2026, mesure sur l'export de `vestiaire_universel` : 97 images,
 * toutes en 800 × 800 à fond transparent). La pièce n'occupe que 22 à 85 % de ce carré — un pantalon seulement 48 % — : posée
 * « contenue » dans un emplacement de la planche, elle y paraît petite. Ce tableau donne, pour chaque image, la part à
 * retrancher à gauche, en haut, à droite et en bas (en millièmes de côté, pixels d'alpha ≥ 20 + 1 % de sécurité pour
 * l'ombre) : la planche recadre l'image sur la pièce.
 *
 * Clé : le chemin dans le bucket `catalog-images`, sans extension. Une image absente du tableau (nouvelle, régénérée sous un
 * autre nom) n'est pas recadrée : le comportement est celui d'avant. Régénérer : `node scripts/mesurer-marges-catalogue.mjs`.
 * Ne vaut que pour des images CARRÉES (toutes le sont aujourd'hui) : `margesDe` ne rend rien pour les autres chemins.
 */
const MARGES: Record<string, [number, number, number, number]> = {
  "femme/hauts/29": [86,51,80,61],
  "femme/hauts/30": [93,48,94,40],
  "unisexe/hauts/580-1787939712132": [220,60,220,55],
  "unisexe/hauts/20": [62,80,58,74],
  "femme/hauts/77": [73,36,66,44],
  "femme/hauts/80": [180,0,174,17],
  "femme/pulls-gilets/582-1789485773491": [94,0,99,0],
  "femme/pulls-gilets/583-1789485790875": [119,0,111,0],
  "femme/vestes-blazers/32": [98,0,105,0],
  "femme/vestes-blazers/33": [159,71,150,24],
  "femme/vestes-blazers/34": [116,0,111,12],
  "femme/vestes-blazers/581-1789485807893": [58,0,61,30],
  "femme/vestes-blazers/35": [132,8,134,5],
  "femme/vestes-blazers/36": [120,23,131,46],
  "femme/pulls-gilets/37": [106,45,115,26],
  "femme/manteaux-exterieurs/584-1789485824634": [165,0,157,0],
  "femme/manteaux-exterieurs/585-1789485839877": [180,0,165,0],
  "femme/shorts/64": [48,104,46,121],
  "femme/shorts/38": [124,91,122,91],
  "femme/jeans/39": [294,6,294,0],
  "femme/pantalons/40": [246,0,254,0],
  "femme/pantalons/75": [244,0,246,0],
  "femme/jupes/41": [191,50,183,30],
  "femme/robes/1": [226,0,228,0],
  "femme/robes/43": [244,0,255,0],
  "femme/robes/65": [204,0,186,0],
  "femme/robes/44": [209,0,209,0],
  "femme/chaussures/586-1789485856746": [86,264,73,208],
  "femme/chaussures/587-1789485885238": [51,209,54,165],
  "femme/chaussures/47": [51,179,59,167],
  "femme/chaussures/197": [49,113,53,193],
  "femme/chaussures/588-1789485902973": [109,79,96,64],
  "femme/chaussures/50": [106,305,101,234],
  "femme/sacs/51": [148,71,129,64],
  "femme/sacs/52": [155,39,124,32],
  "femme/sacs/53": [73,328,95,215],
  "unisexe/accessoires/54": [71,270,80,259],
  "unisexe/accessoires/28": [45,309,30,275],
  "unisexe/accessoires/55": [238,65,204,68],
  "unisexe/accessoires/56": [194,20,206,16],
  "unisexe/bijoux/57": [234,88,229,84],
  "unisexe/bijoux/58": [146,334,144,325],
  "femme/hauts/66": [215,35,205,20],
  "femme/pulls-gilets/68": [128,0,119,0],
  "femme/pantalons/69": [284,0,284,0],
  "femme/pantalons/81": [261,0,262,0],
  "femme/accessoires/17": [4,255,53,244],
  "femme/accessoires/59": [323,8,358,0],
  "homme/hauts/589-1789485919516": [46,12,45,20],
  "homme/hauts/590-1789485938290": [106,75,90,74],
  "homme/pulls-gilets/591-1789485953343": [75,3,59,0],
  "homme/pulls-gilets/592-1789485969432": [144,8,141,0],
  "homme/vestes-blazers/593-1789485985138": [54,33,59,22],
  "homme/vestes-blazers/594-1789486001278": [59,30,51,40],
  "homme/vestes-blazers/528-1789486019172": [99,0,101,0],
  "homme/vestes-blazers/338-1789486036635": [140,34,149,24],
  "homme/vestes-blazers/595-1789486051833": [68,20,58,6],
  "homme/vestes-blazers/596-1789486067695": [83,0,90,49],
  "homme/pulls-gilets/545-1787592732398": [89,0,74,20],
  "homme/manteaux-exterieurs/597-1789486084091": [111,0,108,0],
  "homme/manteaux-exterieurs/598-1789486099203": [180,0,179,0],
  "homme/shorts/599-1789486115067": [111,53,110,51],
  "homme/shorts/600-1789486132351": [145,49,129,50],
  "homme/jeans/601-1789486149114": [231,0,228,0],
  "homme/pantalons/602-1789486165133": [241,0,234,0],
  "homme/pantalons/78": [276,0,265,0],
  "homme/chaussures/603-1789486181097": [29,190,41,179],
  "homme/chaussures/604-1789486197428": [56,240,75,196],
  "homme/hauts/605-1789486213711": [76,48,75,51],
  "homme/pulls-gilets/606-1789486229529": [86,21,93,12],
  "homme/pantalons/556-1787693789940": [268,0,266,0],
  "homme/pantalons/62": [268,0,266,0],
  "femme/hauts/72": [83,65,86,73],
  "homme/hauts/79": [49,15,40,12],
  "homme/hauts/73": [38,8,45,29],
  "femme/hauts/82": [161,0,161,1],
  "femme/hauts/83": [95,60,88,58],
  "femme/hauts/85": [159,26,162,14],
  "femme/hauts/86": [158,0,169,10],
  "femme/hauts/87": [51,45,53,101],
  "femme/hauts/89": [56,38,58,27],
  "femme/hauts/93": [86,73,73,59],
  "femme/shorts/88": [78,83,83,93],
  "femme/shorts/94": [74,96,78,90],
  "femme/pantalons/95": [238,0,244,0],
  "femme/pantalons/96": [245,0,254,0],
  "femme/jupes/97": [209,0,220,0],
  "femme/jupes/98": [159,8,164,15],
  "femme/jeans/99": [276,0,283,0],
  "femme/robes/100": [223,0,226,0],
  "femme/robes/101": [190,0,204,0],
  "femme/robes/84": [255,0,261,0],
  "femme/robes/102": [119,0,127,0],
  "femme/combinaisons/103": [260,0,261,0],
  "femme/chaussures/91": [51,181,44,174],
  "femme/chaussures/104": [49,126,5,111],
  "femme/chaussures/90": [56,161,45,146]
};

export type Marges = { g: number; h: number; d: number; b: number };

/** Les marges (fractions de 0 à 1) du visuel de cette URL, ou null s'il n'est pas dans le tableau. */
export function margesDe(url: string | undefined): Marges | null {
  if (!url) return null;
  const m = /\/catalog-images\/(.+?)\.webp(?:\?.*)?$/.exec(url);
  const t = m ? MARGES[m[1]] : undefined;
  return t ? { g: t[0] / 1000, h: t[1] / 1000, d: t[2] / 1000, b: t[3] / 1000 } : null;
}

/**
 * Le format (largeur / hauteur) d'un visuel HERO (08/10/2026), lu dans son nom : « …-r0.83.webp ». Un visuel hero est rogné sur
 * la pièce à la génération (supabase/functions/_shared/heroImage.ts), il n'a donc pas besoin du tableau MARGES. Null pour tout
 * autre fichier.
 */
export function ratioHero(url: string | undefined): number | null {
  if (!url) return null;
  const m = /-r(\d+\.\d{2})\.webp(?:\?.*)?$/.exec(url);
  const r = m ? Number(m[1]) : NaN;
  return Number.isFinite(r) && r > 0.1 && r < 10 ? r : null;
}

/**
 * LA BOÎTE RÉELLE DE L'OBJET dans son image (08/10/2026, « objectBoundingBox »), en fractions de l'image : { x, y, width, height }.
 * Le moteur du flat lay calcule la taille d'une pièce à partir de CETTE boîte et non du fichier. Visuel du catalogue standard :
 * déduite du tableau des marges. Visuel hero : rogné à la génération, donc toute l'image. Autre fichier : null (boîte inconnue).
 */
export interface ObjectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function objectBounds(url: string | undefined): ObjectBounds | null {
  if (!url) return null;
  if (ratioHero(url) !== null) return { x: 0, y: 0, width: 1, height: 1 };
  const m = margesDe(url);
  return m ? { x: m.g, y: m.h, width: 1 - m.g - m.d, height: 1 - m.h - m.b } : null;
}
