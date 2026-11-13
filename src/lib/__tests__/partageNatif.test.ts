import { describe, expect, it } from "vitest";
import { estAnnulation } from "../partageNatif";

// LE PARTAGE DANS L'APP (13/11/2026) : refermer la feuille sans destinataire n'est ni un envoi ni un échec.
describe("estAnnulation", () => {
  it("reconnaît une feuille refermée", () => {
    expect(estAnnulation(new Error("Share canceled"))).toBe(true);
    expect(estAnnulation({ message: "Abort" })).toBe(true);
  });
  it("une vraie panne n'en est pas une", () => {
    expect(estAnnulation(new Error("File not found"))).toBe(false);
  });
});
