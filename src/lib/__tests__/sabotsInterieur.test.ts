import { describe, expect, it } from "vitest";
import { CATALOG } from "../catalog";

// Les chaussures d'intérieur du catalogue de secours (30/10/2026) : des sabots fourrés en daim, toujours reconnus comme chaussures
// d'intérieur — sinon la capsule perd la paire qu'elle garantit pour Cocooning (capsule.ts).
describe("sabots fourrés", () => {
  it("sont des chaussures d'intérieur", () => {
    const sabots = CATALOG.find((i) => i.name === "Sabots fourrés en daim");
    expect(sabots?.shoeType).toBe("Chaussures d'intérieur");
  });
});
