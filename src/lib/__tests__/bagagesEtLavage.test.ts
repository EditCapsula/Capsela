import { describe, expect, it } from "vitest";
import { capaciteDe, FORMATS_BAGAGE, nomBagage, NomBagage } from "../valise";
import { lavageDuMode, modeLavageDe } from "../valises";

/** Brief 2.3, points 8 et 9 (12/11/2026). */
describe("formats de bagage", () => {
  it("trois formats, aux capacités déjà arbitrées, croissantes", () => {
    expect(FORMATS_BAGAGE.map((f) => f.taille)).toEqual(["M", "L", "XL"]);
    const caps = FORMATS_BAGAGE.map((f) => capaciteDe(f.taille));
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
  });
  it("se nomment dans une phrase, la S ancienne comprise", () => {
    expect(nomBagage("M")).toBe("bagage cabine");
    expect(NomBagage("XL")).toBe("Grand bagage en soute");
    expect(nomBagage("S")).toBe("bagage cabine souple");
  });
});

describe("lavage", () => {
  it("machine et service laissent laver ; non, pas", () => {
    expect(lavageDuMode("machine")).toBe(true);
    expect(lavageDuMode("service")).toBe(true);
    expect(lavageDuMode("non")).toBe(false);
  });
  it("relit une valise d'avant (oui / non) sans perdre sa réponse", () => {
    expect(modeLavageDe({ lavage: true })).toBe("machine");
    expect(modeLavageDe({ lavage: false })).toBe("non");
    expect(modeLavageDe({})).toBeNull();
    expect(modeLavageDe({ lavage: true, modeLavage: "service" })).toBe("service");
  });
});
