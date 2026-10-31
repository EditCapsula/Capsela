import { describe, expect, it } from "vitest";
import {
  aCreer,
  brouillonsDepuisTicket,
  brouillonsDepuis,
  changerCategorie,
  depasseLesPlaces,
  limiterAuxPlaces,
  manquesDe,
  messageIncomplet,
  peutCocher,
  phraseManque,
  pieceDepuis,
  type ObjetRepere,
} from "../importTenue";
import { seasonDepuisSaisons } from "../saisons";

const objet = (o: Partial<ObjetRepere> & { cat: ObjetRepere["cat"] }): ObjetRepere => ({
  nom: "Pièce",
  couleur: { nom: "Beige", hex: "#D8C8B0" },
  couleurLue: true,
  photo_url: "https://x/a.oN.detouree.plat.webp",
  ...o,
});

describe("brouillonsDepuis", () => {
  it("tout est coché, aucune saison n'est présélectionnée", () => {
    const b = brouillonsDepuis([objet({ cat: "robe", manches: "courtes" }), objet({ cat: "sac" })]);
    expect(b.every((x) => x.coche)).toBe(true);
    expect(b.every((x) => x.saisons.length === 0)).toBe(true);
    expect(b[0].manches).toBe("courtes");
  });

  it("un modèle hors liste est ignoré ; les manches d'un sac aussi", () => {
    const [b] = brouillonsDepuis([objet({ cat: "sac", sacType: "Inconnu", manches: "longues" })]);
    expect(b.type).toBe("");
    expect(b.manches).toBeNull();
  });

  it("changer de catégorie efface le modèle et les manches qui n'ont plus lieu d'être", () => {
    const [b] = brouillonsDepuis([objet({ cat: "robe", manches: "longues" })]);
    expect(changerCategorie(b, "sac").manches).toBeNull();
    expect(changerCategorie(b, "veste").manches).toBe("longues");
  });
});

describe("complétude", () => {
  const [robe] = brouillonsDepuis([objet({ cat: "robe", nom: "Robe lin", manches: "courtes" })]);

  it("sans saison, la pièce n'est pas créée et le message nomme la pièce", () => {
    expect(manquesDe(robe)).toEqual(["saisons"]);
    expect(phraseManque(manquesDe(robe))).toBe("Précise les saisons");
    expect(aCreer([robe])).toEqual([]);
    expect(messageIncomplet([robe])).toBe("Précise les saisons de Robe lin pour l'ajouter.");
  });

  it("avec une saison, elle est créée ; décochée, elle ne l'est pas et ne bloque rien", () => {
    const prete = { ...robe, saisons: ["Été" as const] };
    expect(aCreer([prete])).toHaveLength(1);
    expect(messageIncomplet([prete])).toBeNull();
    expect(aCreer([{ ...prete, coche: false }])).toEqual([]);
    expect(messageIncomplet([{ ...robe, coche: false }])).toBeNull();
  });

  it("manches requises pour un haut, modèle requis pour des chaussures", () => {
    const [haut, chaussures] = brouillonsDepuis([objet({ cat: "haut" }), objet({ cat: "chaussures" })]);
    expect(manquesDe(haut)).toEqual(["manches", "saisons"]);
    expect(manquesDe(chaussures)).toEqual(["modele", "saisons"]);
    expect(messageIncomplet([haut])).toContain("les détails");
  });
});

describe("dressing gratuit", () => {
  const six = brouillonsDepuis(Array.from({ length: 6 }, () => objet({ cat: "sac" })));

  it("ne coche pas plus de cases que de places", () => {
    expect(limiterAuxPlaces(six, 4).filter((b) => b.coche)).toHaveLength(4);
    expect(limiterAuxPlaces(six, null).filter((b) => b.coche)).toHaveLength(6);
  });

  it("on ne coche plus au-delà des places", () => {
    const quatre = limiterAuxPlaces(six, 4);
    expect(peutCocher(quatre, 4)).toBe(false);
    expect(peutCocher(quatre, 5)).toBe(true);
    expect(peutCocher(quatre, null)).toBe(true);
  });

  it("l'avis de dépassement ne vaut que sous limite", () => {
    expect(depasseLesPlaces(6, 4)).toBe(true);
    expect(depasseLesPlaces(4, 4)).toBe(false);
    expect(depasseLesPlaces(6, null)).toBe(false);
  });
});

describe("pieceDepuis", () => {
  it("produit la pièce du dressing : saisons, valeur à trois choix, type rangé dans le bon champ", () => {
    const [b] = brouillonsDepuis([objet({ cat: "chaussures", shoeType: "Sandales", nom: "Sandales" })]);
    const p = pieceDepuis({ ...b, saisons: ["Été", "Printemps"] });
    expect(p.shoeType).toBe("Sandales");
    expect(p.saisons).toEqual(["Été", "Printemps"]);
    expect(p.season).toBe(seasonDepuisSaisons(["Été", "Printemps"]));
    expect(p.photoUrl).toBe(b.photoUrl);
    expect(p.worn).toBeNull();
    expect(p.occasion).toBeUndefined();
  });

  it("un nom vide devient « Nouvelle pièce »", () => {
    const [b] = brouillonsDepuis([objet({ cat: "sac", nom: "  " })]);
    expect(pieceDepuis({ ...b, saisons: ["Été"] }).name).toBe("Nouvelle pièce");
  });
});

describe("saisons lues sur la photo (12/10/2026)", () => {
  it("elles préremplissent le brouillon (modifiables), dans l'ordre de l'année", () => {
    const [b] = brouillonsDepuis([objet({ cat: "manteau", saisons: ["Hiver", "Automne", "Mousson"] } as never)]);
    expect(b.saisons).toEqual(["Automne", "Hiver"]);
  });
  it("sans saison lue, le brouillon n'en invente pas", () => {
    const [b] = brouillonsDepuis([objet({ cat: "manteau" })]);
    expect(b.saisons).toEqual([]);
  });
});

describe("les articles d'un ticket de caisse (30/10/2026)", () => {
  const t = {
    magasin: "Sézane",
    articles: [
      { nom: "Robe midi", categorie: "robe", taille: "s", couleur: { nom: "Camel", hex: "#C08A5E" } },
      { nom: "Article mode", categorie: null, taille: null, couleur: null },
    ],
  };
  const [robe, inconnu] = brouillonsDepuisTicket(t);

  it("une carte par article, le magasin en marque, sans photo ni saison devinée", () => {
    expect(robe).toMatchObject({ nom: "Robe midi", cat: "robe", marque: "Sézane", photoUrl: "", saisons: [], taille: "S", couleurLue: true });
    expect(robe.categorieAConfirmer).toBe(false);
  });
  it("une catégorie que le ticket ne dit pas reste à confirmer, et bloque l'ajout", () => {
    expect(inconnu.categorieAConfirmer).toBe(true);
    expect(inconnu.couleurLue).toBe(false);
    expect(manquesDe(inconnu)[0]).toBe("categorie");
    expect(manquesDe(changerCategorie(inconnu, "haut"))).not.toContain("categorie");
  });
  it("la pièce créée garde la marque et la taille, et n'a pas de photo", () => {
    const p = pieceDepuis({ ...robe, saisons: ["Été"] });
    expect(p.brand).toBe("Sézane");
    expect(p.size).toBe("S");
    expect(p.photoUrl).toBeUndefined();
  });
});
