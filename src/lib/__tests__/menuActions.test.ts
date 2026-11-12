import { describe, expect, it } from "vitest";
import { masquerMenuActions, menuActionsMasque, menuActionsVisible } from "../menuActions";

describe("menu d'actions flottant", () => {
  it("vit sur les pages principales, jamais sur un parcours ni sur un détail à barre d'actions", () => {
    for (const screen of ["home", "wardrobe", "capsule", "history", "tenues"] as const) expect(menuActionsVisible({ screen, masque: false, clavier: false })).toBe(true);
    for (const screen of ["planifier", "valise", "add", "piece", "createLook", "profileSetup", "welcome"] as const)
      expect(menuActionsVisible({ screen, masque: false, clavier: false })).toBe(false);
  });
  it("s'efface avec le clavier, ou quand un écran le masque", () => {
    expect(menuActionsVisible({ screen: "home", masque: false, clavier: true })).toBe(false);
    expect(menuActionsVisible({ screen: "home", masque: true, clavier: false })).toBe(false);
  });
  it("un masque posé puis retiré rend le menu", () => {
    masquerMenuActions("selection", true);
    expect(menuActionsMasque()).toBe(true);
    masquerMenuActions("selection", false);
    expect(menuActionsMasque()).toBe(false);
  });
});
