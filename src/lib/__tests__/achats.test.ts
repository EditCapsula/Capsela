import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" } }));

import { achatsIntegresIci, droitActif, dureeDuPaquet, formulesDeLOffre } from "../achats";

describe("achats intégrés", () => {
  it("hors de l'app iOS, aucun achat proposé", () => {
    expect(achatsIntegresIci()).toBe(false);
  });
  it("seuls les paquets mensuel et annuel sont proposés", () => {
    expect(dureeDuPaquet("ANNUAL")).toBe("annuel");
    expect(dureeDuPaquet("MONTHLY")).toBe("mensuel");
    expect(dureeDuPaquet("WEEKLY")).toBeNull();
  });
  it("les formules de l'offre, annuel d'abord, prix du store", () => {
    const f = formulesDeLOffre([
      { packageType: "MONTHLY", product: { priceString: "4,99 €" } },
      { packageType: "ANNUAL", product: { priceString: "54,99 €", pricePerMonthString: "4,58 €" } },
      { packageType: "LIFETIME", product: { priceString: "99 €" } },
    ]);
    expect(f.map((x) => [x.duree, x.prix, x.prixMensuel])).toEqual([
      ["annuel", "54,99 €", "4,58 €"],
      ["mensuel", "4,99 €", null],
    ]);
  });
  it("une offre vide ne donne aucune formule", () => {
    expect(formulesDeLOffre([])).toEqual([]);
  });
  it("le droit premium actif", () => {
    expect(droitActif({ entitlements: { active: { premium: {} } } })).toBe(true);
    expect(droitActif({ entitlements: { active: {} } })).toBe(false);
    expect(droitActif(null)).toBe(false);
  });
});
