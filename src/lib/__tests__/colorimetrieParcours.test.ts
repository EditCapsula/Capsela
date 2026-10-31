import { describe, expect, it } from "vitest";
import {
  NB_QUESTIONS,
  QUESTIONS_POUR_AFFINER,
  QUESTIONS_PRINCIPALES,
  analyser,
  choisir,
  conclure,
  parcoursInitial,
  peutAnalyser,
  recommencer,
  retour,
} from "../colorimetrieParcours";
import { QUESTIONS_COLORIMETRIE, saisonDuQuestionnaire } from "../colorimetrie";

// Le parcours colorimétrie de l'onboarding, sur un seul écran depuis le 31/10/2026 (lot 3).

const ordre = (ids: number[]) => ids.map((i) => QUESTIONS_COLORIMETRIE[i].id);
/** Réponses données par identifiant de question : { cheveux: 2, yeux: 1 }. */
const avec = (r: Record<string, number>) => {
  let p = parcoursInitial();
  for (const [id, indice] of Object.entries(r)) p = choisir(p, QUESTIONS_COLORIMETRIE.findIndex((q) => q.id === id), indice);
  return p;
};

describe("parcours colorimétrie sur un écran", () => {
  it("les quatre questions restent ; cheveux et yeux d'abord, bijoux et blanc pour affiner", () => {
    expect(NB_QUESTIONS).toBe(4);
    expect(ordre(QUESTIONS_PRINCIPALES)).toEqual(["cheveux", "yeux"]);
    expect(ordre(QUESTIONS_POUR_AFFINER)).toEqual(["bijoux", "blanc"]);
    expect(parcoursInitial().vue).toBe("formulaire");
  });

  it("« Analyser ma palette » attend cheveux ET yeux ; « Je ne sais pas » est une réponse ; bijoux et blanc sont facultatifs", () => {
    expect(peutAnalyser(avec({ cheveux: 2 }))).toBe(false);
    expect(analyser(avec({ cheveux: 2 })).vue).toBe("formulaire");
    const nsp = QUESTIONS_COLORIMETRIE.find((q) => q.id === "yeux")!.reponses.length - 1;
    expect(peutAnalyser(avec({ cheveux: 2, yeux: nsp }))).toBe(true);
    expect(analyser(avec({ cheveux: 2, yeux: 1 })).vue).toBe("analyse");
  });

  it("une réponse par question ; la toucher de nouveau la retire ; une réponse hors liste n'est pas enregistrée", () => {
    const i = QUESTIONS_PRINCIPALES[0];
    let p = choisir(parcoursInitial(), i, 1);
    p = choisir(p, i, 2);
    expect(p.reponses[i]).toBe(2);
    expect(choisir(p, i, 2).reponses[i]).toBeNull();
    expect(choisir(p, i, 99)).toEqual(p);
  });

  it("le retour quitte l'étape depuis le formulaire ; aucun retour pendant l'analyse", () => {
    expect(retour(parcoursInitial())).toBeNull();
    const a = analyser(avec({ cheveux: 2, yeux: 1 }));
    expect(retour(a)).toBe(a);
  });

  it("une saison : retour au formulaire, réponses intactes", () => {
    const p = analyser(avec({ bijoux: 0, blanc: 1, cheveux: 2, yeux: 2 }));
    const { parcours, saison } = conclure(p);
    expect(saison).toBe("automne");
    expect(parcours.vue).toBe("formulaire");
    expect(parcours.reponses).toEqual(p.reponses);
  });

  it("pas de saison nette : l'écran dédié, dont le retour ramène au formulaire", () => {
    const { parcours, saison } = conclure(analyser(avec({ cheveux: 2, yeux: 2 })));
    expect(saison).toBeNull();
    expect(parcours.vue).toBe("indecis");
    expect(retour(parcours)).toMatchObject({ vue: "formulaire" });
  });

  it("les règles de saison ne changent pas : mêmes réponses, même saison qu'avant le lot 3", () => {
    // Indices dans l'ordre de QUESTIONS_COLORIMETRIE (bijoux, blanc, cheveux, yeux), comme le stocke le profil.
    expect(saisonDuQuestionnaire([0, 1, 2, 2])).toBe("automne");
    expect(saisonDuQuestionnaire([1, 0, 0, 0])).toBe("ete");
    expect(saisonDuQuestionnaire([3, 2, 2, 2])).toBeNull();
  });

  it("« Je ne sais pas » existe pour chaque question, en dernier (indices déjà enregistrés inchangés), et reste neutre", () => {
    for (const q of QUESTIONS_COLORIMETRIE) {
      const nsp = q.reponses[q.reponses.length - 1];
      expect(nsp.libelle).toBe("Je ne sais pas");
      expect([nsp.chaleur, nsp.profondeur]).toEqual([0, 0]);
    }
    const cheveux = QUESTIONS_COLORIMETRIE.find((q) => q.id === "cheveux")!;
    expect(cheveux.reponses.slice(0, 4).map((r) => r.libelle)).toEqual(["Blond clair ou cendré", "Blond doré, roux ou cuivré", "Châtain", "Brun foncé ou noir"]);
  });

  it("reprise de réponses déjà enregistrées ; « Refaire » efface tout", () => {
    const p = parcoursInitial([0, 1, 2, 2]);
    expect(peutAnalyser(p)).toBe(true);
    expect(recommencer()).toMatchObject({ vue: "formulaire", reponses: [null, null, null, null] });
  });
});
