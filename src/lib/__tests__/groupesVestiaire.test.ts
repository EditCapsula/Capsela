import { describe, expect, it } from "vitest";
import { groupesDuVestiaire } from "../dressingEcran";
import type { Item } from "../types";

const item = (id: number, cat: string) => ({ id, cat, name: `p${id}`, hex: "#000000" }) as unknown as Item;

describe("catégories vides : masquées au Dressing, conservées dans les filtres de Mes pièces", () => {
  const items = [item(1, "sac"), item(2, "haut")];
  it("Dressing : seulement les groupes qui ont des pièces", () => {
    expect(groupesDuVestiaire(items, "femme").map((g) => g.id)).toEqual(["hauts", "sacs"]);
  });
  it("Mes pièces : toutes les catégories du profil, avec leur compteur (0 compris)", () => {
    const g = groupesDuVestiaire(items, "femme", { inclureVides: true });
    expect(g.length).toBe(8);
    expect(g.find((x) => x.id === "bijoux-accessoires")?.nbPieces).toBe(0);
  });
  it("dressing vide : aucune carte au Dressing, mais les catégories restent accessibles dans Mes pièces", () => {
    expect(groupesDuVestiaire([], "femme")).toEqual([]);
    expect(groupesDuVestiaire([], "femme", { inclureVides: true }).every((g) => g.nbPieces === 0)).toBe(true);
  });
  it("une section réapparaît dès qu'elle contient une pièce, et disparaît quand elle se vide", () => {
    expect(groupesDuVestiaire(items, "femme").some((g) => g.id === "bijoux-accessoires")).toBe(false);
    expect(groupesDuVestiaire([...items, item(3, "bijou")], "femme").some((g) => g.id === "bijoux-accessoires")).toBe(true);
    expect(groupesDuVestiaire(items.filter((i) => i.id !== 1), "femme").some((g) => g.id === "sacs")).toBe(false);
  });
  it("profil homme : pas de catégories de robes ou jupes vides proposées", () => {
    const ids = groupesDuVestiaire([], "homme", { inclureVides: true }).map((g) => g.id);
    expect(ids).not.toContain("robes-combinaisons");
    expect(ids).not.toContain("jupes");
  });
});
