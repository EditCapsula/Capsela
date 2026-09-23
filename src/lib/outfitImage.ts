/**
 * Image partageable de la tenue — composée dans le navigateur, sans backend.
 *
 * POURQUOI C'EST POSSIBLE. Le flat-lay n'existe qu'en DOM : il n'y a aucun
 * fichier image de la tenue à partager. Le seul chemin sans backend est de la
 * redessiner sur un canvas, ce qui suppose que les visuels distants n'y
 * « tachent » pas le contexte. Mesuré avant d'écrire : le bucket
 * catalog-images répond `access-control-allow-origin: *`, donc un chargement
 * en crossOrigin="anonymous" laisse le canvas exportable.
 *
 * CE QUI PEUT ÉCHOUER MALGRÉ TOUT, et pourquoi tout est en repli silencieux :
 * une photo du dressing servie depuis un autre bucket, un en-tête CORS qui
 * change, un navigateur qui refuse toBlob, un réseau coupé. Aucun de ces cas
 * ne doit faire échouer le partage — le texte, lui, part toujours. La fonction
 * rend donc `null` plutôt que de lever.
 *
 * La grille est volontairement la plus simple qui soit : ce n'est pas une
 * seconde implémentation d'OutfitComposition, mais une planche carrée pour un
 * fil de discussion, où la composition sera vue en vignette.
 */

/** Côté de l'image produite, en pixels. Carré : c'est le format le mieux traité par les messageries en aperçu. */
const COTE = 1080;
const FOND = "#9e5b43"; // --color-terracotta-deep, le fond de la card Tenue
const MARGE = 72;
const GOUTTIERE = 28;

/**
 * Découpe N pièces en une grille aussi carrée que possible.
 *
 * Extrait et exporté pour être testable hors ligne : c'est la seule partie de
 * ce module qui ne dépend ni du DOM ni du réseau, et la seule qui puisse être
 * fausse en silence — une grille mal calculée produit une image bancale sans
 * lever la moindre erreur.
 */
export function grillePour(nombre: number): { colonnes: number; lignes: number } {
  if (nombre <= 0) return { colonnes: 0, lignes: 0 };
  const colonnes = Math.ceil(Math.sqrt(nombre));
  return { colonnes, lignes: Math.ceil(nombre / colonnes) };
}

/** Case occupée par la i-ème pièce, en pixels, marges et gouttières comprises. */
export function caseDeLaPiece(
  index: number,
  nombre: number,
  cote = COTE
): { x: number; y: number; taille: number } {
  const { colonnes, lignes } = grillePour(nombre);
  const dispo = cote - 2 * MARGE;
  const taille = (dispo - GOUTTIERE * (Math.max(colonnes, lignes) - 1)) / Math.max(colonnes, lignes);
  const col = index % colonnes;
  const ligne = Math.floor(index / colonnes);
  // Centrage du bloc réel dans la zone disponible : une dernière rangée
  // incomplète ne doit pas laisser l'image déséquilibrée à gauche.
  const largeurBloc = colonnes * taille + GOUTTIERE * (colonnes - 1);
  const hauteurBloc = lignes * taille + GOUTTIERE * (lignes - 1);
  const piecesDerniereLigne = nombre - (lignes - 1) * colonnes;
  const decalageLigne =
    ligne === lignes - 1 && piecesDerniereLigne < colonnes
      ? ((colonnes - piecesDerniereLigne) * (taille + GOUTTIERE)) / 2
      : 0;
  return {
    x: MARGE + (cote - 2 * MARGE - largeurBloc) / 2 + decalageLigne + col * (taille + GOUTTIERE),
    y: MARGE + (cote - 2 * MARGE - hauteurBloc) / 2 + ligne * (taille + GOUTTIERE),
    taille,
  };
}

/** Charge une image en mode anonyme — seul mode qui laisse le canvas exportable. */
function charge(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resoudre) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resoudre(img);
    img.onerror = () => resoudre(null);
    img.src = url;
  });
}

/**
 * Compose la planche et rend un fichier PNG, ou `null` si quoi que ce soit
 * s'y oppose. Ne lève jamais : le partage du texte ne doit pas dépendre d'elle.
 */
export async function composeOutfitImage(urls: readonly string[]): Promise<File | null> {
  if (typeof document === "undefined" || urls.length === 0) return null;
  try {
    const images = (await Promise.all(urls.map(charge))).filter((i): i is HTMLImageElement => i !== null);
    if (images.length === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = COTE;
    canvas.height = COTE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, COTE, COTE);

    images.forEach((img, i) => {
      const { x, y, taille } = caseDeLaPiece(i, images.length);
      // "contain" : un vêtement n'est jamais déformé ni recadré.
      const echelle = Math.min(taille / img.naturalWidth, taille / img.naturalHeight);
      const l = img.naturalWidth * echelle;
      const h = img.naturalHeight * echelle;
      ctx.drawImage(img, x + (taille - l) / 2, y + (taille - h) / 2, l, h);
    });

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return null;
    return new File([blob], "ma-tenue-du-jour.png", { type: "image/png" });
  } catch {
    // Canvas taché, réseau coupé, toBlob refusé : le texte part quand même.
    return null;
  }
}
