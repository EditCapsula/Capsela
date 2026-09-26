import { describe, expect, it } from "vitest";
import { computeDefaultCapsule } from "../capsule";
import type { CatalogItem } from "../catalog";
import {
  alternativesDeRemplacement,
  introCapsule,
  margeVignette,
  piecesCles,
  piecesDuDressingPourSaison,
  raisonsSuggestion,
} from "../capsuleEcran";
import { EMPTY_PROFILE, type Profile } from "../profile";
import { CATS } from "../data";
import type { CategoryKey, Item, Season } from "../types";
import { at, item } from "./fixtures";

function piece(id: number, over: Partial<Item> = {}): Item {
  return { id, name: "Pièce " + id, cat: "haut", color: "Beige", hex: "#D8C8B0", season: "Toutes saisons", worn: null, ...over };
}
const profil = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, gender: "femme", ...over });

describe("piecesDuDressingPourSaison", () => {
  const avec = (season: Season, id: number) => piece(id, { season });
  const dressing = [avec("Printemps / Été", 1), avec("Automne / Hiver", 2), avec("Toutes saisons", 3)];

  it("une capsule d'hiver montre les pièces froides et celles de toutes saisons", () => {
    expect(piecesDuDressingPourSaison(dressing, "Hiver").map((i) => i.id)).toEqual([2, 3]);
  });

  it("le printemps suit le même découpage que le moteur (bucket Printemps / Été)", () => {
    expect(piecesDuDressingPourSaison(dressing, "Printemps").map((i) => i.id)).toEqual([1, 3]);
  });
});

describe("piecesCles", () => {
  it("une pièce par famille, l'indispensable avant la première venue", () => {
    const capsule = [
      piece(1, { cat: "veste" }),
      piece(2, { cat: "manteau", estBasiqueCapsule: true }),
      piece(3, { cat: "haut" }),
      piece(4, { cat: "chaussures" }),
      piece(5, { cat: "pantalon" }),
    ];
    expect(piecesCles(capsule).map((i) => i.id)).toEqual([2, 3, 4]);
  });

  it("une famille vide laisse sa place à la suivante, sans doublon", () => {
    const capsule = [piece(1, { cat: "haut" }), piece(2, { cat: "pull" }), piece(3, { cat: "jean" })];
    expect(piecesCles(capsule).map((i) => i.id)).toEqual([1, 3]);
  });

  it("capsule vide : aucune pièce clé", () => {
    expect(piecesCles([])).toEqual([]);
  });
});

describe("introCapsule — courte, et vraie de la capsule affichée", () => {
  it("rien de notable : le texte fixe, qui n'affirme rien", () => {
    expect(introCapsule([piece(1, { statement: false })])).toBe("Une base cohérente pour composer tes tenues.");
  });

  it("essentiels et pièces de caractère quand la capsule les contient", () => {
    const capsule = [piece(1, { estBasiqueCapsule: true, statement: false }), piece(2, { statement: true })];
    expect(introCapsule(capsule)).toBe("Des essentiels faciles à associer, et quelques pièces de caractère.");
  });

  it("sans pièce de caractère, elles ne sont pas annoncées", () => {
    expect(introCapsule([piece(1, { estBasiqueCapsule: true, statement: false })])).toBe("Des essentiels faciles à associer.");
  });
});

describe("raisonsSuggestion — aucune raison que le système n'a pas lue", () => {
  it("profil vide, pièce sans donnée particulière : seules ses occasions", () => {
    const r = raisonsSuggestion(piece(1, { occasion: ["quotidien"] }), profil());
    expect(r.map((x) => x.cle)).toEqual(["occasions"]);
  });

  it("la palette n'est citée que pour une teinte exactement choisie", () => {
    const p = piece(1, { hex: "#D8C8B0", occasion: ["quotidien"] });
    expect(raisonsSuggestion(p, profil({ paletteCouleurs: ["#d8c8b0"] })).map((x) => x.cle)).toContain("palette");
    // Affinité déclarée, pièce sans conflit : admise par paletteFit, mais ce
    // n'est pas « une couleur de ta palette ».
    expect(raisonsSuggestion(p, profil({ paletteAffinite: "Tons chauds" })).map((x) => x.cle)).not.toContain("palette");
  });

  it("le style n'est cité que si la pièce y correspond", () => {
    const p = piece(1, { styleTags: ["Minimaliste"], occasion: ["quotidien"] });
    expect(raisonsSuggestion(p, profil({ styles: ["minimaliste"] }))[0]).toEqual({ cle: "style", texte: "Dans ton style Minimaliste" });
    expect(raisonsSuggestion(p, profil({ styles: ["glamour"] })).map((x) => x.cle)).not.toContain("style");
  });

  it("la silhouette n'est jamais citée pour une morphologie qui n'oriente pas la sélection", () => {
    const p = piece(1, { cat: "jupe", name: "Jupe évasée", occasion: ["quotidien"] });
    expect(raisonsSuggestion(p, profil({ morphology: "f_rectangle" })).map((x) => x.cle)).not.toContain("silhouette");
  });

  it("indispensable et superposition viennent des colonnes du catalogue", () => {
    const p = piece(1, { estBasiqueCapsule: true, rolePiece: "calque", occasion: ["quotidien"] });
    expect(raisonsSuggestion(p, profil()).map((x) => x.cle)).toEqual(["indispensable", "occasions", "superposition"]);
  });
});

