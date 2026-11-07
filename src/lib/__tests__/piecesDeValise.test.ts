import { describe, expect, it } from "vitest";
import { computeDefaultCapsule } from "../capsule";
import type { CatalogItem } from "../catalog";
import { EMPTY_PROFILE, type Profile } from "../profile";
import type { Item } from "../types";
import { ajouterCouverture, chaussuresDeRandonnee, estBaignade, estBlazer, sansTenueDeSport, estPieceDeValise, piecesDeBaignade, piecesPourLaSituation, poolDeBaignade, poolDecontracte, poolDeRandonnee } from "../piecesDeValise";
import { generateurMoteur, lookAChaussuresEtSac, situationsDuProgramme, type SituationValise } from "../valise";
import { filtrerParContrainte } from "../programmeValise";
import { at, item } from "./fixtures";

/** LES PIÈCES RÉSERVÉES À LA VALISE (06/11/2026) : plage, piscine, spa. */
const profil = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, gender: "femme", ...over });
const maillot = (id: number, style: string, genre = "femme") =>
  item({ id, category: "combinaisons", name: `Maillot ${style}`, sous_type: "Maillot de bain", styles: style, genre, saison_capsule: "Printemps, Été, Automne, Hiver", occasions: "quotidien,cocooning", niveau_formalite: "decontracte", role_piece: "piece_unique", couleur_dominante: "Noir" });
const surchemise = (id: number, style: string) =>
  item({ id, category: "hauts", name: `Surchemise ${style}`, sous_type: "Surchemise de plage", styles: style, genre: "femme", saison_capsule: "Printemps, Été", occasions: "quotidien", niveau_formalite: "decontracte", role_piece: "calque", couleur_dominante: "Blanc", manches: "longues" });
const plage = (sousIds = ["plage"]): SituationValise => ({ occasion: "quotidien", meteo: at(28, "Printemps / Été"), jours: ["2026-07-10"], contrainte: "chaleur", sousIds });

describe("pièces réservées à la valise", () => {
  it("reconnues par leur type ; la baignade par l'activité", () => {
    expect(estPieceDeValise(maillot(1, "Bohème"))).toBe(true);
    expect(estPieceDeValise(item({ id: 2, category: "hauts", name: "Chemise", sous_type: "Chemise" }))).toBe(false);
    expect(estBaignade({ sousIds: ["visites", "spa"] })).toBe(true);
    expect(estBaignade({ sousIds: ["visites"] })).toBe(false);
  });

  it("la pièce du style du profil d'abord, jamais l'autre genre", () => {
    const catalogue = [maillot(1, "Minimaliste"), maillot(2, "Bohème"), maillot(3, "Bohème", "homme"), surchemise(4, "Bohème"), surchemise(5, "Glamour")];
    expect(piecesDeBaignade(catalogue, profil({ styles: ["boheme"] }), []).map((p) => p.name)).toEqual(["Maillot Bohème", "Surchemise Bohème"]);
  });

  it("jamais dans une capsule", () => {
    const catalogue: CatalogItem[] = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    for (let k = 0; k < 40; k++) catalogue.push(item({ id: 100 + k, category: ["hauts", "pantalons", "chaussures", "accessoires"][k % 4], name: `Pièce ${k}`, couleur_dominante: "Noir", niveau_formalite: "decontracte", role_piece: "base", styles: "Bohème" }));
    const capsule = computeDefaultCapsule(profil({ styles: ["boheme"] }), at(28, "Printemps / Été"), [], "Été", catalogue);
    expect(capsule.some(estPieceDeValise)).toBe(false);
  });

  it("en baignade, la tenue de bain remplace les vêtements ; ailleurs rien ne change", () => {
    const pool = [maillot(1, "Bohème"), surchemise(2, "Bohème"), item({ id: 3, category: "shorts", name: "Short en jean" }), item({ id: 4, category: "chaussures", name: "Sandales", sous_type: "Sandales" })];
    expect(poolDeBaignade(pool, plage()).map((p) => p.name)).toEqual(["Maillot Bohème", "Surchemise Bohème", "Sandales"]);
    expect(poolDeBaignade(pool, { sousIds: ["visites"] })).toHaveLength(4);
  });

  it("la surchemise rejoint le maillot à la plage, jamais au spa", () => {
    const pool = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    const [m, s] = pool.map((p) => p.id);
    expect(ajouterCouverture([m], pool, plage())).toEqual([m, s]);
    expect(ajouterCouverture([m], pool, { sousIds: ["spa"] })).toEqual([m]);
  });

  it("le moteur compose un look de plage avec les pièces de la valise, même avec un dressing fourni", () => {
    const dressing = [
      item({ id: 10, category: "hauts", name: "T-shirt blanc", couleur_dominante: "Blanc", saison_capsule: "Printemps, Été", manches: "courtes" }),
      item({ id: 11, category: "shorts", name: "Short en jean", couleur_dominante: "Denim", saison_capsule: "Printemps, Été" }),
      item({ id: 12, category: "chaussures", name: "Sandales plates", sous_type: "Sandales", couleur_dominante: "Camel", saison_capsule: "Printemps, Été" }),
      item({ id: 13, category: "accessoires", name: "Cabas en paille", couleur_dominante: "Sable", saison_capsule: "Printemps, Été" }),
    ];
    const reservees = [maillot(1, "Bohème"), surchemise(2, "Bohème")];
    const t = generateurMoteur([], "femme", null, reservees)(dressing, plage());
    const noms = (t?.ids ?? []).map((id) => [...dressing, ...reservees].find((p) => p.id === id)?.name);
    expect(noms).toContain("Maillot Bohème");
    expect(noms).toContain("Surchemise Bohème");
    expect(noms).not.toContain("Short en jean");
  });
});

