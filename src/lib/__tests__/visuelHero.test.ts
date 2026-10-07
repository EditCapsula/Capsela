import { describe, expect, it } from "vitest";
import { buildHeroImagePrompt } from "../../../supabase/functions/_shared/heroPrompt";
import { boiteOpaque, nomFichierHero, rognerSurLaPiece } from "../../../supabase/functions/_shared/heroImage";
import { buildImagePrompt, type VestiaireRow } from "../../../supabase/functions/_shared/imagePrompt";
import { ratioHero } from "../catalogMarges";
import { resolveHeroImage, resolveItemImage } from "../catalogImages";
import type { Item } from "../types";

const ligne = (surcharge: Partial<VestiaireRow>): VestiaireRow => ({
  id: 1, name: "x", category: "vestes_blazers", sous_type: "Blazer", couleur_dominante: "marron", matiere: "laine", genre: "femme", coupe: null, ...surcharge,
});

describe("buildHeroImagePrompt — un flat lay posé, jamais porté", () => {
  it("garde le sujet du visuel standard et change la présentation", () => {
    const standard = buildImagePrompt(ligne({}));
    const hero = buildHeroImagePrompt(ligne({}));
    expect(hero.ok).toBe(true);
    expect(hero.noun).toBe(standard.noun);
    expect(hero.prompt).toContain("blazer");
    expect(hero.prompt).toContain("Editorial flat lay");
    expect(hero.prompt).toContain("directly above");
    expect(hero.prompt).not.toContain("Front view");
    expect(hero.prompt).not.toContain("Perfectly centered");
  });

  it("n'autorise ni personne, ni mannequin (même fantôme), ni partie du corps", () => {
    for (const c of ["hauts", "pantalons", "vestes_blazers", "chaussures", "robes"]) {
      const p = buildHeroImagePrompt(ligne({ category: c, sous_type: c === "chaussures" ? "Baskets" : null })).prompt;
      expect(p).toMatch(/no person, no model, no mannequin, no ghost mannequin/);
      expect(p).toMatch(/no legs, no feet/);
    }
  });

  it("demande un fond transparent même pour une pièce claire (le hero est terracotta)", () => {
    const p = buildHeroImagePrompt(ligne({ category: "hauts", sous_type: "T-shirt", couleur_dominante: "blanc" })).prompt;
    expect(p).toContain("Transparent background, whatever the color of the product.");
    expect(p).not.toContain("soft contrasting light grey");
  });

  it("lumière homogène, ombre très légère, pièce entière, orientation et cadrage constants, proportions réalistes", () => {
    for (const c of ["hauts", "pantalons", "vestes_blazers", "chaussures", "sacs"]) {
      const p = buildHeroImagePrompt(ligne({ category: c, sous_type: c === "chaussures" ? "Baskets" : c === "sacs" ? "Cabas" : null })).prompt;
      expect(p).toContain("Soft, even, homogeneous light");
      expect(p).toContain("A very light, natural soft shadow");
      expect(p).toContain("The whole item is fully visible");
      expect(p).toContain("Realistic proportions");
      expect(p).toContain("Same camera, same top-down angle and same distance");
      expect(p).toContain("High resolution");
      expect(p).toMatch(/at the top of the image|Toes pointing|Upright/);
    }
    expect(buildHeroImagePrompt(ligne({})).prompt).not.toContain("No cast shadow");
  });

  it("une pose par catégorie (pantalon en diagonale, veste à la manche repliée)", () => {
    expect(buildHeroImagePrompt(ligne({ category: "pantalons", sous_type: "Pantalon" })).prompt).toContain("slight diagonal");
    expect(buildHeroImagePrompt(ligne({})).prompt).toContain("sleeve folded across the body");
  });

  it("conserve les exclusions de la catégorie (une veste n'est pas une chemise)", () => {
    expect(buildHeroImagePrompt(ligne({})).prompt).toContain("No shirt.");
  });
});

describe("rognerSurLaPiece — le format est dans le nom du fichier", () => {
  const image = (w: number, h: number, boite: [number, number, number, number]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = boite[1]; y <= boite[3]; y++) for (let x = boite[0]; x <= boite[2]; x++) data[(y * w + x) * 4 + 3] = 255;
    return { data, width: w, height: h };
  };

  it("trouve la boîte des pixels opaques", () => {
    expect(boiteOpaque(image(100, 100, [20, 10, 59, 89]))).toEqual({ x0: 20, y0: 10, x1: 59, y1: 89 });
    expect(boiteOpaque(image(10, 10, [5, 5, 4, 4]))).toBeNull();
  });

  it("rogne avec 2 % de marge et rend le format réel", () => {
    const r = rognerSurLaPiece(image(100, 100, [20, 10, 59, 89]))!;
    expect(r.width).toBeLessThan(100);
    expect(r.width / r.height).toBeGreaterThan(0.45);
    expect(r.width / r.height).toBeLessThan(0.55);
  });

  it("une image vide n'est pas rognée", () => {
    expect(rognerSurLaPiece(image(10, 10, [5, 5, 4, 4]))).toBeNull();
  });

  it("le nom écrit par le serveur est relu par l'app", () => {
    const nom = nomFichierHero(448, 0.8312, 1790000000000);
    expect(nom).toBe("448-1790000000000-r0.83.webp");
    expect(ratioHero("https://x.test/storage/v1/object/public/catalog-images/hero/femme/hauts/" + nom)).toBe(0.83);
    expect(ratioHero("https://x.test/catalog-images/femme/hauts/29.webp")).toBeNull();
    expect(ratioHero(undefined)).toBeNull();
  });
});

describe("resolveHeroImage — le visuel standard reste le repli", () => {
  const piece = (extra: Partial<Item>): Item => ({ id: 1, name: "x", cat: "veste", color: "x", hex: "#999", season: "toutes" as never, worn: null, ...extra }) as Item;

  it("le visuel hero passe devant le standard d'une pièce du catalogue", () => {
    const it = piece({ imageUrl: "https://x/std.webp", imageStatus: "ready", imageHeroUrl: "https://x/hero-r0.80.webp" });
    expect(resolveHeroImage(it).url).toBe("https://x/hero-r0.80.webp");
    expect(resolveItemImage(it).url).toBe("https://x/std.webp");
  });

  it("sans visuel hero, ou avec une photo de la personne ou un produit affilié : comme avant", () => {
    expect(resolveHeroImage(piece({ imageUrl: "https://x/std.webp", imageStatus: "ready" })).url).toBe("https://x/std.webp");
    const photo = piece({ photoUrl: "https://x/ma-photo.png", imageHeroUrl: "https://x/hero-r0.80.webp" });
    expect(resolveHeroImage(photo).url).toBe("https://x/ma-photo.png");
    const affilie = piece({ affiliateImageUrl: "https://x/aff.png", imageHeroUrl: "https://x/hero-r0.80.webp" });
    expect(resolveHeroImage(affilie).url).toBe("https://x/aff.png");
  });

  it("un visuel standard non prêt n'est jamais remplacé par le hero seul", () => {
    expect(resolveHeroImage(piece({ imageUrl: "https://x/std.webp", imageStatus: "missing", imageHeroUrl: "https://x/hero-r0.80.webp" })).kind).toBe("placeholder");
  });
});
