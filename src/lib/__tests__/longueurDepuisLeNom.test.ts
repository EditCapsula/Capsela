import { describe, expect, it } from "vitest";
import { longueurDepuisLeNom } from "../forme";

describe("longueurDepuisLeNom — une proposition relue, jamais une lecture du moteur", () => {
  it("lit la longueur du vêtement", () => {
    expect(longueurDepuisLeNom("robe", "Robe midi portefeuille")).toBe("midi");
    expect(longueurDepuisLeNom("manteau", "Manteau long en laine")).toBe("longue");
    expect(longueurDepuisLeNom("manteau", "Manteau mi-long ceinturé")).toBe("midi");
    expect(longueurDepuisLeNom("manteau", "Manteau mi long")).toBe("midi");
    expect(longueurDepuisLeNom("jupe", "Jupe courte plissée")).toBe("courte");
    expect(longueurDepuisLeNom("robe", "Robe maxi bohème")).toBe("longue");
    expect(longueurDepuisLeNom("veste", "Veste cropped en jean")).toBe("courte");
  });
  it("ignore la longueur des manches, du col, des épaules", () => {
    expect(longueurDepuisLeNom("robe", "Robe manches longues")).toBeNull();
    expect(longueurDepuisLeNom("robe", "Robe midi manches courtes")).toBe("midi");
  });
  it("sans mot, avec deux longueurs contraires, ou hors des catégories : rien", () => {
    expect(longueurDepuisLeNom("manteau", "Trench beige")).toBeNull();
    expect(longueurDepuisLeNom("robe", "Robe longue ou courte")).toBeNull();
    expect(longueurDepuisLeNom("pantalon", "Pantalon long")).toBeNull();
    expect(longueurDepuisLeNom("robe", "Robe au genou")).toBeNull();
  });
  it("lit aussi le sous-type", () => {
    expect(longueurDepuisLeNom("robe", "Robe fluide", "Robe longue")).toBe("longue");
  });
});
