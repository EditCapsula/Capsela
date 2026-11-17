import { describe, expect, it } from "vitest";
import { messagePortee, pieceDeRetour, porteeLe, SEUIL_RETOUR_JOURS } from "../retourPiece";

const J = 86_400_000;
const maintenant = new Date(2026, 10, 17, 10, 0).getTime();
const pantalon = { id: 1, name: "Pantalon droit" };
const chemise = { id: 2, name: "Chemise blanche" };

describe("pièce de retour", () => {
  it("la pièce au plus ancien dernier port, au-delà du seuil", () => {
    const h = [
      { ts: maintenant - 44 * J, pieceIds: [1, 2] },
      { ts: maintenant - 20 * J, pieceIds: [2] },
    ];
    expect(pieceDeRetour([pantalon, chemise], h, maintenant)).toEqual({ piece: pantalon, jours: 44 });
  });
  it("sous le seuil, rien", () => {
    expect(pieceDeRetour([pantalon], [{ ts: maintenant - (SEUIL_RETOUR_JOURS - 1) * J, pieceIds: [1] }], maintenant)).toBeNull();
  });
  it("une pièce jamais portée n'est pas « de retour »", () => {
    expect(pieceDeRetour([pantalon], [], maintenant)).toBeNull();
  });
  it("le port d'aujourd'hui (la tenue qu'on vient de porter) ne compte pas", () => {
    const h = [
      { ts: maintenant - 1000, pieceIds: [1] },
      { ts: maintenant - 30 * J, pieceIds: [1] },
    ];
    expect(pieceDeRetour([pantalon], h, maintenant)?.jours).toBe(30);
  });
  it("le message", () => {
    expect(messagePortee({ piece: pantalon, jours: 44 })).toBe("Pantalon droit : de retour après 44 jours. Tenue ajoutée à ton journal.");
    expect(messagePortee(null)).toBe("Tenue ajoutée à ton journal.");
  });
});

describe("tenue portée aujourd'hui", () => {
  it("la dernière entrée du jour, rien la veille", () => {
    const a = { ts: maintenant - 2 * 3600_000 };
    const b = { ts: maintenant - 3600_000 };
    expect(porteeLe([a, b, { ts: maintenant - J }], maintenant)).toBe(b);
    expect(porteeLe([{ ts: maintenant - J }], maintenant)).toBeNull();
  });
});
