import { describe, expect, it } from "vitest";
import {
  allegement,
  alternatives,
  amplitudePrevue,
  BAGAGES,
  conseilMeteo,
  occasionsCouvertes,
  occasionsDeLaPiece,
  occasionsDuLook,
  resumeLook,
  capaciteDe,
  composerValise,
  etatJauge,
  generateurMoteur,
  joursDuSejour,
  libelleDuree,
  looksDeLaValise,
  looksParPiece,
  nbPolyvalentes,
  occasionsDuSejour,
  occasionsRetenues,
  situationsDuSejour,
  type Generateur,
  type MeteoJour,
  type SituationValise,
} from "../valise";
import { item } from "./fixtures";
import type { CategoryKey, Item } from "../types";
import type { CatalogItem } from "../catalog";

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 });

const meteo = (jour: string, temp = 20, label = "Ensoleillé", prevue = false): MeteoJour => ({ jour, temp, label, prevue });

describe("valise — bagages, séjours, dates", () => {
  it("capacités arbitrées : S 8, M 12, L 18, XL 24", () => {
    expect(["S", "M", "L", "XL"].map((t) => capaciteDe(t as "S"))).toEqual([8, 12, 18, 24]);
    // Libellés du brief de refonte : plus de « Grande soute » (lu « Grande suite »).
    expect(BAGAGES.map(([, l]) => l)).toEqual(["Cabine souple", "Cabine", "Grande valise", "Très grande valise"]);
  });

  it("le type de séjour ne fait que présélectionner des occasions", () => {
    expect(occasionsDuSejour("professionnel")).toEqual(["travail_formel"]);
    expect(occasionsDuSejour("autre")).toEqual([]);
    expect(occasionsDuSejour(null)).toEqual([]);
  });

  it("question passée : la présélection du séjour, sinon le quotidien", () => {
    expect(occasionsRetenues(["date"], "city_break")).toEqual(["date"]);
    expect(occasionsRetenues([], "city_break")).toEqual(["quotidien", "soiree"]);
    expect(occasionsRetenues([], "autre")).toEqual(["quotidien"]);
  });

  it("jours du séjour, départ et retour compris, y compris au changement de mois", () => {
    expect(joursDuSejour("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(joursDuSejour("2026-10-16", "2026-10-16")).toEqual(["2026-10-16"]);
    expect(joursDuSejour("2026-10-01", "2026-12-31")).toHaveLength(21);
    expect(libelleDuree(5)).toBe("5 jours · 4 nuits");
    expect(libelleDuree(2)).toBe("2 jours · 1 nuit");
    expect(libelleDuree(1)).toBe("1 jour");
  });
});

describe("situationsDuSejour — une occasion sous une météo", () => {
  it("les jours de même météo ne font qu'une situation par occasion", () => {
    const s = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16"), meteo("2026-10-17", 21), meteo("2026-10-18", 12, "Pluvieux")]);
    expect(s).toHaveLength(4);
    expect(s[0].jours).toEqual(["2026-10-16", "2026-10-17"]);
    expect(s.map((x) => x.occasion)).toEqual(["quotidien", "quotidien", "soiree", "soiree"]);
  });

  it("amplitude : seulement les jours réellement prévus", () => {
    expect(amplitudePrevue([meteo("2026-10-16", 16, "Nuageux", true), meteo("2026-10-17", 24, "Ensoleillé", true), meteo("2026-10-18", 30)])).toEqual({ min: 16, max: 24, jours: 2 });
    expect(amplitudePrevue([meteo("2026-10-16")])).toBeNull();
  });
});

// Générateur de test : chaque situation a sa liste de tenues, servies en boucle.
const fauxGenerateur = (parOccasion: Record<string, number[][]>): Generateur => {
  const compteurs = new Map<string, number>();
  return (pool, s) => {
    const possibles = (parOccasion[s.occasion] ?? []).filter((ids) => ids.every((id) => pool.some((p) => p.id === id)));
    if (!possibles.length) return null;
    const n = compteurs.get(s.occasion) ?? 0;
    compteurs.set(s.occasion, n + 1);
    return { ids: possibles[n % possibles.length], elargie: false };
  };
};

// 1-3 hauts, 4-5 bas, 6 robe, 7-8 chaussures, 9 veste
const DRESSING = [
  piece(1, "haut"), piece(2, "haut"), piece(3, "haut"),
  piece(4, "pantalon"), piece(5, "jean"),
  piece(6, "robe"),
  piece(7, "chaussures"), piece(8, "chaussures"),
  piece(9, "veste"),
];
const S1 = (occasions: SituationValise["occasion"][]) => situationsDuSejour(occasions, [meteo("2026-10-16")]);

describe("composerValise — plus de looks, moins de pièces", () => {
  it("couvre chaque situation avec le moins de pièces nouvelles", () => {
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7]], soiree: [[6, 8], [1, 4, 8]] });
    const r = composerValise(DRESSING, S1(["quotidien", "soiree"]), 12, gen);
    // Soirée : [1,4,8] n'ajoute qu'une pièce à la tenue du quotidien, la robe en ajoutait deux.
    expect(r.pieceIds.sort()).toEqual([1, 4, 7, 8]);
    expect(r.situationsSansLook).toEqual([]);
  });

  it("un look par jour atteint, n'enrichit que si une pièce rapporte au moins deux looks", () => {
    // Un seul jour : le premier look suffit, et aucune pièce ne rapporte 2 looks à elle seule.
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7], [2, 4, 7], [3, 4, 7], [1, 5, 7]] });
    const r = composerValise(DRESSING, S1(["quotidien"]), 12, gen);
    expect(r.pieceIds.sort()).toEqual([1, 4, 7]);
  });

  it("moins d'un look par jour : enrichit dès qu'une pièce rapporte un look", () => {
    const trois = situationsDuSejour(["quotidien"], [meteo("2026-10-16"), meteo("2026-10-17"), meteo("2026-10-18")]);
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7], [1, 5, 7], [2, 5, 7], [3, 5, 7], [2, 4, 7]] });
    const r = composerValise(DRESSING, trois, 12, gen);
    // Le haut 2 et le jean ouvrent 3 looks pour 2 pièces : 4 looks pour 3 jours,
    // puis le haut 3 n'en rapporterait qu'un — il reste au placard.
    expect(r.pieceIds.sort()).toEqual([1, 2, 4, 5, 7]);
    expect(r.looks).toHaveLength(4);
  });

  it("jamais au-delà de la capacité : une situation qui n'y tient pas reste sans look", () => {
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7]], soiree: [[6, 8]] });
    const r = composerValise(DRESSING, S1(["quotidien", "soiree"]), 4, gen);
    expect(r.pieceIds.length).toBeLessThanOrEqual(4);
    expect(r.situationsSansLook).toHaveLength(1);
  });

  it("une pièce dans aucun look final ne reste pas dans la valise", () => {
    // Tirée dans le dressing entier, la tenue porte un foulard (18, accessoire :
    // même look au sens des pièces principales) ; tirée dans la valise, le
    // moteur la rend sans lui. Le foulard n'est dans aucun look : il reste au placard.
    const avecFoulard = [...DRESSING, piece(18, "accessoire")];
    const gen: Generateur = (pool) => ({ ids: pool.length > 5 ? [1, 4, 7, 18] : [1, 4, 7], elargie: false });
    const r = composerValise(avecFoulard, S1(["quotidien"]), 12, gen, 3);
    expect(r.looks.map((l) => l.ids)).toEqual([[1, 4, 7]]);
    expect(r.pieceIds.sort()).toEqual([1, 4, 7]);
  });

  it("dressing sans tenue possible : valise vide, tout est dit sans look", () => {
    const r = composerValise([piece(7, "chaussures")], S1(["quotidien"]), 12, fauxGenerateur({}));
    expect(r.pieceIds).toEqual([]);
    expect(r.looks).toEqual([]);
    expect(r.situationsSansLook).toEqual([0]);
  });
});

