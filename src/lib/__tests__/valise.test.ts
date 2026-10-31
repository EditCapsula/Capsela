import { describe, expect, it } from "vitest";
import type { Weather } from "../data";
import {
  allegement,
  alternatives,
  amplitudeHabituelle,
  amplitudePrevue,
  BAGAGES,
  MINIMUM_PIECES_VALISE,
  pretPourUneValise,
  categoriesPourCompleter,
  completerAvecCapsule,
  poolDeLaValise,
  conseilMeteo,
  occasionsCouvertes,
  occasionsDeLaPiece,
  occasionsDuLook,
  resumeLook,
  capaciteDe,
  unitesDe,
  volumeDe,
  completerChaussuresEtSac,
  lookAChaussuresEtSac,
  cibleDeVolume,
  composerValise,
  etatJauge,
  generateurMoteur,
  joursDuSejour,
  libelleDuree,
  meteosPrevuesDuSejour,
  pluieAnnoncee,
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
  it("capacités arbitrées en unités d'encombrement : S 14, M 22, L 32, XL 44 ; l'écran dit environ 8, 12, 18, 24 pièces", () => {
    expect(["S", "M", "L", "XL"].map((t) => capaciteDe(t as "S"))).toEqual([14, 22, 32, 44]);
    expect(BAGAGES.map(([, , n]) => n)).toEqual([8, 12, 18, 24]);
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
    // Capacité en unités : le quotidien (haut 1 + pantalon 2 + chaussures 3) en prend 6, la soirée (robe 1,5 + chaussures 3) 4,5.
    const r = composerValise(DRESSING, S1(["quotidien", "soiree"]), 7, gen);
    expect(volumeDe(DRESSING.filter((p) => r.pieceIds.includes(p.id)))).toBeLessThanOrEqual(7);
    expect(r.situationsSansLook).toHaveLength(1);
  });

  it("l'encombrement compte : des chaussures et un manteau pèsent plus que des hauts", () => {
    expect(volumeDe([piece(1, "haut"), piece(2, "haut")])).toBe(2);
    expect(volumeDe([piece(1, "chaussures"), piece(2, "manteau")])).toBe(7);
    expect(unitesDe("bijou")).toBe(0.25);
  });

  it("allègement : le volume décide, pas le nombre de pièces", () => {
    const looks = [{ ids: [1, 2], situations: [0], elargie: false }] as never;
    // Deux pièces seulement, mais 3 + 4 unités pour une capacité de 5 : une doit partir.
    expect(allegement([1, 2], looks, 5, (id) => (id === 1 ? 3 : 4))).toHaveLength(1);
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
    expect(resumeLook([baskets, piece(16, "sac"), robe, piece(9, "veste")])).toBe("Robe chemise · Veste · Baskets · Sac");
    expect(resumeLook([piece(1, "haut"), piece(4, "pantalon")])).toBe("Haut · Pantalon");
    // 19/10/2026 : un sous-type qui ne nomme pas la pièce est précédé de sa catégorie ; une majuscule à chaque pièce.
    const jupe: Item = { ...piece(5, "jupe"), subtype: "Midi" };
    const tshirt: Item = { ...piece(2, "haut"), subtype: "T-shirt" };
    const mocassins: Item = { ...piece(8, "chaussures"), shoeType: "Mocassins" };
    expect(resumeLook([piece(16, "sac"), mocassins, jupe, tshirt])).toBe("T-shirt · Jupe midi · Mocassins · Sac");
    expect(resumeLook([{ ...piece(3, "jupe"), subtype: "Jupe crayon" }])).toBe("Jupe crayon");
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

describe("categoriesPourCompleter — dire quoi ajouter au dressing, sans l'inventer", () => {
  const situations = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
  // Capsule : une robe (60) et des escarpins (61) ; le dressing n'a ni robe ni… rien pour la soirée.
  const capsule = [piece(60, "robe"), piece(61, "chaussures")];
  const dressing = [piece(1, "haut"), piece(4, "pantalon"), piece(7, "chaussures")];

  it("les catégories que le moteur a dû prendre dans la capsule", () => {
    const gen: Generateur = (pool, s) =>
      s.occasion === "soiree" && pool.some((p) => p.id === 60) ? { ids: [60, 7], elargie: false } : { ids: [1, 4, 7], elargie: false };
    expect(categoriesPourCompleter(dressing, capsule, situations, [1], gen)).toEqual([
      { occasion: "soiree", categories: ["robe"], pieces: [capsule[0]], capacite: false },
    ]);
  });

  it("les pièces rendues sont celles de la capsule, jamais celles du dressing — elles ne sont pas dans la valise", () => {
    const gen: Generateur = (pool, s) =>
      s.occasion === "soiree" && pool.some((p) => p.id === 60) ? { ids: [60, 7], elargie: false } : { ids: [1, 4, 7], elargie: false };
    const [m] = categoriesPourCompleter(dressing, capsule, situations, [1], gen);
    expect(m.pieces.map((p) => p.id)).toEqual([60]);
    expect(m.pieces.every((p) => !dressing.some((d) => d.id === p.id))).toBe(true);
  });

  it("look possible avec le dressing seul : c'est la place qui a manqué, pas une pièce", () => {
    const gen: Generateur = () => ({ ids: [1, 4, 7], elargie: false });
    expect(categoriesPourCompleter(dressing, capsule, situations, [1], gen)).toEqual([{ occasion: "soiree", categories: [], pieces: [], capacite: true }]);
  });

  it("une occasion n'est dite qu'une fois ; rien quand le moteur ne trouve rien", () => {
    expect(categoriesPourCompleter(dressing, capsule, situations, [1], () => null)).toEqual([]);
  });
});

describe("completerAvecCapsule — la capsule entre dans la valise seulement quand le dressing ne suffit pas", () => {
  const situations = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
  const capsule = [piece(60, "robe")];
  const dressing = [piece(1, "haut"), piece(4, "pantalon"), piece(7, "chaussures")];
  const dressingSeul = { pieceIds: [1, 4, 7], looks: [{ ids: [1, 4, 7], situations: [0], elargie: false }], situationsSansLook: [1] };
  const gen: Generateur = (pool, s) =>
    s.occasion === "soiree" && pool.some((p) => p.id === 60) ? { ids: [60, 7], elargie: false } : { ids: [1, 4, 7], elargie: false };

  it("une occasion que le dressing ne couvre pas : la pièce de capsule entre, marquée suggestion, et l'occasion est couverte", () => {
    const r = completerAvecCapsule(dressing, capsule, situations, dressingSeul, 22, gen);
    expect(r.suggestionIds).toEqual([60]);
    expect(r.pieceIds).toContain(60);
    expect(r.situationsSansLook).toEqual([]);
  });

  it("un dressing qui couvre tout : rien n'est ajouté", () => {
    const complet = { ...dressingSeul, looks: [...dressingSeul.looks, { ids: [1, 4, 7], situations: [1], elargie: false }], situationsSansLook: [] };
    const r = completerAvecCapsule(dressing, capsule, situations, complet, 22, gen);
    expect(r.suggestionIds).toEqual([]);
    expect(r.pieceIds).toEqual([1, 4, 7]);
  });

  it("jamais au-delà de la capacité : la suggestion qui ne tient pas n'entre pas", () => {
    const r = completerAvecCapsule(dressing, capsule, situations, dressingSeul, 7, gen);
    expect(r.suggestionIds).toEqual([]);
    expect(r.pieceIds).toEqual([1, 4, 7]);
  });

  it("le dressing seul compose le look : c'est la place qui manque, la capsule n'ajoute rien", () => {
    const r = completerAvecCapsule(dressing, capsule, situations, dressingSeul, 22, () => ({ ids: [1, 4, 7], elargie: false }));
    expect(r.suggestionIds).toEqual([]);
  });

  it("sans capsule : inchangé ; et le pool de la valise ne reprend que ses suggestions", () => {
    expect(completerAvecCapsule(dressing, [], situations, dressingSeul, 22, gen).suggestionIds).toEqual([]);
    expect(poolDeLaValise(dressing, undefined, capsule)).toBe(dressing);
    expect(poolDeLaValise(dressing, [60], [...capsule, piece(61, "veste")]).map((p) => p.id)).toEqual([1, 4, 7, 60]);
  });
});

describe("completerAvecCapsule — jamais de doublon redondant", () => {
  const situations = situationsDuSejour(["quotidien", "soiree", "evenement_perso"], [meteo("2026-10-16")]);
  const capsule = [piece(60, "robe"), piece(61, "robe")];
  const dressing = [piece(1, "haut"), piece(4, "pantalon"), piece(7, "chaussures")];
  const r = { pieceIds: [1, 4, 7], looks: [{ ids: [1, 4, 7], situations: [0], elargie: false }], situationsSansLook: [1, 2] };
  const gen: Generateur = (pool, s) =>
    s.occasion === "quotidien" ? { ids: [1, 4, 7], elargie: false } : pool.some((p) => p.id === 60) ? { ids: [60, 7], elargie: false } : pool.some((p) => p.id === 61) ? { ids: [61, 7], elargie: false } : null;

  it("une pièce de capsule déjà retenue pour une occasion est réutilisée pour l'autre", () => {
    const out = completerAvecCapsule(dressing, capsule, situations, r, 30, gen);
    expect(out.suggestionIds).toEqual([60]);
    expect(out.situationsSansLook).toEqual([]);
  });
});

describe("completerAvecCapsule — une occasion seulement élargie peut être complétée", () => {
  const situations = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
  const capsule = [piece(60, "robe")];
  const dressing = [piece(1, "haut"), piece(4, "pantalon"), piece(7, "chaussures")];
  const r = {
    pieceIds: [1, 4, 7],
    looks: [{ ids: [1, 4, 7], situations: [0, 1], elargie: true }],
    situationsSansLook: [],
  };

  it("une pièce de capsule qui apporte quelque chose complète la couverture élargie", () => {
    const gen: Generateur = (pool, s) => (s.occasion === "soiree" && pool.some((p) => p.id === 60) ? { ids: [60, 7], elargie: true } : { ids: [1, 4, 7], elargie: true });
    expect(completerAvecCapsule(dressing, capsule, situations, r, 30, gen).suggestionIds).toEqual([60]);
  });

  it("un look élargi qui n'apporte aucune pièce de capsule n'ajoute rien", () => {
    const gen: Generateur = () => ({ ids: [1, 4, 7], elargie: true });
    expect(completerAvecCapsule(dressing, capsule, situations, r, 30, gen).suggestionIds).toEqual([]);
  });
});

describe("completerAvecCapsule — la capsule complète, elle ne remplace pas le dressing", () => {
  const situations = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
  const capsule = [piece(60, "robe"), piece(61, "veste"), piece(62, "bijou")];
  const dressing = [piece(1, "haut"), piece(7, "chaussures")];
  const r = { pieceIds: [1, 7], looks: [], situationsSansLook: [1] };

  it("jamais plus de suggestions que la moitié des pièces possédées (arrondie au-dessus)", () => {
    const gen: Generateur = (pool) => (pool.some((p) => p.id === 60) ? { ids: [1, 7, 60, 61, 62], elargie: false } : null);
    const out = completerAvecCapsule(dressing, capsule, situations, r, 99, gen);
    // 2 pièces possédées dans la valise : au plus 1 suggestion ; le look qui en demande 3 n'entre pas.
    expect(out.suggestionIds).toEqual([]);
    const gen1: Generateur = (pool) => (pool.some((p) => p.id === 60) ? { ids: [1, 7, 60], elargie: false } : null);
    expect(completerAvecCapsule(dressing, capsule, situations, r, 99, gen1).suggestionIds).toEqual([60]);
  });
});

describe("alternatives — la capacité est respectée", () => {
  const dressing = [piece(1, "haut"), piece(4, "pantalon"), piece(7, "chaussures"), piece(8, "chaussures"), piece(9, "manteau")];
  const situations = situationsDuSejour(["quotidien"], [meteo("2026-10-16")]);
  const gen: Generateur = (pool) => ({ ids: pool.map((p) => p.id).filter((id) => id !== 9), elargie: false });

  it("une pièce qui ferait dépasser la valise est rendue avec tient: false, après celles qui tiennent", () => {
    const sansLimite = alternatives(7, [1, 4, 7], dressing, situations, gen, 2);
    expect(sansLimite.every((a) => a.tient)).toBe(true);
    // Haut 1 + pantalon 2 + chaussures 3 = 6 ; remplacer les chaussures par une paire (3) tient dans 6, pas dans 5.
    expect(alternatives(7, [1, 4, 7], dressing, situations, gen, 2, 6).map((a) => [a.item.id, a.tient])).toEqual([[8, true]]);
    expect(alternatives(7, [1, 4, 7], dressing, situations, gen, 2, 5).map((a) => [a.item.id, a.tient])).toEqual([[8, false]]);
  });
});

describe("pretPourUneValise — de quoi remplir une valise S", () => {
  it("le minimum est la capacité d'une valise S : 8 pièces", () => {
    expect(MINIMUM_PIECES_VALISE).toBe(8);
  });

  it("8 pièces avec haut, bas et chaussures : prêt", () => {
    const d = [1, 2, 3].map((i) => piece(i, "haut")).concat([piece(4, "pantalon"), piece(5, "jean"), piece(7, "chaussures"), piece(16, "sac"), piece(9, "veste")]);
    expect(pretPourUneValise(d)).toEqual({ pret: true, manquePieces: 0, manqueBase: [] });
  });

  it("trop peu de pièces : combien il en manque", () => {
    expect(pretPourUneValise(DRESSING.slice(0, 5))).toEqual({ pret: false, manquePieces: 3, manqueBase: ["chaussures"] });
  });

  it("assez de pièces mais pas de chaussures : pas prêt", () => {
    const d = [1, 2, 3, 20, 21].map((i) => piece(i, "haut")).concat([piece(4, "pantalon"), piece(5, "jean"), piece(16, "sac")]);
    expect(pretPourUneValise(d)).toEqual({ pret: false, manquePieces: 0, manqueBase: ["chaussures"] });
  });

  it("une robe tient lieu de haut et de bas", () => {
    const d = [piece(6, "robe"), piece(7, "chaussures"), ...[30, 31, 32, 33, 34, 35].map((i) => piece(i, "accessoire"))];
    expect(pretPourUneValise(d).manqueBase).toEqual([]);
  });
});

describe("pluieAnnoncee — la pluie de la prévision, jamais d'une météo de repli", () => {
  it("vraie quand un jour prévu annonce de la pluie", () => {
    expect(pluieAnnoncee([meteo("2026-10-16", 17, "Pluie légère", true)])).toBe(true);
  });
  it("fausse quand le ciel prévu est sec", () => {
    expect(pluieAnnoncee([meteo("2026-10-16", 24, "Ensoleillé", true)])).toBe(false);
  });
  it("fausse quand le jour n'est pas une prévision, même si son libellé parle de pluie", () => {
    expect(pluieAnnoncee([meteo("2026-10-16", 17, "Pluie", false)])).toBe(false);
  });
});

describe("meteosPrevuesDuSejour — seulement les jours que la prévision d'aujourd'hui couvre", () => {
  const h = (jour: string, heure: number) => Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10), heure) / 1000;
  const prevision = {
    city: "Rhodes",
    country: "GR",
    timezone: 0,
    slots: [
      { ts: h("2026-10-05", 9), temp: 20, label: "Ensoleillé" },
      { ts: h("2026-10-05", 15), temp: 24, label: "Ensoleillé" },
      { ts: h("2026-10-06", 9), temp: 19, label: "Pluie légère" },
    ],
  };

  it("rend les jours couverts, la moyenne de la journée et le libellé le plus contraignant", () => {
    const r = meteosPrevuesDuSejour(prevision, ["2026-10-05", "2026-10-06"]);
    expect(r).toEqual([
      { jour: "2026-10-05", temp: 22, label: "Ensoleillé", prevue: true },
      { jour: "2026-10-06", temp: 19, label: "Pluie légère", prevue: true },
    ]);
  });

  it("un jour hors de la prévision (passé ou trop lointain) ne rend rien — jamais une valeur de repli", () => {
    expect(meteosPrevuesDuSejour(prevision, ["2026-09-28", "2026-10-09"])).toEqual([]);
  });

  it("sans prévision : rien", () => {
    expect(meteosPrevuesDuSejour(null, ["2026-10-05"])).toEqual([]);
  });
});

describe("cibleDeVolume — 70 % de la capacité (en unités), arrondi au supérieur", () => {
  it("S 6, M 9, L 13, XL 17", () => {
    expect((["S", "M", "L", "XL"] as const).map((t) => cibleDeVolume(t))).toEqual([10, 16, 23, 31]);
  });
});

describe("chaussures et sac — la règle d'un look de valise", () => {
  const pool = [piece(1, "haut"), piece(2, "jupe"), piece(3, "chaussures"), piece(4, "chaussures"), piece(5, "sac")];
  it("une tenue sans chaussures ni sac est complétée avec des pièces du pool", () => {
    const r = completerChaussuresEtSac([1, 2], pool, () => 0)!;
    expect(r).toEqual([1, 2, 3, 5]);
  });
  it("une tenue déjà complète n'est pas touchée", () => {
    expect(completerChaussuresEtSac([1, 2, 4, 5], pool, () => 0)).toEqual([1, 2, 4, 5]);
  });
  it("seul le manquant est ajouté", () => {
    expect(completerChaussuresEtSac([1, 2, 3], pool, () => 0)).toEqual([1, 2, 3, 5]);
  });
  it("sans sac dans le pool, ce n'est pas un look de valise", () => {
    expect(completerChaussuresEtSac([1, 2], pool.filter((p) => p.cat !== "sac"), () => 0)).toBeNull();
  });
  it("sans chaussures dans le pool non plus", () => {
    expect(completerChaussuresEtSac([1, 2], pool.filter((p) => p.cat !== "chaussures"), () => 0)).toBeNull();
  });
  it("lookAChaussuresEtSac : les deux, ou rien", () => {
    expect(lookAChaussuresEtSac([1, 2, 3, 5], pool)).toBe(true);
    expect(lookAChaussuresEtSac([1, 2, 3], pool)).toBe(false);
    expect(lookAChaussuresEtSac([1, 2, 5], pool)).toBe(false);
  });
});

describe("completerChaussuresEtSac — règles du moteur (12/10/2026)", () => {
  const p = (id: number, cat: Item["cat"], name: string, extra: Partial<Item> = {}): Item => ({ id, name, cat, color: "Noir", hex: "#1D1A16", season: "Toutes saisons", worn: null, ...extra });
  const tenue = [p(1, "haut", "T-shirt"), p(2, "pantalon", "Pantalon")];
  const sandales = p(10, "chaussures", "Sandales", { shoeType: "Sandales" });
  const bottines = p(11, "chaussures", "Bottines", { shoeType: "Bottines" });
  const sac = p(12, "sac", "Sac cabas");
  const pluie = { season: "Automne / Hiver", temp: 10, label: "Pluvieux", seasons: ["Automne / Hiver", "Toutes saisons"] } as Weather;

  it("sans contexte, comportement d'origine : une paire quelconque du pool", () => {
    expect(completerChaussuresEtSac([1, 2], [...tenue, sandales, sac], () => 0)).toEqual([1, 2, 10, 12]);
  });
  it("avec le moteur : pas de sandales sous la pluie, ni sous 15 °C", () => {
    expect(completerChaussuresEtSac([1, 2], [...tenue, sandales, bottines, sac], () => 0, { occasion: "quotidien", meteo: pluie })).toEqual([1, 2, 11, 12]);
  });
  it("avec le moteur : si aucune paire n'est acceptée, ce n'est pas un look de valise", () => {
    expect(completerChaussuresEtSac([1, 2], [...tenue, sandales, sac], () => 0, { occasion: "quotidien", meteo: pluie })).toBeNull();
  });
});

describe("composerValise — étape 4, varier (22/10/2026)", () => {
  const quatreJours = ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"].map((j) => meteo(j));
  const situations = situationsDuSejour(["quotidien", "soiree"], quatreJours);
  // La seconde tenue du soir demande deux pièces nouvelles pour un seul look : l'étape 3 (deux looks par pièce) ne l'ajoute pas.
  const gen = () => fauxGenerateur({ quotidien: [[1, 4, 7], [2, 4, 7], [1, 5, 7], [2, 5, 7]], soiree: [[6, 8], [3, 9, 8]] });
  const looksDuSoir = (r: { looks: { situations: number[] }[] }) => r.looks.filter((l) => l.situations.includes(1)).length;

  it("une occasion de quatre jours servie par un seul look en reçoit un second (deux pièces nouvelles au plus)", () => {
    expect(looksDuSoir(composerValise(DRESSING, situations, 22, gen(), undefined, { sansVariete: true }))).toBe(1);
    const r = composerValise(DRESSING, situations, 22, gen());
    expect(looksDuSoir(r)).toBe(2);
    expect(r.pieceIds).toEqual(expect.arrayContaining([3, 9]));
  });

  it("jamais au-delà de la capacité", () => {
    const avant = composerValise(DRESSING, situations, 22, gen(), undefined, { sansVariete: true });
    // Une capacité juste égale au volume d'avant : le second look du soir n'y tient pas.
    const volume = volumeDe(DRESSING.filter((p) => avant.pieceIds.includes(p.id)));
    const r = composerValise(DRESSING, situations, volume, gen());
    expect(looksDuSoir(r)).toBe(1);
    expect(volumeDe(DRESSING.filter((p) => r.pieceIds.includes(p.id)))).toBeLessThanOrEqual(volume);
  });

  it("une occasion d'un seul jour n'est pas concernée", () => {
    const unJour = situationsDuSejour(["quotidien", "soiree"], [meteo("2026-10-16")]);
    expect(looksDuSoir(composerValise(DRESSING, unJour, 22, gen()))).toBe(1);
  });
});

describe("amplitudeHabituelle — les températures habituelles d'un séjour (31/10/2026)", () => {
  it("de la plus basse à la plus haute des jours habituels, et rien sans climatologie", () => {
    const m = (jour: string, o: Partial<{ temp: number; habituelle: boolean; tempMin: number; tempMax: number; prevue: boolean }>) => ({ jour, temp: 25, label: "Ensoleillé", prevue: false, ...o });
    expect(amplitudeHabituelle([m("2026-10-22", { habituelle: true, tempMin: 24, tempMax: 29 }), m("2026-10-23", { habituelle: true, tempMin: 23, tempMax: 30 })])).toEqual({ min: 23, max: 30, jours: 2 });
    // Un jour prévu, ou le repli sur la météo d'aujourd'hui, ne sont pas des températures habituelles.
    expect(amplitudeHabituelle([m("2026-10-22", { prevue: true }), m("2026-10-23", {})])).toBeNull();
  });
});