describe("alternativesDeRemplacement — les choix du moteur, pas un second moteur", () => {
  it("sans pièce de la même catégorie qui entre, aucune alternative", () => {
    const p = piece(1);
    expect(alternativesDeRemplacement(p, [p], [], () => [piece(9, { cat: "jean" })])).toEqual([]);
  });

  it("chaque alternative écarte la pièce remplacée et celles qu'on lui a préférées", () => {
    const p = piece(1);
    const suivantes = [piece(2), piece(3)];
    const calculer = (exclus: number[]) => [suivantes.find((s) => !exclus.includes(s.id))].filter((x): x is Item => Boolean(x));
    const alt = alternativesDeRemplacement(p, [p], [7], calculer);
    expect(alt.map((a) => a.piece.id)).toEqual([2, 3]);
    expect(alt[1].exclusions).toEqual([7, 1, 2]);
  });

  describe("sur le vrai moteur", () => {
    const CATEGORIES = ["hauts", "pulls_gilets", "pantalons", "jeans", "vestes_blazers", "manteaux_exterieurs", "chaussures", "sacs", "accessoires", "bijoux"];
    const OCCS = ["quotidien", "travail_formel", "date", "soiree", "entretien", "voyage", "festive"];
    const catalogue: CatalogItem[] = [];
    let id = 1;
    for (const category of CATEGORIES) {
      for (let k = 0; k < 14; k += 1) {
        catalogue.push(item({ id: id++, category, name: `${category} ${k}`, niveau_formalite: "business_casual", role_piece: "base", occasions: OCCS[k % OCCS.length] }));
      }
    }
    const meteo = at(8);
    const calculer = (exclus: number[]) => computeDefaultCapsule(profil(), meteo, exclus, "Hiver", catalogue);

    it("choisir une alternative donne une capsule qui la contient, sans la pièce remplacée", () => {
      const capsule = calculer([]);
      const cible = capsule.find((it) => it.cat === "haut")!;
      const alt = alternativesDeRemplacement(cible, capsule, [], calculer);
      expect(alt.length).toBeGreaterThan(0);
      for (const a of alt) {
        const apres = calculer(a.exclusions).map((it) => it.id);
        expect(apres).toContain(a.piece.id);
        expect(apres).not.toContain(cible.id);
        expect(a.piece.cat).toBe("haut");
      }
    });
  });
});

describe("margeVignette — poids visuel par famille (polish V2)", () => {
  it("une seule marge pour tous les vêtements", () => {
    const vetements: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
    expect(new Set(vetements.map(margeVignette)).size).toBe(1);
  });

  it("chaque catégorie de CATS a une famille", () => {
    for (const [cat] of CATS) expect(margeVignette(cat)).toBeGreaterThan(0);
  });

  it("un bijou garde plus de vide autour de lui qu'un accessoire, un sac, une chaussure ou un vêtement", () => {
    expect(margeVignette("bijou")).toBeGreaterThan(margeVignette("accessoire"));
    expect(margeVignette("accessoire")).toBeGreaterThan(margeVignette("chaussures"));
    expect(margeVignette("chaussures")).toBeGreaterThan(margeVignette("sac"));
    expect(margeVignette("sac")).toBeGreaterThan(margeVignette("manteau"));
  });

  it("la zone utile reste large : jamais moins de la moitié du cadre", () => {
    for (const [cat] of CATS) expect(1 - 2 * margeVignette(cat)).toBeGreaterThanOrEqual(0.5);
  });
});
