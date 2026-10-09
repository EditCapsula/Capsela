import { describe, expect, it } from "vitest";
import {
  OBJETS_MAX,
  SURFACE_MIN,
  assainerObjets,
  cheminObjet,
  cheminTenue,
  promptTenue,
  recadrerPixels,
  recouvrementUnion,
  rectangleDeRecadrage,
} from "../../../supabase/functions/_shared/analyseTenue.ts";
import { estPhotoDetouree, estPhotoMiseAPlat } from "../../../supabase/functions/_shared/detourage.ts";

// IMPORTER UNE TENUE (10/10/2026) — la partie pure de l'Edge Function importer-tenue.

const objet = (o: Record<string, unknown> = {}) => ({
  nom: "Robe longue fleurie",
  cat: "robe",
  sous_type: "Longue",
  matiere: "Coton",
  manches: "sans",
  color_hex: "#C9846A",
  boite: [0.08, 0.09, 0.4, 0.8],
  ...o,
});

describe("assainerObjets — ce que le modèle répond, vérifié", () => {
  it("un objet valide garde ses champs ; la couleur est ramenée à la palette de l'app", () => {
    const [o] = assainerObjets({ objets: [objet()] });
    expect(o).toMatchObject({ cat: "robe", sousType: "Longue", matiere: "Coton", manches: "sans", couleurLue: true });
    expect(o.couleur).toEqual({ nom: "Corail", hex: "#C9846A" });
    expect(o.boite).toEqual({ x: 0.08, y: 0.09, l: 0.4, h: 0.8 });
  });

  it("rien d'exploitable : liste vide, jamais d'exception", () => {
    for (const brut of [null, undefined, {}, { objets: "x" }, { objets: [null, 3, "a"] }, []]) expect(assainerObjets(brut)).toEqual([]);
  });

  it("une catégorie hors liste écarte l'objet ; une valeur hors liste est ignorée sans l'écarter", () => {
    const sortie = assainerObjets({
      objets: [
        objet({ cat: "tutu" }),
        objet({ cat: "haut", sous_type: "Smoking", matiere: "Kevlar", manches: "très longues", boite: [0.5, 0.1, 0.3, 0.3] }),
      ],
    });
    expect(sortie).toHaveLength(1);
    expect(sortie[0]).toMatchObject({ cat: "haut", sousType: undefined, matiere: undefined, manches: undefined });
  });

  it("les manches ne se lisent que pour une catégorie qui en a", () => {
    const [sac] = assainerObjets({ objets: [objet({ cat: "sac", sac_type: "Cabas", sous_type: null, manches: "longues" })] });
    expect(sac.manches).toBeUndefined();
    expect(sac.sacType).toBe("Cabas");
    const [manteau] = assainerObjets({ objets: [objet({ cat: "manteau", sous_type: "Doudoune", manches: "sans" })] });
    expect(manteau.manches).toBe("sans");
  });

  it("le type propre à une catégorie ne passe pas à une autre", () => {
    const [o] = assainerObjets({ objets: [objet({ cat: "chaussures", sous_type: "Longue", shoe_type: "Sandales", sac_type: "Cabas" })] });
    expect(o.shoeType).toBe("Sandales");
    expect(o.sacType).toBeUndefined();
    expect(o.sousType).toBeUndefined();
  });

  it("un bijou prend sa teinte dans la palette des métaux", () => {
    const [b] = assainerObjets({ objets: [objet({ cat: "bijou", bijou_type: "Bracelet", sous_type: null, manches: null, color_hex: "#C9A24B", boite: [0.7, 0.4, 0.1, 0.1] })] });
    expect(b.couleur.nom).toBe("Doré");
  });

  it("sans couleur lisible, la teinte est celle par défaut ET dite non lue", () => {
    const [o] = assainerObjets({ objets: [objet({ color_hex: "rouge" })] });
    expect(o.couleurLue).toBe(false);
  });

  it("une boîte invalide, trop petite ou à l'envers écarte l'objet ; une boîte qui déborde est rognée", () => {
    const sortie = assainerObjets({
      objets: [
        objet({ boite: [0, 0, 0, 0] }),
        objet({ boite: [0.1, 0.1, 0.01, 0.01] }),
        objet({ boite: "grande" }),
        objet({ boite: [0.1, 0.1, -0.3, 0.2] }),
        objet({ boite: [0.8, 0.7, 0.5, 0.5], cat: "sac", sac_type: "Cabas", sous_type: null }),
      ],
    });
    expect(sortie).toHaveLength(1);
    expect(sortie[0].boite.x + sortie[0].boite.l).toBeLessThanOrEqual(1 + 1e-9);
    expect(sortie[0].boite.y + sortie[0].boite.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(SURFACE_MIN).toBeGreaterThan(0);
  });

  it("le même objet lu deux fois n'est proposé qu'une fois", () => {
    const sortie = assainerObjets({ objets: [objet(), objet({ nom: "Robe fleurie", boite: [0.09, 0.1, 0.4, 0.78] })] });
    expect(sortie).toHaveLength(1);
  });

  it("au plus 8 objets, les plus grands, rendus dans l'ordre de lecture", () => {
    const objets = Array.from({ length: 12 }, (_, i) =>
      objet({ cat: "accessoire", accessoire_type: "Ceinture", sous_type: null, manches: null, boite: [(i % 4) * 0.25, Math.floor(i / 4) * 0.3, 0.1 + i * 0.005, 0.1 + i * 0.005] }),
    );
    const sortie = assainerObjets({ objets });
    expect(sortie).toHaveLength(OBJETS_MAX);
    // Les 4 plus petits (indices 0 à 3) ne sont pas gardés.
    expect(sortie.some((o) => o.boite.l < 0.12)).toBe(false);
    for (let i = 1; i < sortie.length; i++) {
      const a = sortie[i - 1].boite;
      const b = sortie[i].boite;
      expect(Math.abs(a.y - b.y) > 0.05 ? a.y <= b.y : a.x <= b.x).toBe(true);
    }
  });

  it("le nom est rogné à 60 caractères", () => {
    const [o] = assainerObjets({ objets: [objet({ nom: "x".repeat(200) })] });
    expect(o.nom).toHaveLength(60);
  });
});

describe("recouvrementUnion", () => {
  it("0 pour deux boîtes disjointes, 1 pour deux boîtes identiques", () => {
    const a = { x: 0, y: 0, l: 0.2, h: 0.2 };
    expect(recouvrementUnion(a, { x: 0.5, y: 0.5, l: 0.2, h: 0.2 })).toBe(0);
    expect(recouvrementUnion(a, a)).toBe(1);
  });
});

describe("recadrage d'un objet", () => {
  it("la boîte est élargie d'une marge et bornée à l'image", () => {
    const r = rectangleDeRecadrage(1000, 1000, { x: 0.1, y: 0.1, l: 0.3, h: 0.5 });
    expect(r.x).toBeLessThan(100);
    expect(r.y).toBeLessThan(100);
    expect(r.x + r.l).toBeGreaterThan(400);
    expect(r.y + r.h).toBeGreaterThan(600);
    const bord = rectangleDeRecadrage(1000, 1000, { x: 0, y: 0, l: 1, h: 1 });
    expect(bord).toEqual({ x: 0, y: 0, l: 1000, h: 1000 });
  });

  it("recadrerPixels copie exactement le rectangle demandé, transparence comprise", () => {
    // Image 4 × 3, chaque pixel (x, y) porte sa position dans R et G, et une transparence propre dans A.
    const L = 4;
    const H = 3;
    const data = new Uint8ClampedArray(L * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) data.set([x, y, 7, x === 2 ? 0 : 255], (y * L + x) * 4);
    const sortie = recadrerPixels(data, L, H, { x: 1, y: 1, l: 2, h: 2 });
    expect(sortie.width).toBe(2);
    expect(sortie.height).toBe(2);
    expect([...sortie.data]).toEqual([1, 1, 7, 255, 2, 1, 7, 0, 1, 2, 7, 255, 2, 2, 7, 0]);
  });
});

describe("noms des fichiers", () => {
  it("un objet est un fichier détouré ET mis à plat, dans le dossier de la personne ; la planche n'est la photo d'aucune pièce", () => {
    expect(cheminObjet("u1/abc.jpg", 2)).toBe("u1/abc.o2.detouree.plat.webp");
    expect(estPhotoDetouree(cheminObjet("u1/abc.jpg", 0))).toBe(true);
    expect(estPhotoMiseAPlat(cheminObjet("u1/abc.jpg", 0))).toBe(true);
    expect(cheminTenue("u1/abc.jpg")).toBe("u1/abc.tenue.webp");
    expect(estPhotoDetouree(cheminTenue("u1/abc.jpg"))).toBe(false);
  });
});

describe("le prompt de lecture", () => {
  it("donne les listes exactes de l'app et le format de la boîte", () => {
    const p = promptTenue();
    expect(p).toContain("Sandales");
    expect(p).toContain("trois_quarts");
    expect(p).toContain("boite");
    expect(p).toContain("Au plus 8");
  });
});
