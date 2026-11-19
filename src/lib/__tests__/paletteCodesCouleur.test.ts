import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, paletteHexes, paletteColorName } from "@/lib/profile";
import { PAL_COULEURS } from "@/lib/palCouleurs";
import { PALETTE } from "@/lib/data";
import { candidatsCouleur } from "@/lib/colorimetrieMoteur";
import type { Item } from "@/lib/types";

// LA MÊME COULEUR SOUS SES DEUX CODES (19/11/2026) : la palette du profil et la couleur d'une pièce ne portent pas toujours le même hex
// pour un même nom ; la préférence (comparaison d'hex exacts) doit reconnaître la couleur choisie quel que soit son code.
const hexPalette = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)![1];
const hexPiece = (nom: string) => PALETTE.find(([n]) => n === nom)![1];
const profil = (noms: string[]) => ({ ...EMPTY_PROFILE, paletteCouleurs: noms.map(hexPalette) });
const haut = (id: number, color: string, hex: string): Item => ({ id, name: `Chemise ${color}`, cat: "haut", color, hex, season: "Toutes saisons", worn: 0 }) as Item;

describe("paletteHexes : une couleur choisie se reconnaît sur une pièce", () => {
  it("le Chocolat de la palette reconnaît le Chocolat d'une pièce, dont le code diffère", () => {
    expect(hexPalette("Chocolat")).not.toBe(hexPiece("Chocolat"));
    expect(paletteHexes(profil(["Chocolat"]))).toEqual([hexPalette("Chocolat"), hexPiece("Chocolat")]);
  });

  it("une couleur au même code des deux côtés n'est pas dupliquée", () => {
    expect(hexPalette("Noir")).toBe(hexPiece("Noir"));
    expect(paletteHexes(profil(["Noir"]))).toEqual([hexPalette("Noir")]);
  });

  it("aucune couleur non choisie n'est ajoutée, et l'affichage des noms ne change pas", () => {
    const hexes = paletteHexes(profil(["Chocolat", "Kaki"]));
    expect(hexes.map(paletteColorName).filter(Boolean)).toEqual(["Chocolat", "Kaki"]);
    expect(hexes).not.toContain(hexPiece("Prune"));
  });

  it("chaque couleur de la palette qui a un nom de pièce est désormais reconnue sur la pièce de ce nom", () => {
    const nomsPieces = new Set(PALETTE.map(([n]) => n));
    for (const [nom] of PAL_COULEURS.filter(([n]) => nomsPieces.has(n))) {
      expect(paletteHexes(profil([nom]))).toContain(hexPiece(nom));
    }
  });

  it("avant / après dans la même exécution : une préférée Chocolat ne laisse plus passer la chemise prune", () => {
    const hauts = [haut(1, "Prune", hexPiece("Prune")), haut(2, "Chocolat", hexPiece("Chocolat"))];
    const p = profil(["Chocolat"]);
    // Avant : les seuls hex de la palette — aucune pièce reconnue, les deux restent (la préférence ne joue pas).
    expect(candidatsCouleur(hauts, p.paletteCouleurs, null).map((i) => i.id)).toEqual([1, 2]);
    // Après : la chemise chocolat est reconnue, la préférence (molle) la retient.
    expect(candidatsCouleur(hauts, paletteHexes(p), null).map((i) => i.id)).toEqual([2]);
  });
});
