// Icônes et écrans de démarrage des applications iOS et Android (17/10/2026, plan « Publication sur les stores »).
//
// Une seule source : le monogramme « CA » du logo (le C encre, le A terracotta), posé sur le crème de l'app (--color-cream, #F3EEE5).
// Rien n'est dessiné ici : le script ne fait que redimensionner et centrer. Remplace le cintre-cœur du 17/10/2026.
// Relancer après un changement de logo : `node scripts/generer-icones-mobiles.mjs`.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const CREME = "#F3EEE5";

// Le monogramme « CA » du logo (18/10/2026, nouveau logo) : public/brand/capsela-monogramme.png, dérivé par scripts/generer-marque.mjs.
const MONOGRAMME = "public/brand/capsela-monogramme.png";

/** Le monogramme rendu à `largeur` px de large (proportions gardées), fond transparent. */
const logo = (largeur) => sharp(MONOGRAMME).resize({ width: Math.round(largeur), kernel: "lanczos3" }).png().toBuffer();

/** Un carré ou un rectangle crème (ou transparent), le logo centré à `part` de son plus petit côté. */
async function planche(largeur, hauteur, part, { fond = CREME, rond = false } = {}) {
  const l = await logo(Math.min(largeur, hauteur) * part);
  const { width: lw, height: lh } = await sharp(l).metadata();
  let image = sharp({ create: { width: largeur, height: hauteur, channels: 4, background: fond ?? { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: l, left: Math.round((largeur - lw) / 2), top: Math.round((hauteur - lh) / 2) },
  ]);
  if (rond) {
    const masque = Buffer.from(`<svg width="${largeur}" height="${hauteur}"><circle cx="${largeur / 2}" cy="${hauteur / 2}" r="${largeur / 2}" fill="#fff"/></svg>`);
    image = sharp(await image.png().toBuffer()).composite([{ input: masque, blend: "dest-in" }]);
  }
  return image.png();
}

const ecrire = async (chemin, image, { opaque = false } = {}) => {
  const tampon = await (opaque ? image.flatten({ background: CREME }).removeAlpha() : image).toBuffer();
  writeFileSync(chemin, tampon);
  console.log("écrit", chemin);
};

// iOS — une icône 1024 × 1024, SANS transparence (exigé par l'App Store).
await ecrire("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", await planche(1024, 1024, 0.62), { opaque: true });
// iOS — écran de démarrage (les trois variantes du projet, mêmes images).
for (const s of ["", "-1", "-2"]) await ecrire(`ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${s}.png`, await planche(2732, 2732, 0.2), { opaque: true });

// Android — icônes classiques et rondes, puis le premier plan de l'icône adaptative (108 dp : le logo tient dans la zone sûre de 66 dp).
const DENSITES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const res = "android/app/src/main/res";
for (const [d, f] of Object.entries(DENSITES)) {
  await ecrire(`${res}/mipmap-${d}/ic_launcher.png`, await planche(48 * f, 48 * f, 0.66));
  await ecrire(`${res}/mipmap-${d}/ic_launcher_round.png`, await planche(48 * f, 48 * f, 0.6, { rond: true }));
  await ecrire(`${res}/mipmap-${d}/ic_launcher_foreground.png`, await planche(108 * f, 108 * f, 0.44, { fond: null }));
}
// Android — écrans de démarrage, portrait et paysage.
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [d, [l, h]] of Object.entries(SPLASH)) {
  await ecrire(`${res}/drawable-port-${d}/splash.png`, await planche(l, h, 0.3), { opaque: true });
  await ecrire(`${res}/drawable-land-${d}/splash.png`, await planche(h, l, 0.3), { opaque: true });
}
await ecrire(`${res}/drawable/splash.png`, await planche(480, 320, 0.3), { opaque: true });
// Le fond de l'icône adaptative : le crème.
writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${CREME}</color>\n</resources>\n`);
console.log("écrit", `${res}/values/ic_launcher_background.xml`);
// Le favicon du site est généré à part, depuis le « c. » : `node scripts/generer-favicon.mjs` (19/10/2026).
