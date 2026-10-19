// Favicon du site (19/10/2026, monogramme « c. » fourni par la propriétaire, remplace le cintre-cœur).
//
// Source : public/brand/capsela-c.png (« c. » terracotta sur fond transparent, tel que fourni). Ce script en dérive :
//   · src/app/icon.png — 512 px, fond transparent (Next l'annonce dans <head>) ;
//   · src/app/apple-icon.png — 180 px sur le crème de l'app : iOS remplit la transparence en noir ;
//   · src/app/favicon.ico — 16, 32 et 48 px, pour les navigateurs qui ne lisent que /favicon.ico.
// Rien n'est redessiné : le « c. » est rogné, centré dans un carré, et réduit.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SOURCE = "public/brand/capsela-c.png";
const CREME = { r: 243, g: 238, b: 229, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Rognage d'abord (passe séparée : sharp applique trim après les autres opérations d'une même chaîne).
const rogne = await sharp(SOURCE).trim().png().toBuffer();
const { width, height } = await sharp(rogne).metadata();

/** Le « c. » centré dans un carré de `taille` px, `marge` (part du côté) de chaque côté. */
const carre = (taille, marge, fond) => {
  const utile = Math.round(taille * (1 - 2 * marge));
  const l = Math.round(width >= height ? utile : (utile * width) / height);
  const h = Math.round(width >= height ? (utile * height) / width : utile);
  return sharp(rogne)
    .resize(l, h)
    .extend({
      top: Math.floor((taille - h) / 2),
      bottom: Math.ceil((taille - h) / 2),
      left: Math.floor((taille - l) / 2),
      right: Math.ceil((taille - l) / 2),
      background: fond,
    })
    .flatten(fond.alpha === 1 ? { background: fond } : false)
    .png()
    .toBuffer();
};

await writeFile("src/app/icon.png", await carre(512, 0.06, TRANSPARENT));
await writeFile("src/app/apple-icon.png", await carre(180, 0.18, CREME));

// ICO : un en-tête, un répertoire, puis les PNG tels quels (format admis depuis Windows Vista, lu par tous les navigateurs).
const tailles = [16, 32, 48];
const pngs = await Promise.all(tailles.map((t) => carre(t, 0.04, TRANSPARENT)));
const entete = Buffer.alloc(6 + 16 * tailles.length);
entete.writeUInt16LE(0, 0);
entete.writeUInt16LE(1, 2);
entete.writeUInt16LE(tailles.length, 4);
let decalage = entete.length;
tailles.forEach((t, k) => {
  const o = 6 + 16 * k;
  entete.writeUInt8(t, o);
  entete.writeUInt8(t, o + 1);
  entete.writeUInt16LE(1, o + 4);
  entete.writeUInt16LE(32, o + 6);
  entete.writeUInt32LE(pngs[k].length, o + 8);
  entete.writeUInt32LE(decalage, o + 12);
  decalage += pngs[k].length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([entete, ...pngs]));
console.log("icon.png, apple-icon.png, favicon.ico générés");
