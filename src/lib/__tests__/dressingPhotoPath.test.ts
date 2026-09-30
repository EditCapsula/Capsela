import { describe, it, expect } from "vitest";
import { dressingPhotoPath, urlPhotoCanonique } from "../dressing";

/**
 * Ce garde décide si un fichier peut être SUPPRIMÉ du stockage. Une erreur
 * ici ne se voit pas en développement et détruit des données en production :
 * les cas ci-dessous existent parce qu'ils sont réellement produits par
 * l'app, pas pour couvrir une ligne.
 */
const BASE = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public";
/** URL signée (bucket privé, 30/09/2026). */
const SIGNEE = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/sign";

describe("dressingPhotoPath", () => {
  it("reconnaît une photo personnelle et rend son chemin dans le bucket", () => {
    expect(dressingPhotoPath(`${BASE}/dressing-photos/abc-123/9f8e.jpg`)).toBe("abc-123/9f8e.jpg");
  });

  it("REFUSE une image de catalogue — elle est partagée par toutes les utilisatrices", () => {
    // startEditItem retombe sur img.url quand la pièce n'a pas de photo
    // propre ; cette URL peut finir persistée dans photo_url. La supprimer
    // casserait le visuel produit pour tout le monde.
    expect(dressingPhotoPath(`${BASE}/catalog-images/robe-midi-soie.png`)).toBeNull();
  });

  it("refuse ce qui n'est pas une URL de stockage", () => {
    expect(dressingPhotoPath("blob:https://capsela.vercel.app/9f8e-4c2a")).toBeNull();
    expect(dressingPhotoPath("https://exemple.test/dressing-photos/abc/9f8e.jpg")).toBeNull();
  });

  it("rend null sur une valeur absente plutôt que de deviner", () => {
    expect(dressingPhotoPath(undefined)).toBeNull();
    expect(dressingPhotoPath(null)).toBeNull();
    expect(dressingPhotoPath("")).toBeNull();
  });

  it("écarte la chaîne de requête et décode le chemin", () => {
    expect(dressingPhotoPath(`${BASE}/dressing-photos/abc-123/9f8e.jpg?t=1757000000`)).toBe("abc-123/9f8e.jpg");
    expect(dressingPhotoPath(`${BASE}/dressing-photos/abc-123/robe%20verte.jpg`)).toBe("abc-123/robe verte.jpg");
  });
});

describe("photos du dressing en bucket privé (30/09/2026)", () => {
  it("une URL signée désigne le même fichier que l'URL publique", () => {
    expect(dressingPhotoPath(`${SIGNEE}/dressing-photos/abc-123/9f8e.jpg?token=eyJhbGci.x.y`)).toBe("abc-123/9f8e.jpg");
    expect(dressingPhotoPath(`${SIGNEE}/catalog-images/robe.png?token=t`)).toBeNull();
  });

  it("la base ne reçoit jamais le jeton : l'URL signée redevient la forme publique", () => {
    expect(urlPhotoCanonique(`${SIGNEE}/dressing-photos/abc-123/9f8e.jpg?token=eyJhbGci.x.y`)).toBe(`${BASE}/dressing-photos/abc-123/9f8e.jpg`);
    expect(urlPhotoCanonique(`${BASE}/dressing-photos/abc-123/9f8e.jpg`)).toBe(`${BASE}/dressing-photos/abc-123/9f8e.jpg`);
  });

  it("toute autre URL est rendue telle quelle", () => {
    expect(urlPhotoCanonique(`${BASE}/catalog-images/robe-midi-soie.png`)).toBe(`${BASE}/catalog-images/robe-midi-soie.png`);
    expect(urlPhotoCanonique("blob:https://capsela.vercel.app/9f8e-4c2a")).toBe("blob:https://capsela.vercel.app/9f8e-4c2a");
    expect(urlPhotoCanonique(undefined)).toBeUndefined();
  });
});
