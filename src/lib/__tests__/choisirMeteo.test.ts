import { describe, expect, it } from "vitest";
import { choisirMeteo } from "../weather";
import type { City } from "../types";

const c = (city: string, temp: number): City => ({ city, country: "FR", temp, label: "Nuageux" });
const defauts = [c("Paris", 24), c("Lyon", 27)];
const base = { live: null, ville: null, derniere: null, geoActive: true, villeProfil: "Sens", defauts };

describe("choisirMeteo — d'où vient la météo", () => {
  it("la position en direct prime sur tout", () => {
    expect(choisirMeteo({ ...base, live: c("Auxerre", 14), ville: c("Sens", 15), derniere: c("Dijon", 20) })).toMatchObject({
      source: "position",
      city: { city: "Auxerre", temp: 14 },
    });
  });

  it("sans position, la VRAIE météo de la ville du profil passe avant la dernière position", () => {
    // La dernière position porte la température du jour où elle a été
    // enregistrée : périmée. La ville vient d'être interrogée.
    expect(choisirMeteo({ ...base, ville: c("Sens", 15), derniere: c("Dijon", 20) })).toMatchObject({ source: "ville", city: { temp: 15 } });
  });

  it("géolocalisation échouée et ville injoignable : la dernière position sert de repli", () => {
    expect(choisirMeteo({ ...base, derniere: c("Dijon", 20) }).source).toBe("derniere_position");
  });

  it("météo de position DÉSACTIVÉE : la dernière position n'est jamais utilisée", () => {
    expect(choisirMeteo({ ...base, geoActive: false, derniere: c("Dijon", 20) }).source).toBe("defaut");
  });

  it("rien de disponible : valeurs par défaut, mais la ville affichée reste celle du profil", () => {
    const r = choisirMeteo(base);
    expect(r.source).toBe("defaut");
    expect(r.city.city).toBe("Sens");
  });

  it("ville du profil présente dans la liste : ses valeurs par défaut, pas celles de Paris", () => {
    expect(choisirMeteo({ ...base, villeProfil: "Lyon" }).city).toMatchObject({ city: "Lyon", temp: 27 });
  });
});
