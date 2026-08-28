import { describe, expect, it } from "vitest";
import { exportFileName } from "@/lib/dataExport";

describe("exportFileName", () => {
  it("date le fichier, pour qu'un second export n'écrase pas le premier", () => {
    expect(exportFileName(new Date("2026-08-28T14:32:10Z"))).toBe("capsela-mes-donnees-2026-08-28.json");
    expect(exportFileName(new Date("2027-01-05T00:00:00Z"))).toBe("capsela-mes-donnees-2027-01-05.json");
  });

  it("ne produit que des caractères sûrs pour un système de fichiers", () => {
    // Deux points, barres obliques ou accents casseraient l'enregistrement
    // sur au moins un des systèmes visés (Windows en particulier).
    expect(exportFileName(new Date("2026-12-31T23:59:59Z"))).toMatch(/^[a-z0-9-]+\.json$/);
  });

  it("reste stable au sein d'une même journée", () => {
    const matin = exportFileName(new Date("2026-08-28T01:00:00Z"));
    const soir = exportFileName(new Date("2026-08-28T22:00:00Z"));
    expect(matin).toBe(soir);
  });
});
