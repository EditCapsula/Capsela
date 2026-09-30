import { describe, expect, it } from "vitest";
import {
  QUESTIONS_COLORIMETRIE,
  SAISONS,
  SAISONS_CLES,
  colorimetrieDeSaison,
  colorimetrieUtilisable,
  estSaison,
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

describe("saisonDuQuestionnaire", () => {
  it("chaque saison est atteignable", () => {
    expect(
      saisonDuQuestionnaire(reponses({ bijoux: "Dorés", blanc: "Un écru", cheveux: "Blond doré", yeux: "Verts", compliments: "Des tons chauds" }))
    ).toBe("printemps");
    expect(
      saisonDuQuestionnaire(reponses({ bijoux: "Argentés", blanc: "Un blanc pur", cheveux: "Blond clair", yeux: "Bleus", compliments: "Des pastels" }))
    ).toBe("ete");
    expect(
      saisonDuQuestionnaire(reponses({ bijoux: "Dorés", blanc: "Un écru", cheveux: "Châtain", yeux: "Marron", compliments: "Des tons terreux" }))
    ).toBe("automne");
    expect(
      saisonDuQuestionnaire(reponses({ bijoux: "Argentés", blanc: "Un blanc pur", cheveux: "Brun foncé", yeux: "Marron très", compliments: "Des couleurs franches" }))
    ).toBe("hiver");
  });

  it("sans indice de chaud ou de froid, aucune saison n'est inventée", () => {
    expect(
      saisonDuQuestionnaire(reponses({ bijoux: "Je ne sais pas", blanc: "Les deux", cheveux: "Châtain", yeux: "Marron", compliments: "Je ne sais pas" }))
    ).toBeNull();
    expect(saisonDuQuestionnaire([])).toBeNull();
  });

  it("une réponse absente ou hors liste ne compte pas", () => {
    const base = reponses({ bijoux: "Dorés", blanc: "Un écru", cheveux: "Châtain", yeux: "Marron", compliments: "Des tons terreux" });
    expect(saisonDuQuestionnaire([base[0], null, 99, undefined, base[4]])).toBe("automne");
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

describe("règles du projet", () => {
  it("aucune question ne porte sur la couleur de peau", () => {
    for (const q of QUESTIONS_COLORIMETRIE) {
      const t = [q.question, ...q.reponses.map((x) => x.libelle)].join(" ").toLowerCase();
      expect(t).not.toMatch(/peau|teint|carnation/);
    }
  });

  it("aucun mot interdit dans les questions ni les saisons", () => {
    const textes = [
      ...QUESTIONS_COLORIMETRIE.flatMap((q) => [q.question, ...q.reponses.map((x) => x.libelle)]),
      ...SAISONS_CLES.flatMap((k) => [SAISONS[k].libelle, SAISONS[k].description]),
    ].map((t) => t.toLowerCase());
    for (const t of textes) for (const m of MOTS_INTERDITS) expect(t).not.toContain(m);
  });
});