describe("looksDeLaValise — retirer une pièce recompte les looks", () => {
  it("les looks qui en dépendaient disparaissent, les autres restent", () => {
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7], [2, 4, 7]] });
    const s = S1(["quotidien"]);
    const avant = looksDeLaValise([1, 2, 4, 7], DRESSING, s, gen);
    expect(avant.looks).toHaveLength(2);
    const apres = looksDeLaValise([1, 4, 7], DRESSING, s, gen, avant.looks);
    expect(apres.looks.map((l) => l.ids)).toEqual([[1, 4, 7]]);
  });

  it("pièces par look et polyvalentes (≥ 3 looks)", () => {
    const looks = [[1, 4, 7], [2, 4, 7], [3, 4, 7], [1, 5, 8]].map((ids) => ({ ids, situations: [0], elargie: false }));
    expect(looksParPiece(looks).get(4)).toBe(3);
    expect(nbPolyvalentes(looks)).toBe(2); // 4 et 7
  });
});

describe("etatJauge — les 4 états", () => {
  it("légère, optimisée, presque pleine, dépassée", () => {
    expect(etatJauge(6, 12)).toBe("legere");
    expect(etatJauge(10, 12)).toBe("optimisee");
    expect(etatJauge(12, 12)).toBe("presque_pleine");
    expect(etatJauge(13, 12)).toBe("depassee");
  });
});

