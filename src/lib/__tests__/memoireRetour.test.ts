import { describe, expect, it, vi } from "vitest";
import { estUnRetour, marquerRetour } from "../memoireEcrans";

// 14/11/2026 : seul un retour reprend le contexte d'un écran ; le drapeau ne survit pas à l'appui qui l'a posé.
describe("marquerRetour", () => {
  it("vaut le temps de l'appui, puis s'efface", () => {
    vi.useFakeTimers();
    expect(estUnRetour()).toBe(false);
    marquerRetour();
    expect(estUnRetour()).toBe(true);
    vi.runAllTimers();
    expect(estUnRetour()).toBe(false);
    vi.useRealTimers();
  });
});
