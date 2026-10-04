import { describe, expect, it } from "vitest";
import { MOMENTS_TENUE_DU_JOUR, alerteMeteoPlan, clePlanApplique, doitAppliquerPlan, planPourTenueDuJour, previsionAChange, sousChoixDuPlan } from "../planDuJour";
import { plansDuJour, type TenuePlanifiee } from "../planifier";
import type { MomentJournee } from "../prevision";
import type { CategoryKey, Item } from "../types";

// La tenue planifiée devient la tenue du jour, selon le moment (option C, 30/09/2026).

const plan = (id: string, moment: MomentJournee, pieceIds: number[] = [1, 2, 3], over: Partial<TenuePlanifiee> = {}): TenuePlanifiee => ({
  id,
  jour: "2026-10-02",
  moment,
  occasion: "travail_formel",
  sousChoix: "Présentiel",
  lieu: "Paris, Île-de-France, France",
  typeLieu: null,
  dressingSeul: false,
  pieceIds,
  temp: 18,
  weatherLabel: "Nuageux",
  ...over,
});
const piece = (id: number, cat: CategoryKey, over: Partial<Item> = {}): Item =>
  ({ id, name: `${cat} ${id}`, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const DRESSING = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("planPourTenueDuJour", () => {
  it("tous les moments font la tenue du jour — la soirée aussi depuis le 04/10/2026 (hero de l'Accueil)", () => {
    expect(MOMENTS_TENUE_DU_JOUR).toEqual(["Toute la journée", "Matin", "Après-midi", "Soirée"]);
    for (const m of MOMENTS_TENUE_DU_JOUR) expect(planPourTenueDuJour([plan("a", m)], DRESSING, [])).toEqual({ etat: "applicable", plan: plan("a", m) });
  });

  it("travail le jour et dîner le soir : le plan de journée passe avant, le dîner reste un rappel", () => {
    const plans = plansDuJour([plan("diner", "Soirée"), plan("bureau", "Matin")], "2026-10-02");
    expect(planPourTenueDuJour(plans, DRESSING, [])).toMatchObject({ etat: "applicable", plan: { id: "bureau" } });
  });

  it("dans l'ordre de la journée : « Toute la journée » passe avant le matin", () => {
    const plans = plansDuJour([plan("matin", "Matin"), plan("jour", "Toute la journée")], "2026-10-02");
    expect(planPourTenueDuJour(plans, DRESSING, [])?.plan.id).toBe("jour");
  });

  it("un plan écarté (« Voir une autre proposition ») ne revient pas ; le suivant peut prendre sa place", () => {
    const plans = plansDuJour([plan("matin", "Matin"), plan("aprem", "Après-midi")], "2026-10-02");
    expect(planPourTenueDuJour(plans, DRESSING, ["matin"])?.plan.id).toBe("aprem");
    expect(planPourTenueDuJour(plans, DRESSING, ["matin", "aprem"])).toBeNull();
  });

  it("une pièce sortie du dressing : incomplet, jamais imposé", () => {
    expect(planPourTenueDuJour([plan("a", "Matin", [1, 2, 99])], DRESSING, [])).toEqual({ etat: "incomplet", plan: plan("a", "Matin", [1, 2, 99]), manquantes: 1 });
    expect(planPourTenueDuJour([plan("a", "Matin", [])], DRESSING, [])?.etat).toBe("incomplet");
  });

  it("aucun plan ce jour-là : rien", () => {
    expect(planPourTenueDuJour([], DRESSING, [])).toBeNull();
  });
});

describe("sousChoixDuPlan", () => {
  it("rend le mode de travail ou le contexte de date, s'ils sont valides", () => {
    expect(sousChoixDuPlan({ occasion: "travail_formel", sousChoix: "Télétravail" })).toEqual({ workMode: "Télétravail" });
    expect(sousChoixDuPlan({ occasion: "date", sousChoix: "Verre" })).toEqual({ dateContext: "Verre" });
    expect(sousChoixDuPlan({ occasion: "date", sousChoix: "Inconnu" })).toEqual({});
    expect(sousChoixDuPlan({ occasion: "quotidien", sousChoix: null })).toEqual({});
  });
});

describe("alerteMeteoPlan — un constat sur les pièces, jamais deviné", () => {
  const sandales = piece(5, "chaussures", { shoeType: "Sandales" });
  const mocassins = piece(6, "chaussures", { shoeType: "Mocassins" });

  it("chaussures ouvertes sous la pluie", () => {
    expect(alerteMeteoPlan([sandales], { temp: 16, label: "Pluie légère" })).toMatch(/pluie/i);
    expect(alerteMeteoPlan([mocassins], { temp: 16, label: "Pluie légère" })).toBeNull();
    expect(alerteMeteoPlan([sandales], { temp: 16, label: "Ensoleillé" })).toBeNull();
  });

  it("pièce hors de ses bornes de température déclarées", () => {
    const lin = piece(7, "haut", { meteoMinTemp: 18 });
    const laine = piece(8, "pull", { meteoMaxTemp: 15 });
    expect(alerteMeteoPlan([lin], { temp: 11, label: "Nuageux" })).toBe("Il fera 11° : plus frais que ce que certaines pièces de cette tenue supportent.");
    expect(alerteMeteoPlan([laine], { temp: 24, label: "Ensoleillé" })).toMatch(/plus chaud/);
    expect(alerteMeteoPlan([lin], { temp: 20, label: "Nuageux" })).toBeNull();
    expect(alerteMeteoPlan([laine], { temp: 12, label: "Nuageux" })).toBeNull();
  });
});

describe("previsionAChange — la prévision d'aujourd'hui contre celle enregistrée à la planification", () => {
  it("vraie à partir de 3° d'écart", () => {
    expect(previsionAChange({ temp: 24, weatherLabel: "Ensoleillé" }, { temp: 21, label: "Ensoleillé" })).toBe(true);
    expect(previsionAChange({ temp: 24, weatherLabel: "Ensoleillé" }, { temp: 27, label: "Ensoleillé" })).toBe(true);
  });
  it("fausse sous 3° quand le ciel reste du même type", () => {
    expect(previsionAChange({ temp: 24, weatherLabel: "Ensoleillé" }, { temp: 22, label: "Nuageux" })).toBe(false);
  });
  it("vraie quand la pluie apparaît ou disparaît, même à température égale", () => {
    expect(previsionAChange({ temp: 18, weatherLabel: "Ensoleillé" }, { temp: 18, label: "Pluie légère" })).toBe(true);
    expect(previsionAChange({ temp: 18, weatherLabel: "Pluvieux" }, { temp: 18, label: "Ensoleillé" })).toBe(true);
  });
  it("sans prévision enregistrée, rien à comparer", () => {
    expect(previsionAChange({ temp: null, weatherLabel: null }, { temp: 10, label: "Pluie" })).toBe(false);
  });
});

describe("doitAppliquerPlan — les retouches de la personne ne sont pas annulées", () => {
  const p = { id: "t1", pieceIds: [3, 1, 2] };
  it("un plan pas encore appliqué s'applique", () => {
    expect(doitAppliquerPlan(null, p, null)).toBe(true);
  });
  it("un plan déjà appliqué ne se rejoue pas, même si la tenue affichée a changé (veste ajoutée)", () => {
    expect(doitAppliquerPlan("t1", p, clePlanApplique(p))).toBe(false);
  });
  it("un plan dont les pièces ont changé (modifié dans Planifier) se rejoue", () => {
    expect(doitAppliquerPlan("t1", { id: "t1", pieceIds: [1, 2, 4] }, clePlanApplique(p))).toBe(true);
  });
  it("l'ordre des pièces ne compte pas", () => {
    expect(clePlanApplique({ id: "t1", pieceIds: [2, 3, 1] })).toBe(clePlanApplique(p));
  });
  it("un autre plan s'applique", () => {
    expect(doitAppliquerPlan("t1", { id: "t2", pieceIds: [3, 1, 2] }, clePlanApplique(p))).toBe(true);
  });
});
