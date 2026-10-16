import { describe, expect, it } from "vitest";
import { SEUILS_COMMENTAIRE, commentaireDesTenues, commentaireJournal, filtrerListeJournal, statistiquesOccasions } from "../commentaireJournal";
import { OCCASIONS_EDITORIALES, TEXTES_JOURNAL } from "../occasionEditoriale";
import type { HistoryEntry, OccasionKey } from "../types";

type Occ = Exclude<OccasionKey, "all">;
/** Des tenues portées : `n` par occasion, plus `sans` tenues sans occasion notée. */
const tenues = (parOccasion: Partial<Record<Occ, number>>, sans = 0): Pick<HistoryEntry, "occasion">[] => [
  ...Object.entries(parOccasion).flatMap(([o, n]) => Array.from({ length: n as number }, () => ({ occasion: o as Occ }))),
  ...Array.from({ length: sans }, () => ({ occasion: "all" as OccasionKey })),
];

describe("les seuils, en un seul endroit", () => {
  it("valent ceux de la spécification du 16/10/2026", () => {
    expect(SEUILS_COMMENTAIRE).toEqual({
      MIN_TENUES_OBSERVATION: 5,
      MIN_TENUES_TENDANCE: 10,
      PART_DOMINANTE: 0.4,
      ECART_DOMINANT: 0.15,
      ECART_EQUILIBRE: 0.05,
      MIN_OCCASIONS_DIVERSITE: 4,
    });
  });
});

describe("règles 1 à 3 — historique vide, insuffisant, en constitution", () => {
  it("1. aucune tenue : état vide, aucune part calculée (pas de division par zéro)", () => {
    const c = commentaireDesTenues([]);
    expect(c).toMatchObject({ type: "vide", ...TEXTES_JOURNAL.vide, occasion: null, total: 0, part: null, ecart: null });
    expect(c.stats.parts).toBeNull();
  });
  it("2. de 1 à 4 tenues : « Ton Journal prend forme », aucune occasion désignée, même toutes identiques", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 1 }))).toMatchObject({ type: "insuffisant", titre: "Ton Journal prend forme", occasion: null });
    expect(commentaireDesTenues(tenues({ quotidien: 4 }))).toMatchObject({ type: "insuffisant", occasion: null });
  });
  it("3. de 5 à 9 tenues : « Ton style se dessine peu à peu », sans conclusion", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 5 }))).toMatchObject({ type: "emergent", titre: "Ton style se dessine peu à peu", occasion: null });
    expect(commentaireDesTenues(tenues({ quotidien: 9 }))).toMatchObject({ type: "emergent", occasion: null });
  });
});

describe("règle 7 — occasion dominante (au moins 40 % et 15 points d'avance, dès 10 tenues)", () => {
  it("4. 10 / 20 (50 %) contre 6 / 20 (30 %) : dominante, avec le texte de l'occasion", () => {
    const c = commentaireDesTenues(tenues({ quotidien: 10, travail_formel: 6, soiree: 4 }));
    expect(c).toMatchObject({ type: "dominant", occasion: "quotidien", libelleOccasion: "Quotidien", compte: 10, total: 20, ...OCCASIONS_EDITORIALES.quotidien.dominante });
    expect(c.part).toBeCloseTo(0.5);
    expect(c.ecart).toBeCloseTo(0.2);
  });
  it("5. 40 % exactement (8 / 20, deuxième à 25 %) : dominante ; 35 % (7 / 20) ne l'est pas", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 8, travail_formel: 5, soiree: 4, sport: 3 }))).toMatchObject({ type: "dominant", occasion: "quotidien" });
    expect(commentaireDesTenues(tenues({ quotidien: 7, travail_formel: 3, soiree: 2 }, 8)).type).not.toBe("dominant");
  });
  it("6. 15 points d'avance exactement (9 / 20 = 45 % contre 6 / 20 = 30 %) : dominante ; 12,5 points (18 / 40 contre 13 / 40) ne l'est pas", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 9, travail_formel: 6, soiree: 5 }))).toMatchObject({ type: "dominant", occasion: "quotidien" });
    expect(commentaireDesTenues(tenues({ quotidien: 18, travail_formel: 13, soiree: 9 }))).toMatchObject({ type: "en_tete", occasion: "quotidien" });
  });
  it("le sport en tête, nettement : sa variante propre", () => {
    expect(commentaireDesTenues(tenues({ sport: 12, quotidien: 4, cocooning: 4 }))).toMatchObject({ type: "dominant", occasion: "sport", titre: "Le confort en mouvement" });
  });
  it("une seule occasion représentée : dominante, sans prétendre qu'on ne porte rien d'autre", () => {
    const c = commentaireDesTenues(tenues({ voyage: 10 }));
    expect(c).toMatchObject({ type: "dominant", occasion: "voyage", compte: 10, total: 10 });
    expect(c.description).not.toMatch(/uniquement|seulement|toujours/);
  });
});