describe("avec le vrai moteur — toutes les pièces viennent du dressing, chaque look est complet", () => {
  it("valise cohérente sur un dressing réaliste (aléa fixé)", () => {
    const vrai = Math.random;
    let n = 7;
    Math.random = () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
    try {
      const dressing: CatalogItem[] = [
        item({ id: 1, category: "hauts", name: "T-shirt blanc" }),
        item({ id: 2, category: "hauts", name: "Chemise écrue", sous_type: "Chemise" }),
        item({ id: 3, category: "pulls_gilets", name: "Pull fin camel" }),
        item({ id: 4, category: "pantalons", name: "Pantalon large sable" }),
        item({ id: 5, category: "jeans", name: "Jean droit brut" }),
        item({ id: 6, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets" }),
        item({ id: 7, category: "chaussures", name: "Mocassins bruns", sous_type: "Mocassins" }),
        item({ id: 8, category: "sacs", name: "Cabas cuir" }),
      ];
      const s = situationsDuSejour(["quotidien"], [meteo("2026-10-16", 18, "Nuageux"), meteo("2026-10-17", 18, "Nuageux")]);
      const r = composerValise(dressing, s, 12, generateurMoteur([], "femme"));
      expect(r.pieceIds.length).toBeGreaterThan(0);
      expect(r.pieceIds.length).toBeLessThanOrEqual(12);
      expect(r.situationsSansLook).toEqual([]);
      const ids = new Set(dressing.map((d) => d.id));
      for (const l of r.looks) {
        expect(l.ids.every((id) => r.pieceIds.includes(id) && ids.has(id))).toBe(true);
      }
    } finally {
      Math.random = vrai;
    }
  });
});

describe("ajuster — allègement et remplacement", () => {
  it("allège en retirant d'abord ce qui sert le moins", () => {
    const looks = [[1, 4, 7], [2, 4, 7], [3, 4, 7], [1, 5, 7]].map((ids) => ({ ids, situations: [0], elargie: false }));
    // 7 pièces, capacité 5 : deux à retirer — d'abord 9 (dans aucun look), puis 2 (un seul look, la première à égalité).
    expect(allegement([1, 2, 3, 4, 5, 7, 9], looks, 5)).toEqual([
      { id: 9, looksPerdus: 0 },
      { id: 2, looksPerdus: 1 },
    ]);
    expect(allegement([1, 4, 7], looks, 12)).toEqual([]);
  });

  it("remplacer : les pièces du même groupe absentes, classées par looks obtenus", () => {
    const gen = fauxGenerateur({ quotidien: [[1, 4, 7], [2, 4, 7], [2, 5, 7]] });
    const alt = alternatives(1, [1, 4, 7], DRESSING, S1(["quotidien"]), gen);
    // Hauts absents de la valise : 2 et 3. Avec 2 à la place de 1 : le look 2-4-7 existe ; avec 3 : aucun.
    expect(alt.map((a) => a.item.id)).toEqual([2, 3]);
    expect(alt[0].looks).toBe(1);
    expect(alt[1].looks).toBe(0);
  });
});

describe("présentation du résultat — ce que l'écran affiche", () => {
  const situations = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
  const looks = [
    { ids: [1, 4, 7], situations: [0], elargie: false },
    { ids: [1, 5, 8], situations: [0, 1], elargie: false },
  ];

  it("occasions d'un look, couvertes par la valise, et d'une pièce", () => {
    expect(occasionsDuLook(looks[1], situations)).toEqual(["quotidien", "soiree"]);
    expect(occasionsCouvertes(looks, situations)).toEqual(["quotidien", "soiree"]);
    expect(occasionsDeLaPiece(4, looks, situations)).toEqual(["quotidien"]);
    expect(occasionsDeLaPiece(1, looks, situations)).toEqual(["quotidien", "soiree"]);
  });

  it("le nom d'un look dit ce qu'il contient, sans rien inventer", () => {
    const robe: Item = { ...piece(6, "robe"), subtype: "Chemise" };
    const baskets: Item = { ...piece(7, "chaussures"), shoeType: "Baskets" };
    expect(resumeLook([baskets, piece(16, "sac"), robe, piece(9, "veste")])).toBe("Chemise · veste · baskets · sac");
    expect(resumeLook([piece(1, "haut"), piece(4, "pantalon")])).toBe("Haut · pantalon");
    expect(resumeLook([])).toBe("");
  });

  it("le conseil météo ne parle que des jours prévus", () => {
    expect(conseilMeteo([meteo("2026-10-16", 17, "Nuageux", true), meteo("2026-10-17", 18, "Ensoleillé", true)])).toBe(
      "Températures douces, prévois des couches légères."
    );
    expect(conseilMeteo([meteo("2026-10-16", 12, "Pluvieux", true)])).toBe("Temps frais, prévois des couches. De la pluie est prévue.");
    expect(conseilMeteo([meteo("2026-10-16", 27, "Ensoleillé", true)])).toBe("Temps chaud, privilégie les matières légères.");
    expect(conseilMeteo([meteo("2026-10-16", 20)])).toBeNull();
  });
});
