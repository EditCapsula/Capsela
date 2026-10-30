import { describe, expect, it } from "vitest";
import { champsDeLArticle } from "../lectureTicket";
import { inviteTicket, ticketLu } from "../../../supabase/functions/_shared/lectureTicket";

/** L'AJOUT DEPUIS UN TICKET DE CAISSE (30/10/2026) : ce qui est gardé de la lecture, et la fiche qu'elle préremplit. */

describe("ticketLu — seuls le magasin et les articles vestimentaires reviennent", () => {
  it("garde nom, catégorie, taille et couleur ; écarte les valeurs hors listes", () => {
    const t = ticketLu({
      magasin: "Zara",
      articles: [
        { nom: "T-shirt manches courtes blanc", categorie: "haut", taille: "M", couleur: "Blanc", prix: "12,99" },
        { nom: "Jean droit", categorie: "pantalons", taille: "38", couleur: "bleu électrique" },
      ],
    });
    expect(t).toEqual({
      magasin: "Zara",
      articles: [
        { nom: "T-shirt manches courtes blanc", categorie: "haut", taille: "M", couleur: "Blanc" },
        { nom: "Jean droit", categorie: null, taille: "38", couleur: null },
      ],
    });
  });
  it("jamais un numéro : un champ qui en contient un long est écarté", () => {
    const t = ticketLu({ magasin: "Carte 4970 1234 5678 9012", articles: [{ nom: "Réf 123456789", categorie: "haut" }, { nom: "Pull", categorie: "pull" }] });
    expect(t.magasin).toBeNull();
    expect(t.articles.map((a) => a.nom)).toEqual(["Pull"]);
  });
  it("un article en double ne compte qu'une fois ; une réponse inutilisable donne un ticket vide", () => {
    expect(ticketLu({ articles: [{ nom: "Pull" , taille: "S" }, { nom: "pull", taille: "S" }] }).articles).toHaveLength(1);
    expect(ticketLu(null)).toEqual({ magasin: null, articles: [] });
    expect(ticketLu({ articles: "non" })).toEqual({ magasin: null, articles: [] });
  });
  it("la consigne exclut les prix et les numéros de carte", () => {
    expect(inviteTicket()).toMatch(/JAMAIS un numéro de carte/);
    expect(inviteTicket()).toMatch(/prix/);
  });
});

describe("champsDeLArticle — la fiche préremplie", () => {
  it("le magasin dans « Marque », et ce que le ticket dit", () => {
    expect(champsDeLArticle({ nom: "Robe midi", categorie: "robe", taille: "s", couleur: "Camel" }, "Sézane")).toEqual({
      addName: "Robe midi",
      addBrand: "Sézane",
      addCat: "robe",
      addSize: "S",
      addColor: { name: "Camel", hex: "#C08A5E" },
    });
  });
  it("ce que le ticket ne dit pas reste à remplir", () => {
    expect(champsDeLArticle({ nom: "Article", categorie: null, taille: null, couleur: null }, null)).toEqual({ addName: "Article", addBrand: "", addSize: null });
  });
});
