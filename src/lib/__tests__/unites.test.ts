import { afterEach, describe, expect, it } from "vitest";
import { degres, degresUnite, definirSystemeUnites, systemeUnites, temperatureAffichee } from "../unites";

afterEach(() => definirSystemeUnites("metric"));

describe("unités d'affichage des températures", () => {
  it("par défaut, les degrés Celsius, arrondis", () => {
    expect(systemeUnites()).toBe("metric");
    expect(degres(17.4)).toBe("17°");
    expect(degresUnite(17.6)).toBe("18 °C");
  });

  it("en impérial, les degrés Fahrenheit", () => {
    definirSystemeUnites("imperial");
    expect(temperatureAffichee(0)).toBe(32);
    expect(temperatureAffichee(100)).toBe(212);
    expect(degres(17)).toBe("63°");
    expect(degresUnite(-5, undefined, " ")).toBe("23 °F");
  });

  it("une valeur inconnue revient au métrique", () => {
    definirSystemeUnites("imperial");
    definirSystemeUnites(undefined);
    expect(degres(20)).toBe("20°");
  });
});
