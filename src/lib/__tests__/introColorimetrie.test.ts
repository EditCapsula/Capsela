import { describe, expect, it } from "vitest";
import { QUESTIONS_COLORIMETRIE } from "../colorimetrie";
import { RESUME_DES_QUESTIONS } from "../../components/EtapesColorimetrie";

// L'écran d'introduction décrit les questions : il ne doit jamais en dire plus, ni moins, que le parcours (13/10/2026).
describe("introduction de la colorimétrie : le résumé des questions correspond aux questions réelles", () => {
  it("quatre questions : métal, blanc, cheveux, yeux — dans cet ordre", () => {
    expect(QUESTIONS_COLORIMETRIE.map((q) => q.id)).toEqual(["bijoux", "blanc", "cheveux", "yeux"]);
  });
  it("le résumé nomme chacune, et aucune ne porte sur la peau ni sur une photo", () => {
    for (const mot of ["métal", "blanc", "cheveux", "yeux"]) expect(RESUME_DES_QUESTIONS).toContain(mot);
    expect(RESUME_DES_QUESTIONS).not.toMatch(/peau|teint|photo/i);
  });
});
