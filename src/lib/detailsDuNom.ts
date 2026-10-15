// LES DÉTAILS VISIBLES ÉCRITS DANS LE NOM D'UNE PIÈCE (15/10/2026, audit des visuels du 14/10).
//
// Le sujet du prompt (le TYPE de pièce) ne vient jamais du nom (règle du 18/08/2026) : un nom trompeur ne doit pas transformer
// un pantalon en blazer. Mais l'audit de 620 paires de visuels a montré l'autre face de cette règle : un motif ou un détail
// écrit SEULEMENT dans le nom était perdu — « Chemise rayée » (sous-type « Chemise ») dessinée unie, « Short rayé », « Jupe à
// carreaux », « Foulard imprimé », « Bonnet côtelé »… Ce module lit dans le nom les seuls détails VISIBLES (motif, matière
// d'aspect, longueur, encolure, manches, forme d'un bijou) et les rend comme MODIFICATEURS : ils ne changent jamais le type.
//
// Fichier dupliqué à l'identique dans src/lib/detailsDuNom.ts (runtime Deno séparé du bundle de l'app) ; un test vérifie que
// les deux copies sont identiques.

/** Mot du nom → modificateur anglais. Chaque entrée est un détail qui se voit sur la photo. */
const MOTS: Record<string, string> = {
  // Motifs
  "rayé": "striped",
  "rayée": "striped",
  "rayés": "striped",
  "rayées": "striped",
  rayures: "striped",
  "marinière": "breton-striped",
  carreaux: "checked",
  "prince-de-galles": "prince of wales check",
  "imprimé": "printed",
  "imprimée": "printed",
  paisley: "paisley print",
  fleuri: "floral print",
  fleurie: "floral print",
  floral: "floral print",
  graphique: "graphic print",
  // Aspect de la matière
  dentelle: "lace",
  "brodé": "embroidered",
  "brodée": "embroidered",
  broderie: "embroidered",
  franges: "fringed",
  "torsadé": "cable-knit",
  "côtelé": "ribbed",
  "côtelée": "ribbed",
  "matelassé": "quilted",
  "matelassée": "quilted",
  "ajouré": "openwork",
  "ajourée": "openwork",
  crochet: "crochet",
  "tressé": "braided",
  "tressée": "braided",
  "satiné": "satin",
  "satinée": "satin",
  velours: "velvet",
  shearling: "shearling",
  // Seconde passe (15/10/2026) : détails dont l'absence laissait la génération choisir — bracelet chaîne fin dessiné en grosse
  // chaîne, sac souple en sac structuré, créoles texturées lisses, jean wide leg droit, top à basque en gilet de costume.
  "texturé": "textured",
  "texturée": "textured",
  "texturés": "textured",
  "texturées": "textured",
  "chaîne": "chain",
  souple: "soft unstructured",
  "léger": "lightweight",
  "légère": "lightweight",
  basque: "peplum",
  palazzo: "full-length wide-leg palazzo",
  // Longueur et forme
  longue: "long",
  long: "long",
  courte: "short",
  court: "short",
  midi: "midi-length",
  maxi: "maxi-length",
  "ceinturé": "belted",
  "ceinturée": "belted",
  "fendue": "side-slit",
  fente: "side-slit",
  "croisé": "double-breasted",
  // Chaussures
  chelsea: "chelsea",
  // Bijoux
  jonc: "rigid bangle",
  manchette: "wide cuff",
  perles: "pearl",
  "créoles": "hoop",
  puces: "stud",
  pendantes: "drop",
};

/** Bigrammes du nom (deux mots consécutifs) — prioritaires sur les mots seuls qu'ils contiennent. */
const BIGRAMMES: Record<string, string> = {
  "velours côtelé": "corduroy",
  "col v": "v-neck",
  "col rond": "crew neck",
  "col roulé": "turtleneck",
  "col bateau": "boat neck",
  "col carré": "square neck",
  "col bénitier": "cowl neck",
  "col mao": "mandarin collar",
  "col lavallière": "pussy-bow collar",
  "sans manches": "sleeveless",
  "manches courtes": "short-sleeved",
  "manches longues": "long-sleeved",
  "manches ballon": "balloon-sleeve",
  "dos nu": "backless",
  "une épaule": "one-shoulder",
  "épaules dénudées": "off-the-shoulder",
  "épaules dégagées": "off-the-shoulder",
  "bout rond": "round-toe",
  "fines bretelles": "with thin straps",
  "petites créoles": "small hoop",
  // « Fin » seul resterait ambigu (un pull fin est une jauge de maille, pas une épaisseur) : lu seulement après « chaîne ».
  "chaîne fin": "thin chain",
  "chaîne fine": "thin chain",
  "col ouvert": "open-collar",
  "wide leg": "wide-leg",
  // Consommé sans rien produire : la manchette des « boutons de manchette » n'est pas un bracelet manchette (« wide cuff »).
  "de manchette": "",
};

/** Le nom découpé en mots, minuscules, ponctuation retirée (« Pull col roulé / épais » → pull, col, roulé, épais). */
function mots(nom: string | null | undefined): string[] {
  return (nom || "")
    .toLowerCase()
    .split(/[\s/,()]+/)
    .map((m) => m.replace(/^[-–.]+|[-–.]+$/g, ""))
    .filter(Boolean);
}

/**
 * Les modificateurs visibles lus dans le nom, dans l'ordre du nom, sans doublon. Un mot pris par un bigramme n'est pas relu seul
 * (« manches courtes » → short-sleeved, jamais « short ») ; un bigramme vide consomme ses mots sans rien produire. « Imprimé »
 * seul cède la place à un imprimé précis (paisley, floral).
 */
export function detailsDuNom(nom: string | null | undefined): string[] {
  const m = mots(nom);
  const pris = new Set<number>();
  const sortie: string[] = [];
  for (let i = 0; i < m.length - 1; i++) {
    const b = BIGRAMMES[`${m[i]} ${m[i + 1]}`];
    if (b !== undefined) {
      if (b) sortie.push(b);
      pris.add(i);
      pris.add(i + 1);
    }
  }
  for (let i = 0; i < m.length; i++) {
    if (pris.has(i)) continue;
    const d = MOTS[m[i]];
    if (d) sortie.push(d);
  }
  let uniques = Array.from(new Set(sortie));
  if (uniques.some((d) => d === "paisley print" || d === "floral print" || d === "graphic print")) uniques = uniques.filter((d) => d !== "printed");
  // Un détail précis remplace son voisin générique ; deux longueurs contraires (« Jupe midi / maxi ») ne disent rien.
  if (uniques.includes("breton-striped")) uniques = uniques.filter((d) => d !== "striped");
  if (uniques.includes("hoop") || uniques.includes("small hoop")) uniques = uniques.filter((d) => d !== "stud");
  if (uniques.includes("midi-length") && uniques.includes("maxi-length")) uniques = uniques.filter((d) => d !== "midi-length" && d !== "maxi-length");
  return uniques;
}
