import { describe, expect, it } from "vitest";
import { ECART_FORT, evaluerAlerteMeteo, libelleChangement, proposerAdaptation } from "../alerteMeteo";
import type { CategoryKey, Item } from "../types";

const ids = (xs: Item[]) => new Set(xs.map((x) => x.id));
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
  const saisonDuPlan = "Automne" as const;
  const cardigan = piece(20, "veste", "Veste en laine", { meteoMinTemp: 3, saisons: ["Automne", "Hiver"], occasion: ["soiree"], niveauFormalite: 3 });
  const manteau = piece(21, "manteau", "Manteau long", { meteoMinTemp: -5, saisons: ["Automne", "Hiver"], occasion: ["soiree"], niveauFormalite: 3 });
  const jupeChaude = piece(22, "jupe", "Jupe en laine", { meteoMinTemp: 2, saisons: ["Automne", "Hiver"], occasion: ["soiree"], niveauFormalite: 3 });
  const bottines = piece(23, "chaussures", "Bottines", { shoeType: "Bottines", meteoMinTemp: -5, saisons: ["Automne", "Hiver"], occasion: ["soiree"] });
  const sandalesEte = piece(24, "chaussures", "Sandales", { shoeType: "Sandales", meteoMinTemp: 18, saisons: ["Été"] });

  it("remplace seulement ce qui est hors borne et garde le reste", () => {
    const p = proposerAdaptation({ pieces: look, pool: [...look, jupeChaude, bottines, cardigan], dressingIds: ids([...look, jupeChaude, bottines, cardigan]), meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p).not.toBeNull();
    expect(p?.ids).toEqual(expect.arrayContaining([1, 2, 22, 23]));
    expect(p?.ids).not.toContain(3);
    expect(p?.ids).not.toContain(4);
    expect(p?.resolu).toBe(true);
    expect(p?.changements.map(libelleChangement)).toEqual(["Jupe en laine à la place de Jupe rose poudré", "Bottines à la place de Ballerines noires"]);
  });
  it("ajoute une couche quand le look n'en a pas (manteau sous 10 °C)", () => {
    const sansCouche = [tshirt, jupe, ballerines];
    const p = proposerAdaptation({ pieces: sansCouche, pool: [...sansCouche, manteau, cardigan, jupeChaude, bottines], dressingIds: ids([...sansCouche, manteau, cardigan, jupeChaude, bottines]), meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p?.changements.some((c) => c.type === "ajout" && c.piece.id === 21)).toBe(true);
  });
  it("jamais une pièce d'une autre saison ni hors borne", () => {
    const p = proposerAdaptation({ pieces: look, pool: [...look, sandalesEte], dressingIds: ids([...look, sandalesEte]), meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p).toBeNull();
  });
  it("rien dans le dressing qui convienne : null (l'appelant ouvre l'écran du plan)", () => {
    expect(proposerAdaptation({ pieces: look, pool: look, dressingIds: ids(look), meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", saisonDuPlan })).toBeNull();
  });
  it("tenue adaptée : aucune proposition", () => {
    expect(proposerAdaptation({ pieces: look, pool: [...look, manteau], dressingIds: ids([...look, manteau]), meteo: { temp: 20, label: "Nuageux" }, occasion: "soiree", saisonDuPlan })).toBeNull();
  });
  it("sous la pluie, des chaussures fermées remplacent les ouvertes", () => {
    const sandales = piece(30, "chaussures", "Sandales", { shoeType: "Sandales" });
    const baskets = piece(31, "chaussures", "Baskets blanches", { shoeType: "Baskets" });
    const p = proposerAdaptation({ pieces: [sandales], pool: [sandales, baskets], dressingIds: ids([sandales, baskets]), meteo: { temp: 16, label: "Pluvieux" }, occasion: "quotidien", saisonDuPlan: "Printemps" });
    expect(p?.ids).toEqual([31]);
  });
  it("jamais une pièce dont la formalité s'écarte trop de celle de la pièce remplacée", () => {
    const jupeHabillee = piece(40, "jupe", "Jupe habillée", { meteoMinTemp: 14, niveauFormalite: 4 });
    const jupeSport = piece(41, "jupe", "Jupe de sport", { meteoMinTemp: 2, saisons: ["Automne"], niveauFormalite: 0 });
    const jupeProche = piece(42, "jupe", "Jupe plissée", { meteoMinTemp: 2, saisons: ["Automne"], niveauFormalite: 3 });
    const p = proposerAdaptation({ pieces: [jupeHabillee, blazer], pool: [jupeHabillee, blazer, jupeSport, jupeProche], dressingIds: ids([jupeHabillee, blazer, jupeSport, jupeProche]), meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p?.ids).toContain(42);
    expect(p?.ids).not.toContain(41);
  });
  it("une pièce « toutes saisons » sans borne ni saison choisie n'est jamais proposée contre le froid", () => {
    const sansIndice = piece(43, "jupe", "Jupe sans information");
    expect(proposerAdaptation({ pieces: [jupe, blazer], pool: [jupe, blazer, sansIndice], dressingIds: ids([jupe, blazer, sansIndice]), meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", saisonDuPlan })).toBeNull();
  });
  it("les pièces de la capsule du pool sont dites « suggestion de ta capsule », celles du dressing non", () => {
    const capsuleJupe = piece(900001, "jupe", "Jupe de la capsule", { meteoMinTemp: 2, saisons: ["Automne", "Hiver"], occasion: ["soiree"], niveauFormalite: 3 });
    const capsuleBottines = piece(900002, "chaussures", "Bottines de la capsule", { shoeType: "Bottines", meteoMinTemp: -5, saisons: ["Automne", "Hiver"], occasion: ["soiree"] });
    const dressingIds = new Set(look.map((p) => p.id));
    // Le pool est celui du moteur (composeWardrobePool) : ici le dressing n'a rien de convenable, la capsule le complète.
    const p = proposerAdaptation({ pieces: look, pool: [...look, capsuleJupe, capsuleBottines], dressingIds, meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p?.changements.map((c) => c.source)).toEqual(["capsule", "capsule"]);
    expect(p?.changements.map(libelleChangement)[0]).toContain("(suggestion de ta capsule)");
    // Une pièce du dressing n'est jamais étiquetée suggestion.
    const q = proposerAdaptation({ pieces: look, pool: [...look, jupeChaude, bottines], dressingIds: new Set([...dressingIds, 22, 23]), meteo: { temp: 11, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(q?.changements.every((c) => c.source === "dressing")).toBe(true);
    expect(libelleChangement(q!.changements[0])).not.toContain("capsule");
  });
  it("règles du moteur : une teinte affirmée par tenue (le neutre est préféré)", () => {
    const pull = piece(50, "pull", "Pull moutarde", { color: "Moutarde", hex: "#D4A017", meteoMinTemp: 0, occasion: ["soiree"], niveauFormalite: 3 });
    const jupeFroide = piece(51, "jupe", "Jupe d'été", { meteoMinTemp: 14, occasion: ["soiree"], niveauFormalite: 3 });
    const rouge = piece(52, "jupe", "Jupe rouge", { color: "Rouge", hex: "#C00000", meteoMinTemp: 2, occasion: ["soiree"], niveauFormalite: 3 });
    const noire = piece(53, "jupe", "Jupe noire", { color: "Noir", meteoMinTemp: 2, occasion: ["soiree"], niveauFormalite: 3 });
    const p = proposerAdaptation({ pieces: [pull, jupeFroide], pool: [pull, jupeFroide, rouge, noire], dressingIds: ids([pull, jupeFroide, rouge, noire]), meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree", saisonDuPlan });
    expect(p?.ids).toContain(53);
    expect(p?.ids).not.toContain(52);
  });
  it("règles du moteur : jamais de chaussures d'été sous 15 °C", () => {
    const ballerinesFroides = piece(60, "chaussures", "Ballerines", { shoeType: "Ballerines", meteoMinTemp: 16 });
    const sandales = piece(61, "chaussures", "Sandales", { shoeType: "Sandales", saisons: ["Automne"], meteoMinTemp: 5 });
    expect(proposerAdaptation({ pieces: [ballerinesFroides], pool: [ballerinesFroides, sandales], dressingIds: ids([ballerinesFroides, sandales]), meteo: { temp: 11, label: "Nuageux" }, occasion: "quotidien", saisonDuPlan })).toBeNull();
  });
  it("la note du moteur (palette) départage deux candidates équivalentes", () => {
    const haut = piece(70, "haut", "Haut", { meteoMinTemp: 0, occasion: ["quotidien"] });
    const jupeFroide = piece(71, "jupe", "Jupe d'été", { meteoMinTemp: 14, occasion: ["quotidien"] });
    const a = piece(72, "jupe", "Jupe A", { color: "Noir", hex: "#1D1A16", meteoMinTemp: 2, occasion: ["quotidien"] });
    const b = piece(73, "jupe", "Jupe B", { color: "Beige", hex: "#D8C3A5", meteoMinTemp: 2, occasion: ["quotidien"] });
    const args = { pieces: [haut, jupeFroide], pool: [haut, jupeFroide, a, b], dressingIds: ids([haut, jupeFroide, a, b]), meteo: { temp: 8, label: "Nuageux" }, occasion: "quotidien" as const, saisonDuPlan };
    const sansPalette = proposerAdaptation(args);
    const avecPalette = proposerAdaptation({ ...args, moteur: { paletteHexes: ["#D8C3A5"], morphology: null } });
    expect(sansPalette).not.toBeNull();
    expect(avecPalette).not.toBeNull();
    expect(avecPalette?.score).toBeGreaterThanOrEqual(sansPalette?.score ?? 0);
  });
  it("une pièce est déterministe : même entrée, même proposition", () => {
    const args = { pieces: look, pool: [...look, jupeChaude, bottines, cardigan], dressingIds: ids([...look, jupeChaude, bottines, cardigan]), meteo: { temp: 8, label: "Nuageux" }, occasion: "soiree" as const, saisonDuPlan };
    expect(proposerAdaptation(args)).toEqual(proposerAdaptation(args));
  });
});
