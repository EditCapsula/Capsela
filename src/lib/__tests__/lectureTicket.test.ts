import { describe, expect, it } from "vitest";
import { inviteTicket, nomAvecUneMajuscule, ticketLu } from "../../../supabase/functions/_shared/lectureTicket";
import { brouillonsDepuisTicket } from "../importTenue";

/** L'AJOUT DEPUIS UN TICKET DE CAISSE (30/10/2026) : ce qui est gardé de la lecture. */

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
        { nom: "T-shirt manches courtes blanc", categorie: "haut", taille: "M", couleur: "Blanc", modele: null, manches: null, motif: null, saisons: [] },
        { nom: "Jean droit", categorie: null, taille: "38", couleur: null, modele: null, manches: null, motif: null, saisons: [] },
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

describe("préremplissage enrichi (06/11/2026) : les champs du formulaire, leurs seules valeurs, rien d'inventé", () => {
  it("modèle, manches, motif et saisons gardés quand ils sont permis pour la catégorie", () => {
    const [a] = ticketLu({
      magasin: "Zara",
      articles: [{ nom: "BLOUSON CUIR CEINTURÉ", categorie: "veste", modele: "Perfecto", couleur: "Marron", manches: "longues", motif: "uni", saisons: ["Hiver", "Automne", "Noël"] }],
    }).articles;
    expect(a).toEqual({ nom: "Blouson cuir ceinturé", categorie: "veste", taille: null, couleur: "Marron", modele: "Perfecto", manches: "longues", motif: "uni", saisons: ["Automne", "Hiver"] });
  });
  it("une valeur d'une autre catégorie, ou sans catégorie sûre, est écartée", () => {
    const [jean, inconnu, bijou] = ticketLu({
      articles: [
        { nom: "Jean", categorie: "jean", modele: "Blazer", manches: "longues" },
        { nom: "Article", categorie: null, modele: "T-shirt", manches: "courtes", motif: "uni", saisons: ["Été"] },
        { nom: "Collier", categorie: "bijou", modele: "Collier", motif: "pois" },
      ],
    }).articles;
    expect([jean.modele, jean.manches]).toEqual([null, null]);
    expect([inconnu.modele, inconnu.manches, inconnu.motif, inconnu.saisons]).toEqual([null, null, null, []]);
    expect([bijou.modele, bijou.motif]).toEqual(["Collier", null]);
  });
  it("une seule majuscule, la première", () => {
    expect(nomAvecUneMajuscule("BLOUSON CUIR CEINTURÉ")).toBe("Blouson cuir ceinturé");
    expect(nomAvecUneMajuscule("Blouson Cuir Ceinturé")).toBe("Blouson cuir ceinturé");
    expect(nomAvecUneMajuscule("t-shirt MC")).toBe("T-shirt mc");
  });
  it("la consigne : les saisons d'après la nature du vêtement, jamais la date d'achat", () => {
    expect(inviteTicket()).toMatch(/JAMAIS d'après la date d'achat/);
    expect(inviteTicket()).toMatch(/veste : Blazer, Veste légère/);
  });
  it("les cartes reçoivent les valeurs lues ; sans elles, le champ reste à remplir", () => {
    const [b, c] = brouillonsDepuisTicket({
      magasin: "Zara",
      articles: [
        { nom: "Blouson cuir ceinturé", categorie: "veste", taille: null, couleur: null, modele: "Perfecto", manches: "longues", motif: "uni", saisons: ["Automne"] },
        { nom: "Pull", categorie: "pull", taille: "M", couleur: null },
      ],
    });
    expect([b.type, b.manches, b.motif, b.saisons]).toEqual(["Perfecto", "longues", "uni", ["Automne"]]);
    expect([c.type, c.manches, c.motif, c.saisons]).toEqual(["", null, null, []]);
  });
});