describe("règles 4 à 6 — égalités et équilibre (prioritaires sur la domination)", () => {
  it("7. 5 points d'écart exactement (7 / 20 = 35 % contre 6 / 20 = 30 %) : équilibrée, même avec 4 occasions", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 7, travail_formel: 6, soiree: 4, sport: 3 }))).toMatchObject({ type: "equilibre", ...TEXTES_JOURNAL.equilibre, occasion: null });
  });
  it("8. égalité exacte entre deux occasions (5 / 10 et 5 / 10) : équilibrée, aucune gagnante", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 5, travail_formel: 5 }))).toMatchObject({ type: "equilibre", occasion: null });
  });
  it("9. égalité exacte entre trois occasions (4 / 12 chacune) : diversifiée", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 4, travail_formel: 4, soiree: 4 }))).toMatchObject({ type: "diversifie", ...TEXTES_JOURNAL.diversifie, occasion: null });
  });
  it("à égalité, le résultat ne dépend pas de l'ordre des tenues", () => {
    const a = tenues({ soiree: 6, quotidien: 6, sport: 2 });
    expect(commentaireDesTenues([...a].reverse())).toEqual(commentaireDesTenues(a));
    expect(statistiquesOccasions(a).classement.map((c) => c.occasion)).toEqual(["quotidien", "soiree", "sport"]);
  });
});

describe("règles 8 et 9 — diversifiée, en tête", () => {
  it("10. quatre occasions, sans dominante ni équilibre (7 / 20 = 35 %, deuxième 25 %) : diversifiée", () => {
    expect(commentaireDesTenues(tenues({ quotidien: 7, soiree: 5, travail_formel: 4, sport: 4 }))).toMatchObject({ type: "diversifie", occasion: null });
  });
  it("11. 35 % contre 25 %, trois occasions : en tête, chiffres dans la description", () => {
    const c = commentaireDesTenues(tenues({ quotidien: 7, travail_formel: 5, soiree: 4 }, 4));
    expect(c).toMatchObject({ type: "en_tete", occasion: "quotidien", compte: 7, total: 20, titre: "Le quotidien revient le plus souvent" });
    expect(c.description).toBe("Avec 7 tenues sur 20, le quotidien est l'occasion la plus représentée dans ton Journal.");
  });
  it("en tête avec une seule tenue : « 1 tenue », au singulier", () => {
    const c = commentaireDesTenues(tenues({ soiree: 1 }, 11));
    expect(c).toMatchObject({ type: "en_tete", occasion: "soiree", compte: 1, total: 12 });
    expect(c.description).toBe("Avec 1 tenue sur 12, les soirées sont l'occasion la plus représentée dans ton Journal.");
  });
});

