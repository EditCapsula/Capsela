import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_COTE_MAX, PHOTO_QUALITE } from "../dressing";
import { preparerPhotoAvis, TAILLE_SOURCE_MAX } from "../photoAvis";

/*
 * Comme compressDressingPhoto.test.ts : l'encodage JPEG est celui du
 * navigateur, non simulable en Node. Ce qui est vérifié ici, c'est
 * l'orchestration — et surtout qu'AUCUN chemin ne rend le fichier d'origine,
 * qui porterait encore ses métadonnées EXIF.
 */

const original = {
  createImageBitmap: (globalThis as Record<string, unknown>).createImageBitmap,
  document: (globalThis as Record<string, unknown>).document,
};

afterEach(() => {
  (globalThis as Record<string, unknown>).createImageBitmap = original.createImageBitmap;
  (globalThis as Record<string, unknown>).document = original.document;
  vi.restoreAllMocks();
});

function installerNavigateur(dims: { width: number; height: number }, tailleBlob: number | null) {
  const canvas = {
    width: 0,
    height: 0,
    ordre: [] as string[],
    appelToBlob: null as null | { type?: string; q?: number },
    getContext: () => ({
      set fillStyle(_c: string) {},
      fillRect() {
        canvas.ordre.push("fillRect");
      },
      drawImage() {
        canvas.ordre.push("drawImage");
      },
    }),
    toBlob: (cb: (b: Blob | null) => void, type?: string, q?: number) => {
      canvas.appelToBlob = { type, q };
      cb(tailleBlob == null ? null : new Blob([new Uint8Array(tailleBlob)], { type: type ?? "image/jpeg" }));
    },
  };
  const bitmap = vi.fn(async () => ({ ...dims, close: vi.fn() }));
  (globalThis as Record<string, unknown>).createImageBitmap = bitmap;
  (globalThis as Record<string, unknown>).document = { createElement: () => canvas };
  return { canvas, bitmap };
}

const photo = (taille: number, type = "image/jpeg", nom = "IMG_2026-09-25_Paris.jpg") =>
  new File([new Uint8Array(taille)], nom, { type });

describe("preparerPhotoAvis", () => {
  it("réduit au côté max du dressing, en JPEG qualité du dressing, fond blanc avant le dessin", async () => {
    const { canvas, bitmap } = installerNavigateur({ width: 4000, height: 3000 }, 900);
    const r = await preparerPhotoAvis(photo(5_000_000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([r.largeur, r.hauteur]).toEqual([PHOTO_COTE_MAX, 900]);
    expect(canvas.appelToBlob).toEqual({ type: "image/jpeg", q: PHOTO_QUALITE });
    expect(canvas.ordre).toEqual(["fillRect", "drawImage"]);
    expect(bitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(r.fichier.type).toBe("image/jpeg");
  });

  it("le nom d'origine (date, lieu) n'est pas transmis", async () => {
    installerNavigateur({ width: 800, height: 600 }, 500);
    const r = await preparerPhotoAvis(photo(1000));
    expect(r.ok && r.fichier.name).toBe("tenue.jpg");
  });

  it("jamais le fichier d'origine, même si le JPEG est plus lourd", async () => {
    installerNavigateur({ width: 300, height: 300 }, 5000);
    const source = photo(1000);
    const r = await preparerPhotoAvis(source);
    expect(r.ok && r.fichier).not.toBe(source);
    expect(r.ok && r.fichier.size).toBe(5000);
  });

  it("une image non déclarée comme telle (HEIC sans type) est tentée, pas refusée d'office", async () => {
    installerNavigateur({ width: 1000, height: 1500 }, 800);
    expect((await preparerPhotoAvis(photo(2000, "", "IMG.HEIC"))).ok).toBe(true);
  });

  it("au-delà de 15 Mo : refusée avant tout décodage", async () => {
    const { bitmap } = installerNavigateur({ width: 100, height: 100 }, 10);
    expect(await preparerPhotoAvis(photo(TAILLE_SOURCE_MAX + 1))).toEqual({ ok: false, raison: "trop_lourde" });
    expect(bitmap).not.toHaveBeenCalled();
  });

  it("illisible par le navigateur : refusée, jamais transmise brute", async () => {
    installerNavigateur({ width: 100, height: 100 }, 10);
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(async () => {
      throw new Error("format non pris en charge");
    });
    expect(await preparerPhotoAvis(photo(1000, "image/heic"))).toEqual({ ok: false, raison: "illisible" });
  });

  it("encodage impossible (toBlob rend null) : refusée", async () => {
    installerNavigateur({ width: 100, height: 100 }, null);
    expect(await preparerPhotoAvis(photo(1000))).toEqual({ ok: false, raison: "illisible" });
  });

  it("navigateur sans createImageBitmap : refusée plutôt qu'envoyée telle quelle", async () => {
    (globalThis as Record<string, unknown>).createImageBitmap = undefined;
    expect(await preparerPhotoAvis(photo(1000))).toEqual({ ok: false, raison: "illisible" });
  });
});
