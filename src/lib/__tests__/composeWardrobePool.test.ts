import { describe, expect, it } from "vitest";
import { composeWardrobePool } from "../selectors";
import { item } from "./fixtures";
import type { CategoryKey } from "../types";

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
