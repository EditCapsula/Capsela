import { describe, expect, it } from "vitest";
import {
  QUESTIONS_COLORIMETRIE,
  SAISONS,
  SAISONS_CLES,
  colorimetrieDeSaison,
  colorimetrieUtilisable,
  estSaison,
  explicationsDesReponses,
  reponsesEnListe,
  reponsesParQuestion,
  saisonDuQuestionnaire,
} from "../colorimetrie";
import { PAL_COULEURS } from "../palCouleurs";
import { MOTS_INTERDITS } from "../../../supabase/functions/_shared/avisStyliste.ts";

// Colorimétrie en quatre saisons, par questionnaire (30/09/2026).

const HEX_PALETTE = new Set(PAL_COULEURS.map(([, h]) => h));
/** Indice de la réponse dont le libellé commence par `debut`, pour la question `id`. */
const r = (id: string, debut: string) => {
  const q = QUESTIONS_COLORIMETRIE.find((x) => x.id === id)!;
  const i = q.reponses.findIndex((x) => x.libelle.startsWith(debut));
  if (i < 0) throw new Error(`${id} : ${debut}`);
  return i;
};
/** Réponses dans l'ordre de QUESTIONS_COLORIMETRIE. */
const reponses = (o: Record<string, string>) => QUESTIONS_COLORIMETRIE.map((q) => r(q.id, o[q.id]));

describe("SAISONS — une seule table pour l'écran et le moteur", () => {
  it("quatre saisons, toutes décrites", () => {
    expect(SAISONS_CLES).toEqual(["printemps", "ete", "automne", "hiver"]);
    for (const k of SAISONS_CLES) {
      expect(SAISONS[k].libelle).toBeTruthy();
      expect(SAISONS[k].description).toBeTruthy();
    }
  });

  it("toutes les teintes sont des couleurs de la palette de l'app, sans doublon dans une saison", () => {
    for (const k of SAISONS_CLES) {
      const s = SAISONS[k];
      const toutes = [...s.signature, ...s.neutres, ...s.moderation];
      for (const h of toutes) expect(HEX_PALETTE.has(h)).toBe(true);
      expect(new Set(toutes).size).toBe(toutes.length);
    }
  });

  it("colorimetrieDeSaison rend un résultat exploitable, sans score de confiance", () => {
    for (const k of SAISONS_CLES) {
      const c = colorimetrieDeSaison(k, "questionnaire");
      expect(colorimetrieUtilisable(c)).toBe(true);
      expect(c.saison).toBe(k);
      expect(c.libelle).toBe(SAISONS[k].libelle);
      expect(c.source).toBe("questionnaire");
      // Pas de score : l'écran n'affiche jamais « Analyse fiable » pour ces chemins.
      expect(c.confiance).toBeUndefined();
    }
  });

  it("estSaison n'accepte que les quatre clés", () => {
    expect(estSaison("automne")).toBe(true);
    expect(estSaison("automne_chaud")).toBe(false);
    expect(estSaison("indetermine")).toBe(false);
    expect(estSaison(undefined)).toBe(false);
  });
});

describe("saisonDuQuestionnaire — quatre questions", () => {
  it("quatre questions, celle des compliments retirée", () => {
    expect(QUESTIONS_COLORIMETRIE.map((q) => q.id)).toEqual(["bijoux", "blanc", "cheveux", "yeux"]);
  });

  it("chaque saison est atteignable", () => {
    expect(saisonDuQuestionnaire(reponses({ bijoux: "Doré", blanc: "Un écru", cheveux: "Blond doré", yeux: "Verts" }))).toBe("printemps");
    expect(saisonDuQuestionnaire(reponses({ bijoux: "Argenté", blanc: "Un blanc pur", cheveux: "Blond clair", yeux: "Bleus" }))).toBe("ete");
    expect(saisonDuQuestionnaire(reponses({ bijoux: "Doré", blanc: "Un écru", cheveux: "Châtain", yeux: "Marron" }))).toBe("automne");
    expect(saisonDuQuestionnaire(reponses({ bijoux: "Argenté", blanc: "Un blanc pur", cheveux: "Brun foncé", yeux: "Marron très" }))).toBe("hiver");
  });

  it("sans indice de chaud ou de froid, aucune saison n'est inventée", () => {
    expect(saisonDuQuestionnaire(reponses({ bijoux: "Je ne sais pas", blanc: "Les deux", cheveux: "Châtain", yeux: "Marron" }))).toBeNull();
    expect(saisonDuQuestionnaire([])).toBeNull();
  });

  it("une réponse absente ou hors liste ne compte pas", () => {
    const base = reponses({ bijoux: "Doré", blanc: "Un écru", cheveux: "Châtain", yeux: "Marron" });
    expect(saisonDuQuestionnaire([base[0], null, 99, base[3]])).toBe("automne");
  });

  it("toutes les combinaisons rendent une saison ou null, et chaque saison en couvre une part", () => {
    const compte: Record<string, number> = {};
    const parcourir = (i: number, acc: number[]) => {
      if (i === QUESTIONS_COLORIMETRIE.length) {
        const s = saisonDuQuestionnaire(acc) ?? "null";
        compte[s] = (compte[s] ?? 0) + 1;
        return;
      }
      QUESTIONS_COLORIMETRIE[i].reponses.forEach((_, j) => parcourir(i + 1, [...acc, j]));
    };
    parcourir(0, []);
    for (const k of SAISONS_CLES) expect(compte[k]).toBeGreaterThan(0);
  });
});

