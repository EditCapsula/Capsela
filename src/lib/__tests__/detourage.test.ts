import { describe, expect, it } from "vitest";
import { fondPhotoPiece, resolveItemImage } from "../catalogImages";
import { MARQUE_PHOTO_DETOUREE, estPhotoDetouree, estPhotoMiseAPlat } from "../dressing";
import type { Item } from "../types";
import {
  MARQUE_DETOUREE,
  TAILLE_RESULTAT_MAX_OCTETS,
  TAILLE_SOURCE_MAX_OCTETS,
  cheminDansLeBucket,
  cheminDetoure,
  cheminMisAPlat,
  estPhotoMiseAPlat as estMiseAPlatServeur,
  mettreAPlatAvecFournisseur,
  POINT_D_ENTREE_PHOTOROOM_EDIT,
  detourerAvecFournisseur,
  estPhotoDetouree as estPhotoDetoureeServeur,
  typeImage,
} from "../../../supabase/functions/_shared/detourage.ts";
import { dimensionsProportionnelles, MAX_IMAGE_DIMENSION } from "../../../supabase/functions/_shared/dimensions.ts";
import { urlPhotoAutorisee } from "../../../supabase/functions/_shared/protection.ts";

// Le détourage des photos du dressing (04/10/2026).

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const reponse = (octets: Uint8Array | null, statut = 200) => new Response(octets as BodyInit | null, { status: statut });
const fauxFetch = (r: Response | Error) => (async () => { if (r instanceof Error) throw r; return r; }) as unknown as typeof fetch;

describe("nommage et reconnaissance d'un fichier détouré", () => {
  it("le fichier détouré garde le dossier de la personne et porte la marque", () => {
    expect(cheminDetoure("u1/abc.jpg")).toBe("u1/abc.detouree.webp");
    expect(cheminDetoure("u1/abc.jpg", "png")).toBe("u1/abc.detouree.png");
    expect(cheminDetoure("u1/abc")).toBe("u1/abc.detouree.webp");
    expect(cheminDetoure("u1/abc.jpg")).toContain(MARQUE_DETOUREE);
  });

  it("estPhotoDetouree : le chemin seul compte, jamais la chaîne de requête", () => {
    expect(estPhotoDetouree("https://x.supabase.co/storage/v1/object/sign/dressing-photos/u1/abc.detouree.webp?token=t")).toBe(true);
    expect(estPhotoDetouree("https://x.supabase.co/storage/v1/object/sign/dressing-photos/u1/abc.jpg?token=a.detouree.b")).toBe(false);
    expect(estPhotoDetouree("u1/abc.jpg")).toBe(false);
    expect(estPhotoDetouree(undefined)).toBe(false);
    expect(estPhotoDetouree("")).toBe(false);
  });

  it("la marque côté app et côté serveur est la même, et le serveur la reconnaît comme l'app", () => {
    expect(MARQUE_PHOTO_DETOUREE).toBe(MARQUE_DETOUREE);
    for (const u of ["u1/a.detouree.webp", "u1/a.jpg", "https://h/u1/a.detouree.png?x=1"]) expect(estPhotoDetouree(u)).toBe(estPhotoDetoureeServeur(u));
  });

  it("cheminDansLeBucket lit l'URL signée ou publique, et refuse le reste", () => {
    const base = "https://x.supabase.co/storage/v1/object";
    expect(cheminDansLeBucket(`${base}/sign/dressing-photos/u1/abc.jpg?token=t`)).toBe("u1/abc.jpg");
    expect(cheminDansLeBucket(`${base}/public/dressing-photos/u1/a%20b.jpg`)).toBe("u1/a b.jpg");
    expect(cheminDansLeBucket(`${base}/sign/autre-bucket/u1/abc.jpg`)).toBeNull();
    // Un « .. » est normalisé par URL avant tout : le chemin lu est celui du dossier visé, que l'autorisation refuse à u1.
    const detourne = `${base}/sign/dressing-photos/u1/../u2/abc.jpg?token=t`;
    expect(cheminDansLeBucket(detourne)).toBe("u2/abc.jpg");
    expect(urlPhotoAutorisee(detourne, "https://x.supabase.co", "u1")).toBe(false);
    expect(urlPhotoAutorisee(`${base}/sign/dressing-photos/u1/%2e%2e/u2/abc.jpg?token=t`, "https://x.supabase.co", "u1")).toBe(false);
    expect(cheminDansLeBucket("pas une url")).toBeNull();
  });

  it("le fichier détouré reste sous le dossier de la personne : l'autorisation existante le couvre", () => {
    const projet = "https://x.supabase.co";
    const chemin = cheminDetoure("u1/abc.jpg");
    expect(urlPhotoAutorisee(`${projet}/storage/v1/object/sign/dressing-photos/${chemin}?token=t`, projet, "u1")).toBe(true);
    expect(urlPhotoAutorisee(`${projet}/storage/v1/object/sign/dressing-photos/${chemin}?token=t`, projet, "u2")).toBe(false);
  });
});