describe("pendant le séjour, jamais en tenue du jour (06/11/2026)", () => {
  it("le vivier de la tenue du jour écarte les pièces de baignade", async () => {
    const { piecesDeLaValisePourLeJour } = await import("../valiseDuJour");
    const pool = [maillot(1, "Bohème"), item({ id: 10, category: "hauts", name: "T-shirt" })];
    const v = { pieceIds: pool.map((p) => p.id) } as unknown as Parameters<typeof piecesDeLaValisePourLeJour>[0];
    expect(piecesDeLaValisePourLeJour(v, pool).map((p) => p.name)).toEqual(["T-shirt"]);
  });
});

describe("le look de vacances, tenue du jour le jour de son activité (06/11/2026)", () => {
  it("plage, piscine, spa et randonnée seulement", async () => {
    const { estActiviteDeVacances } = await import("../piecesDeValise");
    expect(["plage", "piscine", "spa", "randonnee"].every(estActiviteDeVacances)).toBe(true);
    expect(estActiviteDeVacances("visites")).toBe(false);
    expect(estActiviteDeVacances(null)).toBe(false);
  });
});

describe("chaussures de randonnée (06/11/2026) : une paire par genre, pour les seules journées de randonnée", () => {
  const rando = (id: number, genre: string) =>
    item({ id, category: "chaussures", name: `Rando ${genre}`, sous_type: "Chaussures de randonnée", genre, saison_capsule: "Printemps, Été, Automne, Hiver", occasions: "sport" });
  const catalogue: CatalogItem[] = [rando(1, "femme"), rando(2, "homme"), maillot(3, "Minimaliste")];

  it("réservées à la valise, chaussure de sport pour le moteur", () => {
    expect(estPieceDeValise(catalogue[0])).toBe(true);
    expect(catalogue[0].shoeType).toBe("Baskets");
  });
  it("la paire du genre du profil, jamais celle de l'autre", () => {
    expect(chaussuresDeRandonnee(catalogue, { gender: "femme" }).map((p) => p.name)).toEqual(["Rando femme"]);
    expect(chaussuresDeRandonnee(catalogue, { gender: "homme" }).map((p) => p.name)).toEqual(["Rando homme"]);
    expect(chaussuresDeRandonnee([rando(4, "unisexe")], { gender: "homme" }).map((p) => p.name)).toEqual(["Rando unisexe"]);
  });
  it("une situation reçoit ses pièces : la paire à la randonnée, le maillot à la plage", () => {
    const pieces = [catalogue[0], catalogue[2]];
    expect(piecesPourLaSituation(pieces, { sousIds: ["randonnee"] }).map((p) => p.name)).toEqual(["Rando femme"]);
    expect(piecesPourLaSituation(pieces, { sousIds: ["plage"] }).map((p) => p.name)).toEqual(["Maillot Minimaliste"]);
    expect(piecesPourLaSituation(pieces, { sousIds: ["visites"] })).toEqual([]);
  });
  it("à la randonnée, la paire de randonnée remplace les autres chaussures ; ailleurs, rien ne change", () => {
    const baskets = item({ id: 11, category: "chaussures", name: "Baskets", sous_type: "Baskets" });
    const haut = item({ id: 10, category: "hauts", name: "T-shirt", sous_type: "T-shirt" });
    const pool = [haut, baskets, catalogue[0]];
    expect(poolDeRandonnee(pool, { sousIds: ["randonnee"] }).map((p) => p.name)).toEqual(["T-shirt", "Rando femme"]);
    expect(poolDeRandonnee(pool, { sousIds: ["visites"] })).toEqual(pool);
  });
});

