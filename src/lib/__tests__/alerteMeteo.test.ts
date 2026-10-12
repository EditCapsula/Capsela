import { describe, expect, it } from "vitest";
import { contexteCapsule } from "../capsule";
import { ECART_FORT, evaluerAlerteMeteo, libelleChangement, proposerAdaptation } from "../alerteMeteo";
import type { CategoryKey, Item } from "../types";

// ALERTE MÉTÉO D'UN LOOK PLANIFIÉ ET SON ADAPTATION (12/10/2026).

const piece = (id: number, cat: CategoryKey, name: string, extra: Partial<Item> = {}): Item => ({ id, name, cat, color: "Noir", hex: "#1D1A16", season: "Toutes saisons", worn: null, ...extra });

// Le look de l'exemple : t-shirt blanc, blazer camel, jupe rose poudré, ballerines noires.
const tshirt = piece(1, "haut", "T-shirt blanc", { meteoMinTemp: 14 });
const blazer = piece(2, "veste", "Blazer camel", { meteoMinTemp: 10 });
const jupe = piece(3, "jupe", "Jupe rose poudré", { meteoMinTemp: 14 });
const ballerines = piece(4, "chaussures", "Ballerines noires", { shoeType: "Ballerines", meteoMinTemp: 12 });
const look = [tshirt, blazer, jupe, ballerines];

describe("evaluerAlerteMeteo — niveaux et sources", () => {
  it("tenue adaptée : aucune alerte", () => {
    expect(evaluerAlerteMeteo(look, { temp: 20, label: "Nuageux" })).toBeNull();
  });
  it("légèrement frais : alerte discrète, avec la ville et le moment", () => {
    const a = evaluerAlerteMeteo(look, { temp: 13, label: "Nuageux" }, { ville: "Berlin", moment: "Soirée" });
    expect(a).toMatchObject({ niveau: "legere", cause: "froid", titre: "Un peu plus frais que prévu", cta: "Adapter mon look" });
    expect(a?.message).toBe("13 °C prévus à Berlin : prévois une couche chaude pour profiter de ta soirée.");
    // Le t-shirt est sous un blazer dont la borne est respectée : il n'est pas jugé ; seule la jupe est hors borne.
    expect(a?.pieceIds).toEqual([3]);
  });
  it("très frais ou plusieurs pièces hors borne : avertissement explicite", () => {
    const a = evaluerAlerteMeteo(look, { temp: 8, label: "Nuageux" }, { ville: "Berlin" });
    expect(a).toMatchObject({ niveau: "forte", titre: "Ton look mérite un ajustement", cta: "Trouver une alternative" });
    expect(a?.message).toContain("8 °C à Berlin");
  });
  it("le seuil fort est ECART_FORT", () => {
    const seul = [piece(9, "pantalon", "Pantalon fin", { meteoMinTemp: 15 })];
    expect(evaluerAlerteMeteo(seul, { temp: 15 - (ECART_FORT - 1), label: "Nuageux" })?.niveau).toBe("legere");
    expect(evaluerAlerteMeteo(seul, { temp: 15 - ECART_FORT, label: "Nuageux" })?.niveau).toBe("forte");
  });
  it("sans borne déclarée : jamais d'alerte de température, aucune supposition sur la catégorie", () => {
    const sansBorne = [piece(10, "haut", "T-shirt"), piece(11, "jupe", "Jupe"), piece(12, "chaussures", "Sandales", { shoeType: "Mocassins" })];
    expect(evaluerAlerteMeteo(sansBorne, { temp: -3, label: "Neigeux" })).toBeNull();
  });
  it("trop chaud, sans ville : « ce jour-là »", () => {
    const laine = [piece(13, "pull", "Pull en laine", { meteoMaxTemp: 15 })];
    const a = evaluerAlerteMeteo(laine, { temp: 18, label: "Ensoleillé" });
    expect(a).toMatchObject({ niveau: "legere", cause: "chaud" });
    expect(a?.message).toBe("18 °C prévus ce jour-là : choisis des pièces plus légères pour profiter de ta journée.");
  });
  it("pluie sur chaussures ouvertes seulement", () => {
    const sandales = piece(14, "chaussures", "Sandales", { shoeType: "Sandales" });
    expect(evaluerAlerteMeteo([sandales], { temp: 16, label: "Pluvieux" })).toMatchObject({ cause: "pluie", niveau: "legere" });
    expect(evaluerAlerteMeteo([sandales], { temp: 16, label: "Ensoleillé" })).toBeNull();
  });
  it("données absentes : rien", () => {
    expect(evaluerAlerteMeteo([], { temp: 8, label: "Nuageux" })).toBeNull();
    expect(evaluerAlerteMeteo(look, { temp: Number.NaN, label: "Nuageux" })).toBeNull();
  });
});

