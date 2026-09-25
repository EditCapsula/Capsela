import { describe, expect, it } from "vitest";
import { capsuleJournal, etatDePort, moisAnnee } from "../selectors";
import type { HistoryEntry, Item, Season } from "../types";

// Même découpage que lastCompletedSeasonWindow : dates LOCALES, comme lui.
const t = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const NOW = t(2026, 9, 25);

function piece(season: Season, createdAt?: number, id = 1): Item {
  return { id, name: "Pièce", cat: "haut", color: "Beige", hex: "#D8C8B0", season, worn: null, createdAt };
}
const porte = (ts: number, id = 1): HistoryEntry => ({ id: "h" + ts, ts, pieceIds: [id], occasion: "all" });

describe("etatDePort — jamais portée", () => {
  it("sans aucune entrée d'historique, et arrivée récemment : jamais", () => {
    const e = etatDePort(piece("Printemps / Été", t(2026, 9, 1)), [], NOW);
    expect(e).toEqual({ etat: "jamais", dernierPort: null, moisSansPort: null });
  });

  it("jamais portée mais présente toute l'année écoulée : à envisager de vendre", () => {
    expect(etatDePort(piece("Toutes saisons", t(2025, 6, 1)), [], NOW).etat).toBe("a_vendre");
  });

  it("présente moins de 30 jours dans la plus ancienne des deux saisons : pas encore candidate", () => {
    // L'année écoulée commence le 1er sept. 2025 ; arrivée fin février 2026,
    // elle n'a eu que quelques jours d'automne/hiver.
    expect(etatDePort(piece("Automne / Hiver", t(2026, 2, 20)), [], NOW).etat).toBe("jamais");
  });

  it("une suggestion du catalogue (pas de date d'ajout) n'est jamais à vendre", () => {
    expect(etatDePort(piece("Toutes saisons"), [], NOW).etat).toBe("jamais");
  });
});

describe("etatDePort — portée", () => {
  it("portée pendant sa dernière saison écoulée : récente", () => {
    const e = etatDePort(piece("Printemps / Été", t(2024, 1, 1)), [porte(t(2026, 7, 14))], NOW);
    expect(e.etat).toBe("recente");
    expect(e.moisSansPort).toBe(2);
  });

  it("une pièce d'hiver pas portée cet été n'est pas délaissée pour autant", () => {
    // Dernière saison froide écoulée : 1er sept. 2025 → 1er mars 2026.
    const e = etatDePort(piece("Automne / Hiver", t(2024, 1, 1)), [porte(t(2026, 1, 20))], NOW);
    expect(e.etat).toBe("recente");
    expect(e.moisSansPort).toBe(8);
  });

  it("pas portée de tout le printemps/été écoulé : délaissée, avec la durée", () => {
    const e = etatDePort(piece("Printemps / Été", t(2024, 1, 1)), [porte(t(2025, 10, 5))], NOW);
    expect(e.etat).toBe("delaissee");
    expect(e.moisSansPort).toBe(11);
    expect(e.dernierPort).toBe(t(2025, 10, 5));
  });

  it("« Toutes saisons » se compare à la plus récente saison écoulée, quelle qu'elle soit", () => {
    // Au 25/09/2026 : printemps/été, 1er mars → 1er sept. 2026.
    expect(etatDePort(piece("Toutes saisons", t(2024, 1, 1)), [porte(t(2026, 2, 10))], NOW).etat).toBe("delaissee");
    expect(etatDePort(piece("Toutes saisons", t(2024, 1, 1)), [porte(t(2026, 3, 10))], NOW).etat).toBe("recente");
  });

  it("pas portée des deux dernières saisons écoulées : à envisager de vendre", () => {
    const e = etatDePort(piece("Printemps / Été", t(2024, 1, 1)), [porte(t(2025, 7, 1))], NOW);
    expect(e.etat).toBe("a_vendre");
    expect(e.moisSansPort).toBe(14);
  });

  it("c'est le DERNIER port qui compte, pas le premier", () => {
    const h = [porte(t(2024, 7, 1)), porte(t(2026, 6, 1))];
    expect(etatDePort(piece("Printemps / Été", t(2024, 1, 1)), h, NOW).etat).toBe("recente");
  });

  it("une suggestion portée il y a longtemps peut être délaissée, jamais à vendre", () => {
    expect(etatDePort(piece("Printemps / Été"), [porte(t(2025, 7, 1))], NOW).etat).toBe("delaissee");
  });

  it("l'historique des autres pièces n'est pas lu", () => {
    const e = etatDePort(piece("Printemps / Été", t(2026, 9, 1)), [porte(t(2026, 9, 20), 2)], NOW);
    expect(e.etat).toBe("jamais");
  });
});

describe("moisAnnee", () => {
  it("mois en toutes lettres et année", () => {
    expect(moisAnnee(t(2025, 10, 5))).toBe("octobre 2025");
  });
});

describe("capsuleJournal — une seule base pour les chiffres du Journal", () => {
  const pool = [piece("Toutes saisons", undefined, 1), piece("Toutes saisons", undefined, 2), piece("Toutes saisons", undefined, 3)];

  it("portées + jamais = total, et le pourcentage en découle", () => {
    const c = capsuleJournal(pool, [porte(t(2026, 9, 20), 1), porte(t(2026, 9, 21), 1)]);
    expect(c).toEqual({ total: 3, portees: 1, jamais: 2, pourcentage: 33 });
  });

  it("une pièce portée plusieurs fois ne compte qu'une fois", () => {
    const h = [porte(t(2026, 9, 20), 2), porte(t(2026, 9, 21), 2), porte(t(2026, 9, 22), 2)];
    expect(capsuleJournal(pool, h).portees).toBe(1);
  });

  it("les suggestions de la capsule comptent comme les pièces réelles — c'est ce qui manquait", () => {
    // Aucune date d'ajout ni champ worn : ce sont des suggestions, portées.
    const h = [porte(t(2026, 9, 20), 1), porte(t(2026, 9, 20), 3)];
    expect(capsuleJournal(pool, h)).toMatchObject({ portees: 2, jamais: 1 });
  });

  it("une pièce de l'historique sortie du pool n'est pas comptée dans la capsule", () => {
    expect(capsuleJournal(pool, [porte(t(2026, 9, 20), 99)])).toMatchObject({ portees: 0, jamais: 3 });
  });

  it("pool vide : pas de division par zéro", () => {
    expect(capsuleJournal([], [])).toEqual({ total: 0, portees: 0, jamais: 0, pourcentage: 0 });
  });
});
