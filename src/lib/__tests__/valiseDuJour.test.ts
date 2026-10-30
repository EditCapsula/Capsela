import { describe, expect, it } from "vitest";
import { estPlanValise, looksValiseDuJour, lookSuivant, lookSuivantConforme, piecesDeLaValise, valiseDuJour, valisePeutHabiller } from "../valiseDuJour";
import type { ValiseGardee } from "../valises";
import type { Item } from "../types";

/** LA VALISE FAIT LA TENUE DU JOUR PENDANT LE SÉJOUR (20/10/2026). */

const piece = (id: number, cat: Item["cat"]): Item => ({ id, cat, name: `P${id}`, hex: "#000", color: "Noir", season: "Toutes saisons", worn: 0 }) as Item;
const pool = [piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures"), piece(4, "sac"), piece(5, "robe"), piece(6, "chaussures"), piece(99, "haut")];
const jours = ["2026-10-25", "2026-10-26", "2026-10-27"];
const meteo = { season: "Automne / Hiver", temp: 19, label: "Ensoleillé", seasons: ["Automne / Hiver", "Toutes saisons"] } as const;
const valise = (over: Partial<ValiseGardee> = {}): ValiseGardee => ({
  version: 2,
  id: "v1",
  destination: "Lisbonne",
  depart: jours[0],
  retour: jours[2],
  bagage: "M",
  sejour: null,
  occasions: ["quotidien", "soiree"],
  meteos: jours.map((jour) => ({ jour, temp: 19, label: "Ensoleillé", prevue: false })),
  situations: [
    { occasion: "quotidien", meteo: { ...meteo, seasons: [...meteo.seasons] }, jours, sousIds: ["visites"] },
    { occasion: "soiree", meteo: { ...meteo, seasons: [...meteo.seasons] }, jours, sousIds: ["diner"] },
  ],
  pieceIds: [1, 2, 3, 4, 5, 6],
  looks: [
    { ids: [1, 2, 3, 4], situations: [0], elargie: false },
    { ids: [5, 6, 4], situations: [1], elargie: false },
  ],
  situationsSansLook: [],
  programme: [
    { id: "visites", frequence: 3 },
    { id: "diner", frequence: 3 },
  ],
  ...over,
});

describe("valiseDuJour", () => {
  it("la valise dont le séjour couvre le jour ; aucune avant le départ ni après le retour", () => {
    expect(valiseDuJour([valise()], "2026-10-26")?.id).toBe("v1");
    expect(valiseDuJour([valise()], "2026-10-24")).toBeNull();
    expect(valiseDuJour([valise()], "2026-10-28")).toBeNull();
  });
});

describe("looksValiseDuJour", () => {
  it("le look de la journée et celui du soir, en tenues planifiées virtuelles", () => {
    const r = looksValiseDuJour(valise(), "2026-10-26", pool);
    expect(r.numero).toBe(2);
    expect(r.journee).toMatchObject({ moment: "Toute la journée", occasion: "quotidien", pieceIds: [1, 2, 3, 4], lieu: "Lisbonne", jour: "2026-10-26" });
    expect(r.soir).toMatchObject({ moment: "Soirée", occasion: "soiree", pieceIds: [5, 6, 4] });
    expect(estPlanValise(r.journee!.id)).toBe(true);
    expect(estPlanValise("42")).toBe(false);
  });

  it("une valise sans planning jour par jour : aucun look attribué", () => {
    const r = looksValiseDuJour(valise({ programme: undefined }), "2026-10-26", pool);
    expect(r.journee).toBeNull();
    expect(r.soir).toBeNull();
  });

  it("un look dont une pièce n'est plus dans la valise n'est pas proposé", () => {
    const r = looksValiseDuJour(valise({ pieceIds: [1, 2, 3, 5, 6, 4].filter((id) => id !== 2) }), "2026-10-26", pool);
    expect(r.journee).toBeNull();
  });
});

describe("piecesDeLaValise", () => {
  it("seulement les pièces de la valise", () => {
    expect(piecesDeLaValise(valise(), pool).map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("lookSuivant", () => {
  const looks = [{ ids: [1, 2] }, { ids: [3, 4] }, { ids: [5, 6] }];
  it("le look suivant de la valise, en revenant au début ; jamais la tenue affichée", () => {
    expect(lookSuivant(looks, [2, 1])).toEqual({ ids: [3, 4] });
    expect(lookSuivant(looks, [5, 6])).toEqual({ ids: [1, 2] });
    expect(lookSuivant(looks, [9])).toEqual({ ids: [1, 2] });
    expect(lookSuivant([{ ids: [1, 2] }], [1, 2])).toBeNull();
  });
});

describe("« Autre tenue » garde l'occasion de la tenue affichée (22/10/2026)", () => {
  const looks = [
    { ids: [1, 2, 3, 4], occasions: ["quotidien"] },
    { ids: [5, 6, 4], occasions: ["soiree", "evenement_perso"] },
    { ids: [99, 2, 3, 4], occasions: ["quotidien"] },
    { ids: [5, 3, 4], occasions: ["evenement_perso"] },
  ];

  it("depuis un look de cérémonie : le look de cérémonie suivant, jamais un look de quotidien", () => {
    // Avant : lookSuivant sur tous les looks renvoyait le look suivant dans l'ordre, ici un look de quotidien.
    expect(lookSuivant(looks, [5, 6, 4])?.occasions).toEqual(["quotidien"]);
    expect(lookSuivantConforme(looks, [5, 6, 4], "evenement_perso")?.ids).toEqual([5, 3, 4]);
    expect(lookSuivantConforme(looks, [5, 3, 4], "evenement_perso")?.ids).toEqual([5, 6, 4]);
  });

  it("aucun autre look de cette occasion : null (le store tire alors dans la valise, même occasion)", () => {
    expect(lookSuivantConforme(looks, [5, 6, 4], "soiree")).toBeNull();
    expect(lookSuivantConforme(looks, [1, 2, 3, 4], "sport")).toBeNull();
  });

  it("chaque look de la valise porte toutes les occasions qu'il sert", () => {
    const v = valise({ looks: [{ ids: [5, 6, 4], situations: [1, 0], elargie: false }] });
    expect(looksValiseDuJour(v, "2026-10-26", pool).looks[0]).toMatchObject({ occasion: "soiree", occasions: ["soiree", "quotidien"] });
  });
});

describe("valisePeutHabiller (30/10/2026)", () => {
  it("haut et bas, ou robe, ou combinaison : oui ; sinon la tenue du jour revient au dressing", () => {
    expect(valisePeutHabiller([piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures")])).toBe(true);
    expect(valisePeutHabiller([piece(5, "robe")])).toBe(true);
    expect(valisePeutHabiller([piece(3, "chaussures"), piece(4, "sac"), piece(1, "haut")])).toBe(false);
    expect(valisePeutHabiller([])).toBe(false);
  });
});
