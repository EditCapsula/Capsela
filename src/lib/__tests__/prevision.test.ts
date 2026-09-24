import { describe, expect, it } from "vitest";
import { joursCouverts, previsionPour, type Prevision } from "../prevision";

/**
 * Les créneaux sont construits en heure locale AU LIEU puis reconvertis en
 * UTC, de sorte que les tests se lisent dans le vocabulaire de la
 * fonctionnalité (« mardi 9 h à Paris ») et non en horodatages bruts.
 */
const PARIS = 7200; // UTC+2, comme OpenWeather le rend en heure d'été

function creneau(jour: string, heureLocale: number, temp: number, label: string, timezone = PARIS) {
  const [a, m, j] = jour.split("-").map(Number);
  const utc = Date.UTC(a, m - 1, j, heureLocale, 0, 0) / 1000 - timezone;
  return { ts: utc, temp, label };
}

function prevision(slots: ReturnType<typeof creneau>[], timezone = PARIS): Prevision {
  return { city: "Paris", country: "FR", timezone, slots };
}

describe("prévision — découpage en jours et en moments", () => {
  it("range chaque créneau dans le jour local du LIEU, pas en UTC", () => {
    // 00 h 30 à Paris le 29 = 22 h 30 UTC le 28. Lu en UTC, ce créneau
    // tomberait la veille : c'est exactement le défaut que `timezone` existe
    // pour éviter.
    const p = prevision([creneau("2026-09-29", 0.5, 12, "Nuageux")]);
    expect(new Date(p.slots[0].ts * 1000).getUTCDate()).toBe(28);
    expect(joursCouverts(p)).toEqual(["2026-09-29"]);
  });

  it("l'horizon est celui des créneaux reçus, jamais un nombre de jours écrit d'avance", () => {
    const jours = ["2026-09-25", "2026-09-26", "2026-09-27"];
    const p = prevision(jours.map((j) => creneau(j, 9, 15, "Nuageux")));
    expect(joursCouverts(p)).toEqual(jours);
    // Un jour au-delà de ce que l'API a rendu n'est pas extrapolé.
    expect(previsionPour(p, "2026-09-28", "Matin")).toBeNull();
  });

  it("ne retient que les créneaux de la fenêtre demandée", () => {
    const p = prevision([
      creneau("2026-09-29", 9, 10, "Nuageux"),
      creneau("2026-09-29", 15, 20, "Ensoleillé"),
      creneau("2026-09-29", 21, 14, "Nuageux"),
    ]);
    expect(previsionPour(p, "2026-09-29", "Matin")?.temp).toBe(10);
    expect(previsionPour(p, "2026-09-29", "Après-midi")?.temp).toBe(20);
    expect(previsionPour(p, "2026-09-29", "Soirée")?.temp).toBe(14);
  });

  it("« Toute la journée » couvre les trois fenêtres sans compter un créneau deux fois", () => {
    const p = prevision([
      creneau("2026-09-29", 9, 10, "Nuageux"),
      creneau("2026-09-29", 15, 20, "Ensoleillé"),
      creneau("2026-09-29", 21, 12, "Nuageux"),
    ]);
    const tout = previsionPour(p, "2026-09-29", "Toute la journée");
    expect(tout?.creneaux).toBe(3);
    expect(tout?.temp).toBe(14); // (10+20+12)/3
    expect(tout?.tempMin).toBe(10);
    expect(tout?.tempMax).toBe(20);
  });

  it("écarte les heures de nuit, qui ne relèvent d'aucun moment", () => {
    const p = prevision([creneau("2026-09-29", 3, 8, "Nuageux"), creneau("2026-09-29", 9, 14, "Nuageux")]);
    expect(previsionPour(p, "2026-09-29", "Toute la journée")?.creneaux).toBe(1);
    expect(previsionPour(p, "2026-09-29", "Toute la journée")?.temp).toBe(14);
  });

  it("rend null plutôt que la météo d'un autre moment quand la fenêtre est vide", () => {
    const p = prevision([creneau("2026-09-29", 15, 20, "Ensoleillé")]);
    expect(previsionPour(p, "2026-09-29", "Après-midi")).not.toBeNull();
    expect(previsionPour(p, "2026-09-29", "Matin")).toBeNull();
    expect(previsionPour(p, "2026-09-29", "Soirée")).toBeNull();
  });
});

describe("prévision — le libellé retenu", () => {
  it("la pluie l'emporte même minoritaire", () => {
    const p = prevision([
      creneau("2026-09-29", 9, 14, "Ensoleillé"),
      creneau("2026-09-29", 10, 14, "Ensoleillé"),
      creneau("2026-09-29", 11, 13, "Pluvieux"),
    ]);
    expect(previsionPour(p, "2026-09-29", "Matin")?.label).toBe("Pluvieux");
  });

  it("l'orage aussi — c'est le test du moteur (R-B16) qui sert, pas une seconde définition", () => {
    const p = prevision([
      creneau("2026-09-29", 13, 22, "Ensoleillé"),
      creneau("2026-09-29", 16, 21, "Orageux"),
    ]);
    expect(previsionPour(p, "2026-09-29", "Après-midi")?.label).toBe("Orageux");
  });

  it("sans pluie, le libellé le plus fréquent", () => {
    const p = prevision([
      creneau("2026-09-29", 9, 12, "Nuageux"),
      creneau("2026-09-29", 10, 13, "Ensoleillé"),
      creneau("2026-09-29", 11, 14, "Ensoleillé"),
    ]);
    expect(previsionPour(p, "2026-09-29", "Matin")?.label).toBe("Ensoleillé");
  });

  it("à fréquence égale, le plus précoce", () => {
    const p = prevision([
      creneau("2026-09-29", 9, 12, "Brumeux"),
      creneau("2026-09-29", 11, 13, "Ensoleillé"),
    ]);
    expect(previsionPour(p, "2026-09-29", "Matin")?.label).toBe("Brumeux");
  });
});

describe("prévision — un autre fuseau que celui du téléphone", () => {
  it("« mardi matin » se lit dans le fuseau du lieu", () => {
    // Tokyo, UTC+9 : 9 h là-bas le 29 correspond à 0 h UTC le 29, soit encore
    // le 28 à 20 h à New York. Le créneau doit malgré tout répondre à
    // « mardi 29, matin ».
    const p = prevision([creneau("2026-09-29", 9, 24, "Ensoleillé", 32400)], 32400);
    expect(joursCouverts(p)).toEqual(["2026-09-29"]);
    expect(previsionPour(p, "2026-09-29", "Matin")?.temp).toBe(24);
  });
});
