// La marque Capsela (18/10/2026, nouveau logo fourni par la propriétaire : « CAPSELA » en didone, le A en terracotta).
//
// Source unique : public/brand/capsela-logo.png (le logo tel que fourni, rogné, fond transparent). Ce script en dérive :
//   · capsela-logo-claire.png — le même, l'encre passée en crème, pour les fonds sombres (écran d'accueil) ;
//   · capsela-monogramme.png — « CA » seul (le C et le A terracotta, sans la jambe du P qui touche le A), pour l'icône de l'app,
//     le favicon et le chargement. Rien n'est redessiné : on garde les pixels du logo.
// Puis relancer `node scripts/generer-icones-mobiles.mjs` pour les icônes iOS / Android.
import sharp from "sharp";

const SOURCE = "public/brand/capsela-logo.png";
const CREME = [243, 238, 229];
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
// Un pixel « terracotta » : nettement plus rouge que bleu (l'encre est neutre).
const estTerracotta = (i) => data[i] - data[i + 2] > 40;

// Version claire : l'encre devient crème, le terracotta ne change pas.
const claire = Buffer.from(data);
for (let i = 0; i < claire.length; i += 4) if (!estTerracotta(i)) [claire[i], claire[i + 1], claire[i + 2]] = CREME;
await sharp(claire, { raw: { width, height, channels: 4 } }).png().toFile("public/brand/capsela-logo-claire.png");

// Monogramme : à droite de la colonne où finit le C, on ne garde que le terracotta (le A), ce qui écarte la jambe du P.
// La fin du C : la dernière colonne, en partant de la gauche, qui contient de l'encre avant la première colonne terracotta pleine.
let premiereTerracotta = width;
for (let x = 0; x < width && premiereTerracotta === width; x++)
  for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 128 && estTerracotta((y * width + x) * 4)) { premiereTerracotta = x; break; }
const limite = Math.round(premiereTerracotta + (width * 0.03));
let finA = premiereTerracotta;
for (let x = premiereTerracotta; x < width; x++)
  for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 20 && estTerracotta((y * width + x) * 4)) finA = Math.max(finA, x);
const mono = Buffer.from(data);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (x > finA || (x > limite && !estTerracotta(i))) mono[i + 3] = 0;
  }
// LE PIED DU A (proposition du 18/10/2026, à valider) : dans le logo, la jambe droite du A passe sous la jambe du P ; une fois le P retiré,
// elle s'arrêtait net. On la prolonge jusqu'à la ligne de base en suivant ses propres bords (droites ajustées sur la partie visible),
// avec la couleur du A — rien d'autre n'est ajouté.
const TERRA = (() => {
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 250 && estTerracotta(i)) return [data[i], data[i + 1], data[i + 2]];
  return [158, 91, 67];
})();
const bords = []; // [y, gauche, droite] de la jambe épaisse, là où elle n'est pas encore cachée
for (let y = 0; y < height; y++) {
  let g = -1, d = -1, run = 0, meilleur = [-1, -1, 0];
  for (let x = premiereTerracotta; x <= finA + 1; x++) {
    const i = (y * width + x) * 4;
    const t = x <= finA && mono[i + 3] > 128 && estTerracotta(i);
    if (t) { if (run === 0) g = x; run++; d = x; } else { if (run > meilleur[2]) meilleur = [g, d, run]; run = 0; }
  }
  if (meilleur[2] >= 6) { bords.push([y, meilleur[0], meilleur[1]]); }
}
const ajuster = (pts) => {
  const n = pts.length, sx = pts.reduce((a, [y]) => a + y, 0), sy = pts.reduce((a, [, v]) => a + v, 0);
  const sxx = pts.reduce((a, [y]) => a + y * y, 0), sxy = pts.reduce((a, [y, v]) => a + y * v, 0);
  const pente = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return (y) => pente * y + (sy - pente * sx) / n;
};
// Bords mesurés sur la moitié haute de la jambe (jamais cachée), puis prolongés jusqu'au bas du C (la ligne de base).
const visibles = bords.filter(([y]) => y < height * 0.6 && y > height * 0.15);
if (visibles.length > 10) {
  const gauche = ajuster(visibles.map(([y, g]) => [y, g]));
  const droite = ajuster(visibles.map(([y, , d]) => [y, d]));
  let base = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mono[(y * width + x) * 4 + 3] > 128) base = Math.max(base, y);
  const finTrait = (y) => Math.min(width - 1, Math.round(droite(y)));
  for (let y = Math.round(height * 0.15); y <= base; y++)
    for (let x = Math.max(0, Math.round(gauche(y))); x <= finTrait(y); x++) {
      const i = (y * width + x) * 4;
      if (mono[i + 3] < 200) [mono[i], mono[i + 1], mono[i + 2], mono[i + 3]] = [...TERRA, 255];
    }
  finA = Math.max(finA, finTrait(base));
}

// Deux passes : sharp rogne (trim) avant d'extraire, dans une même chaîne.
const coupe = await sharp(mono, { raw: { width, height, channels: 4 } }).extract({ left: 0, top: 0, width: finA + 1, height }).png().toBuffer();
await sharp(coupe).trim({ threshold: 1 }).png().toFile("public/brand/capsela-monogramme.png");
console.log("marque dérivée : claire, monogramme");
