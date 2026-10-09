import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { FlatLayCapsela } from "../src/components/FlatLayCapsela";
import { clePieces } from "../src/lib/outfitFeedback";
import type { CategoryKey, Item } from "../src/lib/types";

// PLANCHE DE DEBUG DU FLAT LAY DE L'ACCUEIL — OUTIL DE DÉVELOPPEMENT, PAS UN ÉCRAN DE L'APP.
//
// Rend les six compositions de référence avec le VRAI composant (FlatLayCapsela, contexte « hero-home ») et les VRAIES images du
// catalogue (bucket catalog-images, lues en ligne), sur une carte terracotta de la largeur de l'accueil à 390 px et à 360 px. Rien
// n'est copié dans l'app : le résultat est une page HTML autonome, à ouvrir dans un navigateur.
//
//   PLANCHE_IMG_DIR=/chemin/vers/images   (facultatif : des copies locales, sous <catégorie>/<fichier>.webp, à la place du réseau)
//   PLANCHE_OUT=/tmp/planche-flat-lay.html
//   PLANCHE_ZOOM=1   (agrandit les cartes pour les regarder de près)
//   npx vitest run --config vitest.audit.config.mts scripts/planche-flat-lay.audit.ts
//
// Les visuels sont des images du catalogue (les pièces du dressing générées en prennent une). Les photos privées d'une utilisatrice ne
// sont pas lisibles ici : une pièce dont le visuel est une photo brute s'y comporte comme `photoBrute` (cf. flatLay.ts), non rendue.

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tkrbzrazejrxavtfspll.supabase.co") + "/storage/v1/object/public/catalog-images/";
const IMG: Record<string, string> = {
  haut: "femme/hauts/29",
  haut2: "femme/hauts/30",
  pantalon: "femme/pantalons/40",
  pantalon2: "femme/pantalons/75",
  jean: "femme/jeans/39",
  veste: "femme/vestes-blazers/32",
  pull: "femme/pulls-gilets/582-1789485773491",
  manteau: "femme/manteaux-exterieurs/584-1789485824634",
  robe: "femme/robes/1",
  chaussures: "femme/chaussures/586-1789485856746",
  chaussures2: "femme/chaussures/47",
  sac: "femme/sacs/51",
  accessoire: "femme/accessoires/17",
};
let n = 0;
const piece = (cle: keyof typeof IMG, cat: CategoryKey): Item =>
  ({ id: ++n, name: cle, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: null, imageUrl: BASE + IMG[cle] + ".webp", imageStatus: "ready" }) as Item;

const CONFIGS: [string, Item[]][] = [
  ["1 · Haut + pantalon + sac + chaussures", [piece("haut", "haut"), piece("pantalon", "pantalon"), piece("sac", "sac"), piece("chaussures", "chaussures")]],
  ["2 · Chemise + pantalon + blazer + sac + chaussures", [piece("haut2", "haut"), piece("pantalon2", "pantalon"), piece("veste", "veste"), piece("sac", "sac"), piece("chaussures2", "chaussures")]],
  ["3 · Pull + pantalon + manteau + chaussures", [piece("pull", "pull"), piece("pantalon", "pantalon"), piece("manteau", "manteau"), piece("chaussures", "chaussures")]],
  ["4 · Robe + sac + chaussures + accessoire", [piece("robe", "robe"), piece("sac", "sac"), piece("chaussures2", "chaussures"), piece("accessoire", "accessoire")]],
  ["5 · Trois pièces (haut, jean, chaussures)", [piece("haut", "haut"), piece("jean", "jean"), piece("chaussures", "chaussures")]],
  ["6 · Six pièces (pull, haut, pantalon, veste, sac, chaussures)", [piece("pull", "pull"), piece("haut2", "haut"), piece("pantalon", "pantalon"), piece("veste", "veste"), piece("sac", "sac"), piece("chaussures", "chaussures")]],
];

describe("planche de debug du flat lay de l'accueil", () => {
  it("écrit la planche HTML", () => {
    const dir = process.env.PLANCHE_IMG_DIR;
    const carte = (largeurZone: number, items: Item[]) => {
      const graine = clePieces(items.map((i) => i.id)).join(",");
      const zone = renderToStaticMarkup(createElement(FlatLayCapsela, { items, context: "hero-home", layoutSeed: graine }));
      // Rendu serveur : les images sont des <img src=URL>. En local, on les pointe vers les copies.
      const html = dir ? zone.split(BASE).join("file://" + dir + "/") : zone;
      return `<div class="carte" style="width:${largeurZone === 181 ? 358 : 328}px"><div class="texte">TON LOOK DU JOUR<br><small>texte de la carte</small></div><div class="zone" style="width:${largeurZone}px;height:${Math.round((largeurZone * 112) / 100)}px">${html}</div></div>`;
    };
    const corps = CONFIGS.map(
      ([titre, items]) => `<section><h2>${titre}</h2><div class="rang"><div><div class="legende">390 px · zone 181 px</div>${carte(181, items)}</div><div><div class="legende">360 px · zone 164 px</div>${carte(164, items)}</div></div></section>`,
    ).join("");
    writeFileSync(
      process.env.PLANCHE_OUT ?? "/tmp/planche-flat-lay.html",
      `<!doctype html><meta charset="utf-8"><title>Planche de debug — flat lay de l'accueil</title><style>body{margin:0;padding:16px;background:#f3eee5;font:12px sans-serif;color:#1d1a16}h1{font:600 14px sans-serif}.bandeau{background:#fff3cd;border:1px solid #e0c36a;padding:8px 12px;margin-bottom:16px}section{margin-bottom:20px}h2{font:600 13px sans-serif;margin:0 0 8px}.rang{display:flex;gap:16px;flex-wrap:wrap}.legende{margin-bottom:4px;color:#7b7366}.carte{background:#9e5b43;border-radius:28px;color:#fbf3ea;display:flex;justify-content:space-between;align-items:center;padding:14px 12px 14px 20px;box-sizing:border-box}.texte{font:500 11px sans-serif;letter-spacing:.16em}.zone{position:relative;flex:none}.absolute{position:absolute}.inset-0{inset:0}.w-full{width:100%}.h-full{height:100%}.flex{display:flex}.items-center{align-items:center}.justify-center{justify-content:center}img{display:block}.carte{zoom:${process.env.PLANCHE_ZOOM ?? 1}}</style><h1>Planche de debug — flat lay de l'accueil (hero-home)</h1><div class="bandeau"><b>Outil de développement.</b> Ce n'est pas le rendu de l'app : c'est le vrai composant FlatLayCapsela sur de vraies images du catalogue, dans une carte qui imite celle de l'accueil.</div>${corps}`,
    );
  });
});
