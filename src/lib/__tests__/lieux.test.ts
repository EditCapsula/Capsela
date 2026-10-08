import { describe, expect, it } from "vitest";
import { ajouterRecente, libelleDestination, lireRecentes, presenterResultats, type VilleRecente } from "../lieux";
import { clePrevision, type VilleSuggeree } from "../weather";

// L'étape « Où » (08/10/2026) : des résultats lisibles, des villes récentes sans doublon, une prévision gardée par point.

const v = (name: string, country: string, state: string, lat: number, lon: number): VilleSuggeree => ({ name, country, state, lat, lon });
const ROME = [v("Rome", "IT", "Lazio", 41.9, 12.49), v("Rome", "US", "New York", 43.21, -75.45), v("Rome", "US", "Georgia", 34.25, -85.18)];

describe("presenterResultats", () => {
  it("« Rome » : le nom domine, la région n'apparaît que pour distinguer deux villes du même pays", () => {
    const r = presenterResultats(ROME);
    expect(r.map((x) => [x.principal, x.secondaire])).toEqual([
      ["Rome", "Italie"],
      ["Rome", "New York, États-Unis"],
      ["Rome", "Georgia, États-Unis"],
    ]);
    expect(r.map((x) => x.libelle)).toEqual(["Rome, Italie", "Rome, New York, États-Unis", "Rome, Georgia, États-Unis"]);
  });
  it("jamais le brut de l'API (« Rome, Lazio, Italie »), jamais deux lignes identiques", () => {
    const r = presenterResultats(ROME);
    expect(r.some((x) => x.libelle.includes("Lazio"))).toBe(false);
    expect(new Set(r.map((x) => x.libelle)).size).toBe(r.length);
  });
  it("une ville seule : « Paris / France »", () => {
    expect(presenterResultats([v("Paris", "FR", "Île-de-France", 48.85, 2.35)])[0]).toMatchObject({ principal: "Paris", secondaire: "France", libelle: "Paris, France" });
  });
  it("le libellé d'une destination suit la même règle", () => {
    expect(libelleDestination(ROME[0], ROME)).toBe("Rome, Italie");
    expect(libelleDestination(ROME[2], ROME)).toBe("Rome, Georgia, États-Unis");
    expect(libelleDestination(v("Paris", "FR", "", 48.85, 2.35))).toBe("Paris, France");
  });
});

describe("villes récentes", () => {
  const r = (name: string, lat: number): VilleRecente => ({ ...v(name, "FR", "", lat, lat), libelle: `${name}, France` });
  it("la dernière choisie en tête, six au plus", () => {
    let l: VilleRecente[] = [];
    for (let i = 0; i < 8; i++) l = ajouterRecente(l, r(`V${i}`, i * 5));
    expect(l).toHaveLength(6);
    expect(l[0].name).toBe("V7");
  });
  it("une ville déjà présente remonte en première position, sans doublon", () => {
    const l = ajouterRecente([r("A", 10), r("B", 20), r("C", 30)], r("C", 30));
    expect(l.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });
  it("lecture tolérante du stockage", () => {
    expect(lireRecentes(null)).toEqual([]);
    expect(lireRecentes("pas du json")).toEqual([]);
    expect(lireRecentes('{"a":1}')).toEqual([]);
    expect(lireRecentes('[{"name":"Rome","country":"IT","lat":41.9,"lon":12.49,"libelle":"Rome, Italie"},{"x":1}]')).toHaveLength(1);
  });
});

describe("clé de prévision", () => {
  it("un point = une clé (arrondi à 0,01) ; sans coordonnées, le nom sans casse", () => {
    expect(clePrevision("Rome", { lat: 41.9028, lon: 12.4964 })).toBe(clePrevision("Rome", { lat: 41.9031, lon: 12.4962 }));
    expect(clePrevision("Rome", { lat: 41.9, lon: 12.49 })).not.toBe(clePrevision("Rome", { lat: 43.21, lon: -75.45 }));
    expect(clePrevision(" Paris ", null)).toBe("paris");
  });
});