describe("randonnée et trajets (06/11/2026, signalé : randonnées sans look, blazer au trajet)", () => {
  const T = "Printemps, Été, Automne, Hiver";
  const paire = (formalite: string) =>
    item({ id: 1, category: "chaussures", name: "Chaussures de randonnée en nubuck", sous_type: "Chaussures de randonnée", genre: "femme", saison_capsule: T, occasions: "sport", niveau_formalite: formalite, couleur_dominante: "Taupe" });
  const tshirt = item({ id: 20, category: "hauts", name: "T-shirt en coton", sous_type: "T-shirt", couleur_dominante: "Blanc", niveau_formalite: "decontracte", occasions: "quotidien,voyage", saison_capsule: T, manches: "courtes" });
  const pantalon = item({ id: 21, category: "pantalons", name: "Pantalon large", sous_type: "Large", couleur_dominante: "Noir", niveau_formalite: "decontracte", occasions: "quotidien,voyage", saison_capsule: T });
  const sacADos = item({ id: 22, category: "sacs", name: "Sac à dos", sous_type: "Sac à dos", couleur_dominante: "Noir", niveau_formalite: "decontracte", occasions: "quotidien,voyage", saison_capsule: T });
  const blazer = item({ id: 23, category: "vestes_blazers", name: "Blazer en laine", sous_type: "Blazer", couleur_dominante: "Beige", niveau_formalite: "business_casual", occasions: "travail_formel,quotidien,voyage", saison_capsule: T });
  const baskets = item({ id: 24, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets", couleur_dominante: "Blanc", niveau_formalite: "sport", occasions: "quotidien,voyage", saison_capsule: T });
  const dressing = [tshirt, pantalon, sacADos, blazer, baskets];
  const meteo = at(26, "Printemps / Été");
  const randonnee: SituationValise = { occasion: "sport", meteo, jours: ["2026-11-24"], contrainte: "outdoor", sousIds: ["randonnee"] };
  const trajet = (avecRandonnee: boolean): SituationValise => ({ occasion: "voyage", meteo, jours: ["2026-11-23"], sousIds: ["trajet"], ...(avecRandonnee ? { avecRandonnee: true as const } : {}) });
  const noms = (ids: number[] | undefined, pieces: Item[]) => (ids ?? []).map((id) => pieces.find((p) => p.id === id)?.name);
  const tirages = (n: number, f: () => ReturnType<ReturnType<typeof generateurMoteur>>) => Array.from({ length: n }, f);

  it("un blazer est reconnu ; une tenue décontractée l'écarte, et privilégie le décontracté sans vider une catégorie", () => {
    expect(estBlazer(blazer)).toBe(true);
    expect(estBlazer(tshirt)).toBe(false);
    const chemise = item({ id: 30, category: "hauts", name: "Chemise en popeline", sous_type: "Chemise", niveau_formalite: "business_casual" });
    expect(poolDecontracte([blazer, tshirt, chemise]).map((p) => p.name)).toEqual(["T-shirt en coton"]);
    expect(poolDecontracte([chemise]).map((p) => p.name)).toEqual(["Chemise en popeline"]);
  });

  it("une randonnée sans tenue de sport reçoit un look de marche avec la paire de randonnée, sans blazer, dit élargi", () => {
    const pieces = [...dressing, paire("decontracte")];
    for (const t of tirages(20, () => generateurMoteur([], "femme", null, [paire("decontracte")])(dressing, randonnee))) {
      expect(t).not.toBeNull();
      expect(t!.elargie).toBe(true);
      expect(noms(t!.ids, pieces)).toContain("Chaussures de randonnée en nubuck");
      expect(noms(t!.ids, pieces)).not.toContain("Blazer en laine");
    }
  });

  it("avec une tenue de sport, la randonnée garde le look de sport", () => {
    const sport = [
      item({ id: 40, category: "hauts", name: "T-shirt technique", sous_type: "T-shirt technique", couleur_dominante: "Noir", niveau_formalite: "sport", occasions: "sport", saison_capsule: T, manches: "courtes" }),
      item({ id: 41, category: "pantalons", name: "Legging de sport", sous_type: "Legging", couleur_dominante: "Noir", niveau_formalite: "sport", occasions: "sport", saison_capsule: T }),
      item({ id: 42, category: "sacs", name: "Sac de sport", sous_type: "Sac de sport", couleur_dominante: "Noir", niveau_formalite: "sport", occasions: "sport", saison_capsule: T }),
    ];
    const t = generateurMoteur([], "femme", null, [paire("sport")])(sport, randonnee);
    expect(t?.elargie).toBe(false);
    expect(noms(t?.ids, [...sport, paire("sport")])).toEqual(expect.arrayContaining(["Legging de sport", "Chaussures de randonnée en nubuck"]));
  });

  it("le trajet n'a jamais de blazer ; il porte la paire de randonnée quand le séjour en compte une", () => {
    const pieces = [...dressing, paire("sport")];
    const gen = generateurMoteur([], "femme", null, [paire("sport")]);
    for (const t of tirages(20, () => gen(dressing, trajet(true)))) {
      expect(noms(t?.ids, pieces)).not.toContain("Blazer en laine");
      expect(noms(t?.ids, pieces)).toContain("Chaussures de randonnée en nubuck");
    }
    for (const t of tirages(20, () => gen(dressing, trajet(false)))) {
      expect(noms(t?.ids, pieces)).not.toContain("Blazer en laine");
      expect(noms(t?.ids, pieces)).not.toContain("Chaussures de randonnée en nubuck");
    }
  });

  it("le programme marque les trajets et journées de marche d'un séjour avec randonnée, et eux seuls", () => {
    const meteos = ["2026-11-23", "2026-11-24", "2026-11-25"].map((jour) => ({ jour, temp: 26, label: "Ensoleillé", prevue: true }));
    const avec = situationsDuProgramme([{ id: "randonnee", frequence: 2 }, { id: "visites", frequence: 1 }, { id: "restaurant", frequence: 1 }, { id: "trajet", frequence: 2 }], meteos, []);
    expect(avec.filter((x) => x.avecRandonnee).map((x) => x.sousIds)).toEqual([["visites"], ["trajet"]]);
    const sans = situationsDuProgramme([{ id: "visites", frequence: 2 }, { id: "trajet", frequence: 2 }], meteos, []);
    expect(sans.some((x) => x.avecRandonnee)).toBe(false);
  });

  it("séjour avec randonnée : la paire est proposée aux trajets et journées de marche, parmi les autres chaussures, avec une tenue ordinaire ; sans randonnée, jamais", () => {
    const visites: SituationValise = { occasion: "quotidien", meteo, jours: ["2026-11-26"], contrainte: "marche", sousIds: ["visites"], avecRandonnee: true };
    expect(piecesPourLaSituation([paire("sport")], visites)).toHaveLength(1);
    expect(piecesPourLaSituation([paire("sport")], { occasion: "quotidien", contrainte: "marche", sousIds: ["balade"], avecRandonnee: true })).toHaveLength(1);
    expect(piecesPourLaSituation([paire("sport")], trajet(true))).toHaveLength(1);
    expect(piecesPourLaSituation([paire("sport")], { occasion: "soiree", sousIds: ["restaurant"] })).toEqual([]);
    // Sans randonnée au programme : ni aux visites, ni à la balade, ni au trajet.
    expect(piecesPourLaSituation([paire("sport")], { occasion: "quotidien", contrainte: "marche", sousIds: ["visites"] })).toEqual([]);
    expect(piecesPourLaSituation([paire("sport")], { occasion: "quotidien", contrainte: "marche", sousIds: ["balade"] })).toEqual([]);
    expect(piecesPourLaSituation([paire("sport")], trajet(false))).toEqual([]);
    expect(poolDeRandonnee([baskets, paire("sport")], visites)).toHaveLength(2);
    const legging = item({ id: 41, category: "pantalons", name: "Legging de sport", sous_type: "Legging", couleur_dominante: "Noir", niveau_formalite: "sport", occasions: "sport,quotidien", saison_capsule: T });
    expect(sansTenueDeSport([legging, pantalon, paire("sport")]).map((p) => p.name)).toEqual(["Pantalon large", "Chaussures de randonnée en nubuck"]);
    expect(sansTenueDeSport([legging]).map((p) => p.name)).toEqual(["Legging de sport"]);
    const pieces = [...dressing, legging, paire("sport")];
    const gen = generateurMoteur([], "femme", null, [paire("sport")]);
    for (const t of tirages(20, () => gen([...dressing, legging], visites))) expect(noms(t?.ids, pieces)).not.toContain("Legging de sport");
  });
});

describe("pas de talons à la plage ni aux visites (06/11/2026, signalé : des slingbacks à talons pour la plage)", () => {
  const T = "Printemps, Été";
  const slingbacks = item({ id: 50, category: "chaussures", name: "Slingbacks à talons", sous_type: "Slingbacks", couleur_dominante: "Noir", saison_capsule: T });
  const petitTalon = item({ id: 51, category: "chaussures", name: "Sandales à petit talon", sous_type: "Sandales", couleur_dominante: "Camel", saison_capsule: T });
  const plates = item({ id: 52, category: "chaussures", name: "Sandales plates", sous_type: "Sandales", couleur_dominante: "Camel", saison_capsule: T });
  const baskets = item({ id: 53, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets", couleur_dominante: "Blanc", saison_capsule: T });
  const pool = [slingbacks, petitTalon, plates, baskets];
  const ete = at(28, "Printemps / Été");
  it("plage et piscine : aucune paire à talon", () => {
    expect(filtrerParContrainte(pool, "chaleur", ete).map((p) => p.name)).toEqual(["Sandales plates", "Baskets blanches"]);
  });
  it("visites : baskets et sandales plates par temps chaud, jamais de talon", () => {
    expect(filtrerParContrainte(pool, "marche", ete).map((p) => p.name)).toEqual(["Sandales plates", "Baskets blanches"]);
  });
});

describe("le spa a un look, sans sac (07/11/2026, signalé : journées de spa toujours sans look)", () => {
  const T = "Printemps, Été, Automne, Hiver";
  const maillotSpa = item({ id: 1, category: "combinaisons", name: "Maillot une pièce", sous_type: "Maillot de bain", genre: "femme", saison_capsule: T, occasions: "quotidien,cocooning", niveau_formalite: "decontracte", role_piece: "piece_unique", couleur_dominante: "Noir" });
  const chaussons = item({ id: 12, category: "chaussures", name: "Chaussons en laine", sous_type: "Chaussures d'intérieur", couleur_dominante: "Gris", niveau_formalite: "decontracte", occasions: "cocooning", saison_capsule: T });
  const pool = [
    item({ id: 10, category: "hauts", name: "Pull doux", sous_type: "Pull", couleur_dominante: "Beige", niveau_formalite: "decontracte", occasions: "cocooning,quotidien", saison_capsule: T, manches: "longues" }),
    item({ id: 11, category: "pantalons", name: "Pantalon en maille", sous_type: "Jogging", couleur_dominante: "Beige", niveau_formalite: "decontracte", occasions: "cocooning", saison_capsule: T }),
    chaussons,
    item({ id: 13, category: "sacs", name: "Cabas", sous_type: "Cabas", couleur_dominante: "Camel", niveau_formalite: "decontracte", saison_capsule: T }),
  ];
  const spa: SituationValise = { occasion: "cocooning", meteo: at(2, "Automne / Hiver"), jours: ["2026-11-23"], sousIds: ["spa"] };

  it("avec ou sans maillot, un look à chaque tirage, en chaussures d'intérieur et sans sac ; il reste un look de valise", () => {
    for (const reservees of [[], [maillotSpa]]) {
      for (let k = 0; k < 20; k++) {
        const t = generateurMoteur([], "femme", null, reservees)(pool, spa);
        expect(t).not.toBeNull();
        const pieces = [...pool, maillotSpa].filter((p) => t!.ids.includes(p.id));
        expect(pieces.some((p) => p.cat === "sac")).toBe(false);
        expect(pieces.find((p) => p.cat === "chaussures")?.name).toBe("Chaussons en laine");
        expect(lookAChaussuresEtSac(t!.ids, [...pool, maillotSpa])).toBe(true);
      }
    }
  });

  it("hors de chez soi, un look sans sac n'est toujours pas un look de valise", () => {
    const baskets = item({ id: 14, category: "chaussures", name: "Baskets", sous_type: "Baskets" });
    const [pull, bas, , cabas] = pool.map((p) => p.id);
    expect(lookAChaussuresEtSac([pull, bas, baskets.id], [...pool, baskets])).toBe(false);
    expect(lookAChaussuresEtSac([pull, bas, baskets.id, cabas], [...pool, baskets])).toBe(true);
  });
});