describe("proposerAdaptation — modifications minimales, depuis le dressing", () => {
  const contexte = contexteCapsule("Automne");
  const cardigan = piece(20, "veste", "Veste en laine", { meteoMinTemp: 3, saisons: ["Automne", "Hiver"] });
  const manteau = piece(21, "manteau", "Manteau long", { meteoMinTemp: -5, saisons: ["Automne", "Hiver"] });
  const jupeChaude = piece(22, "jupe", "Jupe en laine", { meteoMinTemp: 2, saisons: ["Automne", "Hiver"] });
  const bottines = piece(23, "chaussures", "Bottines", { shoeType: "Bottines", meteoMinTemp: -5, saisons: ["Automne", "Hiver"] });
  const sandalesEte = piece(24, "chaussures", "Sandales", { shoeType: "Sandales", meteoMinTemp: 18, saisons: ["Été"] });

  it("remplace seulement ce qui est hors borne et garde le reste", () => {
    const p = proposerAdaptation({ pieces: look, dressing: [...look, jupeChaude, bottines, cardigan], meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", contexte });
    expect(p).not.toBeNull();
    expect(p?.ids).toEqual(expect.arrayContaining([1, 2, 22, 23]));
    expect(p?.ids).not.toContain(3);
    expect(p?.ids).not.toContain(4);
    expect(p?.resolu).toBe(true);
    expect(p?.changements.map(libelleChangement)).toEqual(["Jupe en laine à la place de Jupe rose poudré", "Bottines à la place de Ballerines noires"]);
  });
  it("ajoute une couche quand le look n'en a pas (manteau sous 10 °C)", () => {
    const sansCouche = [tshirt, jupe, ballerines];
    const p = proposerAdaptation({ pieces: sansCouche, dressing: [...sansCouche, manteau, cardigan, jupeChaude, bottines], meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", contexte });
    expect(p?.changements.some((c) => c.type === "ajout" && c.piece.id === 21)).toBe(true);
  });
  it("jamais une pièce d'une autre saison ni hors borne", () => {
    const p = proposerAdaptation({ pieces: look, dressing: [...look, sandalesEte], meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", contexte });
    expect(p).toBeNull();
  });
  it("rien dans le dressing qui convienne : null (l'appelant ouvre l'écran du plan)", () => {
    expect(proposerAdaptation({ pieces: look, dressing: look, meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", contexte })).toBeNull();
  });
  it("tenue adaptée : aucune proposition", () => {
    expect(proposerAdaptation({ pieces: look, dressing: [...look, manteau], meteo: { temp: 20, label: "Nuageux" }, occasion: "soiree", contexte })).toBeNull();
  });
  it("sous la pluie, des chaussures fermées remplacent les ouvertes", () => {
    const sandales = piece(30, "chaussures", "Sandales", { shoeType: "Sandales" });
    const baskets = piece(31, "chaussures", "Baskets blanches", { shoeType: "Baskets" });
    const p = proposerAdaptation({ pieces: [sandales], dressing: [sandales, baskets], meteo: { temp: 16, label: "Pluvieux" }, occasion: "quotidien", contexte: contexteCapsule("Printemps") });
    expect(p?.ids).toEqual([31]);
  });
  it("une pièce est déterministe : même entrée, même proposition", () => {
    const args = { pieces: look, dressing: [...look, jupeChaude, bottines, cardigan], meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree" as const, contexte };
    expect(proposerAdaptation(args)).toEqual(proposerAdaptation(args));
  });
});
