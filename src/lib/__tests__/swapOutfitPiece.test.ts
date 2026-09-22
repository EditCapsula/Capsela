import { describe, expect, it } from "vitest";
import { applySportCocooningFilter, swapOutfitPiece } from "../logic";
import { item, MILD } from "./fixtures";

/**
 * DEUX DÉFAUTS SIGNALÉS LE 22/09/2026 SUR UNE MÊME TENUE DE SPORT, mais
 * indépendants l'un de l'autre — un chapeau fedora proposé en Sport, et un
 * échange d'accessoire qui empilait trois fois la même gourde.
 *
 * Ils sont testés séparément parce qu'ils vivent à deux endroits différents :
 * la liste blanche R-B11 d'une part, le filtrage des candidates d'autre part.
 * Corriger l'un laissait l'autre intact.
 */

const gourde = item({ id: 9001, category: "accessoire", name: "Gourde de sport", niveau_formalite: "sport" });
const chapeau = item({ id: 9002, category: "accessoire", name: "Chapeau type fedora souple", niveau_formalite: "sport" });
const casquette = item({ id: 9003, category: "accessoire", name: "Casquette", niveau_formalite: "sport" });
const ceinture = item({ id: 9004, category: "accessoire", name: "Ceinture cuir", niveau_formalite: "sport" });
const haut = item({ id: 9005, category: "haut", name: "T-shirt technique", niveau_formalite: "sport" });
const bas = item({ id: 9006, category: "pantalon", name: "Legging de sport", niveau_formalite: "sport" });
// Nom qu'aucune expression de detectAccessoireType ne reconnaît : accessoireType
// vaut undefined, et la liste blanche doit le refuser comme tout le reste.
const inconnu = item({ id: 9007, category: "accessoire", name: "Brassard réfléchissant", niveau_formalite: "sport" });

describe("R-B11 · les accessoires autorisés en Sport", () => {
  it("refuse le chapeau, que la liste d'exclusions laissait passer", () => {
    const retenus = applySportCocooningFilter([chapeau, casquette, gourde], "sport");
    expect(retenus.map((i) => i.id)).toEqual([casquette.id, gourde.id]);
  });

  it("refuse un type d'accessoire non reconnu plutôt que de l'autoriser par défaut", () => {
    expect(inconnu.accessoireType).toBeUndefined();
    expect(applySportCocooningFilter([inconnu], "sport")).toHaveLength(0);
  });

  it("continue de refuser la ceinture — le correctif du 22/08/2026 tient", () => {
    expect(applySportCocooningFilter([ceinture], "sport")).toHaveLength(0);
  });

  /**
   * LE BALAYAGE QUI TIENT L'ARBITRAGE DANS LE TEMPS. Une liste blanche ne
   * vaut que si l'on vérifie ce qu'elle refuse, pas seulement ce qu'elle
   * laisse passer : c'est exactement ce qui manquait le 22/08, quand le
   * commentaire annonçait une liste blanche qu'aucun test ne confrontait à
   * un type non prévu. Un type ajouté plus tard à `AccessoireType` fera
   * échouer ce test tant que personne ne l'aura instruit pour le Sport.
   */
  it("n'autorise que les quatre types instruits, sur les neuf existants", () => {
    const parType: [string, string][] = [
      ["Ceinture cuir", "Ceinture"],
      ["Foulard soie", "Foulard"],
      ["Écharpe laine", "Écharpe"],
      ["Chapeau type fedora souple", "Chapeau"],
      ["Casquette", "Casquette"],
      ["Lunettes de soleil", "Lunettes"],
      ["Collants opaques", "Collants"],
      ["Chaussettes hautes", "Chaussettes hautes"],
      ["Gourde de sport", "Gourde"],
    ];
    const pieces = parType.map(([nom], i) =>
      item({ id: 9100 + i, category: "accessoire", name: nom, niveau_formalite: "sport" })
    );
    // La fabrique doit bien produire les neuf types, sinon le balayage
    // testerait moins que ce qu'il annonce.
    expect(pieces.map((p) => p.accessoireType)).toEqual(parType.map(([, t]) => t));

    const retenus = applySportCocooningFilter(pieces, "sport").map((p) => p.accessoireType);
    // Écharpe et Collants retirés le 22/09/2026 : ils ne passaient que par
    // l'effet de bord de l'ancienne liste d'exclusions.
    expect(retenus).toEqual(["Casquette", "Lunettes", "Chaussettes hautes", "Gourde"]);
  });

  it("laisse la gourde au Sport et la refuse ailleurs", () => {
    expect(applySportCocooningFilter([gourde], "sport")).toHaveLength(1);
    expect(applySportCocooningFilter([gourde], "quotidien")).toHaveLength(0);
  });
});

describe("swapOutfitPiece · une pièce déjà portée n'est jamais un remplaçant", () => {
  it("ne duplique pas un accessoire que la tenue porte déjà", () => {
    const tenue = [haut, bas, gourde, chapeau];
    // Le groupe accessoire/bijou/sac ne contient ici que la gourde, déjà portée.
    const apres = swapOutfitPiece(tenue, tenue, chapeau.id, "accessoire", "sport", "Présentiel", "Verre", MILD);
    expect(new Set(apres).size).toBe(apres.length);
  });

  it("préfère laisser la tenue inchangée plutôt que d'introduire un doublon", () => {
    const tenue = [haut, bas, gourde, chapeau];
    const apres = swapOutfitPiece(tenue, tenue, chapeau.id, "accessoire", "sport", "Présentiel", "Verre", MILD);
    expect(apres).toEqual([haut.id, bas.id, gourde.id, chapeau.id]);
  });

  it("échange normalement dès qu'un candidat non porté existe", () => {
    const tenue = [haut, bas, gourde, chapeau];
    const pool = [...tenue, casquette];
    const apres = swapOutfitPiece(tenue, pool, chapeau.id, "accessoire", "sport", "Présentiel", "Verre", MILD);
    expect(apres).toEqual([haut.id, bas.id, gourde.id, casquette.id]);
  });
});
