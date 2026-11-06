import { describe, expect, it } from "vitest";
import { articleValide, cheminVisuel, cleVisuel, ligneVestiaire } from "../../../supabase/functions/_shared/visuelArticle";
import { buildImagePrompt } from "../../../supabase/functions/_shared/imagePrompt";

/** LE VISUEL INDICATIF D'UN ARTICLE DE TICKET (06/11/2026) : ce qui est accepté, et ce que le moteur de visuels en tire. */
describe("visuel d'un article de ticket", () => {
  it("une demande valable est gardée ; une couleur ou un genre inconnus sont écartés", () => {
    expect(articleValide({ nom: "  Pull  col V ", categorie: "pull", couleur: "Marine", genre: "femme" })).toEqual({
      nom: "Pull col V",
      categorie: "pull",
      couleur: "Marine",
      genre: "femme",
    });
    expect(articleValide({ nom: "Pull", categorie: "pull", couleur: "Fuchsia fluo", genre: "autre" })).toEqual({
      nom: "Pull",
      categorie: "pull",
      couleur: null,
      genre: null,
    });
  });

  it("refuse un nom vide ou trop long, une catégorie inconnue", () => {
    expect(articleValide({ nom: "", categorie: "pull" })).toBeNull();
    expect(articleValide({ nom: "x".repeat(61), categorie: "pull" })).toBeNull();
    expect(articleValide({ nom: "Pull", categorie: "chaussette" })).toBeNull();
    expect(articleValide(null)).toBeNull();
  });

  it("la même description donne la même clé, à la casse et aux accents près", () => {
    const a = articleValide({ nom: "Chemise à rayures", categorie: "haut", couleur: "Blanc", genre: "homme" })!;
    const b = articleValide({ nom: "CHEMISE A RAYURES", categorie: "haut", couleur: "Blanc", genre: "homme" })!;
    expect(cleVisuel(a)).toBe(cleVisuel(b));
    expect(cleVisuel(a)).not.toBe(cleVisuel({ ...a, couleur: "Noir" }));
  });

  it("le moteur des visuels du catalogue décrit le vêtement nommé, dans sa couleur", () => {
    const { prompt, ok } = buildImagePrompt(ligneVestiaire(articleValide({ nom: "Pull col V", categorie: "pull", couleur: "Marine", genre: "femme" })!));
    expect(ok).toBe(true);
    expect(prompt.toLowerCase()).toMatch(/sweater|jumper|pullover/);
    expect(prompt.toLowerCase()).toContain("navy");
    expect(prompt).toContain("women's");
  });

  it("le fichier est rangé dans le dossier de l'utilisatrice, marqué comme détouré", () => {
    expect(cheminVisuel("u1", "abc")).toBe("u1/visuel-abc.detouree.webp");
    expect(cheminVisuel("u1", "abc", "png")).toBe("u1/visuel-abc.detouree.png");
  });
});
