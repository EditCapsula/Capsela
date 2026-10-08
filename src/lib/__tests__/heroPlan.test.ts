import { describe, expect, it } from "vitest";
import { etatDuPlan, texteHeroPlan, titreDuPlan } from "../heroPlan";

describe("hero de l'accueil — textes d'une tenue planifiée", () => {
  it("l'état d'un plan : à venir, le jour J, passé", () => {
    expect(etatDuPlan({ jour: "2026-10-06" }, "2026-10-04")).toBe("avenir");
    expect(etatDuPlan({ jour: "2026-10-04" }, "2026-10-04")).toBe("jourJ");
    expect(etatDuPlan({ jour: "2026-10-03" }, "2026-10-04")).toBe("passe");
  });

  it("à venir : « Look planifié », prêt pour le jour de la semaine, badge date · moment", () => {
    expect(texteHeroPlan({ jour: "2026-10-11", moment: "Soirée" }, "2026-10-07")).toEqual({
      surtitre: "Look planifié",
      sousTitre: "Ton look est prêt pour dimanche.",
      badge: "Dimanche 11 oct. · Soirée",
    });
  });

  it("à venir, demain : « prêt pour demain »", () => {
    expect(texteHeroPlan({ jour: "2026-10-05", moment: "Matin" }, "2026-10-04").sousTitre).toBe("Ton look est prêt pour demain.");
  });

  it("le jour J : « Ton look du jour », selon le moment", () => {
    expect(texteHeroPlan({ jour: "2026-10-04", moment: "Soirée" }, "2026-10-04")).toEqual({
      surtitre: "Ton look du jour",
      sousTitre: "Ta silhouette pour ce soir est prête.",
      badge: "Ce soir · Soirée",
    });
    expect(texteHeroPlan({ jour: "2026-10-04", moment: "Toute la journée" }, "2026-10-04").sousTitre).toBe("Ta silhouette pour aujourd'hui est prête.");
  });

  it("le titre : l'occasion, puis la ville du lieu — sans lieu, l'occasion seule", () => {
    expect(titreDuPlan({ occasion: "soiree", lieu: "Gagny, Île-de-France, France" })).toBe("Soirée · Gagny");
    expect(titreDuPlan({ occasion: "soiree", lieu: "" })).toBe("Soirée");
  });
});