describe("réponses gardées et « Pourquoi cette palette ? »", () => {
  const liste = reponses({ bijoux: "Doré", blanc: "Un écru", cheveux: "Châtain", yeux: "Marron" });

  it("aller-retour entre la liste et le profil", () => {
    const parId = reponsesParQuestion(liste);
    expect(Object.keys(parId)).toEqual(["bijoux", "blanc", "cheveux", "yeux"]);
    expect(reponsesEnListe(parId)).toEqual(liste);
    expect(reponsesEnListe(undefined)).toEqual([null, null, null, null]);
    expect(reponsesParQuestion([0, null, 99, 1])).toEqual({ bijoux: 0, yeux: 1 });
  });

  it("colorimetrieDeSaison garde les réponses, et seulement si elles existent", () => {
    expect(colorimetrieDeSaison("automne", "questionnaire", reponsesParQuestion(liste)).reponses).toEqual(reponsesParQuestion(liste));
    expect(colorimetrieDeSaison("automne", "questionnaire").reponses).toBeUndefined();
  });

  it("une explication par réponse, dans l'ordre ; rien sans réponses", () => {
    const e = explicationsDesReponses(reponsesParQuestion(liste));
    expect(e.map((x) => x.titre)).toEqual(["Tes bijoux", "Ton blanc préféré", "Tes cheveux", "Tes yeux"]);
    expect(e[0].texte).toMatch(/chaude/);
    expect(explicationsDesReponses(undefined)).toEqual([]);
    expect(explicationsDesReponses({})).toEqual([]);
  });

  it("chaque explication dit la vérité des points : chaude ⇔ chaleur > 0, froide/fraîche ⇔ chaleur < 0, neutre ⇔ rien", () => {
    for (const q of QUESTIONS_COLORIMETRIE) {
      for (const r of q.reponses) {
        const t = r.explication.toLowerCase();
        if (/chaude|chaleur/.test(t)) expect(r.chaleur).toBeGreaterThan(0);
        if (/froide|fraîche/.test(t)) expect(r.chaleur).toBeLessThan(0);
        if (/profondeur|contraste/.test(t)) expect(r.profondeur).toBeGreaterThan(0);
        if (/clart|claire/.test(t)) expect(r.profondeur).toBeLessThan(0);
        if (/neutre/.test(t)) expect([r.chaleur, r.profondeur]).toEqual([0, 0]);
        if (r.chaleur === 0 && r.profondeur === 0) expect(t).toMatch(/neutre/);
      }
    }
  });

  it("chaque réponse a sa vignette ; « Je ne sais pas » partage le lin neutre", () => {
    for (const q of QUESTIONS_COLORIMETRIE) {
      for (const r of q.reponses) {
        expect(r.visuel).toMatch(/^\/onboarding\/colorimetrie\/[a-z-]+\.webp$/);
        if (r.libelle === "Je ne sais pas") expect(r.visuel).toBe("/onboarding/colorimetrie/neutre-lin.webp");
      }
    }
  });

  it("chaque saison a son propre visuel éditorial, jamais celui d'une autre", () => {
    for (const k of SAISONS_CLES) expect(SAISONS[k].visuel).toBe(`/onboarding/colorimetrie/palette-${k}.webp`);
  });
});

describe("règles du projet", () => {
  it("aucune question ni réponse ne porte sur la couleur de peau", () => {
    for (const q of QUESTIONS_COLORIMETRIE) {
      const t = [q.question, ...q.reponses.flatMap((x) => [x.libelle, x.explication])].join(" ").toLowerCase();
      expect(t).not.toMatch(/peau|teint|carnation/);
    }
  });

  it("aucun mot interdit dans les questions, les explications ni les saisons", () => {
    const textes = [
      ...QUESTIONS_COLORIMETRIE.flatMap((q) => [q.question, q.titreExplication, q.analyse, ...q.reponses.flatMap((x) => [x.libelle, x.explication])]),
      ...SAISONS_CLES.flatMap((k) => [SAISONS[k].libelle, SAISONS[k].description, SAISONS[k].nature]),
    ].map((t) => t.toLowerCase());
    for (const t of textes) for (const m of MOTS_INTERDITS) expect(t).not.toContain(m);
  });
});
