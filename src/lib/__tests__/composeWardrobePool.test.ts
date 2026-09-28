import { describe, expect, it } from "vitest";
import { composeWardrobePool } from "../selectors";
import { weatherForDay } from "../capsule";
import { CATS as CATEGORIES, type Weather } from "../data";
import { generateOutfitWithFallback } from "../logic";
import { item } from "./fixtures";
import type { CategoryKey, Item, OccasionKey, Season } from "../types";

/**
 * La composition du pool décide de ce que le moteur a le DROIT de proposer.
 * Un défaut ici ne casse aucun test de génération : il retire silencieusement
 * des pièces du tirage. C'est exactement ce qui s'est produit le 10/09/2026 —
 * l'occasion sport tombée de 100 % à 0 % de tenue sans qu'aucun test ne
 * bronche, parce que posséder une pièce écartait tout le catalogue de sa
 * catégorie. Ces cas verrouillent les deux moitiés de la règle.
 */
const CATS: CategoryKey[] = ["haut", "pantalon", "chaussures"];

const hautSport = item({ id: 1, category: "hauts", name: "T-shirt technique", sous_type: "T-shirt", occasions: "sport" });
const hautVille = item({ id: 2, category: "hauts", name: "Chemise", sous_type: "Chemise", occasions: "quotidien" });
const pantalonVille = item({ id: 3, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon", occasions: "quotidien" });
const capsule = [hautSport, hautVille, pantalonVille];
/** Les fixtures décalent les ids (VESTIAIRE_ID_OFFSET) : on compare toujours à l'id réel. */
const ids = (pieces: { id: number }[]) => pieces.map((i) => i.id);

describe("composeWardrobePool", () => {
  it("sans pièce réelle, propose la capsule — c'est le cas d'un dressing vide", () => {
    const pool = composeWardrobePool([], capsule, CATS);
    expect(ids(pool).sort()).toEqual(ids(capsule).sort());
  });

  it("les vraies pièces priment : posséder un haut écarte les hauts de la capsule", () => {
    const monHaut = item({ id: 90, category: "hauts", name: "Mon top", sous_type: "T-shirt", occasions: "quotidien" });
    const pool = composeWardrobePool([monHaut], capsule, CATS);
    expect(ids(pool.filter((i) => i.cat === "haut"))).toEqual([monHaut.id]);
    // Les autres catégories, elles, restent servies par la capsule.
    expect(ids(pool)).toContain(pantalonVille.id);
  });

  it("complète quand aucune pièce réelle ne sert l'occasion — le défaut du 10/09", () => {
    const monHaut = item({ id: 90, category: "hauts", name: "Mon top", sous_type: "T-shirt", occasions: "quotidien" });
    const sans = composeWardrobePool([monHaut], capsule, CATS);
    const avec = composeWardrobePool([monHaut], capsule, CATS, { completerPourOccasion: "sport" });
    expect(ids(sans)).not.toContain(hautSport.id);
    expect(ids(avec)).toContain(hautSport.id);
    // En COMPLÉMENT, jamais en remplacement : la pièce réelle garde sa place.
    expect(ids(avec)).toContain(monHaut.id);
  });

  it("ne complète PAS une catégorie dont une pièce réelle sert déjà l'occasion", () => {
    const monHautSport = item({ id: 91, category: "hauts", name: "Mon débardeur", sous_type: "Débardeur", occasions: "sport" });
    const pool = composeWardrobePool([monHautSport], capsule, CATS, { completerPourOccasion: "sport" });
    expect(ids(pool.filter((i) => i.cat === "haut"))).toEqual([monHautSport.id]);
  });

  it("n'ajoute que des pièces déclarant l'occasion demandée", () => {
    const monHaut = item({ id: 90, category: "hauts", name: "Mon top", sous_type: "T-shirt", occasions: "quotidien" });
    const pool = composeWardrobePool([monHaut], capsule, CATS, { completerPourOccasion: "sport" });
    // hautVille ne déclare pas le sport : il reste dehors.
    expect(ids(pool)).not.toContain(hautVille.id);
  });

  it("ne duplique jamais une pièce déjà possédée", () => {
    const pool = composeWardrobePool([hautVille], capsule, CATS, { completerPourOccasion: "quotidien" });
    const hauts = ids(pool.filter((i) => i.cat === "haut"));
    expect(hauts).toEqual([...new Set(hauts)]);
  });

  it("est idempotente : recomposer un pool déjà composé ne le change pas", () => {
    const une = composeWardrobePool([], capsule, CATS, { completerPourOccasion: "sport" });
    const deux = composeWardrobePool(une, capsule, CATS, { completerPourOccasion: "sport" });
    expect(ids(deux)).toEqual(ids(une));
  });
});

/**
 * LA CAPSULE AVANT LE RELÂCHEMENT (28/09/2026, signalé avec capture : une
 * robe déclarée Sortie / Date / Cérémonie proposée pour « Travail / Bureau »).
 * Pièces écrites à la main, occasions déclarées comme dans le dressing réel
 * et comme dans vestiaire_universel ; ids ≥ 100000 pour le catalogue.
 */
describe("composeWardrobePool — capsule adaptée avant le relâchement", () => {
  const P = (id: number, name: string, cat: CategoryKey, occasion: OccasionKey[], season: Season, extra: Partial<Item> = {}): Item =>
    ({ id, name, cat, color: "Noir", hex: "#2A2724", worn: null, season, occasion, ...extra });
  const STRICT = (w: Weather) => ({ completerPourOccasion: "travail_formel" as const, saison: w, exclureHorsOccasion: true });
  const septembre17 = weatherForDay(17, "Nuageux", "Automne");

  const robeSoiree = P(1, "Robe bordeaux", "robe", ["soiree", "date", "evenement_perso"], "Toutes saisons");
  const robeSansOccasion = P(2, "Robe noire", "robe", [], "Toutes saisons");
  const chemiseLin = P(3, "Chemise en lin", "haut", ["quotidien", "travail_formel"], "Printemps / Été", { subtype: "Chemise" });
  const robeCapsuleTravail = P(100001, "Robe portefeuille", "robe", ["travail_formel", "date"], "Toutes saisons", { niveauFormalite: 3 });
  const chemisierCapsule = P(100002, "Chemisier", "haut", ["travail_formel"], "Toutes saisons", { niveauFormalite: 3, subtype: "Chemisier" });

  it("une pièce réelle déclarée pour d'autres occasions sort du pool ; sans déclaration, elle reste", () => {
    const pool = composeWardrobePool([robeSoiree, robeSansOccasion], [robeCapsuleTravail], ["robe"], STRICT(septembre17));
    expect(ids(pool)).toEqual([2, 100001]);
  });

  it("sans les options, rien ne change (bras « avant » de la mesure)", () => {
    const pool = composeWardrobePool([robeSoiree], [robeCapsuleTravail], ["robe"], { completerPourOccasion: "travail_formel" });
    expect(ids(pool)).toEqual([1, 100001]);
  });

  it("une pièce adaptée mais hors saison ne bloque plus le secours de sa catégorie", () => {
    const avant = composeWardrobePool([chemiseLin], [chemisierCapsule], ["haut"], { completerPourOccasion: "travail_formel" });
    const apres = composeWardrobePool([chemiseLin], [chemisierCapsule], ["haut"], STRICT(septembre17));
    expect(ids(avant)).toEqual([3]);
    expect(ids(apres)).toEqual([3, 100002]);
  });

  it("garde-fou : rien d'adapté ni au dressing ni en capsule, la catégorie n'est pas vidée", () => {
    const pool = composeWardrobePool([robeSoiree], [], ["robe"], STRICT(septembre17));
    expect(ids(pool)).toEqual([1]);
  });

  it("DÉMONTRÉ — la capture : la robe de soirée ne sort plus pour le travail", () => {
    // Capsule sans robe de travail, hauts de travail d'été un 17° de septembre.
    const dressing = [
      robeSoiree,
      chemiseLin,
      P(4, "Top blanc", "haut", ["quotidien", "travail_formel"], "Printemps / Été", { subtype: "Top" }),
      P(5, "Jean brut", "jean", ["quotidien"], "Toutes saisons"),
      P(6, "Baskets", "chaussures", ["quotidien", "sport"], "Toutes saisons", { shoeType: "Baskets" }),
    ];
    const capsuleTest = [
      chemisierCapsule,
      P(100003, "Pantalon tailleur", "pantalon", ["travail_formel"], "Toutes saisons", { niveauFormalite: 3 }),
      P(100004, "Ballerines", "chaussures", ["quotidien", "travail_formel"], "Toutes saisons", { niveauFormalite: 3, shoeType: "Ballerines" }),
    ];
    const cats = CATEGORIES.map(([k]) => k);
    const base = composeWardrobePool(dressing, capsuleTest, cats);
    const compter = (pool: Item[]) => {
      let robe = 0;
      const orig = Math.random;
      let graine = 42;
      Math.random = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
      try {
        for (let k = 0; k < 300; k++) {
          if (generateOutfitWithFallback(pool, septembre17, "travail_formel", "Présentiel", "Verre", [], "femme").ids.includes(1)) robe++;
        }
      } finally {
        Math.random = orig;
      }
      return robe;
    };
    const avant = compter(composeWardrobePool(base, capsuleTest, cats, { completerPourOccasion: "travail_formel" }));
    const apres = compter(composeWardrobePool(base, capsuleTest, cats, STRICT(septembre17)));
    expect(avant).toBeGreaterThan(0);
    expect(apres).toBe(0);
  });
});
