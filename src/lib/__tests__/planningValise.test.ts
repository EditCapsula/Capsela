import { describe, expect, it } from "vitest";
import { activitesAPlanifier, activitesDatees, cleDeplacement, deplacerActivite, deplacerActiviteDatee, joursPossibles, looksDesActivites, pieceLaPlusUtilisee, planificationManuelle, planningDuProgramme } from "../planningValise";
import { basculerJour } from "../activitesSejour";
import { filtrerParContrainte } from "../programmeValise";
import { groupesMeteo, situationsDuProgramme, situationsDuSejour, type MeteoJour } from "../valise";
import type { Item } from "../types";

const JOURS = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const meteos: MeteoJour[] = JOURS.map((jour) => ({ jour, temp: 28, label: "Ensoleillé", prevue: false }));
const piece = (id: number, cat: Item["cat"], over: Partial<Item> = {}): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1, ...over }) as Item;

describe("situationsDuProgramme — une situation par mère et contrainte, pas par occasion", () => {
  const programme = [
    { id: "visites", frequence: 3 },
    { id: "plage", frequence: 2 },
    { id: "piscine", frequence: 1 },
    { id: "restaurant", frequence: 2 },
    { id: "trajet", frequence: 2 },
  ];
  const s = situationsDuProgramme(programme, meteos, ["quotidien"]);
  it("plage et piscine partagent une situation (quotidien, chaleur) — pas deux tenues", () => {
    const chaleur = s.filter((x) => x.contrainte === "chaleur");
    expect(chaleur).toHaveLength(1);
    expect(chaleur[0].sousIds).toEqual(["plage", "piscine"]);
    expect(chaleur[0].occasion).toBe("quotidien");
  });
  it("visites (marche) est une situation à part de plage (chaleur), même occasion mère", () => {
    expect(s.filter((x) => x.occasion === "quotidien")).toHaveLength(2);
  });
  it("le trajet ne se joue que le jour du départ et celui du retour", () => {
    const trajet = s.find((x) => x.sousIds?.includes("trajet"))!;
    expect(trajet.jours).toEqual(["2026-10-20", "2026-10-25"]);
  });
  it("sans programme : le repli d'avant, identique à situationsDuSejour", () => {
    expect(situationsDuProgramme([], meteos, ["quotidien", "soiree"])).toEqual(situationsDuSejour(["quotidien", "soiree"], meteos));
  });
  it("groupesMeteo regroupe les jours de même météo", () => {
    expect(groupesMeteo(meteos)).toHaveLength(1);
  });
});