describe("typeImage lit les premiers octets, pas l'en-tête", () => {
  it("reconnaît JPEG, PNG et WebP, et rien d'autre", () => {
    expect(typeImage(JPEG)).toBe("jpeg");
    expect(typeImage(PNG)).toBe("png");
    expect(typeImage(WEBP)).toBe("webp");
    expect(typeImage(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(typeImage(new Uint8Array([]))).toBeNull();
    expect(typeImage(new TextEncoder().encode("<html>Not an image</html>"))).toBeNull();
  });
});

describe("detourerAvecFournisseur", () => {
  it("rend l'image détourée, et envoie la clé dans l'en-tête — jamais dans l'URL", async () => {
    let appel: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => { appel = { url, init }; return reponse(PNG); }) as unknown as typeof fetch;
    const r = await detourerAvecFournisseur(f, "CLE-SECRETE", JPEG);
    expect(r).toMatchObject({ ok: true, type: "png" });
    expect(appel!.url).not.toContain("CLE-SECRETE");
    expect((appel!.init.headers as Record<string, string>)["x-api-key"]).toBe("CLE-SECRETE");
    expect(appel!.init.method).toBe("POST");
    expect(appel!.init.body).toBeInstanceOf(FormData);
    expect((appel!.init.body as FormData).get("image_file")).toBeTruthy();
  });

  it("accepte un WebP à fond transparent en retour", async () => {
    expect(await detourerAvecFournisseur(fauxFetch(reponse(WEBP)), "k", PNG)).toMatchObject({ ok: true, type: "webp" });
  });

  it("une source qui n'est pas une image, vide, ou trop lourde n'est jamais envoyée", async () => {
    let appels = 0;
    const f = (async () => { appels++; return reponse(PNG); }) as unknown as typeof fetch;
    expect(await detourerAvecFournisseur(f, "k", new TextEncoder().encode("<html>"))).toEqual({ ok: false, code: "photo_invalide" });
    expect(await detourerAvecFournisseur(f, "k", new Uint8Array([]))).toEqual({ ok: false, code: "photo_invalide" });
    const trop = new Uint8Array(TAILLE_SOURCE_MAX_OCTETS + 1);
    trop.set(JPEG);
    expect(await detourerAvecFournisseur(f, "k", trop)).toEqual({ ok: false, code: "photo_invalide" });
    expect(appels).toBe(0);
  });

  it("traduit chaque refus du fournisseur en un code, sans exception", async () => {
    const code = async (r: Response | Error) => (await detourerAvecFournisseur(fauxFetch(r), "k", JPEG));
    expect(await code(reponse(null, 401))).toEqual({ ok: false, code: "non_configure" });
    expect(await code(reponse(null, 403))).toEqual({ ok: false, code: "non_configure" });
    expect(await code(reponse(null, 402))).toEqual({ ok: false, code: "credits_epuises" });
    expect(await code(reponse(null, 400))).toEqual({ ok: false, code: "photo_refusee" });
    expect(await code(reponse(null, 422))).toEqual({ ok: false, code: "photo_refusee" });
    expect(await code(reponse(null, 429))).toEqual({ ok: false, code: "fournisseur_indisponible" });
    expect(await code(reponse(null, 500))).toEqual({ ok: false, code: "fournisseur_indisponible" });
    expect(await code(new Error("réseau coupé"))).toEqual({ ok: false, code: "fournisseur_indisponible" });
  });

  it("refuse un résultat qui n'est pas une image à transparence : JPEG, texte, vide, démesuré", async () => {
    const code = async (octets: Uint8Array) => (await detourerAvecFournisseur(fauxFetch(reponse(octets)), "k", JPEG));
    expect(await code(JPEG)).toEqual({ ok: false, code: "resultat_invalide" });
    expect(await code(new TextEncoder().encode("{\"error\":1}"))).toEqual({ ok: false, code: "resultat_invalide" });
    expect(await code(new Uint8Array([]))).toEqual({ ok: false, code: "resultat_invalide" });
    const enorme = new Uint8Array(TAILLE_RESULTAT_MAX_OCTETS + 1);
    enorme.set(PNG);
    expect(await code(enorme)).toEqual({ ok: false, code: "resultat_invalide" });
  });
});

describe("le redimensionnement garde les proportions", () => {
  it("une photo en portrait ou en paysage n'est plus écrasée dans un carré", () => {
    expect(dimensionsProportionnelles(900, 1200)).toEqual({ width: 600, height: 800 });
    expect(dimensionsProportionnelles(1200, 900)).toEqual({ width: 800, height: 600 });
    expect(dimensionsProportionnelles(960, 1200)).toEqual({ width: 640, height: 800 });
  });

  it("une image carrée donne le même résultat qu'avant : le catalogue ne change pas", () => {
    expect(dimensionsProportionnelles(1024, 1024)).toEqual({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION });
  });

  it("le rapport largeur / hauteur est conservé à l'arrondi près, et jamais une dimension nulle", () => {
    for (const [l, h] of [[1200, 1600], [1080, 1920], [3000, 2000], [5000, 20], [20, 5000]] as const) {
      const d = dimensionsProportionnelles(l, h);
      expect(Math.max(d.width, d.height)).toBe(MAX_IMAGE_DIMENSION);
      expect(d.width).toBeGreaterThanOrEqual(1);
      expect(d.height).toBeGreaterThanOrEqual(1);
      if (d.width > 20 && d.height > 20) expect(Math.abs(d.width / d.height - l / h)).toBeLessThan(0.01);
    }
  });
});

describe("l'affichage d'une pièce détourée", () => {
  const item = (photoUrl?: string) => ({ id: 1, name: "x", cat: "haut", color: "Blanc", hex: "#fff", photoUrl }) as unknown as Item;

  it("une photo détourée se classe à part ; une photo réelle reste une photo", () => {
    expect(resolveItemImage(item("https://h/storage/v1/object/public/dressing-photos/u1/a.detouree.webp")).kind).toBe("detouree");
    expect(resolveItemImage(item("https://h/storage/v1/object/public/dressing-photos/u1/a.jpg")).kind).toBe("photo");
    expect(resolveItemImage(item(undefined)).kind).toBe("placeholder");
  });

  it("une photo détourée se montre entière (contain) sur la tuile ; une photo réelle remplit la case (cover)", () => {
    expect(fondPhotoPiece("u.webp", true)).toMatchObject({ backgroundSize: "contain", background: "var(--color-photo-bg)" });
    expect(fondPhotoPiece("u.jpg", false)).toMatchObject({ backgroundSize: "cover" });
  });
});

describe("la mise à plat d'une pièce portée (10/10/2026)", () => {
  it("le fichier mis à plat reste un fichier détouré, et se reconnaît à sa marque", () => {
    expect(cheminMisAPlat("u1/abc.jpg")).toBe("u1/abc.detouree.plat.webp");
    expect(cheminMisAPlat("u1/abc.jpg", "png")).toBe("u1/abc.detouree.plat.png");
    // Une photo déjà détourée mise à plat ensuite (bouton « Mettre la photo à plat ») : la marque ne se double pas.
    expect(cheminMisAPlat("u1/abc.detouree.webp")).toBe("u1/abc.detouree.plat.webp");
    expect(estPhotoDetouree("https://x/u1/abc.detouree.plat.webp?token=1")).toBe(true);
    expect(estPhotoMiseAPlat("https://x/u1/abc.detouree.plat.webp?token=1")).toBe(true);
    expect(estMiseAPlatServeur("u1/abc.detouree.plat.webp")).toBe(true);
    expect(estPhotoMiseAPlat("https://x/u1/abc.detouree.webp")).toBe(false);
    expect(estPhotoMiseAPlat(null)).toBe(false);
  });

  it("l'appel Flat Lay : bon point d'entrée, clé dans l'en-tête, champ imageFile et flatLay.mode", async () => {
    let vu: { url: string; init: RequestInit } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      vu = { url, init };
      return reponse(PNG);
    }) as unknown as typeof fetch;
    const r = await mettreAPlatAvecFournisseur(fetchFn, "CLE", JPEG);
    expect(r).toMatchObject({ ok: true, type: "png" });
    expect(vu!.url).toBe(POINT_D_ENTREE_PHOTOROOM_EDIT);
    expect((vu!.init.headers as Record<string, string>)["x-api-key"]).toBe("CLE");
    expect(vu!.url).not.toContain("CLE");
    const f = vu!.init.body as FormData;
    expect(f.get("flatLay.mode")).toBe("ai.auto");
    expect(f.get("imageFile")).toBeInstanceOf(Blob);
  });

  it("les échecs sont des codes, jamais des exceptions", async () => {
    const code = async (r: Response | Error) => ((await mettreAPlatAvecFournisseur(fauxFetch(r), "CLE", JPEG)) as { code?: string }).code;
    expect(await code(reponse(null, 403))).toBe("non_configure");
    expect(await code(reponse(null, 402))).toBe("credits_epuises");
    expect(await code(reponse(null, 422))).toBe("photo_refusee");
    expect(await code(reponse(null, 500))).toBe("fournisseur_indisponible");
    expect(await code(new Error("réseau"))).toBe("fournisseur_indisponible");
    expect(await code(reponse(new Uint8Array([1, 2, 3])))).toBe("resultat_invalide");
    expect(((await mettreAPlatAvecFournisseur(fauxFetch(reponse(PNG)), "CLE", new Uint8Array([1, 2, 3]))) as { code?: string }).code).toBe("photo_invalide");
  });

  it("un résultat JPEG est accepté (il sera détouré ensuite)", async () => {
    expect(await mettreAPlatAvecFournisseur(fauxFetch(reponse(JPEG)), "CLE", JPEG)).toMatchObject({ ok: true, type: "jpeg" });
  });
});
