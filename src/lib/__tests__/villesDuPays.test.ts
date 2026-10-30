import { describe, expect, it } from "vitest";
import { villesDuPaysDabord } from "../lieux";
import type { VilleSuggeree } from "../weather";

/** LES VILLES D'UN PAYS D'ABORD (30/10/2026) : les étapes d'un road trip dont la première destination est un pays. */

const v = (name: string, country: string, lat: number): VilleSuggeree => ({ name, country, state: "", lat, lon: -23 });

describe("villesDuPaysDabord", () => {
  it("les villes du pays d'abord, puis les autres, sans doublon", () => {
    const duPays = [v("Praia", "CV", 14.93)];
    const libres = [v("Praia", "BR", -8.1), v("Praia", "CV", 14.93), v("Praia a Mare", "IT", 39.9)];
    expect(villesDuPaysDabord(duPays, libres, "cv")?.map((x) => `${x.name}/${x.country}`)).toEqual(["Praia/CV", "Praia/BR", "Praia a Mare/IT"]);
  });
  it("une recherche en échec n'efface pas l'autre ; les deux en échec : null", () => {
    expect(villesDuPaysDabord(null, [v("Mindelo", "CV", 16.9)], "CV")).toHaveLength(1);
    expect(villesDuPaysDabord(null, null, "CV")).toBeNull();
  });
});
