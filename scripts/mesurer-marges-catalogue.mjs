// Mesure les marges transparentes de chaque visuel du catalogue et réécrit src/lib/catalogMarges.ts.
// Usage : node scripts/mesurer-marges-catalogue.mjs chemins.txt   (un chemin du bucket `catalog-images` par ligne, sans extension)
// Les chemins viennent de `select url_image from vestiaire_universel` (la partie après /catalog-images/, sans .webp).
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images/";
const chemins = [...new Set(readFileSync(process.argv[2], "utf8").split("\n").map((l) => l.trim()).filter(Boolean))];
const table = {};
for (const p of chemins) {
  const buf = Buffer.from(await (await fetch(`${BASE}${p}.webp`)).arrayBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (w !== h) continue; // images carrées seulement
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) continue;
  const s = 0.01;
  table[p] = [x0 / w - s, y0 / h - s, 1 - (x1 + 1) / w - s, 1 - (y1 + 1) / h - s].map((v) => Math.round(Math.max(0, v) * 1000));
}
const src = readFileSync("src/lib/catalogMarges.ts", "utf8");
const lignes = Object.entries(table).map(([k, v]) => `  "${k}": [${v.join(",")}]`).join(",\n");
writeFileSync("src/lib/catalogMarges.ts", src.replace(/(const MARGES[^\n]*\n)[\s\S]*?\n\};/, `$1${lignes}\n};`));
console.log(Object.keys(table).length, "images mesurées");
