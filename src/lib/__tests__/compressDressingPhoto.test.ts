import { describe, expect, it, afterEach, vi } from "vitest";
import { compressDressingPhoto, PHOTO_COTE_MAX } from "../dressing";

/**
 * Ce qui est vérifié ici, c'est l'ORCHESTRATION : l'échelle calculée, le fond
 * posé avant le dessin, le garde-fou de taille, le nom et le type du fichier
 * rendu, et surtout les quatre chemins de repli. L'encodage JPEG lui-même est
 * celui du navigateur — il n'est pas simulable en Node et n'est donc pas
 * couvert : c'est le passage sur appareil réel qui le valide.
 *
 * Les replis comptent plus que la compression. Une photo lourde n'empêche
 * personne d'ajouter une pièce ; une exception, si.
 */

type CanvasFactice = {
  width: number;
  height: number;
  remplissages: { couleur: string; l: number; h: number }[];
  ordre: string[];
  getContext: (t: string) => unknown;
  toBlob: (cb: (b: Blob | null) => void, type?: string, q?: number) => void;
};

const original = {
  createImageBitmap: (globalThis as Record<string, unknown>).createImageBitmap,
  document: (globalThis as Record<string, unknown>).document,
};

afterEach(() => {
  (globalThis as Record<string, unknown>).createImageBitmap = original.createImageBitmap;
  (globalThis as Record<string, unknown>).document = original.document;
  vi.restoreAllMocks();
});

/** Installe un navigateur factice et rend le canvas créé, pour inspection. */
function installerNavigateur(dims: { width: number; height: number }, tailleBlob: number) {
  const canvas: CanvasFactice = {
    width: 0,
    height: 0,
    remplissages: [],
    ordre: [],
    getContext: () => ({
      set fillStyle(c: string) {
        (canvas as unknown as { _couleur: string })._couleur = c;
      },
      fillRect(_x: number, _y: number, l: number, h: number) {
        canvas.ordre.push("fillRect");
        canvas.remplissages.push({ couleur: (canvas as unknown as { _couleur: string })._couleur, l, h });
      },
      drawImage() {
        canvas.ordre.push("drawImage");
      },
    }),
    toBlob: (cb, type) => cb(new Blob([new Uint8Array(tailleBlob)], { type: type ?? "image/jpeg" })),
  };
  (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(async () => ({
    ...dims,
    close: vi.fn(),
  }));
  (globalThis as Record<string, unknown>).document = { createElement: () => canvas };
  return canvas;
}

const photo = (octets: number, type = "image/jpeg", nom = "IMG_4821.HEIC") =>
  new File([new Uint8Array(octets)], nom, { type });

describe("compressDressingPhoto", () => {
  it("ramène le côté le plus long à la borne, en gardant les proportions", async () => {
    const canvas = installerNavigateur({ width: 4032, height: 3024 }, 300_000);
    await compressDressingPhoto(photo(8_400_000));
    expect(canvas.width).toBe(PHOTO_COTE_MAX);
    expect(canvas.height).toBe(Math.round(3024 * (PHOTO_COTE_MAX / 4032)));
  });

  it("n'agrandit jamais une photo déjà petite", async () => {
    const canvas = installerNavigateur({ width: 600, height: 400 }, 10_000);
    await compressDressingPhoto(photo(50_000));
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(400);
  });

  it("pose un fond blanc AVANT de dessiner — sinon un PNG détouré ressort sur du noir", async () => {
    const canvas = installerNavigateur({ width: 800, height: 800 }, 20_000);
    await compressDressingPhoto(photo(400_000, "image/png"));
    expect(canvas.ordre).toEqual(["fillRect", "drawImage"]);
    expect(canvas.remplissages[0].couleur).toBe("#ffffff");
  });

  it("rend un JPEG nommé .jpg, quelle que soit l'extension d'origine", async () => {
    installerNavigateur({ width: 2000, height: 2000 }, 200_000);
    const sortie = await compressDressingPhoto(photo(5_000_000, "image/heic", "IMG_4821.HEIC"));
    expect(sortie.type).toBe("image/jpeg");
    expect(sortie.name).toBe("IMG_4821.jpg");
    expect(sortie.size).toBe(200_000);
  });

  it("garde l'original si le ré-encodage l'alourdit", async () => {
    installerNavigateur({ width: 300, height: 300 }, 90_000);
    const entree = photo(40_000);
    expect(await compressDressingPhoto(entree)).toBe(entree);
  });

  it("rend l'original sans navigateur — l'ajout d'une pièce ne doit jamais échouer ici", async () => {
    (globalThis as Record<string, unknown>).createImageBitmap = undefined;
    const entree = photo(8_400_000);
    expect(await compressDressingPhoto(entree)).toBe(entree);
  });

  it("rend l'original si le décodage lève", async () => {
    installerNavigateur({ width: 2000, height: 2000 }, 100_000);
    (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(async () => {
      throw new Error("format non décodable");
    });
    const entree = photo(3_000_000);
    expect(await compressDressingPhoto(entree)).toBe(entree);
  });

  it("ne touche pas à ce qui n'est pas une image", async () => {
    installerNavigateur({ width: 100, height: 100 }, 10);
    const entree = photo(1_000, "application/pdf", "facture.pdf");
    expect(await compressDressingPhoto(entree)).toBe(entree);
  });
});