describe("filtrerParContrainte — un filtre du pool, jamais une règle du moteur", () => {
  const pool = [
    piece(1, "haut"),
    piece(2, "manteau"),
    piece(3, "pull"),
    piece(4, "robe", { season: "Automne / Hiver" }),
    piece(5, "chaussures", { shoeType: "Sandales" }),
    piece(6, "chaussures", { shoeType: "Bottes" }),
    piece(7, "chaussures", { shoeType: "Escarpins" }),
    piece(8, "chaussures", { shoeType: "Baskets" }),
    piece(9, "chaussures"),
  ];
  const ids = (l: Item[]) => l.map((x) => x.id);
  it("sans contrainte, rien n'est filtré", () => {
    expect(ids(filtrerParContrainte(pool))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("chaleur : ni manteau, ni pull, ni pièce d'automne-hiver, ni bottes, ni talons (06/11/2026 : escarpins écartés de la plage)", () => {
    expect(ids(filtrerParContrainte(pool, "chaleur"))).toEqual([1, 5, 8, 9]);
  });
  it("marche : pas d'escarpins ; une chaussure sans type reste", () => {
    expect(ids(filtrerParContrainte(pool, "marche"))).toEqual([1, 2, 3, 4, 5, 6, 8, 9]);
  });
  it("marche (06/11/2026) : baskets, bottines, bottes en hiver, sandales en été ; ni mocassins, ni ballerines, ni espadrilles", () => {
    const p = [
      piece(10, "chaussures", { shoeType: "Mocassins" }),
      piece(11, "chaussures", { shoeType: "Ballerines" }),
      piece(12, "chaussures", { shoeType: "Espadrilles" }),
      piece(13, "chaussures", { shoeType: "Bottines" }),
      piece(5, "chaussures", { shoeType: "Sandales" }),
      piece(6, "chaussures", { shoeType: "Bottes" }),
      piece(8, "chaussures", { shoeType: "Baskets" }),
    ];
    expect(ids(filtrerParContrainte(p, "marche", { season: "Automne / Hiver" }))).toEqual([13, 6, 8]);
    expect(ids(filtrerParContrainte(p, "marche", { season: "Printemps / Été" }))).toEqual([13, 5, 8]);
  });
  it("marche : le confort d'abord, sans rien exclure quand rien d'autre n'existe dans la catégorie", () => {
    const p = [
      piece(20, "jupe", { subtype: "Crayon" }),
      piece(21, "jupe", { subtype: "Midi" }),
      piece(22, "robe", { niveauFormalite: 4 }),
      piece(23, "pantalon", { coupe: "Serré" }),
      piece(24, "pantalon", { coupe: "Ample" }),
      piece(8, "chaussures", { shoeType: "Baskets" }),
    ];
    // La jupe crayon et le pantalon serré sortent (une autre jupe, un autre pantalon restent) ; la robe habillée reste, seule de sa catégorie.
    expect(ids(filtrerParContrainte(p, "marche", { season: "Printemps / Été" }))).toEqual([21, 22, 24, 8]);
  });
  it("marche, sans aucune chaussure de marche : la règle d'avant (ni talons), plutôt qu'une journée sans tenue", () => {
    const p = [piece(1, "haut"), piece(10, "chaussures", { shoeType: "Mocassins" }), piece(7, "chaussures", { shoeType: "Escarpins" })];
    expect(ids(filtrerParContrainte(p, "marche", { season: "Printemps / Été" }))).toEqual([1, 10]);
  });
  it("outdoor : baskets, bottines, bottes seulement parmi les chaussures typées ; sans type, elle reste", () => {
    expect(ids(filtrerParContrainte(pool, "outdoor"))).toEqual([1, 2, 3, 4, 6, 8, 9]);
  });
});

describe("planningDuProgramme — le programme réparti sur les jours, avec les looks de la valise", () => {
  const programme = [
    { id: "visites", frequence: 3 },
    { id: "plage", frequence: 2 },
    { id: "restaurant", frequence: 2 },
    { id: "trajet", frequence: 2 },
  ];
  const situations = situationsDuProgramme(programme, meteos, ["quotidien"]);
  const idx = (sous: string) => situations.findIndex((s) => s.sousIds?.includes(sous));
  const looks = [
    { ids: [1, 2], situations: [idx("visites")], elargie: false },
    { ids: [3, 4], situations: [idx("visites")], elargie: false },
    { ids: [5, 6], situations: [idx("plage")], elargie: false },
    { ids: [7, 8], situations: [idx("restaurant")], elargie: false },
    { ids: [9, 10], situations: [idx("trajet")], elargie: false },
  ];
  const plan = planningDuProgramme(programme, JOURS, situations, looks);

  it("chaque créneau du programme est placé : 3 + 2 + 2 + 2 = 9", () => {
    expect(plan).toHaveLength(9);
  });
  it("le trajet : le départ et le retour", () => {
    const t = plan.filter((c) => c.sousId === "trajet").map((c) => c.jour);
    expect(t).toEqual(["2026-10-20", "2026-10-25"]);
  });
  it("les fréquences sont respectées, une occasion jamais deux fois le même jour", () => {
    for (const [id, n] of [["visites", 3], ["plage", 2], ["restaurant", 2]] as const) {
      const jours = plan.filter((c) => c.sousId === id).map((c) => c.jour);
      expect(jours).toHaveLength(n);
      expect(new Set(jours).size).toBe(n);
    }
  });
  it("plusieurs occasions peuvent tomber le même jour : la somme des jours dépasse parfois la durée sans être refusée", () => {
    const parJour = new Map<string, number>();
    for (const c of plan) parJour.set(c.jour, (parJour.get(c.jour) ?? 0) + 1);
    expect(plan.length).toBeGreaterThan(0);
    expect([...parJour.values()].every((n) => n >= 1)).toBe(true);
  });
  it("chaque créneau reçoit un look qui répond à son occasion, en variant", () => {
    const visites = plan.filter((c) => c.sousId === "visites");
    expect(visites.every((c) => c.look === 0 || c.look === 1)).toBe(true);
    // deux looks pour trois visites : les deux sont utilisés avant qu'un revienne
    expect(new Set(visites.map((c) => c.look)).size).toBe(2);
  });
  it("sans look qui réponde : le créneau reste sans look, jamais un faux", () => {
    const sansPlage = planningDuProgramme(programme, JOURS, situations, looks.filter((_, i) => i !== 2).map((l) => ({ ...l, situations: l.situations.filter((x) => x !== idx("plage")) })));
    expect(sansPlage.filter((c) => c.sousId === "plage").every((c) => c.look === null)).toBe(true);
  });
  it("déterministe : le même programme donne le même planning", () => {
    expect(planningDuProgramme(programme, JOURS, situations, looks)).toEqual(plan);
  });
  it("aucun jour : rien", () => {
    expect(planningDuProgramme(programme, [], situations, looks)).toEqual([]);
  });
});

describe("pieceLaPlusUtilisee", () => {
  it("la pièce de plus de looks, à partir de deux", () => {
    expect(pieceLaPlusUtilisee(new Map([[1, 1], [2, 4], [3, 2]]))).toEqual({ id: 2, fois: 4 });
  });
  it("aucune pièce réutilisée : null", () => {
    expect(pieceLaPlusUtilisee(new Map([[1, 1], [2, 1]]))).toBeNull();
  });
});

describe("déplacer une activité répartie (06/11/2026, glisser-déposer du planning)", () => {
  const programme = [
    { id: "trajet", frequence: 2 },
    { id: "visites", frequence: 3 },
    { id: "plage", frequence: 2 },
    { id: "restaurant", frequence: 2 },
  ];
  const situations = situationsDuProgramme(programme, meteos, ["quotidien"]);
  const auto = planningDuProgramme(programme, JOURS, situations, []);
  const joursDe = (p: typeof auto, id: string) => p.filter((c) => c.sousId === id).map((c) => c.jour);

  it("seules les activités réparties sont déplaçables : pas le trajet", () => {
    expect(auto.filter((c) => c.sousId === "trajet").every((c) => !c.deplacable)).toBe(true);
    expect(auto.filter((c) => c.sousId === "plage").every((c) => c.deplacable)).toBe(true);
  });
  it("le déplacement change ce seul jour, et rien d'autre ne bouge", () => {
    const de = joursDe(auto, "plage")[0];
    const vers = joursPossibles(auto, "plage", JOURS)[0];
    const placements = deplacerActivite(auto, "plage", de, vers)!;
    const apres = planningDuProgramme(programme, JOURS, situations, [], [], placements);
    expect(joursDe(apres, "plage").sort()).toEqual([...joursDe(auto, "plage").filter((j) => j !== de), vers].sort());
    for (const id of ["visites", "restaurant", "trajet"]) expect(joursDe(apres, id)).toEqual(joursDe(auto, id));
  });
  it("impossible : le même jour, un jour qui a déjà l'activité, un trajet", () => {
    const [a, b] = joursDe(auto, "plage");
    expect(deplacerActivite(auto, "plage", a, a)).toBeNull();
    expect(deplacerActivite(auto, "plage", a, b)).toBeNull();
    expect(deplacerActivite(auto, "trajet", JOURS[0], JOURS[2])).toBeNull();
    expect(joursPossibles(auto, "plage", JOURS)).not.toContain(a);
  });
  it("des jours gardés qui ne valent plus (hors séjour, fréquence changée) : la répartition automatique reprend", () => {
    const horsSejour = planningDuProgramme(programme, JOURS, situations, [], [], { plage: ["2026-10-20", "2026-12-01"] });
    expect(joursDe(horsSejour, "plage")).toEqual(joursDe(auto, "plage"));
    const tropPeu = planningDuProgramme(programme, JOURS, situations, [], [], { plage: ["2026-10-20"] });
    expect(joursDe(tropPeu, "plage")).toEqual(joursDe(auto, "plage"));
  });
  it("sans placements : le planning d'avant, à l'identique", () => {
    expect(planningDuProgramme(programme, JOURS, situations, [], [], {})).toEqual(auto);
  });
});

describe("planification manuelle (06/11/2026) : les dates choisies à l'étape Activités", () => {
  const programme = [
    { id: "trajet", frequence: 2 },
    { id: "plage", frequence: 2 },
    { id: "visites", frequence: 3 },
  ];
  const situations = situationsDuProgramme(programme, meteos, ["quotidien"]);
  const choix = [
    { libelle: "Plage de Cascais", activite: "plage" as const, source: "idee" as const, jours: ["2026-10-21", "2026-10-23"] },
    { libelle: "Visiter la ville", activite: "ville" as const, source: "idee" as const, jours: [] },
    { libelle: "Atelier poterie", activite: null, source: "perso" as const, jours: ["2026-10-22"] },
  ];

  it("une valise dont les choix portent leurs jours est planifiée à la main ; une valise d'avant, non", () => {
    expect(planificationManuelle(choix)).toBe(true);
    expect(planificationManuelle([{ libelle: "Plage", activite: "plage", source: "idee" }])).toBe(false);
    expect(planificationManuelle(undefined)).toBe(false);
  });
  it("seules les activités datées apparaissent, sous leur nom, à leurs jours ; rien n'est réparti", () => {
    const p = planningDuProgramme(programme, JOURS, situations, [], [], {}, activitesDatees(choix, JOURS));
    const hors = p.filter((c) => c.sousId !== "trajet");
    expect(hors.map((c) => [c.jour, c.libelle, c.choix])).toEqual([
      ["2026-10-21", "Plage de Cascais", 0],
      ["2026-10-23", "Plage de Cascais", 0],
    ]);
    expect(p.filter((c) => c.sousId === "trajet").map((c) => c.jour)).toEqual(["2026-10-20", "2026-10-25"]);
  });
  it("« À planifier » : une activité du moteur sans jour du séjour ; une activité inconnue du moteur n'y est pas", () => {
    expect(activitesAPlanifier(choix, JOURS)).toEqual([{ choix: 1, libelle: "Visiter la ville" }]);
    expect(activitesAPlanifier([{ ...choix[0], jours: ["2027-01-01"] }], JOURS)).toEqual([{ choix: 0, libelle: "Plage de Cascais" }]);
  });
  it("déplacer une activité datée change ce jour-là seulement ; jamais sur un jour qu'elle a déjà", () => {
    expect(deplacerActiviteDatee(choix, 0, "2026-10-21", "2026-10-24")?.[0].jours).toEqual(["2026-10-23", "2026-10-24"]);
    expect(deplacerActiviteDatee(choix, 0, "2026-10-21", "2026-10-23")).toBeNull();
    expect(cleDeplacement({ choix: 0, sousId: "plage" })).toBe("choix:0");
  });
  it("cocher et décocher un jour garde l'ordre du calendrier", () => {
    const c = basculerJour(basculerJour(choix, 1, "2026-10-24"), 1, "2026-10-21");
    expect(c[1].jours).toEqual(["2026-10-21", "2026-10-24"]);
    expect(basculerJour(c, 1, "2026-10-21")[1].jours).toEqual(["2026-10-24"]);
  });
});

describe("looksDesActivites — une tenue pour chaque activité sans date (12/11/2026)", () => {
  const situations = [
    { occasion: "quotidien", sousIds: ["plage"], jours: JOURS, meteo: meteos[0] },
    { occasion: "soiree", sousIds: ["restaurant"], jours: JOURS, meteo: meteos[0] },
  ] as unknown as Parameters<typeof looksDesActivites>[2];
  const choix = [
    { libelle: "Se détendre sur une plage", activite: "plage" as const, source: "idee" as const, jours: [] },
    { libelle: "Snorkeling", activite: "plage" as const, source: "idee" as const, jours: [] },
    { libelle: "Dîner en ville", activite: "soiree" as const, source: "idee" as const, jours: [] },
  ];
  const aPlanifier = activitesAPlanifier(choix, JOURS);
  it("le look qui répond à l'activité, quel que soit le jour ; le moins porté d'abord, pour varier", () => {
    const looks = [{ situations: [0] }, { situations: [0] }, { situations: [1] }];
    const r = looksDesActivites(aPlanifier, choix, situations, looks, [{ look: 0 }]);
    expect(r.map((t) => t.look)).toEqual([1, 0, 2]);
    expect(r.map((t) => t.situation)).toEqual([0, 0, 1]);
  });
  it("aucun look ne répond : la situation est rendue, pour composer une tenue avec les pièces de la valise", () => {
    const r = looksDesActivites(aPlanifier, choix, situations, [{ situations: [0] }], []);
    expect(r[2]).toMatchObject({ look: null, situation: 1 });
  });
});
