import { describe, expect, it } from "vitest";
import {
  NB_QUESTIONS,
  choisir,
  commencer,
  conclure,
  continuer,
  derniereQuestion,
  parcoursInitial,
  peutContinuer,
  recommencer,
  retour,
} from "../colorimetrieParcours";

// Le parcours colorimétrie de l'onboarding (30/09/2026).

const repondreTout = (indices: number[]) => {
  let p = commencer(parcoursInitial());
  for (const i of indices) p = continuer(choisir(p, i));
  return p;
};

describe("parcours colorimétrie", () => {
  it("présentation → quatre questions → analyse", () => {
    let p = parcoursInitial();
    expect(p.vue).toBe("presentation");
    p = commencer(p);
    expect([p.vue, p.question]).toEqual(["question", 0]);
    expect(NB_QUESTIONS).toBe(4);
    p = repondreTout([0, 1, 2, 2]);
    expect(p.vue).toBe("analyse");
  });

  it("« Continuer » reste sans effet tant que la question n'a pas de réponse", () => {
    const p = commencer(parcoursInitial());
    expect(peutContinuer(p)).toBe(false);
    expect(continuer(p)).toEqual(p);
    expect(peutContinuer(choisir(p, 1))).toBe(true);
  });

  it("une réponse hors liste n'est pas enregistrée", () => {
    const p = commencer(parcoursInitial());
    expect(choisir(p, 9)).toEqual(p);
  });

  it("le retour remonte d'une question, puis à la présentation, puis quitte l'étape", () => {
    let p = continuer(choisir(commencer(parcoursInitial()), 0));
    expect(p.question).toBe(1);
    p = retour(p)!;
    expect([p.vue, p.question, p.reponses[0]]).toEqual(["question", 0, 0]);
    p = retour(p)!;
    expect(p.vue).toBe("presentation");
    expect(retour(p)).toBeNull();
  });

  it("aucun retour pendant l'analyse", () => {
    const p = repondreTout([0, 1, 2, 2]);
    expect(retour(p)).toBe(p);
  });

  it("une saison : conclusion sur la dernière question, réponses intactes (le retour depuis le résultat y ramène)", () => {
    const { parcours, saison } = conclure(repondreTout([0, 1, 2, 2]));
    expect(saison).toBe("automne");
    expect([parcours.vue, parcours.question]).toEqual(["question", NB_QUESTIONS - 1]);
    expect(derniereQuestion(parcours)).toBe(true);
    expect(parcours.reponses).toEqual([0, 1, 2, 2]);
  });

  it("pas de saison nette : l'écran dédié, dont le retour ramène à la dernière question", () => {
    const { parcours, saison } = conclure(repondreTout([3, 2, 2, 2]));
    expect(saison).toBeNull();
    expect(parcours.vue).toBe("indecis");
    expect(retour(parcours)).toMatchObject({ vue: "question", question: NB_QUESTIONS - 1 });
  });

  it("reprise d'un questionnaire déjà rempli ; « Refaire » efface tout", () => {
    const p = commencer(parcoursInitial([0, 1, 2, 2]));
    expect(peutContinuer(p)).toBe(true);
    expect(recommencer()).toMatchObject({ vue: "question", question: 0, reponses: [null, null, null, null] });
  });
});