describe("tenues sans occasion, données incomplètes", () => {
  it("12. des tenues sans occasion comptent dans le total, dans aucune occasion (6 / 10 = 60 %)", () => {
    const c = commentaireDesTenues(tenues({ quotidien: 6 }, 4));
    expect(c).toMatchObject({ type: "dominant", occasion: "quotidien", compte: 6, total: 10 });
    expect(c.part).toBeCloseTo(0.6);
    expect(c.stats.avecOccasion).toBe(6);
  });
  it("13. aucune tenue avec une occasion : le secours, quel que soit le nombre de tenues", () => {
    expect(commentaireDesTenues(tenues({}, 12))).toMatchObject({ type: "secours", ...TEXTES_JOURNAL.secours, occasion: null, total: 12, part: null });
    expect(commentaireDesTenues(tenues({}, 3))).toMatchObject({ type: "secours", total: 3 });
  });
  it("20. occasions absentes ou inconnues : ignorées, jamais de NaN", () => {
    const brut = [{ occasion: undefined }, { occasion: null }, { occasion: "festive_inconnue" }, ...tenues({ travail_formel: 10 })] as unknown as Pick<HistoryEntry, "occasion">[];
    const c = commentaireDesTenues(brut);
    expect(c).toMatchObject({ type: "dominant", occasion: "travail_formel", compte: 10, total: 13 });
    expect(Number.isNaN(c.part)).toBe(false);
    expect(Object.values(c.stats.parts!).every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("14. les trois périodes du Journal", () => {
  const NOW = new Date(2026, 9, 16, 12, 0);
  const le = (j: number, m: number, occasion: Occ, id: string): HistoryEntry => ({ id, ts: new Date(2026, m, j, 9).getTime(), pieceIds: [1], occasion });
  // Juin : 12 tenues sport ; août : 6 quotidien ; octobre : 6 travail et 6 soirée.
  const histo = [
    ...Array.from({ length: 12 }, (_, k) => le(1 + k, 5, "sport", `j${k}`)),
    ...Array.from({ length: 6 }, (_, k) => le(1 + k, 7, "quotidien", `a${k}`)),
    ...Array.from({ length: 6 }, (_, k) => le(1 + k, 9, "travail_formel", `ot${k}`)),
    ...Array.from({ length: 6 }, (_, k) => le(7 + k, 9, "soiree", `os${k}`)),
  ];
  it("tout est recalculé sur la période choisie", () => {
    expect(commentaireJournal(histo, "mois", NOW)).toMatchObject({ type: "equilibre", total: 12 });
    // Août à octobre : 18 tenues, trois occasions à 6 → égalité à trois.
    expect(commentaireJournal(histo, "trois_mois", NOW)).toMatchObject({ type: "diversifie", total: 18 });
    // Depuis le début : sport 12 / 30 = 40 %, deuxième 6 / 30 = 20 % → dominant.
    expect(commentaireJournal(histo, "tout", NOW)).toMatchObject({ type: "dominant", occasion: "sport", compte: 12, total: 30 });
  });
  it("17. seules les tenues portées comptent : le moteur ne lit que l'historique (une tenue proposée n'y entre jamais)", () => {
    expect(commentaireJournal(histo, "tout", NOW).total).toBe(histo.length);
  });
});

describe("15 et 16. la liste ouverte par le bouton de la carte", () => {
  const NOW = new Date(2026, 9, 16, 12, 0);
  const e = (id: string, m: number, occasion: OccasionKey) => ({ id, ts: new Date(2026, m, 3).getTime(), occasion });
  const entrees = [e("o-q", 9, "quotidien"), e("o-t", 9, "travail_formel"), e("s-q", 8, "quotidien"), e("j-q", 5, "quotidien")];
  it("15. l'occasion ET la période du Journal", () => {
    expect(filtrerListeJournal(entrees, "quotidien", "mois", NOW).map((x) => x.id)).toEqual(["o-q"]);
    expect(filtrerListeJournal(entrees, "quotidien", "trois_mois", NOW).map((x) => x.id)).toEqual(["o-q", "s-q"]);
    expect(filtrerListeJournal(entrees, "quotidien", "tout", NOW).map((x) => x.id)).toEqual(["o-q", "s-q", "j-q"]);
  });
  it("16. « Tout afficher » retire la période, jamais l'occasion", () => {
    expect(filtrerListeJournal(entrees, "quotidien", null, NOW).map((x) => x.id)).toEqual(["o-q", "s-q", "j-q"]);
    expect(filtrerListeJournal(entrees, "toutes", null, NOW)).toHaveLength(4);
  });
});

describe("la bibliothèque — 8 occasions, longueurs, ton", () => {
  const occasions = Object.keys(OCCASIONS_EDITORIALES) as Occ[];
  const remplir = (s: string) => s.replace("{tenues}", "9999 tenues").replace("{total}", "9999");
  const textes = [
    ...occasions.flatMap((o) => [OCCASIONS_EDITORIALES[o].dominante, OCCASIONS_EDITORIALES[o].enTete]),
    ...Object.values(TEXTES_JOURNAL),
  ];
  it("les huit occasions ont leurs deux variantes et un bouton rédigé", () => {
    expect(occasions).toHaveLength(8);
    for (const o of occasions) {
      const t = OCCASIONS_EDITORIALES[o];
      expect(t.dominante.titre && t.dominante.description && t.enTete.titre && t.enTete.description && t.cta, o).toBeTruthy();
      expect(t.enTete.description, o).toMatch(/\{tenues\} sur \{total\}/);
      expect(t.dominante.description, o).not.toMatch(/\{|\d/);
    }
  });
  it("19. titres de 45 caractères au plus, descriptions de 160 au plus (chiffres à 4 positions compris)", () => {
    for (const t of textes) {
      expect(t.titre.length, t.titre).toBeLessThanOrEqual(45);
      expect(remplir(t.description).length, t.description).toBeLessThanOrEqual(160);
    }
  });
  it("18. formulations neutres en genre ; « préféré » jamais dans une description", () => {
    const marques = /\b(prête?s?|seule?s?|ravie?s?|habillée?s?|élégante|heureux|heureuse|fière?|sportive?|amoureuse?|célibataire)\b/i;
    for (const t of textes) {
      expect(t.titre, t.titre).not.toMatch(marques);
      expect(t.description, t.description).not.toMatch(marques);
      expect(t.description, t.description).not.toMatch(/préféré/i);
    }
  });
});
