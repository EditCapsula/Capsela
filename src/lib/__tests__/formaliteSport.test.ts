import { describe, expect, it } from "vitest";
import { formalityOf } from "../attributes";
import { CATALOG } from "../catalog";
import { PALETTE, SUBTYPES } from "../data";
import type { Item } from "../types";

/**
 * MESURÉ LE 22/09/2026 sur un dressing de sport saisi à la main : « T-shirt
 * de running », « Débardeur de sport » et « Short de running » valaient 1,
 * alors que R-B11 exige 0. Une utilisatrice qui saisissait sa vraie tenue de
 * course la voyait refusée du Sport, gardant son legging et son sweat.
 *
 * Le trou était déjà connu : SPORT_RAW (catalog.ts) porte un
 * `niveauFormalite: 0` explicite justifié par « les noms ne matchent pas tous
 * l'heuristique de formalityOf ». Contourné là, jamais rebouché ici.
 */

/**
 * L'état d'AVANT, reproduit ici pour que les deux bras soient mesurés dans la
 * même exécution sur les mêmes pièces, plutôt que comparés entre deux
 * lancements. Si `formalityOf` change ailleurs que sur les mots de sport,
 * cette copie cessera de refléter la baseline et devra être revue avec elle.
 */
const MOTS_SPORT_AVANT_LE_22_09 = /sweat|jogging|molleton|legging|coupe-vent|survêt/;
function formaliteAvantLe22_09(it: Item): number {
  if (it.niveauFormalite != null) return it.niveauFormalite;
  const t = (it.name + " " + it.color).toLowerCase();
  if (it.shoeType === "Baskets" || MOTS_SPORT_AVANT_LE_22_09.test(t)) return 0;
  if (/soie|tailleur|smoking|paillet|dentelle/.test(t) && /robe|blouse|combinaison/.test(t)) return 4;
  if (/tailleur|blazer|escarpin|chemis|blouse|gilet|robe chemise|robe droite/.test(t)) return 3;
  return 1;
}

const piece = (name: string, over: Partial<Item> = {}): Item =>
  ({ id: 1, cat: "haut", name, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;

describe("formalityOf · les noms de sport", () => {
  it.each([
    "T-shirt de running",
    "T-shirt technique",
    "Débardeur de sport",
    "Brassière de sport",
    "Pantalon de yoga",
    "Short de running",
    "Veste de trail",
    "Haut de fitness",
    "Tee-shirt de training",
  ])("reconnaît « %s »", (nom) => {
    expect(formalityOf(piece(nom))).toBe(0);
  });

  it.each([
    "Sweat à capuche",
    "Jogging en molleton",
    "Legging noir",
    "Coupe-vent léger",
    "Survêtement",
  ])("continue de reconnaître « %s » — la liste d'origine n'est pas perdue", (nom) => {
    expect(formalityOf(piece(nom))).toBe(0);
  });

  it.each([
    ["Chemise en lin", 3],
    ["Blazer en laine", 3],
    ["Robe chemise", 3],
    ["Pull col rond", 1],
  ])("laisse « %s » à %i", (nom, attendu) => {
    expect(formalityOf(piece(nom))).toBe(attendu);
  });

  it("ne s'applique jamais à une pièce dont la formalité est déclarée", () => {
    // Toute ligne de vestiaire_universel renseigne niveau_formalite : la
    // lecture de nom ne sert donc qu'au dressing personnel, dont la table
    // n'a pas la colonne. C'est ce qui rend cet élargissement peu risqué.
    expect(formalityOf(piece("Short de running", { niveauFormalite: 3 }))).toBe(3);
  });

  /**
   * LA CONTRE-ÉPREUVE, sans laquelle l'élargissement ne serait pas démontré :
   * `formalityOf` lit `name + " " + color`, donc une couleur de la palette
   * contenant un mot de sport ferait tomber n'importe quelle pièce à 0, et un
   * sous-type proposé à la saisie ferait de même à grande échelle. Vérifier
   * que la règle se déclenche ne dit rien de ce qu'elle emporte au passage.
   */
  it("aucune couleur de la palette ne fait tomber une pièce à 0", () => {
    const fautives = PALETTE.map(([c]) => c).filter((c) => formalityOf(piece("Pull col rond", { color: c })) === 0);
    expect(fautives).toEqual([]);
  });

  it("aucun sous-type proposé à la saisie n'est pris pour du sport", () => {
    const fautifs = Object.entries(SUBTYPES)
      .flatMap(([cat, liste]) => (liste ?? []).map((t) => `${t} (${cat})`))
      .filter((libelle) => formalityOf(piece(libelle.split(" (")[0])) === 0);
    // Ces trois-là en font partie depuis l'origine et sont légitimes : ce
    // sont des vêtements de sport. Aucun ne s'est ajouté le 22/09.
    expect(fautifs).toEqual(["Sweat (haut)", "Legging (pantalon)", "Jogging (pantalon)"]);
  });

  it("ne déplace aucune pièce du catalogue statique", () => {
    // Toute ligne de vestiaire_universel déclare sa formalité, et SPORT_RAW
    // déclare déjà 0 : l'élargissement doit être strictement invisible ici.
    // Les deux états sont comparés dans la même exécution, sur les mêmes
    // pièces — un mot trop large se verrait immédiatement.
    const deplacees = CATALOG.filter((it) => formaliteAvantLe22_09(it) !== formalityOf(it))
      .map((it) => `${it.name} : ${formaliteAvantLe22_09(it)} → ${formalityOf(it)}`);
    expect(deplacees).toEqual([]);
  });
});
