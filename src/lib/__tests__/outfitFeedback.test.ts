import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appliquerAvis, clePieces, jourLocal, memeTenue } from "../outfitFeedback";

/**
 * Les deux règles de l'avis du jour qui peuvent être FAUSSES sans que rien ne
 * plante — donc les seules qui méritent vraiment un test.
 *
 * Un jour décalé classe l'avis à la mauvaise date ; une clé mal ordonnée crée
 * une ligne de trop au lieu de corriger la précédente. Aucune des deux
 * n'émet la moindre erreur. Toutes deux ont été trouvées à la relecture du
 * SQL, avant la première écriture — ces tests les figent.
 */
describe("jour local", () => {
  /**
   * FUSEAU ÉPINGLÉ, et c'est indispensable : cette machine tourne en UTC, où
   * jour local et jour UTC coïncident toujours. Un test qui se contenterait
   * de sauter le cas sur une machine UTC serait vert sans rien démontrer —
   * exactement le genre de garde qui ne mord pas. Paris est le fuseau des
   * utilisatrices de l'app, et celui où le défaut se produit.
   */
  const tzOrigine = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Paris";
  });
  afterAll(() => {
    process.env.TZ = tzOrigine;
  });

  /**
   * LE CAS QUI MOTIVE TOUT. À 00 h 30 à Paris en heure d'été (UTC+2), le
   * serveur est encore la veille en UTC. `current_date` — le défaut de la
   * colonne — classerait donc l'avis au mauvais jour, et la clé d'unicité ne
   * serait pas la même qu'à 23 h le soir précédent.
   */
  it("rend le 24 là où UTC dit encore le 23", () => {
    const minuitTrenteAParis = new Date("2026-09-23T22:30:00Z");
    expect(jourLocal(minuitTrenteAParis)).toBe("2026-09-24");
    expect(minuitTrenteAParis.toISOString().slice(0, 10)).toBe("2026-09-23");
  });

  it("le même avis à 23 h et à 00 h 30 tombe bien sur DEUX jours différents", () => {
    // 23 h à Paris le 23 -> 21 h UTC le 23.
    expect(jourLocal(new Date("2026-09-23T21:00:00Z"))).toBe("2026-09-23");
    // 00 h 30 à Paris le 24 -> 22 h 30 UTC le 23. UTC les confondrait.
    expect(jourLocal(new Date("2026-09-23T22:30:00Z"))).toBe("2026-09-24");
  });

  it("tient aussi en heure d'hiver (UTC+1)", () => {
    // 00 h 30 à Paris le 15 janvier -> 23 h 30 UTC le 14.
    expect(jourLocal(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-15");
  });

  it("formate toujours en AAAA-MM-JJ, mois et jour sur deux chiffres", () => {
    expect(jourLocal(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(jourLocal(new Date(2026, 11, 31, 12))).toBe("2026-12-31");
    expect(jourLocal(new Date(2026, 8, 9, 12))).toBe("2026-09-09");
  });
});

describe("clé des pièces", () => {
  /**
   * L'unicité en base porte sur (user_id, jour, piece_ids), et l'égalité de
   * tableaux est SENSIBLE À L'ORDRE en Postgres. `addPieceToOutfit` ajoutant
   * en fin de tableau, retirer puis remettre une pièce réordonne le jeu.
   */
  it("trie, donc un même jeu réordonné donne la MÊME clé", () => {
    expect(clePieces([13, 11, 12])).toEqual([11, 12, 13]);
    expect(clePieces([11, 12, 13])).toEqual(clePieces([13, 12, 11]));
  });

  it("reproduit le réordonnancement réel : retirer puis remettre une pièce", () => {
    const tenue = [11, 12, 13];
    const apresRetraitEtAjout = [...tenue.filter((id) => id !== 12), 12]; // -> [11, 13, 12]
    expect(apresRetraitEtAjout).not.toEqual(tenue); // l'ordre a bien changé
    expect(clePieces(apresRetraitEtAjout)).toEqual(clePieces(tenue)); // la clé, non
  });

  it("dédoublonne, pour qu'un ajout en double ne crée pas une autre clé", () => {
    expect(clePieces([11, 12, 11])).toEqual([11, 12]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const tenue = [13, 11, 12];
    clePieces(tenue);
    expect(tenue).toEqual([13, 11, 12]);
  });
});

describe("même tenue", () => {
  it("ignore l'ordre et les doublons", () => {
    expect(memeTenue([11, 12, 13], [13, 11, 12])).toBe(true);
    expect(memeTenue([11, 12, 11], [11, 12])).toBe(true);
  });

  /**
   * Une tenue régénérée dans la journée ne doit PAS hériter de l'avis donné
   * sur la précédente — c'est ce que cette comparaison garantit côté écran.
   */
  it("distingue deux tenues qui partagent des pièces", () => {
    expect(memeTenue([11, 12, 13], [11, 12, 14])).toBe(false);
    expect(memeTenue([11, 12], [11, 12, 13])).toBe(false);
    expect(memeTenue([], [11])).toBe(false);
  });
});

describe("application d'un avis", () => {
  const JOUR = "2026-09-23";
  const TENUE = [11, 12, 13];

  it("ajoute l'avis quand il n'y en avait aucun", () => {
    const { liste, retire } = appliquerAvis([], { jour: JOUR, pieceIds: TENUE, verdict: "adore" });
    expect(retire).toBe(false);
    expect(liste).toEqual([{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" }]);
  });

  it("REMPLACE un verdict différent au lieu d'empiler", () => {
    const avant = [{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" as const }];
    const { liste, retire } = appliquerAvis(avant, { jour: JOUR, pieceIds: TENUE, verdict: "pas_aujourdhui" });
    expect(retire).toBe(false);
    expect(liste).toHaveLength(1);
    expect(liste[0].verdict).toBe("pas_aujourdhui");
  });

  it("RETIRE l'avis quand on repasse le même verdict", () => {
    const avant = [{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" as const }];
    const { liste, retire } = appliquerAvis(avant, { jour: JOUR, pieceIds: TENUE, verdict: "adore" });
    expect(retire).toBe(true);
    expect(liste).toEqual([]);
  });

  /** Le cas que l'unicité en base ne peut pas rattraper si l'app ne trie pas. */
  it("reconnaît la tenue même si l'ordre des pièces a changé", () => {
    const avant = [{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" as const }];
    const { liste, retire } = appliquerAvis(avant, { jour: JOUR, pieceIds: [13, 11, 12], verdict: "adore" });
    expect(retire).toBe(true);
    expect(liste).toEqual([]);
  });

  it("écrit toujours une clé triée, quel que soit l'ordre reçu", () => {
    const { liste } = appliquerAvis([], { jour: JOUR, pieceIds: [13, 11, 12], verdict: "adore" });
    expect(liste[0].pieceIds).toEqual([11, 12, 13]);
  });

  it("ne touche ni aux autres tenues ni aux autres jours", () => {
    const avant = [
      { jour: JOUR, pieceIds: [21, 22], verdict: "adore" as const },
      { jour: "2026-09-22", pieceIds: [11, 12, 13], verdict: "adore" as const },
    ];
    const { liste } = appliquerAvis(avant, { jour: JOUR, pieceIds: TENUE, verdict: "pas_aujourdhui" });
    expect(liste).toHaveLength(3);
    expect(liste).toEqual(expect.arrayContaining(avant));
  });

  it("ne modifie pas la liste reçue", () => {
    const avant = [{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" as const }];
    appliquerAvis(avant, { jour: JOUR, pieceIds: TENUE, verdict: "pas_aujourdhui" });
    expect(avant).toEqual([{ jour: JOUR, pieceIds: [11, 12, 13], verdict: "adore" }]);
  });
});
