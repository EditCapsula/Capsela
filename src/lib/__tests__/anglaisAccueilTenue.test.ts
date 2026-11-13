import { afterEach, describe, expect, it } from "vitest";
import { poserLangue } from "../langue";
import { complementTenue, libelleJour, libelleJourCourt } from "../jourConsulte";
import { compteAReboursCourt, periodeCourte } from "../rappelsValise";
import { texteEditorialLook } from "../editorialLook";
import type { Item } from "../types";

// L'ANGLAIS DE L'ACCUEIL ET DE MA TENUE DU JOUR, SUITE (13/11/2026) : la grammaire de l'anglais, pas un mot à mot ; le français ne change pas.
afterEach(() => poserLangue("fr"));
const mardi = new Date(2026, 10, 17);

describe("jours", () => {
  it("en anglais", () => {
    poserLangue("en");
    expect([libelleJourCourt(0, mardi), libelleJourCourt(1, mardi), libelleJourCourt(3, mardi)]).toEqual(["Today", "Tomorrow", "Tue 17"]);
    expect(libelleJour(0, mardi)).toBe("Today · Tuesday 17");
    expect(libelleJour(3, mardi)).toBe("Tuesday 17 November");
    expect([complementTenue(0, mardi), complementTenue(1, mardi), complementTenue(3, mardi)]).toEqual(["of the day", "for tomorrow", "for Tuesday 17"]);
  });
  it("le français inchangé", () => {
    expect([libelleJourCourt(0, mardi), complementTenue(0, mardi)]).toEqual(["Aujourd'hui", "du jour"]);
  });
});

describe("prochain départ", () => {
  it("le mois d'abord, et un compte à rebours en jours", () => {
    poserLangue("en");
    expect(periodeCourte("2026-11-16", "2026-11-20")).toBe("Nov 16–20");
    expect(periodeCourte("2026-11-28", "2026-12-03")).toBe("Nov 28–Dec 3");
    expect([compteAReboursCourt(1), compteAReboursCourt(3)]).toEqual(["Tomorrow", "3 days"]);
  });
});

describe("bloc éditorial", () => {
  const piece = (p: Partial<Item>): Item => ({ id: 1, name: "Blazer", cat: "veste", color: "Noir", hex: "#000", season: "Toute saison", ...p }) as Item;
  it("en anglais : registre et caractère, phrase pour l'occasion", () => {
    poserLangue("en");
    const r = texteEditorialLook([piece({ couche: "structuree" })], "travail_formel", "Présentiel", "Verre");
    expect(r.titre.b).toBe("and structured");
    expect(r.phrase).toBe("Clean lines for a day at the office.");
  });
  it("sans pièce : l'occasion seule", () => {
    poserLangue("en");
    expect(texteEditorialLook([], "cocooning", "Présentiel", "Verre")).toEqual({ titre: { a: "Your outfit", b: "of the day" }, phrase: "An outfit designed for a day at home." });
  });
});
